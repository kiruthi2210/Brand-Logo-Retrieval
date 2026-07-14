import os, sqlite3, pickle, random, multiprocessing as mp
import numpy as np
import cv2
import easyocr
import open_clip
import torch
import faiss
from PIL import Image

DATASET_DIR  = "../dataset/food"
DB_PATH      = "../data/logos.db"
FAISS_PATH   = "../data/faiss_index.bin"
META_PATH    = "../data/faiss_meta.pkl"
ORB_PATH     = "../data/orb_refs.pkl"

IMAGES_PER_BRAND = 25
BATCH_SIZE       = 64
NUM_WORKERS      = max(1, mp.cpu_count() - 1)

os.makedirs("../data", exist_ok=True)

# ── Image enhancement ────────────────────────────────────────────────────
def enhance(img):
    if img is None:
        return None
    h, w = img.shape[:2]
    if h < 128 or w < 128:
        img = cv2.resize(img, (224, 224), interpolation=cv2.INTER_CUBIC)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    img = cv2.cvtColor(cv2.merge([clahe.apply(l), a, b]), cv2.COLOR_LAB2BGR)
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    return cv2.filter2D(img, -1, kernel)

# ── OCR worker (runs in subprocess) ──────────────────────────────────────
def ocr_worker(paths):
    reader = easyocr.Reader(["en"], gpu=False, verbose=False)
    results = {}
    for path in paths:
        try:
            img = enhance(cv2.imread(path))
            if img is None:
                results[path] = ""
                continue
            texts = []
            # Multi-angle OCR — catches rotated text
            h, w = img.shape[:2]
            cx, cy = w // 2, h // 2
            for angle in [0, 90, 180, 270]:
                M = cv2.getRotationMatrix2D((cx, cy), angle, 1)
                rot = cv2.warpAffine(img, M, (w, h))
                t = reader.readtext(rot, detail=0)
                texts.extend(t)
            results[path] = " ".join(set(texts)).lower()
        except:
            results[path] = ""
    return results

# ── CLIP batch embedding ──────────────────────────────────────────────────
def clip_batch(paths, model, preprocess, device):
    batch, valid = [], []
    for p in paths:
        try:
            img = enhance(cv2.imread(p))
            if img is None:
                raise ValueError
            pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
            batch.append(preprocess(pil))
            valid.append(p)
        except:
            pass
    if not batch:
        return valid, np.zeros((0, 512), dtype="float32")
    with torch.no_grad():
        embs = model.encode_image(
            torch.stack(batch).to(device)
        ).cpu().numpy().astype("float32")
    return valid, embs

# ── ORB reference keypoints ───────────────────────────────────────────────
def build_orb_refs(brand, paths, orb):
    refs = []
    for p in paths[:5]:
        img = cv2.imread(p, cv2.IMREAD_GRAYSCALE)
        if img is None:
            continue
        img = cv2.resize(img, (224, 224))
        kp, des = orb.detectAndCompute(img, None)
        if des is not None and len(kp) > 10:
            refs.append({"path": p, "des": des})
    return refs

# ── Main ──────────────────────────────────────────────────────────────────
def main():
    print("Loading CLIP…")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model, _, preprocess = open_clip.create_model_and_transforms(
        "ViT-B-32", pretrained="openai")
    model = model.to(device).eval()

    print(f"Device: {device}  |  Workers: {NUM_WORKERS}")

    # DB setup
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS images (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            path    TEXT UNIQUE,
            brand   TEXT,
            ocr_text TEXT,
            faiss_id INTEGER
        )""")
    con.commit()
    cur.execute("SELECT path FROM images")
    already = set(r[0] for r in cur.fetchall())
    print(f"Already indexed: {len(already)}")

    # Collect files — equal distribution
    brands = [b for b in os.listdir(DATASET_DIR)
              if os.path.isdir(os.path.join(DATASET_DIR, b))]
    all_files = []
    for brand in brands:
        bp = os.path.join(DATASET_DIR, brand)
        files = [os.path.join(bp, f) for f in os.listdir(bp)
                 if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
                 and os.path.join(bp, f) not in already]
        random.shuffle(files)
        all_files.extend([(f, brand.lower()) for f in files[:IMAGES_PER_BRAND]])

    print(f"To process: {len(all_files)}")
    if not all_files:
        print("Nothing new.")
        con.close()
        return

    paths_only    = [f for f, _ in all_files]
    path_to_brand = dict(all_files)

    # ── Parallel OCR ─────────────────────────────────────────────────────
    print(f"\nOCR — {NUM_WORKERS} parallel workers…")
    chunk_size = max(1, len(paths_only) // NUM_WORKERS)
    chunks = [paths_only[i:i + chunk_size]
              for i in range(0, len(paths_only), chunk_size)]

    with mp.Pool(processes=NUM_WORKERS) as pool:
        results = pool.map(ocr_worker, chunks)

    ocr_results = {}
    for r in results:
        ocr_results.update(r)
    print(f"OCR done — {len(ocr_results)} images")

    # ── CLIP batched ──────────────────────────────────────────────────────
    print("\nCLIP embeddings…")
    embeddings, meta = [], []

    if os.path.exists(FAISS_PATH) and os.path.exists(META_PATH):
        print("Resuming existing FAISS index…")
        index = faiss.read_index(FAISS_PATH)
        with open(META_PATH, "rb") as f:
            meta = pickle.load(f)
        faiss_id = len(meta)
    else:
        index    = faiss.IndexFlatIP(512)
        faiss_id = 0

    total_added = 0
    rows = []
    for i in range(0, len(paths_only), BATCH_SIZE):
        vp, embs = clip_batch(paths_only[i:i + BATCH_SIZE], model, preprocess, device)
        for j, path in enumerate(vp):
            brand = path_to_brand[path]
            ocr   = ocr_results.get(path, "")
            rows.append((path, brand, ocr, faiss_id + j))
            meta.append({"path": path, "brand": brand, "faiss_id": faiss_id + j})
            embeddings.append(embs[j])
        faiss_id    += len(vp)
        total_added += len(vp)
        if total_added % 500 == 0:
            print(f"  CLIP {total_added}/{len(paths_only)}")

    cur.executemany(
        "INSERT OR IGNORE INTO images (path,brand,ocr_text,faiss_id) VALUES (?,?,?,?)",
        rows)
    con.commit()
    con.close()

    if embeddings:
        matrix = np.array(embeddings, dtype="float32")
        faiss.normalize_L2(matrix)
        index.add(matrix)

    faiss.write_index(index, FAISS_PATH)
    with open(META_PATH, "wb") as f:
        pickle.dump(meta, f)

    # ── ORB reference keypoints ───────────────────────────────────────────
    print("\nBuilding ORB reference keypoints…")
    orb = cv2.ORB_create(nfeatures=500)
    orb_refs = {}
    if os.path.exists(ORB_PATH):
        with open(ORB_PATH, "rb") as f:
            orb_refs = pickle.load(f)

    for brand in brands:
        if brand.lower() in orb_refs:
            continue
        bp = os.path.join(DATASET_DIR, brand)
        files = [os.path.join(bp, f) for f in os.listdir(bp)
                 if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))][:5]
        refs = build_orb_refs(brand.lower(), files, orb)
        if refs:
            orb_refs[brand.lower()] = refs

    with open(ORB_PATH, "wb") as f:
        pickle.dump(orb_refs, f)

    print(f"\nDone. Added {total_added} images. Total indexed: {len(meta)}")
    print(f"ORB refs built for {len(orb_refs)} brands")

if __name__ == "__main__":
    mp.freeze_support()
    main()

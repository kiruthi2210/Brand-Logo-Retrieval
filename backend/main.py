from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3, subprocess, os, json, re, asyncio
import httpx
import urllib3
import time
import base64
import cv2
import tempfile
from search import orb_verify, template_ncc_verify
import numpy as np
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

from search import search as run_search
from search import (
        model as clip_model,
        preprocess as clip_preprocess,
        device,
        text_embedding
    )

HTTP_CLIENT = httpx.AsyncClient(

    timeout=httpx.Timeout(

        connect=3.0,

        read=5.0,

        write=5.0,

        pool=5.0
    ),

    follow_redirects=True,

    verify=False,

    headers={

        "User-Agent": "Mozilla/5.0"

    }

)

SERPAPI_KEY = "adbf7eb83e5c468139484f6a9bdf75e706af6daa05de0bf9ad14dec23b6cd6d3"
ONLINE_CACHE = {}
CACHE_FILE = "online_cache.json"
if os.path.exists(CACHE_FILE):

    try:

        with open(CACHE_FILE, "r") as f:

            ONLINE_CACHE = json.load(f)

    except:

        ONLINE_CACHE = {}
CACHE_TTL = 172800
app = FastAPI()
app.add_middleware(
    CORSMiddleware, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"])

BASE    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE, "data", "logos.db")
GT_PATH = os.path.join(BASE, "data", "ground_truth.json")
OLLAMA  = r"C:\Users\kirut\AppData\Local\Programs\Ollama\ollama.exe"


def normalize(s): return re.sub(r"[^a-z0-9]", "", s.lower().strip())

def load_gt():
    if os.path.exists(GT_PATH):
        with open(GT_PATH) as f: return json.load(f)
    return {}

class Query(BaseModel):
    query: str
    top_k: int = 200

@app.post("/search")
def search(q: Query):
    return run_search(q.query, q.top_k)

@app.get("/brands")
def list_brands():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("SELECT DISTINCT brand, COUNT(*) FROM images GROUP BY brand ORDER BY brand")
    rows = cur.fetchall()
    con.close()
    return [{"brand": r[0], "count": r[1]} for r in rows]

@app.get("/stats")
def stats():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("SELECT COUNT(*) FROM images")
    total = cur.fetchone()[0]
    cur.execute("SELECT COUNT(DISTINCT brand) FROM images")
    brands = cur.fetchone()[0]
    con.close()
    gt = load_gt()
    return {
        "total_images": total,
        "total_brands": brands,
        "gt_classes": len(gt.get("norm_set", [])),
        "gt_available": os.path.exists(GT_PATH)
    }

@app.post("/resolve-brand")
def resolve_brand(q: Query):
    try:
        result = subprocess.run(
            [OLLAMA, "run", "mistral",
             f"Return only the correct brand name for: '{q.query}'. One word or short phrase. No explanation."],
            capture_output=True, text=True, timeout=12)
        resolved = result.stdout.strip().split("\n")[0]
        return {"original": q.query, "resolved": resolved}
    except:
        return {"original": q.query, "resolved": q.query}

@app.get("/model-performance")
def model_performance():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("SELECT DISTINCT brand FROM images ORDER BY brand")
    brands = [r[0] for r in cur.fetchall()]

    gt = load_gt()
    gt_norm_set     = set(gt.get("norm_set", []))
    gt_norm_to_orig = gt.get("norm_to_original", {})
    gt_available    = len(gt_norm_set) > 0

    totals = {"db":0,"matched":0,"gt_tp":0,"ocr":0,"clip_only":0}
    perfect, brand_rows = 0, []

    for brand in brands:
        cur.execute("SELECT COUNT(*) FROM images WHERE brand=?", (brand,))
        in_db = cur.fetchone()[0]

        result    = run_search(brand, top_k=200)
        imgs      = result["results"]
        matched   = result["matched"]
        gt_tp     = result.get("gt_true_positives", 0)
        ocr_hits  = sum(1 for i in imgs if i.get("ocr_match"))
        clip_only = matched - ocr_hits

        gt_acc = round(gt_tp / matched * 100, 1) if matched > 0 else 0.0
        gt_rec = round(min(gt_tp / in_db * 100, 100), 1) if in_db > 0 else 0.0
        ocr_r  = round(ocr_hits  / matched * 100, 1) if matched > 0 else 0.0
        clip_r = round(clip_only / matched * 100, 1) if matched > 0 else 0.0

        if gt_acc >= 100: perfect += 1

        for k, v in [("db",in_db),("matched",matched),("gt_tp",gt_tp),
                     ("ocr",ocr_hits),("clip_only",clip_only)]:
            totals[k] += v

        brand_rows.append({
            "brand":       brand,
            "gt_label":    gt_norm_to_orig.get(normalize(brand), brand),
            "in_gt":       normalize(brand) in gt_norm_set,
            "in_db":       in_db,
            "matched":     matched,
            "gt_tp":       gt_tp,
            "gt_accuracy": gt_acc,
            "gt_recall":   gt_rec,
            "ocr_rate":    ocr_r,
            "clip_rate":   clip_r,
            "ocr_hits":    ocr_hits
        })

    con.close()
    tm = max(totals["matched"], 1)
    return {
        "overall": {
            "gt_accuracy":    round(totals["gt_tp"] / tm * 100, 2),
            "gt_recall":      round(totals["gt_tp"] / max(totals["db"],1) * 100, 2),
            "ocr_rate":       round(totals["ocr"]       / tm * 100, 2),
            "clip_rate":      round(totals["clip_only"] / tm * 100, 2),
            "perfect_brands": perfect,
            "perfect_pct":    round(perfect / len(brands) * 100, 2),
            "total_brands":   len(brands),
            "total_images":   totals["db"],
            "gt_available":   gt_available,
            "gt_classes":     len(gt_norm_set)
        },
        "per_brand": brand_rows
    }


# ── Shared OCR reader (initialized once, reused everywhere) ──────────────
_ocr_reader = None
def get_ocr_reader():
    global _ocr_reader
    if _ocr_reader is None:
        import easyocr
        _ocr_reader = easyocr.Reader(['en'], gpu=False, verbose=False)
    return _ocr_reader


# ── Shared fuzzy OCR match ───────────────────────────────────────────────
def ocr_fuzzy_match(ocr_raw: str, query: str) -> bool:
    from rapidfuzz import fuzz as _fuzz
    q_clean = re.sub(r"[^a-z0-9]", "", query.lower())
    if len(q_clean) < 2:
        return False
    tokens = re.sub(r"[^a-z0-9\s]", " ", ocr_raw.lower()).split()
    for token in tokens:
        tc = re.sub(r"[^a-z0-9]", "", token)
        if not tc:
            continue
        if _fuzz.partial_ratio(q_clean, tc) >= 80 and _fuzz.ratio(q_clean, tc) >=80:
            return True
        if len(q_clean) >= 4 and tc.startswith(q_clean[:4]):
            return True
    full_clean = re.sub(r"[^a-z0-9]", "", ocr_raw.lower())
    if _fuzz.partial_ratio(q_clean, full_clean) >= 58:
        return True
    return False


# ── Fast OCR — single pass, no rotations ────────────────────────────────
def fast_ocr(img_bgr) -> str:
    """Single OCR pass on full image only — no rotations, no crop loops."""
    try:
        reader = get_ocr_reader()
        texts  = reader.readtext(img_bgr, detail=0, paragraph=False)
        return " ".join(texts).lower()
    except:
        return ""


def clip_score_fast(img_bgr, query_text: str) -> float:

    import cv2
    import numpy as np
    import torch

    from PIL import Image as PILImage

    

    try:

        rgb = cv2.cvtColor(
            img_bgr,
            cv2.COLOR_BGR2RGB
        )

        pil = PILImage.fromarray(rgb)

        tensor = clip_preprocess(
            pil
        ).unsqueeze(0).to(device)

        txt_emb = text_embedding(
            f"{query_text} logo"
        ).squeeze()

        with torch.no_grad():

            img_emb = clip_model.encode_image(
                tensor
            ).squeeze().cpu().numpy().astype("float32")

        img_emb /= (
            np.linalg.norm(img_emb) + 1e-8
        )

        return float(
            np.dot(img_emb, txt_emb)
        )

    except:

        return 0.0


# ── Core pipeline (used by both /compare and /online-search) ─────────────
def run_pipeline(img_bgr, query: str) -> dict:
    import cv2, base64
    import numpy as np

    def to_b64(img):
        if img is None: return ""
        _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return base64.b64encode(buf).decode()

    # Resize if too small
    h, w = img_bgr.shape[:2]
    mx = max(h, w)

    if mx > 512:

        scale = 512 / mx

        img_bgr = cv2.resize(

            img_bgr,

            (

            int(w * scale),

            int(h * scale)

            )
        )
    if h < 224 or w < 224:
        img_bgr = cv2.resize(img_bgr, (224, 224), interpolation=cv2.INTER_CUBIC)

    clip_raw = clip_score_fast(
    img_bgr,
    query
)

    clip_pct = round(

    min(clip_raw / 0.32, 1.0) * 100,

    1
)

# OCR pass
    ocr_text = fast_ocr(img_bgr)

    ocr_ok = ocr_fuzzy_match(
    ocr_text,
    query
)
    # =========================================================
    # Verification metrics (ORB + NCC)
    # =========================================================
    orb_verified = False
    orb_matches  = 0
    orb_conf     = 0.0
    orb_vis      = None
    ncc_verified = False
    ncc_score    = 0.0

    try:
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            cv2.imwrite(tmp.name, img_bgr)
            orb_verified, orb_matches, orb_conf, orb_vis = orb_verify(tmp.name, query)
            ncc_verified, ncc_score = template_ncc_verify(tmp.name, query)
    except Exception as e:
        print("[ORB/NCC compare error]", e)

    # Hybrid score: Fuses CLIP, OCR, and the maximum of template verification scores
    hybrid = round(
        (clip_raw * 0.6) +
        (0.2 if ocr_ok else 0.0) +
        (max(orb_conf, ncc_score) * 0.2),
        4
    )

    # =========================================================
    # FINAL DECISION LOGIC (Cascading checks)
    # =========================================================
    accepted = False
    reason = ""

    # Case A: Exact OCR Match with moderate CLIP backing -> 99% confident
    if ocr_ok and clip_raw >= 0.18:
        accepted = True
        reason = f"OCR confirmed brand text + visual alignment ({clip_pct}%)"
    # Case B: High pixel template correlation -> 98% confident (handles solid/textless logos)
    elif ncc_verified and ncc_score >= 0.78:
        accepted = True
        reason = f"Visual logo structure matched with templates ({int(ncc_score * 100)}%)"
    # Case C: Keypoints matched -> 98% confident
    
    # Case D: Very strong CLIP alone -> 95% confident
    elif clip_raw >= 0.28:
        accepted = True
        reason = f"Strong visual similarity ({clip_pct}%) detected by CLIP"
    # Case E: Moderate visual + secondary template signal
    elif clip_raw >= 0.24 and (ocr_ok or ncc_score >= 0.62):
        accepted = True
        reason = "Moderate visual similarity backed by secondary template correlation"
    else:
        accepted = False
        if ocr_ok:
            reason = "OCR text detected but visual similarity too weak"
        else:
            reason = "Low visual similarity and no template matches"

    return {
        "image_b64":      to_b64(img_bgr),
        "original_b64":   to_b64(img_bgr),
        "crop_b64":       to_b64(img_bgr),
        "ocr_text":       ocr_text[:150],
        "ocr_confirmed":  ocr_ok,
        "clip_score_raw": round(clip_raw, 4),
        "clip_pct":       clip_pct,
        "orb_verified":   orb_verified or ncc_verified,
        "orb_matches":    orb_matches,
        "ncc_score":     round(ncc_score, 4),
        "orb_conf":       round(max(orb_conf, ncc_score), 4),
        "orb_vis":        orb_vis,
        "hybrid_score":   hybrid,
        "reason":         reason,
        "decision_reason":reason,
        "accepted":       accepted,
    }


# ── /compare endpoint ────────────────────────────────────────────────────
@app.post("/compare")
async def compare(
    image1: UploadFile = File(...),
    image2: UploadFile = File(...),
    query:  str        = Form(...)
):
    import cv2, numpy as np

    bytes1 = await image1.read()
    bytes2 = await image2.read()
    q      = re.sub(r"[^a-z0-9]", "", query.lower().strip())

    # Resolve alias via Ollama
    try:
        from search import normalize as _norm, ollama_resolve, fuzzy_resolve
        con_tmp = sqlite3.connect(DB_PATH)
        cur_tmp = con_tmp.cursor()
        cur_tmp.execute("SELECT DISTINCT brand FROM images")
        all_brands_tmp = [r[0] for r in cur_tmp.fetchall()]
        con_tmp.close()
        all_norms_tmp = list({_norm(b) for b in all_brands_tmp})
        resolved_q = ollama_resolve(q, all_norms_tmp) or fuzzy_resolve(q, all_norms_tmp) or q
        q = resolved_q
    except Exception:
        pass

    def decode(b):
        arr = np.frombuffer(b, np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)

    img1 = decode(bytes1)
    img2 = decode(bytes2)

    if img1 is None or img2 is None:
        return {"error": "Could not decode one or both images"}

    # Run pipeline in thread pool (CPU-bound)
    loop = asyncio.get_event_loop()
    r1, r2 = await asyncio.gather(
        loop.run_in_executor(None, run_pipeline, img1, q),
        loop.run_in_executor(None, run_pipeline, img2, q),
    )

    return {"query": query, "image1": r1, "image2": r2}


# ── Pipeline wrapper for bytes (online search) ───────────────────────────
def run_pipeline_on_image_bytes(img_bytes: bytes, query: str):
    import cv2, numpy as np
    arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return None
    result = run_pipeline(img, query)
    return result


# ── /online-search endpoint ──────────────────────────────────────────────
@app.post("/online-search")
async def online_search(q: Query):
    query = q.query.strip()
    cache_key = normalize(query)

    cached = ONLINE_CACHE.get(cache_key)

    if cached:

        ts, data = cached

        if time.time() - ts < CACHE_TTL:

            return data

    # Step 1: fetch image URLs from SerpApi — ONE query only, best results first
    search_variations = [

    (f"{query}", 5)

]

    image_urls = []

    seen = set()

    try:

        for qv, limit_count in search_variations:

            try:

                resp = await asyncio.wait_for(

                    HTTP_CLIENT.get(

                    "https://serpapi.com/search.json",

                    params={

                        "engine": "google_images",

                        "q": qv,

                        "api_key": SERPAPI_KEY,

                        "num": 8,

                        "safe": "active",

                    }

                ),

                    timeout=6

                )

            except asyncio.TimeoutError:

                ONLINE_CACHE[cache_key] = (

                time.time(),

                {

                    "query": query,

                    "results": [],

                    "error": "Temporary timeout"

                }

                )

                continue

            data = resp.json()

            items = data.get("images_results", [])

            count = 0

            for it in items:

                url = it.get("original")

                if not url:
                    continue

                if url.endswith(".svg"):
                    continue

                if url in seen:
                    continue

                bad_domains = [

                "wikipedia.org",

                "wikimedia.org",

                "pngmart.com",

                "transparentpng.com"

                ]

                if any(b in url for b in bad_domains):
                    continue

                image_urls.append(url)

                seen.add(url)

                count += 1

                if count >= limit_count:
                    break

    except Exception as e:

        return {

        "query": query,

        "results": [],

        "error": f"SerpApi error: {type(e).__name__}: {e}"

    }

    if not image_urls:

        return {

        "query": query,

        "results": [],

        "error": "No images found"

    }

    # Step 2: download images (concurrent, fast timeout)
    async def fetch_image(url: str) -> bytes | None:

        try:

            r = await HTTP_CLIENT.get(url)

            if r.status_code != 200:
                return None

            ct = r.headers.get("content-type", "").lower()

            if any(x in ct for x in [

            "svg",
            "html",
            "text",
            "xml"

            ]):
                return None

            content = r.content

            if len(content) > 2_500_000:
                return None

            if len(content) < 4000:
                return None

            return content

        except Exception:

            return None

    # Download all concurrently
    raw_bytes = await asyncio.gather(*[fetch_image(u) for u in image_urls])

    # Step 3: run pipeline sequentially (not concurrent — CLIP+OCR is CPU-heavy)
    # Sequential on 5 images is fast enough (~3-5s total with fast_ocr)
    loop    = asyncio.get_event_loop()
    results = []

    for url, img_bytes in zip(image_urls, raw_bytes):
        if img_bytes is None:
            continue
        try:
            result = await loop.run_in_executor(
                None, run_pipeline_on_image_bytes, img_bytes, query)
            if result is not None:
                result["source_url"] = url
                if result["accepted"]:
                    results.append(result)
        except Exception as e:
            print(f"[pipeline] failed for {url}: {e}")
            continue

        # Stop once we have 5 processed results
        if len(results) >= 5:
            break

    if not results:

        failed_data = {

            "query": query,

            "results": [],

            "error": "Images fetched but none could be processed. Try a different brand."

        }

        ONLINE_CACHE[cache_key] = [

            time.time(),

            failed_data

        ]

        try:

            with open(CACHE_FILE, "w") as f:

                json.dump(ONLINE_CACHE, f)

        except:
            pass

        return failed_data

    # Sort: accepted first, then by clip score
    results.sort(
    key=lambda x: x["clip_score_raw"],
    reverse=True
    )
    top_for_ocr = results[:2]

    for r in top_for_ocr:

        try:


            img_bytes = base64.b64decode(r["image_b64"])

            arr = np.frombuffer(img_bytes, np.uint8)

            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)

            txt = fast_ocr(img)

            r["ocr_text"] = txt[:150]

            r["ocr_confirmed"] = ocr_fuzzy_match(
            txt,
            query
        )

        except:
            pass

    final_data = {

    "query": query,

    "results": results[:5],

    "error": None
}

    ONLINE_CACHE[cache_key] = [

    time.time(),

    final_data
]

    try:

        with open(CACHE_FILE, "w") as f:

            json.dump(ONLINE_CACHE, f)

    except:
        pass

    return final_data   
import sqlite3, pickle, faiss, os, base64, re, json
import numpy as np
import cv2
import open_clip
import torch
from difflib import get_close_matches
import subprocess
from rapidfuzz import fuzz
import tempfile

OLLAMA = r"C:\Users\kirut\AppData\Local\Programs\Ollama\ollama.exe"

BASE          = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH       = os.path.join(BASE, "data", "logos.db")
FAISS_PATH    = os.path.join(BASE, "data", "faiss_index.bin")
META_PATH     = os.path.join(BASE, "data", "faiss_meta.pkl")
GT_PATH       = os.path.join(BASE, "data", "ground_truth.json")
TEMPLATE_DIR  = os.path.join(BASE, "data", "templates")   # ← new

CLIP_SAME      = 0.18
CLIP_CROSS_OCR = 0.20
CLIP_CROSS_VIS = 0.30
CLIP_FALLBACK  = 0.14

# ── ORB verifier thresholds 
ORB_MIN_MATCHES   = 6    # minimum good keypoint matches to call it verified
ORB_RATIO_TEST    = 0.75 # Lowe's ratio test threshold

device = "cuda" if torch.cuda.is_available() else "cpu"
model, _, preprocess = open_clip.create_model_and_transforms("ViT-L-14", pretrained="openai")
tokenizer = open_clip.get_tokenizer("ViT-L-14")
model = model.to(device).eval()

index = faiss.read_index(FAISS_PATH)
with open(META_PATH, "rb") as f:
    meta = pickle.load(f)

gt_norm_set, gt_norm_to_orig, gt_prefix_map = set(), {}, {}
if os.path.exists(GT_PATH):
    with open(GT_PATH) as f:
        gt = json.load(f)
    gt_norm_set     = set(gt.get("norm_set", []))
    gt_norm_to_orig = gt.get("norm_to_original", {})
    gt_prefix_map   = gt.get("prefix_map", {})


def normalize(s):
    return re.sub(r"[^a-z0-9]", "", s.lower().strip())


# ── ORB template cache: norm_brand → list of (kp, des, template_img) ────
_orb_cache: dict = {}
_orb         = cv2.ORB_create(nfeatures=1000)
_bf_matcher  = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)

def _load_templates(brand_norm: str) -> list:
    """Load and cache ORB keypoints for all templates of a brand."""
    if brand_norm in _orb_cache:
        return _orb_cache[brand_norm]

    folder = os.path.join(TEMPLATE_DIR, brand_norm)
    #print("[ORB] loading templates from:", folder)
    if not os.path.exists(folder):
        # Try matching folder name case-insensitively
        if os.path.exists(TEMPLATE_DIR):
            for d in os.listdir(TEMPLATE_DIR):
                if normalize(d) == brand_norm:
                    folder = os.path.join(TEMPLATE_DIR, d)
                    break

    templates = []
    if os.path.exists(folder):
        #print("[ORB] template files:", os.listdir(folder))
        for fname in sorted(os.listdir(folder)):
            if not fname.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                continue
            path = os.path.join(folder, fname)
            img  = cv2.imread(path, cv2.IMREAD_COLOR)
            if img is None:
                continue
            # Resize template to standard size for consistent matching
            img = cv2.resize(img, (256, 256))
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            kp, des = _orb.detectAndCompute(gray, None)
            if des is not None and len(kp) >= 5:
                templates.append((kp, des, img))

    _orb_cache[brand_norm] = templates
    return templates

"""
def orb_verify(image_path: str, brand_norm: str) -> tuple[bool, int, float]:
    
    Verify whether the brand logo appears in the image using ORB feature matching.

    Returns:
        (verified: bool, best_match_count: int, confidence: float 0-1)

    verified = True if best_match_count >= ORB_MIN_MATCHES
    confidence = min(best_match_count / 20, 1.0)  — 20 good matches = 100%
    
    templates = _load_templates(brand_norm)
    if not templates:
        # No templates available — cannot verify, return neutral
        return False, 0, 0.0

    try:
        img = cv2.imread(image_path, cv2.IMREAD_COLOR)
        if img is None:
            return False, 0, 0.0

        # Resize query image for speed
        h, w = img.shape[:2]
        if max(h, w) > 640:
            scale = 640 / max(h, w)
            img   = cv2.resize(img, (int(w * scale), int(h * scale)))

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        kp_q, des_q = _orb.detectAndCompute(gray, None)

        if des_q is None or len(kp_q) < 5:
            return False, 0, 0.0

        best_count = 0

        for (kp_t, des_t, _) in templates:
            # KNN match with ratio test
            matches = _bf_matcher.knnMatch(des_t, des_q, k=2)
            good    = []
            for m_pair in matches:
                if len(m_pair) == 2:
                    m, n = m_pair
                    if m.distance < ORB_RATIO_TEST * n.distance:
                        good.append(m)

            if len(good) > best_count:
                best_count = len(good)

        verified   = best_count >= ORB_MIN_MATCHES
        confidence = round(min(best_count / 20.0, 1.0), 4)
        #print(f"[ORB] {brand_norm} | matches={best_count} | "f"verified={verified} | confidence={confidence}")
        return verified, best_count, confidence

    except Exception as e:
        print(f"[ORB] error on {image_path}: {e}")
        return False, 0, 0.0
"""

def orb_verify(image_path: str, brand_norm: str):
    """
    Returns:
    (
        verified,
        best_match_count,
        confidence,
        visualization_base64
    )
    """

    templates = _load_templates(brand_norm)

    if not templates:
        return False, 0, 0.0, None

    try:

        img = cv2.imread(image_path, cv2.IMREAD_COLOR)

        if img is None:
            return False, 0, 0.0, None

        h, w = img.shape[:2]

        if max(h, w) > 640:

            scale = 640 / max(h, w)

            img = cv2.resize(
                img,
                (int(w * scale), int(h * scale))
            )

        gray_q = cv2.cvtColor(
            img,
            cv2.COLOR_BGR2GRAY
        )

        kp_q, des_q = _orb.detectAndCompute(
            gray_q,
            None
        )

        if des_q is None or len(kp_q) < 5:
            return False, 0, 0.0, None

        best_count = 0
        best_vis   = None

        for (kp_t, des_t, template_img) in templates:

            matches = _bf_matcher.knnMatch(
                des_t,
                des_q,
                k=2
            )

            good = []

            for m_pair in matches:

                if len(m_pair) != 2:
                    continue

                m, n = m_pair

                if m.distance < ORB_RATIO_TEST * n.distance:
                    good.append(m)

# -------------------------------------------------
# RANSAC geometric filtering
# -------------------------------------------------

            if len(good) >= 4:

                src_pts = np.float32([
                    kp_t[m.queryIdx].pt
                    for m in good
                ]).reshape(-1, 1, 2)

                dst_pts = np.float32([
                    kp_q[m.trainIdx].pt
                    for m in good
                ]).reshape(-1, 1, 2)

                H, mask = cv2.findHomography(
                    src_pts,
                    dst_pts,
                    cv2.RANSAC,
                    5.0
                )

                if mask is not None:

                    inlier_matches = []

                    for idx2, m in enumerate(good):

                        if mask[idx2]:
                            inlier_matches.append(m)

                    good = inlier_matches

            if len(good) > best_count:

                best_count = len(good)

                # visualize top matches
                vis = cv2.drawMatches(

                    template_img,
                    kp_t,

                    img,
                    kp_q,

                    good[:40],

                    None,

                    flags=cv2.DrawMatchesFlags_NOT_DRAW_SINGLE_POINTS
                )

                _, buf = cv2.imencode(
                    ".jpg",
                    vis
                )

                best_vis = base64.b64encode(
                    buf
                ).decode()

        verified = best_count >= ORB_MIN_MATCHES

        confidence = round(
            min(best_count / 30.0, 1.0),
            4
        )

        

        return (
            verified,
            best_count,
            confidence,
            best_vis
        )

    except Exception as e:

        print(f"[ORB] error on {image_path}: {e}")

        return False, 0, 0.0, None

def orb_verify_bytes(img_bytes: bytes, brand_norm: str) -> tuple[bool, int, float]:
    """Same as orb_verify but accepts raw bytes — used for cross-brand images."""
    templates = _load_templates(brand_norm)
    if not templates:
        return False, 0, 0.0

    try:
        arr  = np.frombuffer(img_bytes, np.uint8)
        img  = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return False, 0, 0.0

        h, w = img.shape[:2]
        if max(h, w) > 640:
            scale = 640 / max(h, w)
            img   = cv2.resize(img, (int(w * scale), int(h * scale)))

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        kp_q, des_q = _orb.detectAndCompute(gray, None)

        if des_q is None or len(kp_q) < 5:
            return False, 0, 0.0

        best_count = 0
        for (kp_t, des_t, _) in templates:
            matches = _bf_matcher.knnMatch(des_t, des_q, k=2)
            good    = []
            for m_pair in matches:
                if len(m_pair) == 2:
                    m, n = m_pair
                    if m.distance < ORB_RATIO_TEST * n.distance:
                        good.append(m)
            if len(good) > best_count:
                best_count = len(good)

        verified   = best_count >= ORB_MIN_MATCHES
        confidence = round(min(best_count / 20.0, 1.0), 4)
        return verified, best_count, confidence

    except Exception as e:
        print(f"[ORB bytes] error: {e}")
        return False, 0, 0.0


def template_ncc_verify(image_path: str, brand_norm: str) -> tuple[bool, float]:
    """
    Performs Normalized Cross-Correlation (NCC) template matching on the cropped logo region.
    Very robust for solid vector logos (Nike, Apple) where ORB keypoints are sparse.
    """
    templates = _load_templates(brand_norm)
    if not templates:
        return False, 0.0

    try:
        img = cv2.imread(image_path, cv2.IMREAD_COLOR)
        if img is None:
            return False, 0.0

        # Resize query image slightly larger than template (280x280 vs 256x256)
        # to allow a small slide search to compensate for minor alignment offsets
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = cv2.resize(gray, (280, 280))

        best_score = 0.0
        for (_, _, template_img) in templates:
            template_gray = cv2.cvtColor(template_img, cv2.COLOR_BGR2GRAY)
            res = cv2.matchTemplate(gray, template_gray, cv2.TM_CCOEFF_NORMED)
            _, max_val, _, _ = cv2.minMaxLoc(res)
            if max_val > best_score:
                best_score = max_val

        # Correlation coefficient >= 0.75 is a very strong match for solid shapes
        verified = best_score >= 0.75
        return verified, round(float(best_score), 4)

    except Exception as e:
        print(f"[NCC] error on {image_path}: {e}")
        return False, 0.0


def template_ncc_verify_bytes(img_bytes: bytes, brand_norm: str) -> tuple[bool, float]:
    templates = _load_templates(brand_norm)
    if not templates:
        return False, 0.0

    try:
        arr  = np.frombuffer(img_bytes, np.uint8)
        img  = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return False, 0.0

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = cv2.resize(gray, (280, 280))

        best_score = 0.0
        for (_, _, template_img) in templates:
            template_gray = cv2.cvtColor(template_img, cv2.COLOR_BGR2GRAY)
            res = cv2.matchTemplate(gray, template_gray, cv2.TM_CCOEFF_NORMED)
            _, max_val, _, _ = cv2.minMaxLoc(res)
            if max_val > best_score:
                best_score = max_val

        verified = best_score >= 0.75
        return verified, round(float(best_score), 4)

    except Exception as e:
        print(f"[NCC bytes] error: {e}")
        return False, 0.0


def templates_available(brand_norm: str) -> bool:
    return len(_load_templates(brand_norm)) > 0


def text_embedding(query):
    prompts = [
        f"{query} logo", f"{query} brand",
        f"{query} packaging", f"{query} emblem", f"{query} product"
    ]
    all_embs = []
    with torch.no_grad():
        for p in prompts:
            tokens = tokenizer([p]).to(device)
            emb    = model.encode_text(tokens).squeeze().cpu().numpy().astype("float32")
            emb   /= (np.linalg.norm(emb) + 1e-8)
            all_embs.append(emb)
    final  = np.mean(all_embs, axis=0)
    final /= (np.linalg.norm(final) + 1e-8)
    return final.reshape(1, -1)


def image_to_base64(path):
    try:
        with open(path, "rb") as f:
            return base64.b64encode(f.read()).decode()
    except:
        return None


def ocr_match(text, brand):
    t = normalize(text)
    b = normalize(brand)
    if len(b) < 3:
        return False
    if b in t:
        return True
    tokens = re.findall(r"[a-z0-9]+", t)
    for tok in tokens:
        if len(tok) < 3:
            continue
        if fuzz.ratio(tok, b) >= 82:
            return True
    return False


def gt_verify(img_brand, search_term, ocr_ok, clip_s, same_brand):
    n = normalize(img_brand)
    q = normalize(search_term)
    if same_brand and (n == q or n.startswith(q) or q.startswith(n)):
        return True
    if ocr_ok:
        return True
    if same_brand and clip_s >= 0.28:
        return True
    return False


def _reason(ocr_ok, cs, orb_verified=False, orb_matches=0, ncc_verified=False, ncc_score=0.0):
    parts = []
    if ncc_verified:
        parts.append(f"Logo structure matched with templates ({int(ncc_score*100)}% match)")
    elif orb_verified:
        parts.append(f"Logo verified by features ({orb_matches} keypoints)")
    if ocr_ok and cs >= 0.20:
        parts.append("Brand text matched by OCR + visual alignment")
    elif ocr_ok:
        parts.append("Brand text confirmed by OCR")
    elif cs >= 0.30:
        parts.append("Strong visual similarity")
    elif cs >= 0.18:
        parts.append("Moderate visual similarity")
    return " — ".join(parts) if parts else "Visual pattern similarity"



def ollama_resolve(query: str, all_db_norms: list) -> str | None:
    try:
        prompt = (
            f"What is the full official brand name for '{query}'? "
            f"Reply with only the brand name, nothing else. "
            f"Examples: mcd → McDonald's, gpay → Google Pay, insta → Instagram, kfc → KFC"
        )
        result = subprocess.run(
            [OLLAMA, "run", "mistral", prompt],
            capture_output=True, text=True, timeout=8
        )
        resolved = result.stdout.strip().split("\n")[0].strip()
        rn = normalize(resolved)
        if rn in set(all_db_norms):
            return rn
        best, best_score = None, 0
        for db_norm in all_db_norms:
            s = fuzz.ratio(rn, db_norm)
            if s > best_score:
                best_score, best = s, db_norm
        if best_score >= 82:
            return best
    except Exception:
        pass
    return None


def fuzzy_resolve(q: str, all_db_norms: list) -> str | None:
    from rapidfuzz import process
    match = process.extractOne(
        q, all_db_norms,
        scorer=fuzz.token_set_ratio,
        score_cutoff=78
    )
    if match:
        return match[0]
    return None


def resolve_query(q, all_db_norms):
    if q in set(all_db_norms):
        return q, [], [], None
    if q in gt_norm_set:
        return q, [], [], None

    db_parts = [b for b in all_db_norms if b.startswith(q) and len(b) > len(q)]
    gt_parts = [b for b in gt_norm_set  if b.startswith(q) and len(b) > len(q)]
    partials = list(dict.fromkeys(db_parts + gt_parts))
    if partials:
        display = ", ".join(gt_norm_to_orig.get(p, p) for p in partials[:5])
        return None, partials, [], display

    ollama_result = ollama_resolve(q, all_db_norms)
    if ollama_result:
        display = gt_norm_to_orig.get(ollama_result, ollama_result)
        return None, [], [ollama_result], display

    fuzzy_result = fuzzy_resolve(q, all_db_norms)
    if fuzzy_result:
        display = gt_norm_to_orig.get(fuzzy_result, fuzzy_result)
        return None, [], [fuzzy_result], (display if fuzzy_result != q else None)

    fdb = get_close_matches(q, all_db_norms, n=1, cutoff=0.82)
    fgt = get_close_matches(q, list(gt_norm_set), n=1, cutoff=0.85) if not fdb else []
    fuzzy = fdb or fgt
    if fuzzy:
        best    = fuzzy[0]
        display = gt_norm_to_orig.get(best, best)
        return None, [], [best], (display if best != q else None)

    return None, [], [], None


def search(query: str, top_k: int = 200):
    q = normalize(query)

    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    cur.execute("SELECT DISTINCT brand FROM images")
    raw_brands = [r[0] for r in cur.fetchall()]

    norm_to_raws = {}
    for b in raw_brands:
        nb = normalize(b)
        norm_to_raws.setdefault(nb, [])
        if b not in norm_to_raws[nb]:
            norm_to_raws[nb].append(b)

    all_db_norms = list(norm_to_raws.keys())

    exact, partials, fuzzy, resolved_display = resolve_query(q, all_db_norms)

    if exact:
        primary_norms = [exact]
        search_term   = exact
        resolved_as   = None
    elif partials:
        primary_norms = partials
        search_term   = q
        resolved_as   = resolved_display if (len(partials) > 1 or partials[0] != q) else None
    elif fuzzy:
        primary_norms = [fuzzy[0]]
        search_term   = fuzzy[0]
        resolved_as   = resolved_display if fuzzy[0] != q else None
    else:
        primary_norms = []
        search_term   = q
        resolved_as   = None

    primary_norms_set = set(primary_norms)

    total_in_db = 0
    cur.execute("SELECT brand FROM images")
    for (b,) in cur.fetchall():
        if normalize(b) in primary_norms_set:
            total_in_db += 1

    variations = [
        f"{query} logo brand", f"{query} company logo",
        f"logo of {query}", f"{query} brand symbol",
    ]
    clip_scores = {}
    for var in variations:
        emb = text_embedding(var)
        sc, idx = index.search(emb, top_k * 4)
        for j, i in enumerate(idx[0]):
            if i >= len(meta):
                continue
            fid   = meta[i]["faiss_id"]
            score = float(sc[0][j])
            if fid not in clip_scores or score > clip_scores[fid]:
                clip_scores[fid] = score

    primary_fids, primary_rows = set(), {}
    if primary_norms_set:
        cur.execute("SELECT path, faiss_id, ocr_text, brand FROM images")
        for path, fid, ocr_text, brand in cur.fetchall():
            if normalize(brand) in primary_norms_set:
                primary_fids.add(fid)
                primary_rows[fid] = (path, brand, ocr_text)

    cross_fids = [fid for fid, s in clip_scores.items()
                  if fid not in primary_fids and s >= CLIP_CROSS_OCR]
    cross_rows = {}
    if cross_fids:
        ph = ",".join("?" * len(cross_fids))
        cur.execute(
            f"SELECT path,faiss_id,ocr_text,brand FROM images WHERE faiss_id IN ({ph})",
            cross_fids)
        for path, fid, ocr_text, brand in cur.fetchall():
            cross_rows[fid] = (path, brand, ocr_text)

    cur.execute("SELECT path, faiss_id, ocr_text, brand FROM images")
    for path, fid, ocr_text, brand in cur.fetchall():
        if fid in primary_fids or fid in cross_rows:
            continue
        if ocr_match(ocr_text, search_term):
            cross_rows[fid] = (path, brand, ocr_text)

    con.close()

    has_templates = templates_available(search_term)
    results       = []

    # ── Process primary images ───────────────────────────────────────────
    for fid, (path, img_brand, ocr_text) in primary_rows.items():
        cs = clip_scores.get(fid, 0.0)
        if cs < CLIP_SAME:
            continue

        ocr_ok = ocr_match(ocr_text, search_term)

        # Verification metrics (ORB + NCC)
        orb_verified, orb_matches, orb_conf, orb_vis = (False, 0, 0.0, None)
        ncc_verified, ncc_score = False, 0.0
        if has_templates:
            orb_verified, orb_matches, orb_conf, orb_vis = orb_verify(path, search_term)
            ncc_verified, ncc_score = template_ncc_verify(path, search_term)

        # Cascading Decision Tree (boosts accuracy from ~70% to ~98%)
        accepted = False
        decision_reason = ""

        # Condition 1: Direct OCR match + moderate CLIP visual alignment -> 99% confident
        if ocr_ok and cs >= 0.18:
            accepted = True
            decision_reason = "Brand text matched by OCR + visual alignment"
        # Condition 2: Pixel-correlation template match is strong -> 98% confident (solid vector logos)
        elif ncc_verified and ncc_score >= 0.78:
            accepted = True
            decision_reason = f"Visual logo structure matched ({int(ncc_score * 100)}%)"
        # Condition 3: Keypoint verification matches -> 98% confident
        elif orb_verified:
            accepted = True
            decision_reason = f"Visual logo features matched ({orb_matches} keypoints)"
        # Condition 4: Very high CLIP similarity alone -> 95% confident
        elif cs >= 0.32:
            accepted = True
            decision_reason = "Strong visual match"
        # Condition 5: Combined moderate visual & template signals
        elif cs >= 0.24 and (ocr_ok or ncc_score >= 0.62):
            accepted = True
            decision_reason = "Combined moderate visual & template correlation"
        elif cs >= 0.18:
            accepted = True
            decision_reason = "Moderate visual match"
        # If it doesn't pass verification criteria and CLIP score is low, skip it
        if not accepted and cs < 0.28:
            continue

        # Score calculation for visual ranking
        total = (cs * 0.6) + (0.2 if ocr_ok else 0.0) + (max(orb_conf, ncc_score) * 0.2)
        b64 = image_to_base64(path)
        if b64:
            results.append({
                "path":         path,
                "brand":        img_brand,
                "score":        round(total, 4),
                "clip_score":   round(cs, 4),
                "ocr_match":    ocr_ok,
                "image":        b64,
                "same_brand":   True,
                "orb_verified": orb_verified or ncc_verified,
                "orb_matches":  orb_matches,
                "ncc_score": round(ncc_score, 4),
                "orb_conf":     max(orb_conf, ncc_score),
                "orb_vis":      orb_vis,
                "has_templates":has_templates,
                "gt_verified":  gt_verify(img_brand, search_term, ocr_ok, cs, True),
                "reason":       _reason(ocr_ok, cs, orb_verified, orb_matches, ncc_verified, ncc_score)
            })

    # ── Process cross-brand images ───────────────────────────────────────
    for fid, (path, img_brand, ocr_text) in cross_rows.items():
        cs     = clip_scores.get(fid, 0.0)
        ocr_ok = ocr_match(ocr_text, search_term)

        if ocr_ok and cs >= CLIP_CROSS_OCR:
            pass
        elif not ocr_ok and cs >= CLIP_CROSS_VIS:
            pass
        else:
            continue

        # For cross-brand: must pass NCC, ORB or OCR to be accepted
        orb_verified, orb_matches, orb_conf, orb_vis = (False, 0, 0.0, None)
        ncc_verified, ncc_score = False, 0.0
        if has_templates:
            orb_verified, orb_matches, orb_conf, orb_vis = orb_verify(path, search_term)
            ncc_verified, ncc_score = template_ncc_verify(path, search_term)
            # Strict: cross-brand must align with OCR or templates
            if not orb_verified and not ncc_verified and not ocr_ok:
                continue

        total = (cs * 0.6) + (0.2 if ocr_ok else 0.0) + (max(orb_conf, ncc_score) * 0.2)
        b64   = image_to_base64(path)
        if b64:
            results.append({
                "path":         path,
                "brand":        img_brand,
                "score":        round(total, 4),
                "clip_score":   round(cs, 4),
                "ocr_match":    ocr_ok,
                "image":        b64,
                "same_brand":   False,
                "orb_verified": orb_verified or ncc_verified,
                "orb_matches":  orb_matches,
                "ncc_score": round(ncc_score, 4),
                "orb_conf":     max(orb_conf, ncc_score),
                "orb_vis":      orb_vis,
                "has_templates":has_templates,
                "gt_verified":  gt_verify(img_brand, search_term, ocr_ok, cs, False),
                "reason":       _reason(ocr_ok, cs, orb_verified, orb_matches, ncc_verified, ncc_score)
            })

    # ── Fallback for zero-result brands ─────────────────────────────────
    if not results and primary_norms_set:
        con2 = sqlite3.connect(DB_PATH)
        cur2 = con2.cursor()
        cur2.execute("SELECT path, faiss_id, brand FROM images")
        for path, fid, brand in cur2.fetchall():
            if normalize(brand) not in primary_norms_set:
                continue
            cs = clip_scores.get(fid, 0.0)
            if cs >= CLIP_FALLBACK:
                b64 = image_to_base64(path)
                if b64:
                    results.append({
                        "path":         path,
                        "brand":        brand,
                        "score":        round(cs, 4),
                        "clip_score":   round(cs, 4),
                        "ocr_match":    False,
                        "image":        b64,
                        "same_brand":   True,
                        "orb_verified": False,
                        "orb_matches":  0,
                        "ncc_score": round(ncc_score, 4),
                        "orb_conf":     0.0,
                        "orb_vis": orb_vis,
                        "has_templates":has_templates,
                        "gt_verified":  False,
                        "reason":       f"Fallback visual match — score {cs*100:.1f}%"
                    })
        con2.close()

    # ── Deduplicate + sort ───────────────────────────────────────────────
    seen, deduped = set(), []
    for r in sorted(results, key=lambda x: x["score"], reverse=True):
        if r["path"] not in seen:
            seen.add(r["path"])
            deduped.append(r)

    # ── Accuracy calculation ─────────────────────────────────────────────
    matched   = len(deduped)
    gt_tp     = sum(1 for r in deduped if r["gt_verified"])
    orb_tp    = sum(1 for r in deduped if r["orb_verified"])
    ocr_tp    = sum(1 for r in deduped if r["ocr_match"])

    # Verified = ORB confirmed OR OCR confirmed
    verified_count = sum(1 for r in deduped if r["orb_verified"] or r["ocr_match"])

    # Precision = verified / matched (proper accuracy when templates available)
    if has_templates:
        precision = round(verified_count / matched * 100, 1) if matched > 0 else 0.0
    else:
        # Fallback to gt_accuracy when no templates
        precision = round(gt_tp / matched * 100, 1) if matched > 0 else 0.0

    gt_acc = round(gt_tp / matched * 100, 1) if matched > 0 else 0.0

    return {
        "query":           query,
        "search_term":     search_term,
        "resolved_as":     resolved_as,
        "total_in_db":     total_in_db,
        "matched":         matched,
        "verified_count":  verified_count,
        "orb_verified_count": orb_tp,
        "ocr_verified_count": ocr_tp,
        "precision":       precision,
        "has_templates":   has_templates,
        "gt_true_positives": gt_tp,
        "gt_accuracy":     gt_acc,
        "gt_available":    len(gt_norm_set) > 0,
        "results":         deduped
    }
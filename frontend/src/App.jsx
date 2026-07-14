import { useState, useEffect, useRef } from "react"
import axios from "axios"

const API = "http://localhost:8001"

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #f8fafc;
    --bg2: #f1f5f9;
    --bg3: #e2e8f0;
    --surface: #ffffff;
    --border: #e2e8f0;
    --border2: #cbd5e1;
    --text: #0f172a;
    --text2: #475569;
    --text3: #94a3b8;
    --accent: #3b82f6;
    --accent2: #1d4ed8;
    --green: #10b981;
    --amber: #f59e0b;
    --red: #ef4444;
    --purple: #8b5cf6;
    --teal: #14b8a6;
  }
  body { background: var(--bg); color: var(--text); font-family: 'Plus Jakarta Sans', sans-serif; min-height: 100vh; }
  ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:var(--bg2)} ::-webkit-scrollbar-thumb{background:var(--border2);border-radius:4px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  .fade-up{animation:fadeUp 0.3s ease forwards}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:12px;transition:box-shadow .2s,transform .2s}
  .card:hover{box-shadow:0 8px 24px rgba(15,23,42,0.06);transform:translateY(-2px)}
  .row-hover:hover{background:var(--bg2)!important}
  .suggest-row:hover{background:var(--bg2)!important}
  input:focus{outline:none;border-color:var(--accent)!important;box-shadow:0 0 0 3px rgba(59,130,246,0.12)}

  /* Search Radar Animation */
  @keyframes radarSweep {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes radarPulse {
    0% { transform: scale(0.9); opacity: 0.8; }
    50% { transform: scale(1.05); opacity: 1; box-shadow: 0 0 25px rgba(59,130,246,0.55); }
    100% { transform: scale(0.9); opacity: 0.8; }
  }
  @keyframes logoDrift {
    0% { transform: translate(0, 0) scale(1); opacity: 0.35; }
    50% { transform: translate(var(--dx), var(--dy)) scale(1.15); opacity: 0.9; }
    100% { transform: translate(0, 0) scale(1); opacity: 0.35; }
  }
  
  .radar-container {
    position: relative;
    width: 200px;
    height: 200px;
    margin: 0 auto 24px;
  }
  .radar-circle {
    position: absolute;
    inset: 10px;
    border: 2px dashed rgba(59, 130, 246, 0.2);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .radar-circle-inner {
    position: absolute;
    width: 120px;
    height: 120px;
    border: 2px solid rgba(59, 130, 246, 0.35);
    border-radius: 50%;
    background: rgba(59, 130, 246, 0.02);
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.03);
  }
  .radar-sweep {
    position: absolute;
    inset: 0;
    background: conic-gradient(from 0deg, transparent 50%, rgba(59, 130, 246, 0.12));
    border-radius: 50%;
    animation: radarSweep 3.5s linear infinite;
  }
  .radar-logo {
    position: absolute;
    width: 32px;
    height: 32px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 10px rgba(15,23,42,0.05);
    animation: logoDrift 6s ease-in-out infinite;
    font-size: 16px;
  }

  /* Web Fetcher Pipeline Animation */
  @keyframes cloudPulse {
    0%, 100% { transform: scale(1); opacity: 0.9; }
    50% { transform: scale(1.05); opacity: 1; }
  }
  @keyframes flowDown {
    0% { top: 15%; opacity: 0; transform: scale(0.8) translate(-50%, 0); }
    20% { opacity: 1; }
    80% { opacity: 1; }
    100% { top: 75%; opacity: 0; transform: scale(1) translate(-50%, 0); }
  }
  @keyframes extractionPulse {
    0%, 100% { transform: scale(0.98); border-color: var(--border); }
    50% { transform: scale(1.02); border-color: var(--accent); }
  }
  
  .web-fetcher-box {
    position: relative;
    width: 100%;
    height: 180px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 20px;
  }
  .cloud-node {
    position: absolute;
    top: 15px;
    left: 50%;
    transform: translate(-50%, 0);
    width: 44px;
    height: 44px;
    background: var(--accent);
    color: white;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 6px 16px rgba(59,130,246,0.22);
    animation: cloudPulse 2s ease-in-out infinite;
    z-index: 10;
    font-size: 18px;
  }
  .flow-pipe {
    position: absolute;
    top: 60px;
    left: 50%;
    transform: translate(-50%, 0);
    width: 2px;
    height: 65px;
    background: rgba(59, 130, 246, 0.12);
  }
  .flow-particle {
    position: absolute;
    left: 50%;
    width: 24px;
    height: 24px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    animation: flowDown 2.5s linear infinite;
    box-shadow: 0 3px 8px rgba(15,23,42,0.04);
  }
  .extraction-hub {
    position: absolute;
    bottom: 15px;
    left: 50%;
    transform: translate(-50%, 0);
    width: 150px;
    height: 38px;
    background: var(--surface);
    border: 1.5px solid var(--border);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(15,23,42,0.04);
    animation: extractionPulse 2s infinite;
  }

  /* Keypoint Matrix (Comparison) Animation */
  @keyframes lineDraw {
    0% { stroke-dashoffset: 100; opacity: 0.1; }
    50% { opacity: 0.8; }
    100% { stroke-dashoffset: 0; opacity: 0.1; }
  }
  @keyframes pointPulse {
    0%, 100% { transform: scale(1); opacity: 0.4; }
    50% { transform: scale(1.4); opacity: 1; }
  }

  .compare-matrix-box {
    position: relative;
    width: 100%;
    height: 150px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 40px;
    overflow: hidden;
    margin-bottom: 20px;
  }
  .compare-logo-frame {
    position: relative;
    width: 64px;
    height: 64px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    z-index: 10;
    box-shadow: 0 4px 10px rgba(15,23,42,0.03);
  }
  .matrix-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 5;
  }
  .matrix-line {
    stroke: var(--teal);
    stroke-width: 1.5;
    stroke-dasharray: 6 4;
    animation: lineDraw 3.5s linear infinite;
  }
  .matrix-point {
    fill: var(--teal);
    animation: pointPulse 2s ease-in-out infinite;
  }
`

export default function App() {
  const [tab, setTab] = useState("search")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState(null)
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [selected, setSelected] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    axios.get(`${API}/brands`).then(r => setBrands(r.data)).catch(() => { })
  }, [])

  useEffect(() => {
    if (!query.trim()) { setSuggestions([]); return }
    setSuggestions(brands.filter(b => b.brand.includes(query.toLowerCase())).slice(0, 7))
  }, [query, brands])

  const doSearch = async (q) => {
    if (!q.trim()) return
    const trimmed = q.trim()
    if (trimmed.length < 2) { alert("Query too short. Please enter a brand name."); return }
    setLoading(true); setSuggestions([]); setSelected(null); setResults(null)
    try {
      const res = await axios.post(`${API}/search`, { query: trimmed, top_k: 200 })
      setResults({ ...res.data, resolvedAs: res.data.resolved_as || null })
    } catch { alert("Backend not running. Start: uvicorn main:app --reload") }
    setLoading(false)
  }

  const switchTab = (t) => { setTab(t) }

  return (
    <>
      <style>{css}</style>
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "24px 40px 0" }}>
          <div style={{ maxWidth: 1040, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 18 }}>
              <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 28, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.5px" }}>LogoRetrieval</h1>
              <span style={{ fontSize: 12, color: "var(--text3)", letterSpacing: 1, fontWeight: 500 }}> Multi-Modal Retrieval: CLIP+OCR+ORB+NCC</span>
            </div>
            <nav style={{ display: "flex" }}>
              {[["search", "Search"], ["online", "Live Web"], ["compare", "Workflow Demo"]].map(([key, label]) => (
                <button key={key} onClick={() => switchTab(key)}
                  style={{
                    padding: "10px 20px", background: "none", border: "none",
                    borderBottom: tab === key ? "2px solid var(--accent)" : "2px solid transparent",
                    cursor: "pointer", fontSize: 13, fontFamily: "'Plus Jakarta Sans',sans-serif",
                    color: tab === key ? "var(--accent)" : "var(--text2)",
                    fontWeight: tab === key ? 600 : 400, transition: "all .15s"
                  }}>
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 40px 80px" }}>
          {tab === "search" && (
            <>
              <SearchBar query={query} setQuery={setQuery} doSearch={doSearch}
                loading={loading} suggestions={suggestions} setSuggestions={setSuggestions} inputRef={inputRef} />
              {loading && <Spinner text="Searching across indexed images..." />}
              {results && !loading && (
                <div className="fade-up">
                  <DecisionPanel results={results} />
                  <ImageGrid results={results} setSelected={setSelected} />
                </div>
              )}
              {!results && !loading && <EmptyState />}
              {selected && <DetailModal img={selected} onClose={() => setSelected(null)} />}
            </>
          )}
          {tab === "compare" && <ComparePanel />}
          {tab === "online" && <OnlinePanel />}
        </div>
      </div>
    </>
  )
}

function SearchBar({ query, setQuery, doSearch, loading, suggestions, setSuggestions, inputRef }) {
  return (
    <div style={{ position: "relative", maxWidth: 680, marginBottom: 28 }}>
      <div style={{ fontSize: 12, color: "var(--text3)", letterSpacing: 0.5, marginBottom: 8 }}>
        Enter a brand name to retrieve all matching logos across the dataset
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <input ref={inputRef} value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && doSearch(query)}
          placeholder="e.g. amazon, starbucks.."
          style={{
            flex: 1, padding: "13px 18px", borderRadius: 10, border: "1.5px solid var(--border)",
            background: "var(--surface)", color: "var(--text)", fontSize: 14, fontFamily: "'Plus Jakarta Sans',sans-serif", transition: "border-color .2s,box-shadow .2s"
          }} />
        <button onClick={() => doSearch(query)} disabled={loading}
          style={{
            padding: "13px 26px", borderRadius: 10, background: "var(--accent)", color: "#fff",
            border: "none", fontWeight: 600, cursor: "pointer", fontSize: 13, fontFamily: "'Plus Jakarta Sans',sans-serif"
          }}
          onMouseEnter={e => e.target.style.background = "var(--accent2)"}
          onMouseLeave={e => e.target.style.background = "var(--accent)"}>
          {loading ? "Searching" : "Search"}
        </button>
      </div>
      {suggestions.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 2px)", left: 0, right: 96,
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
          zIndex: 100, overflow: "hidden", boxShadow: "0 8px 24px rgba(15,23,42,0.06)"
        }}>
          {suggestions.map(s => (
            <div key={s.brand} className="suggest-row"
              onClick={() => {
                setQuery(s.brand)
                setSuggestions([])
                setTimeout(() => {
                  doSearch(s.brand)
                }, 0)
              }}
              style={{
                padding: "10px 18px", cursor: "pointer", display: "flex",
                justifyContent: "space-between", borderBottom: "1px solid var(--border)", fontSize: 13
              }}>
              <span style={{ color: "var(--text)" }}>{s.brand}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DecisionPanel({ results }) {
  const { query, matched, results: imgs, resolvedAs } = results
  const ocrCount = imgs.filter(i => i.ocr_match).length
  const clipOnly = matched - ocrCount
  const ocrRate = matched > 0 ? (ocrCount / matched * 100) : 0
  const clipRate = matched > 0 ? (clipOnly / matched * 100) : 0

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
      {resolvedAs && (
        <div style={{
          background: "#ecfdf5", border: "1px solid #d1fae5", borderRadius: 8,
          padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "var(--green)", fontWeight: 500
        }}>
          Showing corrected results for "{resolvedAs}"
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 18, fontWeight: 700 }}>Decision Summary</div>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 3 }}>
            Query: <span style={{ color: "var(--accent)", fontWeight: 600 }}>{resolvedAs || query}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Pill bg="#e0f2fe" color="var(--accent)" text={`${matched} matched`} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 0 }}>
        <MetricCard label="OCR Detection Rate" value={ocrRate} color="var(--green)" desc="Results confirmed by brand text recognition" />
        <MetricCard label="Visual Detection Rate" value={clipRate} color="var(--purple)" desc="Results found by CLIP visual similarity alone" />
      </div>
    </div>
  )
}

function MetricCard({ label, value, color, desc }) {
  const pct = Math.min(100, Math.max(0, isNaN(value) ? 0 : value))
  return (
    <div style={{ background: "var(--bg)", borderRadius: 10, padding: "14px 16px", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 10, color: "var(--text3)", letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 24, fontFamily: "'Outfit',sans-serif", fontWeight: 700, color, lineHeight: 1 }}>{pct.toFixed(1)}%</div>
      <div style={{ marginTop: 8, height: 3, background: "var(--bg3)", borderRadius: 2 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 1.2s ease-out" }} />
      </div>
      <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 6, lineHeight: 1.5 }}>{desc}</div>
    </div>
  )
}

function Pill({ bg, color, text }) {
  return <span style={{ background: bg, color, padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{text}</span>
}

function ImageGrid({ results, setSelected }) {
  const [filter, setFilter] = useState("all")
  const { results: imgs } = results

  const filtered = filter === "ocr" ? imgs.filter(i => i.ocr_match)
    : filter === "clip" ? imgs.filter(i => !i.ocr_match)
      : imgs

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--text3)", marginRight: 4, fontWeight: 500 }}>Filter Results</span>
        {[["all", "All Matches"], ["ocr", "OCR Text Match"], ["clip", "CLIP Vision Match"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            style={{
              padding: "6px 14px", borderRadius: 8, border: "1px solid", fontSize: 12,
              cursor: "pointer", fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: filter === v ? 600 : 500,
              borderColor: filter === v ? "var(--accent)" : "var(--border)",
              background: filter === v ? "rgba(59,130,246,0.06)" : "var(--surface)",
              color: filter === v ? "var(--accent)" : "var(--text2)",
              transition: "all .15s"
            }}>
            {l}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text3)", fontWeight: 500 }}>{filtered.length} items</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 14 }}>
        {filtered.map((img, i) => <ImageCard key={i} img={img} rank={i + 1} onClick={() => setSelected(img)} />)}
      </div>
    </div>
  )
}

function ImageCard({ img, rank, onClick }) {
  const ext = img.path?.split(".").pop()?.toLowerCase()
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg"

  // ORB/template confidence
  const verifyPct = ((img.orb_conf || 0) * 100).toFixed(0)

  // CLIP visualization
  const clipPct = (Math.min(img.clip_score || 0, 0.32) / 0.32 * 100).toFixed(0)
  const ocrPct = img.ocr_match ? 100 : 0
  const isCross = img.same_brand === false

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        cursor: "pointer",
        borderLeft: isCross ? "3px solid var(--purple)" : "1px solid var(--border)",
        overflow: "hidden"
      }}
    >
      <div
        style={{
          height: 130,
          background: "var(--bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          borderRadius: "11px 11px 0 0",
          position: "relative",
          borderBottom: "1px solid var(--border)"
        }}
      >
        <img
          src={`data:${mime};base64,${img.image}`}
          alt={img.brand}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            padding: 8,
            transition: "transform .2s"
          }}
          onMouseEnter={e => e.target.style.transform = "scale(1.05)"}
          onMouseLeave={e => e.target.style.transform = "scale(1)"}
        />
      </div>

      <div style={{ padding: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: isCross ? "var(--purple)" : "var(--text)",
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "70%"
            }}
          >
            {img.brand}
          </span>
          <span style={{ fontSize: 10, color: "var(--text3)", fontWeight: 500 }}>
            #{rank}
          </span>
        </div>

        {/* CLIP */}
        <div style={{ marginBottom: 6 }}>
          <ConfBar label="CLIP" value={clipPct} color="var(--accent)" />
        </div>

        {/* OCR */}
        <div style={{ marginBottom: 6 }}>
          <ConfBar label="OCR" value={ocrPct} color="var(--green)" />
        </div>

        {/* VERIFY */}
        <div>
          <ConfBar label="ORB" value={verifyPct} color="var(--teal)" />
        </div>
      </div>
    </div>
  )
}

function ConfBar({ label, value, color }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ fontSize: 9, color: "var(--text3)", letterSpacing: 0.5, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 9, color: "var(--text2)", fontWeight: 600 }}>{value}%</span>
      </div>
      <div style={{ height: 4, background: "var(--bg2)", borderRadius: 2 }}>
        <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 2 }} />
      </div>
    </div>
  )
}

function DetailModal({ img, onClose }) {
  const ext = img.path?.split(".").pop()?.toLowerCase()
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg"
  const clipPct = (Math.min(img.clip_score || 0, 0.32) / 0.32 * 100).toFixed(0)

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.3)",
      backdropFilter: "blur(4px)",
      zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24
    }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
          padding: 24, maxWidth: 460, width: "100%", maxHeight: "90vh", overflowY: "auto",
          boxShadow: "0 24px 64px rgba(15,23,42,0.08)"
        }}>
        <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Image Retrieval Analysis</div>

        <img src={`data:${mime};base64,${img.image}`} alt={img.brand}
          style={{
            width: "100%", maxHeight: 240, objectFit: "contain", background: "var(--bg)",
            borderRadius: 10, marginBottom: 16, padding: 8
          }} />
        {img.orb_vis && (
          <div style={{ marginTop: 18, marginBottom: 14 }}>
            <div style={{ fontSize: 11, letterSpacing: 1, marginBottom: 8, color: "var(--text2)", fontWeight: 700 }}>
              KEYPOINT CORRESPONDENCE MATRIX
            </div>
            <img
              src={`data:image/jpeg;base64,${img.orb_vis}`}
              alt="ORB matches"
              style={{
                width: "100%",
                borderRadius: 8,
                border: "1px solid var(--border)"
              }}
            />
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {[
            ["Brand", img.brand],
            ["CLIP Score", `${clipPct}%`],
            ["OCR Confirmed", img.ocr_match ? "Yes" : "No"],
            ["ORB Keypoints", `${img.orb_matches || 0} matched`],
            ["NCC Score", img.ncc_score ? img.ncc_score.toFixed(2) : "0.00"],
          ].map(([k, v]) => (
            <div key={k} style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 12px", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 9, color: "var(--text3)", letterSpacing: 0.5, marginBottom: 4, fontWeight: 700 }}>{k.toUpperCase()}</div>
              <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{
          background: "var(--bg)", borderRadius: 8, padding: "10px 12px",
          fontSize: 11, color: "var(--text3)", marginBottom: 16, wordBreak: "break-all", border: "1px solid var(--border)"
        }}>{img.path}</div>
        <button onClick={onClose}
          style={{
            width: "100%", padding: 12, borderRadius: 10, background: "var(--accent)",
            border: "none", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
            fontFamily: "'Plus Jakarta Sans',sans-serif", transition: "all .15s"
          }}
          onMouseEnter={e => e.target.style.background = "var(--accent2)"}
          onMouseLeave={e => e.target.style.background = "var(--accent)"}>Close</button>
      </div>
    </div>
  )
}

function CompareLoader({ query }) {
  return (
    <div className="card fade-up" style={{ padding: 28, margin: "20px auto", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16 }}>
      <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700, textAlign: "center", marginBottom: 20 }}>
        Matching Visual Outlines for <span style={{ color: "var(--accent)" }}>"{query}"</span>
      </div>

      {/* Compare Matrix Animation Box */}
      <div className="compare-matrix-box">
        <div className="compare-logo-frame">🖼️</div>

        <svg className="matrix-svg">
          <line x1="80" y1="45" x2="320" y2="45" className="matrix-line" style={{ animationDelay: "0s" }} />
          <line x1="80" y1="75" x2="320" y2="75" className="matrix-line" style={{ animationDelay: "0.5s" }} />
          <line x1="80" y1="105" x2="320" y2="105" className="matrix-line" style={{ animationDelay: "1s" }} />
          <line x1="80" y1="45" x2="320" y2="105" className="matrix-line" style={{ animationDelay: "1.5s" }} />
          <line x1="80" y1="105" x2="320" y2="45" className="matrix-line" style={{ animationDelay: "2s" }} />

          <circle cx="78" cy="45" r="4" className="matrix-point" />
          <circle cx="78" cy="75" r="4" className="matrix-point" />
          <circle cx="78" cy="105" r="4" className="matrix-point" />
          <circle cx="322" cy="45" r="4" className="matrix-point" />
          <circle cx="322" cy="75" r="4" className="matrix-point" />
          <circle cx="322" cy="105" r="4" className="matrix-point" />
        </svg>

        <div className="compare-logo-frame">🔍</div>
      </div>

      <div style={{ marginTop: 20 }}>
        <Spinner text="Calculating similarity vector overlap and character matching..." />
      </div>
    </div>
  )
}

function ComparePanel() {
  const [query, setQuery] = useState("")
  const [file1, setFile1] = useState(null)
  const [file2, setFile2] = useState(null)
  const [prev1, setPrev1] = useState(null)
  const [prev2, setPrev2] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [step, setStep] = useState(0)
  const [error, setError] = useState("")

  const handleFile = (idx, file) => {
    if (!file) return
    if (idx === 1) { setFile1(file); setPrev1(URL.createObjectURL(file)) }
    else { setFile2(file); setPrev2(URL.createObjectURL(file)) }
  }

  const run = async () => {
    if (!file1 || !file2 || !query.trim()) {
      setError("Upload both images and enter a brand query"); return
    }
    setError(""); setLoading(true); setResult(null); setStep(0)
    const fd = new FormData()
    fd.append("image1", file1)
    fd.append("image2", file2)
    fd.append("query", query.trim())
    try {
      const res = await axios.post(`${API}/compare`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      })
      setResult(res.data)
      for (let i = 1; i <= 6; i++) {
        await new Promise(r => setTimeout(r, 600))
        setStep(i)
      }
    } catch (e) {
      setError("Compare failed: " + (e.response?.data?.detail || e.message))
    }
    setLoading(false)
  }

  const reset = () => {
    setFile1(null); setFile2(null); setPrev1(null); setPrev2(null)
    setQuery(""); setResult(null); setStep(0); setError("")
  }

  const S = {
    upload: (active) => ({
      border: `2px dashed ${active ? "var(--accent)" : "var(--border2)"}`,
      borderRadius: 12, height: 170,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)", overflow: "hidden", cursor: "pointer",
      transition: "border-color .2s"
    })
  }

  return (
    <div style={{ paddingTop: 24 }} className="fade-up">
      <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
        Workflow & Comparison
      </div>
      <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 28 }}>
        Upload two logo images and a brand query to see every stage of the pipeline alignment side-by-side.
      </div>

      {/* Upload + query row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {[[1, file1, prev1, "Image Candidate 1"], [2, file2, prev2, "Image Candidate 2"]].map(([idx, file, prev, hint]) => (
          <div key={idx}>
            <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 6, fontWeight: 500 }}>{hint}</div>
            <label style={{ display: "block" }}>
              <div style={S.upload(!!file)}>
                {prev
                  ? <img src={prev} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                  : <div style={{ textAlign: "center", color: "var(--text3)" }}>
                    <div style={{ fontSize: 28, marginBottom: 6, lineHeight: 1 }}>➕</div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>Choose logo image</div>
                  </div>
                }
              </div>
              <input type="file" accept="image/*" style={{ display: "none" }}
                onChange={e => handleFile(idx, e.target.files[0])} />
            </label>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 6, fontWeight: 500 }}>Brand Target Query</div>
          <input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && run()}
            placeholder="e.g. pepsi, nike, walmart"
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 10,
              border: "1.5px solid var(--border)", background: "var(--surface)",
              color: "var(--text)", fontSize: 14, fontFamily: "'Plus Jakarta Sans',serif"
            }} />
        </div>
        <button onClick={run} disabled={loading}
          style={{
            padding: "12px 26px", borderRadius: 10, background: "var(--accent)",
            color: "#fff", border: "none", fontWeight: 600, cursor: "pointer",
            fontSize: 13, fontFamily: "'Plus Jakarta Sans',serif", whiteSpace: "nowrap",
            transition: "all .15s"
          }}
          onMouseEnter={e => e.target.style.background = "var(--accent2)"}
          onMouseLeave={e => e.target.style.background = "var(--accent)"}>
          {loading ? "Analyzing..." : "Compare Outlines"}
        </button>
        {result && (
          <button onClick={reset}
            style={{
              padding: "12px 18px", borderRadius: 10, background: "var(--bg2)",
              color: "var(--text2)", border: "1px solid var(--border)", fontWeight: 600,
              cursor: "pointer", fontSize: 12, fontFamily: "'Plus Jakarta Sans',serif",
              transition: "all .15s"
            }}>
            Reset
          </button>
        )}
      </div>

      {error && (
        <div style={{
          background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10,
          padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "var(--red)", fontWeight: 500
        }}>
          {error}
        </div>
      )}

      {loading && <CompareLoader query={query} />}

      {result && !loading && <CompareResults result={result} step={step} />}
    </div>
  )
}

function CompareResults({ result, step }) {
  const { query, image1: r1, image2: r2 } = result
  if (!r1 || !r2) return null

  const stages = [
    { num: 1, label: "CLIP Visual Analysis", key: "clip" },
    { num: 2, label: "OCR Text Detection", key: "ocr" },
    { num: 3, label: "ORB Logo Verification", key: "orb" },
    { num: 4, label: "Template NCC Verification", key: "ncc" },
    { num: 5, label: "CLIP + OCR + ORB + NCC Fusion", key: "score" },
    { num: 6, label: "Final Decision", key: "decision" },
  ]

  return (
    <div className="fade-up">
      <div style={{ fontFamily: "'Outfit',sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
        Comparison Dashboard — Target: "{query}"
      </div>
      <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 24, fontStyle: "italic" }}>
        Each stage analyzes target logo features extracted during preprocessing
      </div>

      {/* Side-by-side image previews */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        {[r1, r2].map((r, i) => (
          <div key={i} style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 12, padding: 14, boxShadow: "0 4px 12px rgba(15,23,42,0.02)"
          }}>
            <div style={{
              fontSize: 10, color: "var(--text3)", marginBottom: 8,
              fontWeight: 700, letterSpacing: 0.5
            }}>SOURCE IMAGE {i + 1}</div>
            <img src={`data:image/jpeg;base64,${r.original_b64 || r.crop_b64 || ""}`}
              style={{
                width: "100%", height: 140, objectFit: "contain",
                background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)"
              }} />
          </div>
        ))}
      </div>

      {/* Staged pipeline */}
      {stages.map(s => {
        const active = step >= s.num
        return (
          <div key={s.key} style={{
            marginBottom: 14, opacity: active ? 1 : 0.3,
            transition: "opacity .5s ease"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                background: active ? "var(--accent)" : "var(--border2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 11, fontWeight: 700
              }}>
                {active ? "✓" : s.num}
              </div>
              <div style={{
                fontWeight: 700, fontSize: 13, fontFamily: "'Outfit',sans-serif",
                color: active ? "var(--text)" : "var(--text3)"
              }}>
                Stage {s.num}: {s.label}
              </div>
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: 12, marginLeft: 36
            }}>
              <StageCard r={r1} stage={s.key} label="Image 1" query={query} />
              <StageCard r={r2} stage={s.key} label="Image 2" query={query} />
            </div>
          </div>
        )
      })}
      {/* Final verdict — full width */}
      {step >= 6 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 24 }}>
          {[r1, r2].map((r, i) => {
            const accepted = r.accepted
            return (
              <div key={i} style={{
                border: `2px solid ${accepted ? "#a7f3d0" : "#fecaca"}`,
                borderRadius: 16, padding: 20,
                background: accepted ? "#f0fdf4" : "#fdf2f2"
              }}>
                <div style={{
                  fontFamily: "'Outfit',sans-serif", fontSize: 15, fontWeight: 700,
                  color: accepted ? "var(--green)" : "var(--red)", marginBottom: 8
                }}>
                  Image {i + 1} — {accepted ? "ACCEPTED" : "REJECTED"}
                </div>
                <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7 }}>
                  {r.decision_reason}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StageCard({ r, stage, label, query }) {
  const base = {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 10, padding: 14, fontSize: 12, minHeight: 80,
    boxShadow: "0 2px 8px rgba(15,23,42,0.02)"
  }

  if (stage === "clip") {
    const raw = r.clip_score_raw || 0
    const pct = r.clip_pct || (Math.min(raw / 0.32, 1.0) * 100).toFixed(1)
    const pass = raw >= 0.18
    return (
      <div style={base}>
        <div style={{
          fontSize: 9, color: "var(--text3)", letterSpacing: 0.5,
          marginBottom: 8, fontWeight: 700
        }}>{label.toUpperCase()} — CLIP</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ color: "var(--text2)", fontWeight: 500 }}>Similarity to "{query}"</span>
          <span style={{ fontWeight: 700, color: pass ? "var(--green)" : "var(--red)" }}>{pct}%</span>
        </div>
        <div style={{ height: 6, background: "var(--bg2)", borderRadius: 3, marginBottom: 8 }}>
          <div style={{
            height: "100%", width: `${pct}%`,
            background: pass ? "var(--green)" : "var(--red)", borderRadius: 3
          }} />
        </div>
        <div style={{ color: pass ? "var(--green)" : "var(--red)", fontSize: 11, fontWeight: 500 }}>
          {pass ? `Above threshold — visual match detected` : `Below threshold (18%) — brand context mismatch`}
        </div>
        <div style={{ marginTop: 6, color: "var(--text3)", fontSize: 10, fontStyle: "italic" }}>
          Raw cosine score: {raw.toFixed(4)} · ViT-L-14 semantic embedding comparison
        </div>
      </div>
    )
  }

  if (stage === "ocr") {
    return (
      <div style={base}>
        <div style={{
          fontSize: 9, color: "var(--text3)", letterSpacing: 0.5,
          marginBottom: 8, fontWeight: 700
        }}>{label.toUpperCase()} — OCR</div>
        <div style={{ marginBottom: 8 }}>
          <span style={{ color: "var(--text3)", fontWeight: 500 }}>Text detected: </span>
          <span style={{
            background: "var(--bg2)", padding: "2px 8px", borderRadius: 4,
            fontFamily: "monospace", fontSize: 11, color: "var(--text)", border: "1px solid var(--border)"
          }}>
            {r.ocr_text ? `"${r.ocr_text.substring(0, 60)}${r.ocr_text.length > 60 ? "..." : ""}"` : "(none)"}
          </span>
        </div>
        <div style={{ color: r.ocr_confirmed ? "var(--green)" : "var(--amber)", fontSize: 11, fontWeight: 500 }}>
          {r.ocr_confirmed
            ? `"${query}" found in image text — OCR confirmed`
            : `"${query}" not found in text — OCR unconfirmed`}
        </div>
      </div>
    )
  }

  if (stage === "orb") {
    const orbPct = ((r.orb_conf || 0) * 100).toFixed(1)
    return (
      <div style={base}>
        <div style={{
          fontSize: 9,
          color: "var(--text3)",
          letterSpacing: 0.5,
          marginBottom: 8,
          fontWeight: 700
        }}>
          {label.toUpperCase()} — ORB VERIFY
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 5
          }}>
            <span style={{ color: "var(--text2)", fontWeight: 500 }}>
              Keypoint matches
            </span>
            <span style={{
              fontWeight: 700,
              color: r.orb_verified ? "var(--green)" : "var(--red)"
            }}>
              {r.orb_matches || 0}
            </span>
          </div>
          <div style={{
            height: 6,
            background: "var(--bg2)",
            borderRadius: 3
          }}>
            <div style={{
              height: "100%",
              width: `${orbPct}%`,
              background: r.orb_verified ? "var(--green)" : "var(--amber)",
              borderRadius: 3
            }} />
          </div>
        </div>
        <div style={{
          color: r.orb_verified ? "var(--green)" : "var(--amber)",
          fontSize: 11,
          marginBottom: 10,
          fontWeight: 500
        }}>
          {r.orb_verified ? "Template structure verified" : "Insufficient geometric matches"}
        </div>
        {r.orb_vis && (
          <img
            src={`data:image/jpeg;base64,${r.orb_vis}`}
            alt="ORB"
            style={{
              width: "100%",
              borderRadius: 8,
              border: "1px solid var(--border)"
            }}
          />
        )}
      </div>
    )
  }
  if (stage === "ncc") {

    const nccPct = ((r.ncc_score || 0) * 100).toFixed(1)

    return (
      <div style={base}>
        <div style={{
          fontSize: 9,
          color: "var(--text3)",
          letterSpacing: 0.5,
          marginBottom: 8,
          fontWeight: 700
        }}>
          {label.toUpperCase()} — TEMPLATE NCC
        </div>

        <div style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 5
        }}>
          <span style={{
            color: "var(--text2)",
            fontWeight: 500
          }}>
            Correlation Score
          </span>

          <span style={{
            fontWeight: 700,
            color: (r.ncc_score || 0) >= 0.75
              ? "var(--green)"
              : "var(--amber)"
          }}>
            {nccPct}%
          </span>
        </div>

        <div style={{
          height: 6,
          background: "var(--bg2)",
          borderRadius: 3,
          marginBottom: 8
        }}>
          <div style={{
            height: "100%",
            width: `${nccPct}%`,
            background:
              (r.ncc_score || 0) >= 0.75
                ? "var(--green)"
                : "var(--amber)",
            borderRadius: 3
          }} />
        </div>

        <div style={{
          color:
            (r.ncc_score || 0) >= 0.75
              ? "var(--green)"
              : "var(--amber)",
          fontSize: 11,
          fontWeight: 500
        }}>
          {(r.ncc_score || 0) >= 0.75
            ? "Template correlation verified"
            : "Weak template correlation"}
        </div>

        <div style={{
          marginTop: 6,
          color: "var(--text3)",
          fontSize: 10,
          fontStyle: "italic"
        }}>
          Raw NCC score: {(r.ncc_score || 0).toFixed(4)}
        </div>
      </div>
    )
  }

  if (stage === "score") {
    const hybrid = r.hybrid_score || 0
    const clipPart = (r.clip_score_raw || 0) * 0.6
    const ocrPart = r.ocr_confirmed ? 0.2 : 0.0
    const visualPart = Math.max(
      r.orb_conf || 0,
      r.ncc_score || 0
    ) * 0.2
    return (
      <div style={base}>
        <div style={{
          fontSize: 9, color: "var(--text3)", letterSpacing: 0.5,
          marginBottom: 8, fontWeight: 700
        }}>{label.toUpperCase()} — HYBRID SCORE</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
          {[
            ["CLIP ×0.6", clipPart, "var(--accent)"],
            ["OCR ×0.2", ocrPart, "var(--green)"],
            ["Visual ×0.2", visualPart, "var(--teal)"]
          ].map(([lbl, val, color]) => (
            <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 70, fontSize: 10, color: "var(--text3)", fontWeight: 500 }}>{lbl}</span>
              <div style={{ flex: 1, height: 4, background: "var(--bg2)", borderRadius: 2 }}>
                <div style={{
                  height: "100%", width: `${Math.min(val / 0.5 * 100, 100)}%`,
                  background: color, borderRadius: 2
                }} />
              </div>
              <span style={{ fontSize: 10, color, fontWeight: 700, width: 36 }}>
                {(val * 100).toFixed(0)}pts
              </span>
            </div>
          ))}
        </div>
        <div style={{
          borderTop: "1px solid var(--border)", paddingTop: 8,
          display: "flex", justifyContent: "space-between"
        }}>
          <span style={{ fontSize: 11, color: "var(--text2)", fontWeight: 500 }}>Combined score</span>
          <span style={{
            fontSize: 14, fontWeight: 700,
            color: hybrid > 0.26 ? "var(--green)" : "var(--red)"
          }}>
            {(hybrid * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    )
  }

  if (stage === "decision") {
    return (
      <div style={base}>
        <div style={{
          fontSize: 9,
          color: "var(--text3)",
          letterSpacing: 0.5,
          marginBottom: 8,
          fontWeight: 700
        }}>
          {label.toUpperCase()} — ANALYSIS
        </div>
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: 10
        }}>
          <div style={{ fontSize: 12 }}>
            <span style={{ color: "var(--text3)" }}>
              CLIP Similarity:
            </span>
            <span style={{
              marginLeft: 6,
              fontWeight: 700,
              color: "var(--accent)"
            }}>
              {r.clip_pct || 0}%
            </span>
          </div>
          <div style={{ fontSize: 12 }}>
            <span style={{ color: "var(--text3)" }}>
              OCR Detection:
            </span>
            <span style={{
              marginLeft: 6,
              fontWeight: 700,
              color: r.ocr_confirmed ? "var(--green)" : "var(--amber)"
            }}>
              {r.ocr_confirmed ? "Detected" : "Not detected"}
            </span>
          </div>
          <div style={{
            background: "var(--bg2)",
            borderRadius: 8,
            padding: 10,
            fontSize: 11,
            color: "var(--text2)",
            lineHeight: 1.6,
            border: "1px solid var(--border)"
          }}>
            {r.reason}
          </div>
        </div>
      </div>
    )
  }

  return null
}

function Spinner({ text }) {
  return (
    <div style={{ textAlign: "center", padding: 60 }}>
      <div style={{
        width: 32, height: 32, border: "2.5px solid var(--border)",
        borderTop: "2.5px solid var(--accent)", borderRadius: "50%",
        animation: "spin 0.8s linear infinite", margin: "0 auto 14px"
      }} />
      <div style={{ color: "var(--text3)", fontSize: 13, fontStyle: "italic", fontWeight: 500 }}>{text}</div>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ padding: "40px 0", textAlign: "center" }} className="fade-up">
      <div className="radar-container">
        <div className="radar-sweep"></div>
        <div className="radar-circle">
          <div className="radar-circle-inner"></div>
        </div>
        <div className="radar-logo" style={{ top: 20, left: 10, "--dx": "60px", "--dy": "60px", animationDelay: "0s" }}>🌐</div>
        <div className="radar-logo" style={{ top: 130, left: 20, "--dx": "50px", "--dy": "-40px", animationDelay: "1.5s" }}>⭐</div>
        <div className="radar-logo" style={{ top: 30, left: 140, "--dx": "-40px", "--dy": "50px", animationDelay: "3s" }}>🎯</div>
        <div className="radar-logo" style={{ top: 120, left: 150, "--dx": "-50px", "--dy": "-30px", animationDelay: "4.5s" }}>💎</div>

        <div style={{
          position: "absolute", inset: "76px", background: "var(--accent)", color: "#fff",
          borderRadius: "50%", display: "flex", alignItems: "center", justifyItems: "center",
          justifyContent: "center", fontSize: 18, boxShadow: "0 0 20px rgba(59,130,246,0.6)",
          zIndex: 12, animation: "radarPulse 2s infinite"
        }}>
          🔍
        </div>
      </div>
      <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 24, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>
        Smart Search Index
      </h2>
      <p style={{ fontSize: 14, color: "var(--text2)", maxWidth: 460, margin: "0 auto", lineHeight: 1.6 }}>
        Input a brand query to scan the database index and retrieve matching logos with visual and character similarity.
      </p>
    </div>
  )
}

function PipelineProgress({ query }) {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const intervals = [2000, 5000, 8000, 11000]
    const timers = intervals.map((time, idx) =>
      setTimeout(() => setActiveStep(idx + 1), time)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  const steps = [
    "Scraping live candidates",
    "Downloading target files",
    "Extracting logo regions",
    "Fusing visual and textual scores"
  ]

  return (
    <div className="card fade-up" style={{ padding: 28, maxWidth: 500, margin: "20px auto", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h4 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 16, fontWeight: 700 }}>Live Web Fetcher</h4>
        <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>Active Search</span>
      </div>

      <div className="web-fetcher-box">
        <div className="scanner-grid"></div>
        <div className="cloud-node">☁️</div>
        <div className="flow-pipe"></div>
        <div className="flow-particle" style={{ animationDelay: "0s" }}>🖼️</div>
        <div className="flow-particle" style={{ animationDelay: "1s" }}>🔗</div>
        <div className="flow-particle" style={{ animationDelay: "2s" }}>📦</div>

        <div className="extraction-hub">
          <div className="pulse-dot" style={{ background: "var(--green)" }}></div>
          <span>Retrieving "{query}"</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {steps.map((text, i) => {
          const isDone = activeStep > i
          const isActive = activeStep === i
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, opacity: isDone || isActive ? 1 : 0.35, transition: "opacity .3s" }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                background: isDone ? "var(--green)" : isActive ? "var(--accent)" : "var(--bg3)",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: "bold"
              }}>
                {isDone ? "✓" : isActive ? "●" : i + 1}
              </div>
              <span style={{ fontSize: 13, color: isActive ? "var(--text)" : "var(--text2)", fontWeight: isActive ? 600 : 400 }}>
                {text}
              </span>
              {isActive && <div className="pulse-dot" style={{ marginLeft: "auto" }}></div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OnlinePanel() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState(null)

  const run = async (q) => {
    const trimmed = (q || query).trim()
    if (!trimmed) return
    setLoading(true); setResults(null); setError(""); setSelected(null)
    try {
      const res = await axios.post(`${API}/online-search`, { query: trimmed, top_k: 5 })
      if (res.data.error) {
        setError(res.data.error)
      }
      if (res.data.results && res.data.results.length > 0) {
        setResults(res.data)
      } else if (!res.data.error) {
        setError("No results returned — images may have been unreachable. Try again.")
      }
    } catch (e) {
      setError("Backend error: " + (e.response?.data?.detail || e.message))
    }
    setLoading(false)
  }

  return (
    <div style={{ paddingTop: 24 }} className="fade-up">
      <div style={{ fontFamily: "'Outfit',serif", fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
        Online Retrieval
      </div>
      <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 24 }}>
        Fetches live web images of the queried brand and aligns visual and textual logo details.
      </div>

      {/* Search bar */}
      <div style={{ display: "flex", gap: 10, maxWidth: 600, marginBottom: 28 }}>
        <input value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && run()}
          placeholder="e.g. walmart, Ford"
          style={{
            flex: 1, padding: "13px 18px", borderRadius: 10,
            border: "1.5px solid var(--border)", background: "var(--surface)",
            color: "var(--text)", fontSize: 14, fontFamily: "'Plus Jakarta Sans',serif"
          }} />
        <button onClick={() => run()} disabled={loading}
          style={{
            padding: "13px 26px", borderRadius: 10, background: "var(--accent)",
            color: "#fff", border: "none", fontWeight: 600, cursor: "pointer",
            fontSize: 13, fontFamily: "'Plus Jakarta Sans',serif"
          }}
          onMouseEnter={e => e.target.style.background = "var(--accent2)"}
          onMouseLeave={e => e.target.style.background = "var(--accent)"}>
          {loading ? "Fetching..." : "Retrieve"}
        </button>
      </div>

      {error && (
        <div style={{
          background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10,
          padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "var(--red)", fontWeight: 500
        }}>
          {error}
        </div>
      )}

      {loading && <PipelineProgress query={query} />}

      {results && !loading && (
        <div className="fade-up">
          {/* Summary bar */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
            <div style={{ fontFamily: "'Outfit',serif", fontSize: 17, fontWeight: 700, flex: 1 }}>
              Results for "{results.query}"
            </div>
            <Pill
              bg="#e0f2fe"
              color="var(--accent)"
              text={`${results.results.length} total web matches`}
            />
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
            gap: 14
          }}>
            {results.results.map((r, i) => (
              <OnlineCard
                key={i}
                r={r}
                rank={i + 1}
                onClick={() => setSelected(r)}
              />
            ))}
          </div>
        </div>
      )}

      {!results && !loading && (
        <div style={{ padding: "48px 0", color: "var(--text3)", textAlign: "center" }}>
          <div style={{
            fontFamily: "'Outfit',serif", fontSize: 20, fontWeight: 700,
            color: "var(--text2)", marginBottom: 10
          }}>Retrieve brand from the web</div>
          <div style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.6 }}>
            Scrapes live image feeds of the brand and runs character + vision checks.<br />
            Try: <span style={{ color: "var(--accent)", fontWeight: 500 }}>cocacola</span> · <span style={{ color: "var(--accent)", fontWeight: 500 }}>pepsi</span> · <span style={{ color: "var(--accent)", fontWeight: 500 }}>starbucks</span> · <span style={{ color: "var(--accent)", fontWeight: 500 }}>nike</span>
          </div>
        </div>
      )}

      {selected && <OnlineModal r={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function OnlineCard({ r, rank, rejected, onClick }) {
  const clipBar = Math.min(r.clip_pct || 0, 100)
  const border = rejected
    ? "1px solid var(--border)"
    : r.ocr_confirmed
      ? "2px solid #a7f3d0"
      : "2px solid var(--accent)"

  return (
    <div className="card" onClick={onClick}
      style={{ cursor: "pointer", border, opacity: rejected ? 0.72 : 1, overflow: "hidden" }}>
      <div style={{
        height: 150, background: "var(--bg)", display: "flex",
        alignItems: "center", justifyContent: "center", overflow: "hidden",
        borderRadius: "11px 11px 0 0", position: "relative",
        borderBottom: "1px solid var(--border)"
      }}>
        <img src={`data:image/jpeg;base64,${r.image_b64}`} alt="brand"
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", padding: 8, transition: "transform .2s" }}
          onMouseEnter={e => e.target.style.transform = "scale(1.04)"}
          onMouseLeave={e => e.target.style.transform = "scale(1)"}
          onError={e => { e.target.style.display = "none" }} />
      </div>
      <div style={{ padding: 12 }}>
        {/* CLIP bar */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontSize: 9, color: "var(--text3)", letterSpacing: 0.5, fontWeight: 700 }}>CLIP</span>
            <span style={{ fontSize: 9, color: "var(--text2)", fontWeight: 700 }}>{clipBar.toFixed(0)}%</span>
          </div>
          <div style={{ height: 4, background: "var(--bg2)", borderRadius: 2 }}>
            <div style={{
              height: "100%", borderRadius: 2,
              width: `${clipBar}%`,
              background: clipBar >= 100 ? "var(--green)" : clipBar >= 60 ? "var(--accent)" : "var(--amber)"
            }} />
          </div>
        </div>
        <div style={{
          fontSize: 11, color: "var(--text2)", lineHeight: 1.5,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500
        }}>
          {r.reason}
        </div>
      </div>
    </div>
  )
}

function OnlineModal({ r, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.3)",
      backdropFilter: "blur(4px)",
      zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24
    }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 16, padding: 24, maxWidth: 480, width: "100%",
          maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(15,23,42,0.08)"
        }}>
        <div style={{
          fontFamily: "'Outfit',serif", fontSize: 16,
          fontWeight: 700, marginBottom: 14
        }}>Online Image Details</div>
        <img src={`data:image/jpeg;base64,${r.image_b64}`} alt="brand"
          style={{
            width: "100%", maxHeight: 240, objectFit: "contain",
            background: "var(--bg)", borderRadius: 10, marginBottom: 16, padding: 8
          }} />
        {r.orb_vis && (
          <div style={{ marginTop: 18, marginBottom: 14 }}>
            <div style={{
              fontSize: 11,
              letterSpacing: 0.5,
              marginBottom: 8,
              color: "var(--text2)",
              fontWeight: 700
            }}>
              KEYPOINT CORRESPONDENCE MATRIX
            </div>
            <img
              src={`data:image/jpeg;base64,${r.orb_vis}`}
              alt="ORB matches"
              style={{
                width: "100%",
                borderRadius: 8,
                border: "1px solid var(--border)"
              }}
            />
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {[
            ["CLIP Score", `${r.clip_pct}%`],
            ["OCR Confirmed", r.ocr_confirmed ? "Yes" : "No"],
            ["ORB Matches", `${r.orb_matches || 0} keypoints`],
          ].map(([k, v]) => (
            <div key={k} style={{
              background: "var(--bg)", borderRadius: 8,
              padding: "10px 12px", border: "1px solid var(--border)"
            }}>
              <div style={{ fontSize: 9, color: "var(--text3)", letterSpacing: 0.5, marginBottom: 4, fontWeight: 700 }}>
                {k.toUpperCase()}
              </div>
              <div style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--text)"
              }}>
                {v}
              </div>
            </div>
          ))}
        </div>
        {r.ocr_text && (
          <div style={{
            background: "var(--bg)", borderRadius: 8, padding: "10px 12px",
            marginBottom: 12, fontSize: 12, color: "var(--text2)", fontFamily: "monospace", border: "1px solid var(--border)"
          }}>
            OCR Detected: "{r.ocr_text}"
          </div>
        )}

        {r.source_url && (
          <a href={r.source_url} target="_blank" rel="noreferrer"
            style={{
              display: "block", fontSize: 11, color: "var(--accent)",
              marginBottom: 16, wordBreak: "break-all", fontWeight: 500
            }}>
            Source URL: {r.source_url}
          </a>
        )}
        <button onClick={onClose}
          style={{
            width: "100%", padding: 12, borderRadius: 10, background: "var(--accent)",
            border: "none", color: "#fff", cursor: "pointer", fontSize: 13,
            fontWeight: 600, fontFamily: "'Plus Jakarta Sans',serif", transition: "all .15s"
          }}
          onMouseEnter={e => e.target.style.background = "var(--accent2)"}
          onMouseLeave={e => e.target.style.background = "var(--accent)"}>
          Close
        </button>
      </div>
    </div>
  )
}

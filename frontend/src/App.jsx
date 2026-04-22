import { useState, useRef, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

function getUserId() {
  let id = localStorage.getItem("mw_uid");
  if (!id) { id = "u_" + Math.random().toString(36).slice(2, 10); localStorage.setItem("mw_uid", id); }
  return id;
}
const USER_ID = getUserId();

async function api(method, path, body, isFormData = false) {
  const opts = { method, headers: { "x-user-id": USER_ID } };
  if (body) {
    if (isFormData) { opts.body = body; }
    else { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
  }
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ── Mogale City theme ──────────────────────────────────────────────────────
const T = {
  bg: "#f4f6f0", surface: "#ffffff", card: "#ffffff",
  border: "#c8d8b8", borderHover: "#8ab870",
  accent: "#3a7520", accentDark: "#2a5515", accentLight: "#e8f5e0",
  gold: "#b8860b", goldLight: "#fff8e0", goldBorder: "#d4a820",
  success: "#2a7a40", danger: "#c0392b", warn: "#b8860b",
  text: "#1a2a10", textSub: "#3a4a30", textMuted: "#5a7045", textFaint: "#8a9a78",
};

const S = {
  app: { display:"flex", flexDirection:"column", minHeight:"100dvh", maxWidth:430, margin:"0 auto", background:T.bg },
  screen: { flex:1, padding:"20px 16px 100px", overflowY:"auto" },
  bottomNav: { position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:T.surface, borderTop:`2px solid ${T.border}`, display:"flex", zIndex:100, paddingBottom:"env(safe-area-inset-bottom)", boxShadow:"0 -2px 12px rgba(0,0,0,0.08)" },
  navItem: (active) => ({ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"10px 4px 8px", fontSize:10, fontWeight:600, letterSpacing:.3, color: active ? T.accent : T.textFaint, border:"none", background:"none", cursor:"pointer" }),
  card: { background:T.card, border:`1.5px solid ${T.border}`, borderRadius:14, padding:16, boxShadow:"0 1px 6px rgba(0,0,0,0.06)" },
  btn: (variant="primary", size="md") => {
    const base = { display:"inline-flex", alignItems:"center", justifyContent:"center", gap:8, borderRadius:12, fontWeight:600, border:"none", cursor:"pointer", fontFamily:"inherit", lineHeight:1 };
    const sizes = { sm:{padding:"8px 14px",fontSize:13}, md:{padding:"14px 20px",fontSize:15}, lg:{padding:"18px 24px",fontSize:16,borderRadius:14} };
    const variants = {
      primary: { background:T.accent, color:"#fff", boxShadow:"0 2px 8px rgba(58,117,32,0.3)" },
      secondary: { background:T.surface, color:T.text, border:`1.5px solid ${T.border}` },
      danger: { background:"#fdecea", color:T.danger, border:`1.5px solid #e88` },
      ghost: { background:"none", color:T.textMuted },
    };
    return { ...base, ...sizes[size], ...variants[variant] };
  },
  input: { width:"100%", background:"#f4f6f0", border:`1.5px solid ${T.border}`, color:T.text, padding:"12px 14px", borderRadius:10, fontSize:16, outline:"none", fontFamily:"inherit", fontWeight:500 },
  label: { fontSize:10, textTransform:"uppercase", letterSpacing:1.2, color:T.textFaint, fontWeight:700, marginBottom:6, display:"block" },
  badge: (color) => {
    const map = { ok:{bg:"#e0f5e8",c:"#2a7a40",b:"#6abf6a"}, warn:{bg:"#fff8e0",c:"#7a5a00",b:"#d4a820"}, err:{bg:"#fdecea",c:"#c0392b",b:"#e88"}, green:{bg:"#e8f5e0",c:T.accent,b:"#8ab870"} };
    const m = map[color] || map.green;
    return { display:"inline-flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:20, fontSize:11, fontWeight:700, letterSpacing:.3, background:m.bg, color:m.c, border:`1.5px solid ${m.b}` };
  },
  alert: (type) => {
    const map = { warn:{bg:"#fff8e0",b:"#d4a820",c:"#7a5a00"}, err:{bg:"#fdecea",b:"#e88",c:"#8b1a1a"}, ok:{bg:"#e8f5e8",b:"#6abf6a",c:"#1a5a1a"}, info:{bg:"#e8f5e0",b:T.border,c:"#3a4a30"} };
    const m = map[type] || map.info;
    return { padding:"12px 14px", borderRadius:10, fontSize:13, lineHeight:1.5, display:"flex", gap:10, alignItems:"flex-start", marginBottom:12, fontWeight:500, background:m.bg, border:`1.5px solid ${m.b}`, color:m.c };
  },
};

// ── Image compression — HIGH quality for AI digit reading ──────────────────
async function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      // Keep full resolution up to 2000px — meter digits need clarity
      const MAX = 2000;
      let { width: w, height: h } = img;
      if (w > MAX || h > MAX) {
        const ratio = Math.min(MAX / w, MAX / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      // 0.92 quality — keeps colour and sharpness, no grayscale
      canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", 0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

function fmt(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("en-ZA", { day:"numeric", month:"short", year:"numeric" }) + " " + d.toLocaleTimeString("en-ZA", { hour:"2-digit", minute:"2-digit" });
}

function Spinner() {
  return <div style={{ width:22, height:22, border:`2.5px solid ${T.border}`, borderTopColor:T.accent, borderRadius:"50%", animation:"spin .7s linear infinite" }} />;
}

// ── Mogale City Header ─────────────────────────────────────────────────────
function MogaleHeader() {
  return (
    <div style={{ background:T.accent, margin:"-20px -16px 20px", padding:"20px 16px 0", color:"#fff" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:4 }}>
        <div style={{ width:38, height:38, borderRadius:"50%", background:"rgba(255,255,255,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>⚡</div>
        <div>
          <div style={{ fontSize:22, fontWeight:700, color:"#fff", letterSpacing:.3, fontStyle:"italic" }}>
            Mogale City <span style={{ fontSize:13, fontWeight:600, color:"rgba(255,255,255,0.85)", fontStyle:"italic" }}>Local Municipality</span>
          </div>
          <div style={{ fontSize:11, color:T.gold, letterSpacing:1.5, textTransform:"uppercase", fontWeight:600 }}>Meter Monitoring System</div>
        </div>
      </div>
      <div style={{ fontSize:11, color:"rgba(255,255,255,0.75)", display:"flex", alignItems:"center", gap:4, marginTop:4 }}>
        🌐 mogalecity.gov.za — <em>The City of Human Origin</em>
      </div>
      <div style={{ height:3, background:`linear-gradient(90deg, ${T.gold}, #f0c030, ${T.gold})`, margin:"10px -16px 0", borderRadius:2 }} />
    </div>
  );
}

// ── HomeScreen ─────────────────────────────────────────────────────────────
function HomeScreen({ readings, statements, onNav }) {
  const latest = readings[0];
  const prev = readings[1];
  const diff = latest && prev ? (latest.reading_kwh - prev.reading_kwh).toFixed(1) : null;
  return (
    <div style={S.screen}>
      <MogaleHeader />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
        {[
          { label:"Latest kWh", val: latest ? latest.reading_kwh.toLocaleString() : "—" },
          { label:"Since Last", val: diff !== null ? `+${diff} kWh` : "—" },
          { label:"Readings", val: readings.length },
          { label:"Statements", val: statements.length },
        ].map(({ label, val }) => (
          <div key={label} style={S.card}>
            <div style={S.label}>{label}</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:26, fontWeight:600, color:T.text, lineHeight:1 }}>{val}</div>
          </div>
        ))}
      </div>
      {!readings.length && (
        <div style={{ ...S.alert("info"), marginBottom:12 }}>
          <span>💡</span>
          <span>No readings yet. Tap <strong>Capture</strong> to photograph your meter and start tracking.</span>
        </div>
      )}
      <div style={{ ...S.alert("info"), fontSize:12 }}>
        <span>🔒</span>
        <span>Every photo is cryptographically fingerprinted on our server. Readings are hash-chained and GPS-stamped. You cannot alter a saved reading.</span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:16 }}>
        <button style={{ ...S.btn("primary","lg"), width:"100%" }} onClick={() => onNav("capture")}>📷 Capture</button>
        <button style={{ ...S.btn("secondary","lg"), width:"100%" }} onClick={() => onNav("compare")}>📊 Compare</button>
      </div>
    </div>
  );
}

// ── CaptureScreen ──────────────────────────────────────────────────────────
function CaptureScreen({ onDone }) {
  const [phase, setPhase] = useState("idle"); // idle | preview | submitting | confirm | manual | done
  const [photoFile, setPhotoFile] = useState(null);
  const [photoURL, setPhotoURL] = useState(null);
  const [aiReading, setAiReading] = useState(null);
  const [manualReading, setManualReading] = useState("");
  const [meterNumber, setMeterNumber] = useState("");
  const [imageHash, setImageHash] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [gps, setGps] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      p => setGps({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {}
    );
  }, []);

  async function handleFile(f) {
    setError(null);
    const compressed = await compressImage(f);
    setPhotoFile(compressed);
    setPhotoURL(URL.createObjectURL(compressed));
    setPhase("preview");
  }

  async function submit() {
    setPhase("submitting");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("photo", photoFile, "meter.jpg");
      fd.append("clientTimestamp", Date.now().toString());
      if (gps) { fd.append("gpsLat", gps.lat); fd.append("gpsLng", gps.lng); }

      const data = await api("POST", "/api/readings/capture", fd, true);

      if (data.status === "manual_required") {
        setImageHash(data.imageHash);
        setMeterNumber(data.meterNumber || "");
        setPhase("manual");
        return;
      }
      // AI succeeded — show confirm screen
      setAiReading(data.aiReading ?? data.reading);
      setMeterNumber(data.meterNumber || "");
      setManualReading(String(data.reading));
      setImageHash(data.imageHash);
      setResult(data);
      setPhase("confirm");
    } catch (e) {
      if (e.message === "This photo has already been submitted") {
        setError("This photo was already submitted.");
        setPhase("preview");
      } else {
        setError(e.message);
        setPhase("preview");
      }
    }
  }

  async function submitManual() {
    const val = parseFloat(manualReading);
    if (!val || isNaN(val) || val <= 0) { setError("Enter a valid reading"); return; }
    setPhase("submitting");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("photo", photoFile, "meter.jpg");
      fd.append("confirmedReading", val);
      fd.append("meterNumber", meterNumber);
      fd.append("clientTimestamp", Date.now().toString());
      if (gps) { fd.append("gpsLat", gps.lat); fd.append("gpsLng", gps.lng); }
      const data = await api("PATCH", "/api/readings/manual", fd, true);
      setResult(data);
      setPhase("done");
    } catch (e) { setError(e.message); setPhase("manual"); }
  }

  async function confirmReading() {
    const val = parseFloat(manualReading);
    if (!val || isNaN(val) || val <= 0) { setError("Enter a valid reading"); return; }
    setPhase("submitting");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("photo", photoFile, "meter.jpg");
      fd.append("confirmedReading", val);
      fd.append("meterNumber", meterNumber);
      fd.append("clientTimestamp", Date.now().toString());
      if (gps) { fd.append("gpsLat", gps.lat); fd.append("gpsLng", gps.lng); }
      const data = await api("POST", "/api/readings/capture", fd, true);
      setResult(data);
      setPhase("done");
    } catch (e) { setError(e.message); setPhase("confirm"); }
  }

  function reset() {
    setPhase("idle"); setPhotoFile(null); setPhotoURL(null);
    setAiReading(null); setManualReading(""); setMeterNumber("");
    setImageHash(null); setResult(null); setError(null);
  }

  // ── done ──
  if (phase === "done" && result) return (
    <div style={S.screen}>
      <div style={{ ...S.card, textAlign:"center", padding:32 }}>
        <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
        <div style={{ fontSize:13, color:T.textFaint, fontWeight:700, letterSpacing:1, marginBottom:8 }}>READING SAVED</div>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:42, fontWeight:700, color:T.accent, marginBottom:4 }}>
          {result.reading?.toLocaleString()}
        </div>
        <div style={{ fontSize:13, color:T.textMuted, marginBottom:20 }}>kWh — {result.readingSource}</div>
        {result.meterNumber && <div style={{ ...S.badge("green"), marginBottom:16 }}>Meter: {result.meterNumber}</div>}
        <div style={{ fontSize:11, color:T.textFaint, fontFamily:"'JetBrains Mono',monospace", wordBreak:"break-all", marginBottom:20 }}>
          🔗 {result.chainHash?.slice(0,32)}…
        </div>
        {result.fraudFlags?.length > 0 && (
          <div style={S.alert("warn")}><span>⚠️</span><span>{result.fraudFlags.join(", ")}</span></div>
        )}
        <button style={{ ...S.btn("primary"), width:"100%" }} onClick={() => { reset(); onDone(); }}>Done</button>
        <button style={{ ...S.btn("ghost"), width:"100%", marginTop:8 }} onClick={reset}>Capture Another</button>
      </div>
    </div>
  );

  // ── confirm ──
  if (phase === "confirm") return (
    <div style={S.screen}>
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:18, fontWeight:700, color:T.accent }}>Confirm Reading</div>
        <div style={{ fontSize:13, color:T.textMuted, marginTop:2 }}>Verify or correct the AI-extracted reading</div>
      </div>
      {photoURL && <img src={photoURL} alt="meter" style={{ width:"100%", borderRadius:12, marginBottom:16, maxHeight:260, objectFit:"cover", border:`1.5px solid ${T.border}` }} />}
      <div style={{ ...S.card, marginBottom:16 }}>
        <div style={S.label}>AI Extracted Reading</div>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:36, fontWeight:700, color: aiReading !== null ? T.accent : T.danger, marginBottom:4 }}>
          {aiReading !== null ? aiReading.toLocaleString() : "Could not read — enter manually"}
        </div>
        <div style={{ ...S.label, marginTop:12 }}>Confirm or Correct Reading (kWh)</div>
        <input style={{ ...S.input, fontFamily:"'JetBrains Mono',monospace", fontSize:24, padding:14 }}
          type="number" inputMode="decimal" placeholder="e.g. 12345.6"
          value={manualReading} onChange={e => setManualReading(e.target.value)} />
        <div style={{ ...S.label, marginTop:12 }}>Meter Number</div>
        <input style={S.input} type="text" placeholder={meterNumber || "Not detected — enter manually"}
          value={meterNumber} onChange={e => setMeterNumber(e.target.value)} />
      </div>
      {error && <div style={S.alert("err")}><span>⚠️</span><span>{error}</span></div>}
      <button style={{ ...S.btn("primary"), width:"100%", marginBottom:10 }} onClick={confirmReading}>
        {phase === "submitting" ? <Spinner /> : "Save Reading"}
      </button>
      <button style={{ ...S.btn("ghost"), width:"100%" }} onClick={reset}>Cancel</button>
    </div>
  );

  // ── manual ──
  if (phase === "manual") return (
    <div style={S.screen}>
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:18, fontWeight:700, color:T.accent }}>Enter Reading Manually</div>
        <div style={{ fontSize:13, color:T.textMuted, marginTop:2 }}>Photo saved. Enter the meter reading below.</div>
      </div>
      {photoURL && <img src={photoURL} alt="meter" style={{ width:"100%", borderRadius:12, marginBottom:16, maxHeight:260, objectFit:"cover", border:`1.5px solid ${T.border}` }} />}
      <div style={{ ...S.alert("warn"), marginBottom:16 }}>
        <span>⚠️</span><span>AI could not read the meter digits. Please enter the reading manually from the photo.</span>
      </div>
      <div style={{ ...S.card, marginBottom:16 }}>
        <div style={S.label}>Meter Reading (kWh)</div>
        <input style={{ ...S.input, fontFamily:"'JetBrains Mono',monospace", fontSize:24, padding:14 }}
          type="number" inputMode="decimal" placeholder="e.g. 12345.6" autoFocus
          value={manualReading} onChange={e => setManualReading(e.target.value)} />
        <div style={{ ...S.label, marginTop:12 }}>Meter Number</div>
        <input style={S.input} type="text" placeholder="From meter plate"
          value={meterNumber} onChange={e => setMeterNumber(e.target.value)} />
      </div>
      {error && <div style={S.alert("err")}><span>⚠️</span><span>{error}</span></div>}
      <button style={{ ...S.btn("primary"), width:"100%", marginBottom:10 }} onClick={submitManual}>Save Reading</button>
      <button style={{ ...S.btn("ghost"), width:"100%" }} onClick={reset}>Cancel</button>
    </div>
  );

  // ── submitting ──
  if (phase === "submitting") return (
    <div style={S.screen}>
      <div style={{ ...S.card, textAlign:"center", padding:48 }}>
        <Spinner />
        <div style={{ marginTop:20, fontSize:15, color:T.textMuted, fontWeight:500 }}>Validating and saving reading…</div>
        <div style={{ marginTop:8, fontSize:12, color:T.textFaint }}>AI is reading the meter digits</div>
      </div>
    </div>
  );

  // ── preview ──
  if (phase === "preview") return (
    <div style={S.screen}>
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:18, fontWeight:700, color:T.accent }}>Capture Reading</div>
        <div style={{ fontSize:13, color:T.textMuted, marginTop:2 }}>Review photo before submitting</div>
      </div>
      {photoURL && <img src={photoURL} alt="meter" style={{ width:"100%", borderRadius:12, marginBottom:16, border:`1.5px solid ${T.border}` }} />}
      {error && <div style={S.alert("err")}><span>⚠️</span><span>{error}</span></div>}
      <button style={{ ...S.btn("primary"), width:"100%", marginBottom:10 }} onClick={submit}>Submit for AI Reading</button>
      <button style={{ ...S.btn("secondary"), width:"100%" }} onClick={reset}>Retake Photo</button>
    </div>
  );

  // ── idle ──
  return (
    <div style={S.screen}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:18, fontWeight:700, color:T.accent }}>Capture Reading</div>
        <div style={{ fontSize:13, color:T.textMuted, marginTop:2 }}>Take a photo of your electricity meter</div>
      </div>
      <div
        style={{ border:`2px dashed ${T.border}`, borderRadius:14, padding:"36px 16px", textAlign:"center", cursor:"pointer", background:T.surface }}
        onClick={() => fileRef.current?.click()}
      >
        <div style={{ fontSize:48, marginBottom:12 }}>📷</div>
        <div style={{ fontSize:15, fontWeight:600, color:T.text, marginBottom:4 }}>Tap to photograph meter</div>
        <div style={{ fontSize:13, color:T.textMuted }}>Make sure the display is clearly visible</div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }}
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
      <div style={{ ...S.alert("info"), marginTop:16, fontSize:12 }}>
        <span>🔒</span>
        <span>Photos are cryptographically secured. GPS location is recorded automatically.</span>
      </div>
    </div>
  );
}

// ── HistoryScreen ──────────────────────────────────────────────────────────
function HistoryScreen({ readings, onRefresh }) {
  const [selected, setSelected] = useState(null);
  const [verify, setVerify] = useState(null);
  const [verifying, setVerifying] = useState(false);

  async function doVerify(id) {
    setVerifying(true);
    try { setVerify(await api("GET", `/api/readings/${id}/verify`)); }
    catch (e) { setVerify({ error: e.message }); }
    setVerifying(false);
  }

  if (selected) {
    const r = selected;
    return (
      <div style={S.screen}>
        <button style={{ ...S.btn("ghost"), marginBottom:16, paddingLeft:0 }} onClick={() => { setSelected(null); setVerify(null); }}>← Back</button>
        <img src={API + r.imagePath} alt="meter" style={{ width:"100%", borderRadius:12, marginBottom:16, border:`1.5px solid ${T.border}` }} />
        <div style={{ ...S.card, marginBottom:12 }}>
          <div style={S.label}>Reading</div>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:36, fontWeight:700, color:T.accent }}>{r.reading_kwh?.toLocaleString()} kWh</div>
          <div style={{ fontSize:13, color:T.textMuted, marginTop:4 }}>{fmt(r.server_ts)}</div>
          {r.meter_number && <div style={{ ...S.badge("green"), marginTop:8 }}>Meter: {r.meter_number}</div>}
        </div>
        <div style={{ ...S.card, marginBottom:12 }}>
          <div style={S.label}>Source</div>
          <div style={{ ...S.badge(r.reading_source === "MANUAL" ? "warn" : "ok") }}>{r.reading_source}</div>
          {r.ai_reading_kwh !== null && r.ai_reading_kwh !== undefined && (
            <div style={{ fontSize:12, color:T.textFaint, marginTop:8 }}>AI reading: {r.ai_reading_kwh} kWh</div>
          )}
        </div>
        {r.gps_lat && (
          <div style={{ ...S.card, marginBottom:12 }}>
            <div style={S.label}>GPS</div>
            <div style={{ fontSize:13, fontFamily:"'JetBrains Mono',monospace", color:T.text }}>{r.gps_lat?.toFixed(6)}, {r.gps_lng?.toFixed(6)}</div>
          </div>
        )}
        {r.fraudFlags?.length > 0 && (
          <div style={{ ...S.alert("warn"), marginBottom:12 }}><span>⚠️</span><span>{r.fraudFlags.join(", ")}</span></div>
        )}
        <div style={{ ...S.card, marginBottom:12 }}>
          <div style={S.label}>Proof Hash</div>
          <div style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", wordBreak:"break-all", color:T.textFaint }}>{r.chain_hash}</div>
        </div>
        {!verify && (
          <button style={{ ...S.btn("secondary"), width:"100%", marginBottom:10 }} onClick={() => doVerify(r.id)} disabled={verifying}>
            {verifying ? <Spinner /> : "🔍 Verify Integrity"}
          </button>
        )}
        {verify && (
          <div style={{ ...S.card, marginBottom:12 }}>
            <div style={S.label}>Integrity Check</div>
            {verify.error ? <div style={{ color:T.danger }}>{verify.error}</div> : verify.checks?.map((c, i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom: i < verify.checks.length-1 ? `1px solid ${T.border}` : "none" }}>
                <span style={{ fontSize:13, color:T.text }}>{c.name}</span>
                <span style={{ ...S.badge(c.pass ? "ok" : "err") }}>{c.pass ? "✓ " : "✗ "}{c.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={S.screen}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:700, color:T.accent }}>Reading History</div>
          <div style={{ fontSize:13, color:T.textMuted }}>{readings.length} records</div>
        </div>
        <button style={S.btn("ghost","sm")} onClick={onRefresh}>↻ Refresh</button>
      </div>
      {!readings.length && <div style={S.alert("info")}><span>📋</span><span>No readings yet.</span></div>}
      <div style={S.card}>
        {readings.map((r, i) => (
          <div key={r.id} onClick={() => setSelected(r)}
            style={{ display:"flex", gap:12, alignItems:"center", padding:"12px 0", borderBottom: i < readings.length-1 ? `1.5px solid ${T.border}` : "none", cursor:"pointer" }}>
            <img src={API + r.imagePath} alt="" style={{ width:54, height:54, borderRadius:10, objectFit:"cover", border:`1.5px solid ${T.border}`, flexShrink:0, background:T.bg }} onError={e => e.target.style.display="none"} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:22, fontWeight:600, color:T.text }}>{r.reading_kwh?.toLocaleString()} kWh</div>
              <div style={{ fontSize:12, color:T.textMuted, marginTop:2 }}>{fmt(r.server_ts)}</div>
              {r.meter_number && <div style={{ fontSize:11, color:T.textFaint, marginTop:2 }}>#{r.meter_number}</div>}
            </div>
            <span style={S.badge(r.reading_source === "MANUAL" ? "warn" : "ok")}>{r.reading_source}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── StatementScreen ────────────────────────────────────────────────────────
function StatementScreen({ statements, onRefresh }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const fileRef = useRef();

  async function handleUpload(f) {
    setUploading(true); setError(null); setSuccess(null);
    try {
      const fd = new FormData();
      fd.append("statement", f, f.name);
      const data = await api("POST", "/api/statements/upload", fd, true);
      setSuccess(`Parsed: ${data.billingPeriodStart} → ${data.billingPeriodEnd}, ${data.unitsConsumed} kWh, R${data.amountDue}`);
      onRefresh();
    } catch (e) { setError(e.message); }
    setUploading(false);
  }

  return (
    <div style={S.screen}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:18, fontWeight:700, color:T.accent }}>Municipal Statements</div>
        <div style={{ fontSize:13, color:T.textMuted }}>Upload your electricity bill to compare with readings</div>
      </div>
      <div style={{ border:`2px dashed ${T.border}`, borderRadius:14, padding:"28px 16px", textAlign:"center", cursor:"pointer", background:T.surface, marginBottom:16, opacity: uploading ? .6 : 1 }}
        onClick={() => !uploading && fileRef.current?.click()}>
        {uploading ? <><Spinner /><div style={{ marginTop:12, color:T.textMuted }}>Parsing statement…</div></> : <>
          <div style={{ fontSize:40, marginBottom:10 }}>📄</div>
          <div style={{ fontSize:15, fontWeight:600, color:T.text, marginBottom:4 }}>Upload Statement</div>
          <div style={{ fontSize:13, color:T.textMuted }}>Photo or scan of your Mogale City bill</div>
        </>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
      {error && <div style={S.alert("err")}><span>⚠️</span><span>{error}</span></div>}
      {success && <div style={S.alert("ok")}><span>✅</span><span>{success}</span></div>}
      {statements.map(s => (
        <div key={s.id} style={{ ...S.card, marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
            <div style={{ fontSize:14, fontWeight:600, color:T.text }}>{s.billing_start} → {s.billing_end}</div>
            <span style={S.badge(s.reading_type === "ACTUAL" ? "ok" : "warn")}>{s.reading_type}</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            {[["Opening", s.opening_kwh], ["Closing", s.closing_kwh], ["Units", s.units_consumed]].map(([l,v]) => (
              <div key={l}><div style={{ fontSize:10, color:T.textFaint, fontWeight:700 }}>{l}</div><div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:14, fontWeight:600 }}>{v ?? "—"}</div></div>
            ))}
          </div>
          {s.amount_due && <div style={{ marginTop:8, fontSize:13, fontWeight:600, color:T.accent }}>R {Number(s.amount_due).toFixed(2)}</div>}
        </div>
      ))}
    </div>
  );
}

// ── CompareScreen ──────────────────────────────────────────────────────────
function CompareScreen({ readings, statements }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function runCompare() {
    setLoading(true); setError(null);
    try { setResult(await api("POST", "/api/compare", {})); }
    catch (e) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div style={S.screen}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:18, fontWeight:700, color:T.accent }}>Billing Comparison</div>
        <div style={{ fontSize:13, color:T.textMuted }}>Compare meter readings against municipal statements</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
        <div style={S.card}><div style={S.label}>Readings</div><div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:26, fontWeight:600 }}>{readings.length}</div></div>
        <div style={S.card}><div style={S.label}>Statements</div><div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:26, fontWeight:600 }}>{statements.length}</div></div>
      </div>
      {(!readings.length || !statements.length) && (
        <div style={S.alert("warn")}><span>⚠️</span><span>You need at least one reading and one statement to compare.</span></div>
      )}
      <button style={{ ...S.btn("primary"), width:"100%", marginBottom:16 }}
        onClick={runCompare} disabled={loading || !readings.length || !statements.length}>
        {loading ? <Spinner /> : "🔍 Analyse Billing"}
      </button>
      {error && <div style={S.alert("err")}><span>⚠️</span><span>{error}</span></div>}
      {result && (
        <>
          <div style={{ ...S.card, marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ fontSize:14, fontWeight:700 }}>Overall Status</div>
              <span style={S.badge(result.overallStatus === "ACCURATE" ? "ok" : result.overallStatus === "OVERBILLED" ? "err" : "warn")}>{result.overallStatus}</span>
            </div>
            <div style={{ fontSize:13, color:T.textSub, lineHeight:1.5 }}>{result.summary}</div>
          </div>
          {result.totalOverbilledKwh > 0 && (
            <div style={{ ...S.card, marginBottom:12, borderColor:T.danger }}>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:28, fontWeight:700, color:T.danger }}>{result.totalOverbilledKwh} kWh</div>
              <div style={{ fontSize:13, color:T.textMuted }}>overbilled — est. R{result.totalRandOverbilled}</div>
            </div>
          )}
          {result.discrepancies?.map((d, i) => (
            <div key={i} style={{ ...S.card, marginBottom:10, borderLeft:`3px solid ${d.severity==="HIGH" ? T.danger : d.severity==="MEDIUM" ? T.gold : T.success}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <span style={{ fontSize:13, fontWeight:600 }}>{d.period}</span>
                <span style={S.badge(d.severity==="HIGH" ? "err" : d.severity==="MEDIUM" ? "warn" : "ok")}>{d.severity}</span>
              </div>
              <div style={{ fontSize:12, color:T.textSub, lineHeight:1.5 }}>{d.explanation}</div>
              {d.overbilledKwh > 0 && <div style={{ fontSize:12, color:T.danger, marginTop:4, fontWeight:600 }}>+{d.overbilledKwh} kWh overbilled ≈ R{d.estimatedRandOverbilled}</div>}
            </div>
          ))}
          {result.recommendedAction && (
            <div style={{ ...S.card, marginBottom:12 }}>
              <div style={S.label}>Recommended Action</div>
              <div style={{ fontSize:13, color:T.textSub, lineHeight:1.5 }}>{result.recommendedAction}</div>
            </div>
          )}
          {result.disputeLetter && (
            <div style={{ ...S.card }}>
              <div style={S.label}>Dispute Letter</div>
              <pre style={{ fontSize:12, color:T.text, whiteSpace:"pre-wrap", lineHeight:1.6, fontFamily:"inherit" }}>{result.disputeLetter}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── AdminScreen ────────────────────────────────────────────────────────────
function AdminScreen() {
  const [token, setToken] = useState(null);
  const [pw, setPw] = useState("");
  const [readings, setReadings] = useState([]);
  const [audit, setAudit] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("readings");

  async function login() {
    setError(null); setLoading(true);
    try {
      const d = await api("POST", "/api/admin/login", { password: pw });
      setToken(d.token);
      loadData(d.token);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function loadData(t) {
    try {
      const [r, a] = await Promise.all([
        fetch(API + "/api/admin/readings", { headers: { "x-admin-token": t, "x-user-id": USER_ID } }).then(r => r.json()),
        fetch(API + "/api/admin/audit", { headers: { "x-admin-token": t, "x-user-id": USER_ID } }).then(r => r.json()),
      ]);
      setReadings(Array.isArray(r) ? r : []);
      setAudit(Array.isArray(a) ? a : []);
    } catch (e) { setError(e.message); }
  }

  async function deleteReading(id) {
    if (!confirm("Delete this reading?")) return;
    await fetch(API + "/api/admin/readings/" + id, { method:"DELETE", headers: { "x-admin-token": token, "x-user-id": USER_ID } });
    loadData(token);
  }

  async function wipeAll() {
    if (!confirm("WIPE ALL DATA? This cannot be undone.")) return;
    await fetch(API + "/api/admin/wipe", { method:"DELETE", headers: { "x-admin-token": token, "x-user-id": USER_ID } });
    loadData(token);
  }

  if (!token) return (
    <div style={S.screen}>
      <div style={{ fontSize:18, fontWeight:700, color:T.accent, marginBottom:20 }}>Admin Login</div>
      <div style={{ ...S.card, padding:32 }}>
        <div style={{ fontSize:32, textAlign:"center", marginBottom:20 }}>⚡ MeterWatch</div>
        <div style={{ fontSize:13, color:T.textFaint, textAlign:"center", marginBottom:24 }}>Admin Portal</div>
        <input style={{ ...S.input, marginBottom:12 }} type="password" placeholder="Admin password"
          value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} />
        <button style={{ ...S.btn("primary"), width:"100%" }} onClick={login} disabled={loading}>
          {loading ? <Spinner /> : "Sign In"}
        </button>
        {error && <div style={{ ...S.alert("err"), marginTop:12 }}><span>⚠️</span><span>{error}</span></div>}
      </div>
    </div>
  );

  return (
    <div style={S.screen}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontSize:18, fontWeight:700, color:T.accent }}>Admin Panel</div>
        <button style={S.btn("danger","sm")} onClick={wipeAll}>Wipe All</button>
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {["readings","audit"].map(t => (
          <button key={t} style={{ ...S.btn(tab===t ? "primary" : "secondary","sm") }} onClick={() => setTab(t)}>
            {t === "readings" ? `Readings (${readings.length})` : `Audit (${audit.length})`}
          </button>
        ))}
        <button style={S.btn("ghost","sm")} onClick={() => loadData(token)}>↻</button>
      </div>
      {tab === "readings" && readings.map(r => (
        <div key={r.id} style={{ ...S.card, marginBottom:10 }}>
          <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
            <img src={API + r.imagePath} alt="" style={{ width:60, height:60, borderRadius:8, objectFit:"cover", border:`1.5px solid ${T.border}`, flexShrink:0 }} onError={e => e.target.style.display="none"} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:20, fontWeight:600 }}>{r.reading_kwh} kWh</div>
              <div style={{ fontSize:11, color:T.textFaint }}>{fmt(r.server_ts)}</div>
              <div style={{ fontSize:11, color:T.textFaint }}>User: {r.user_id}</div>
              {r.meter_number && <div style={{ fontSize:11, color:T.textFaint }}>Meter: {r.meter_number}</div>}
              {r.fraudFlags?.length > 0 && <div style={{ ...S.badge("err"), marginTop:4 }}>⚠️ {r.fraudFlags[0]}</div>}
              <span style={{ ...S.badge(r.reading_source === "MANUAL" ? "warn" : "ok"), marginTop:4 }}>{r.reading_source}</span>
            </div>
            <button style={S.btn("danger","sm")} onClick={() => deleteReading(r.id)}>✕</button>
          </div>
        </div>
      ))}
      {tab === "audit" && audit.slice().reverse().map((a, i) => (
        <div key={i} style={{ ...S.card, marginBottom:8, padding:"10px 14px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <span style={{ ...S.badge(a.event?.includes("ERROR")||a.event?.includes("FRAUD") ? "err" : a.event?.includes("SUCCESS") ? "ok" : "green"), fontSize:10 }}>{a.event}</span>
            <span style={{ fontSize:11, color:T.textFaint }}>{fmt(a.server_ts)}</span>
          </div>
          <div style={{ fontSize:11, color:T.textFaint, fontFamily:"'JetBrains Mono',monospace" }}>{a.user_id}</div>
          <div style={{ fontSize:11, color:T.textSub, marginTop:2 }}>{a.details?.slice(0,120)}</div>
        </div>
      ))}
    </div>
  );
}

// ── Nav icons ──────────────────────────────────────────────────────────────
const NAV = [
  { id:"home", label:"Home", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { id:"capture", label:"Capture", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"/><path d="M22 7H20a2 2 0 0 0-2-2h-2l-2-3H10L8 5H6a2 2 0 0 0-2 2H2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/></svg> },
  { id:"history", label:"History", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
  { id:"statement", label:"Statement", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> },
  { id:"compare", label:"Compare", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/></svg> },
  { id:"admin", label:"Admin", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
];

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("home");
  const [readings, setReadings] = useState([]);
  const [statements, setStatements] = useState([]);

  const loadReadings = useCallback(async () => {
    try { setReadings(await api("GET", "/api/readings")); } catch {}
  }, []);

  const loadStatements = useCallback(async () => {
    try { setStatements(await api("GET", "/api/statements")); } catch {}
  }, []);

  useEffect(() => { loadReadings(); loadStatements(); }, []);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; margin: 0; padding: 0; } html { -webkit-tap-highlight-color: transparent; } body { background: ${T.bg}; color: ${T.text}; font-family: 'DM Sans', system-ui, sans-serif; font-size: 16px; line-height: 1.5; overscroll-behavior: none; } button:active { opacity: .85; transform: scale(.97); } input:focus { border-color: ${T.accent} !important; background: #fff !important; }`;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  return (
    <div style={S.app}>
      {screen === "home" && <HomeScreen readings={readings} statements={statements} onNav={setScreen} />}
      {screen === "capture" && <CaptureScreen onDone={() => { loadReadings(); setScreen("history"); }} />}
      {screen === "history" && <HistoryScreen readings={readings} onRefresh={loadReadings} />}
      {screen === "statement" && <StatementScreen statements={statements} onRefresh={loadStatements} />}
      {screen === "compare" && <CompareScreen readings={readings} statements={statements} />}
      {screen === "admin" && <AdminScreen />}
      <nav style={S.bottomNav}>
        {NAV.map(({ id, label, icon }) => (
          <button key={id} style={S.navItem(screen === id)} onClick={() => setScreen(id)}>
            {icon}{label}
          </button>
        ))}
      </nav>
    </div>
  );
}

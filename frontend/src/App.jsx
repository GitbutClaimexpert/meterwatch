import { useState, useRef, useEffect, useCallback } from "react";

// ── API base URL — set this to your deployed backend ──────────────────────────
const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

// ── Simple persistent user ID (in production use proper auth) ─────────────────
function getUserId() {
  let id = localStorage.getItem("mw_uid");
  if (!id) { id = "u_" + Math.random().toString(36).slice(2, 10); localStorage.setItem("mw_uid", id); }
  return id;
}
const USER_ID = getUserId();

async function api(method, path, body, isFormData = false) {
  const opts = {
    method,
    headers: { "x-user-id": USER_ID },
  };
  if (body) {
    if (isFormData) { opts.body = body; }
    else { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
  }
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg: "#080b0f",
  surface: "#0e1318",
  card: "#141a22",
  border: "#1e2a38",
  borderHover: "#2e4058",
  accent: "#e8b84b",
  accentDark: "#6b4f0f",
  success: "#34c97a",
  danger: "#e05252",
  warn: "#e8b84b",
  text: "#dde3ed",
  muted: "#667080",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
  sans: "'DM Sans', system-ui, sans-serif",
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=JetBrains+Mono:wght@400;600&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-tap-highlight-color: transparent; }
body { background: ${T.bg}; color: ${T.text}; font-family: ${T.sans}; font-size: 16px; line-height: 1.5; min-height: 100dvh; overscroll-behavior: none; }
button { cursor: pointer; border: none; background: none; font-family: inherit; color: inherit; }
input { font-family: inherit; color: inherit; }
img { display: block; }
::-webkit-scrollbar { width: 3px; height: 3px; }
::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 2px; }

/* Layout */
.app { display: flex; flex-direction: column; min-height: 100dvh; max-width: 430px; margin: 0 auto; }
.screen { flex: 1; padding: 24px 16px 96px; overflow-y: auto; }
.bottomnav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 430px; background: ${T.surface}; border-top: 1px solid ${T.border}; display: flex; z-index: 100; padding-bottom: env(safe-area-inset-bottom); }
.nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 10px 4px 8px; font-size: 10px; font-weight: 500; letter-spacing: .3px; color: ${T.muted}; transition: color .15s; border: none; background: none; cursor: pointer; }
.nav-item svg { width: 22px; height: 22px; stroke-width: 1.6; transition: transform .15s; }
.nav-item.active { color: ${T.accent}; }
.nav-item.active svg { transform: scale(1.1); }
.nav-item:active svg { transform: scale(.92); }

/* Header */
.screen-header { margin-bottom: 24px; }
.screen-title { font-family: ${T.mono}; font-size: 20px; font-weight: 600; color: ${T.accent}; letter-spacing: -.3px; }
.screen-sub { font-size: 13px; color: ${T.muted}; margin-top: 3px; }

/* Cards */
.card { background: ${T.card}; border: 1px solid ${T.border}; border-radius: 14px; padding: 16px; }
.card + .card { margin-top: 10px; }
.card-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px; color: ${T.muted}; font-weight: 500; margin-bottom: 6px; }
.card-value { font-family: ${T.mono}; font-size: 30px; font-weight: 600; line-height: 1; }
.card-sub { font-size: 12px; color: ${T.muted}; margin-top: 5px; }

/* Stats */
.stat-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
.stat { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 12px; padding: 14px; }
.stat-n { font-family: ${T.mono}; font-size: 26px; font-weight: 600; line-height: 1; }
.stat-l { font-size: 11px; color: ${T.muted}; margin-top: 5px; }

/* Buttons */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 14px 20px; border-radius: 12px; font-size: 15px; font-weight: 500; transition: all .15s; line-height: 1; }
.btn:active { transform: scale(.96); }
.btn-primary { background: ${T.accent}; color: #0a0700; }
.btn-primary:hover { background: #f5cc6a; }
.btn-secondary { background: ${T.surface}; color: ${T.text}; border: 1px solid ${T.border}; }
.btn-secondary:hover { border-color: ${T.borderHover}; }
.btn-ghost { color: ${T.muted}; padding: 10px 14px; font-size: 14px; }
.btn-ghost:hover { color: ${T.text}; }
.btn-full { width: 100%; }
.btn-lg { padding: 18px 24px; font-size: 16px; border-radius: 14px; }
.btn-sm { padding: 8px 14px; font-size: 13px; border-radius: 8px; }

/* Alerts */
.alert { padding: 12px 14px; border-radius: 10px; font-size: 13px; line-height: 1.5; display: flex; gap: 10px; align-items: flex-start; margin-bottom: 12px; }
.alert-icon { font-size: 15px; flex-shrink: 0; margin-top: 1px; }
.alert-warn { background: #1a1200; border: 1px solid ${T.accentDark}; color: ${T.accent}; }
.alert-err { background: #1a0808; border: 1px solid #5a1010; color: ${T.danger}; }
.alert-ok { background: #081a10; border: 1px solid #0e5025; color: ${T.success}; }
.alert-info { background: ${T.surface}; border: 1px solid ${T.border}; color: ${T.muted}; }

/* Badges */
.badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; }
.badge-ok { background: #062010; color: ${T.success}; border: 1px solid #0e4020; }
.badge-warn { background: #1a1200; color: ${T.accent}; border: 1px solid ${T.accentDark}; }
.badge-err { background: #1a0606; color: ${T.danger}; border: 1px solid #5a0f0f; }

/* Camera */
.camera-wrap { width: 100%; border-radius: 16px; overflow: hidden; background: #000; position: relative; border: 1px solid ${T.border}; aspect-ratio: 3/4; }
.camera-wrap video, .camera-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
.camera-frame { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
.camera-guide { width: 80%; height: 22%; border: 2px solid ${T.accent}; border-radius: 8px; box-shadow: 0 0 0 9999px rgba(0,0,0,.45); position: relative; }
.camera-guide::before { content: 'Align meter display here'; position: absolute; bottom: -28px; left: 50%; transform: translateX(-50%); font-size: 11px; color: ${T.accent}; white-space: nowrap; background: rgba(0,0,0,.7); padding: 3px 10px; border-radius: 10px; }
.camera-corner { position: absolute; width: 16px; height: 16px; border-color: ${T.accent}; border-style: solid; }
.camera-corner.tl { top: -2px; left: -2px; border-width: 3px 0 0 3px; border-radius: 3px 0 0 0; }
.camera-corner.tr { top: -2px; right: -2px; border-width: 3px 3px 0 0; border-radius: 0 3px 0 0; }
.camera-corner.bl { bottom: -2px; left: -2px; border-width: 0 0 3px 3px; border-radius: 0 0 0 3px; }
.camera-corner.br { bottom: -2px; right: -2px; border-width: 0 3px 3px 0; border-radius: 0 0 3px 0; }
.capture-btn { width: 72px; height: 72px; border-radius: 50%; background: ${T.accent}; border: 4px solid rgba(255,255,255,.2); display: flex; align-items: center; justify-content: center; transition: transform .15s; }
.capture-btn:active { transform: scale(.9); }

/* Reading list */
.reading-item { display: flex; gap: 12px; align-items: center; padding: 12px 0; border-bottom: 1px solid ${T.border}; cursor: pointer; }
.reading-item:last-child { border-bottom: none; }
.reading-thumb { width: 54px; height: 54px; border-radius: 10px; object-fit: cover; background: ${T.surface}; flex-shrink: 0; border: 1px solid ${T.border}; }
.reading-thumb-placeholder { width: 54px; height: 54px; border-radius: 10px; background: ${T.surface}; border: 1px solid ${T.border}; display: flex; align-items: center; justify-content: center; color: ${T.muted}; font-size: 20px; flex-shrink: 0; }
.reading-body { flex: 1; min-width: 0; }
.reading-val { font-family: ${T.mono}; font-size: 22px; font-weight: 600; }
.reading-date { font-size: 12px; color: ${T.muted}; margin-top: 2px; }

/* Chain */
.chain-indicator { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
.chain-dot { width: 8px; height: 8px; border-radius: 50%; background: ${T.accent}; }
.chain-line { width: 1px; flex: 1; background: ${T.border}; min-height: 20px; }

/* Spinner */
.spinner { width: 22px; height: 22px; border: 2px solid ${T.border}; border-top-color: ${T.accent}; border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Drop zone */
.dropzone { border: 2px dashed ${T.border}; border-radius: 14px; padding: 36px 16px; text-align: center; cursor: pointer; transition: all .2s; }
.dropzone:hover, .dropzone.drag { border-color: ${T.accent}; background: rgba(232,184,75,.04); }
.dropzone-icon { font-size: 40px; margin-bottom: 12px; }
.dropzone-title { font-size: 15px; font-weight: 500; color: ${T.text}; margin-bottom: 4px; }
.dropzone-sub { font-size: 13px; color: ${T.muted}; }

/* Compare */
.discrepancy-row { border-left: 3px solid ${T.danger}; padding-left: 12px; margin-bottom: 10px; }
.discrepancy-row.low { border-left-color: ${T.success}; }
.discrepancy-row.medium { border-left-color: ${T.accent}; }

/* Input */
.input-field { width: 100%; background: ${T.surface}; border: 1px solid ${T.border}; color: ${T.text}; padding: 12px 14px; border-radius: 10px; font-size: 16px; outline: none; transition: border-color .15s; }
.input-field:focus { border-color: ${T.accent}; }
.input-mono { font-family: ${T.mono}; font-size: 24px; padding: 14px; }

/* Divider */
.divider { height: 1px; background: ${T.border}; margin: 16px 0; }

/* Slide-in */
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.slide-up { animation: slideUp .25s ease; }

/* Flash */
@keyframes flashWhite { 0%,100% { opacity: 1; } 50% { opacity: 0; background: #fff; } }
.flash { animation: flashWhite .15s ease; }
`;

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const Ico = ({ name, size = 24, color }) => {
  const paths = {
    home: <><path d="M3 12L12 3l9 9"/><path d="M5 10v9a1 1 0 001 1h4v-4h4v4h4a1 1 0 001-1v-9"/></>,
    camera: <><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></>,
    list: <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="3" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="3" cy="18" r="1" fill="currentColor" stroke="none"/></>,
    upload: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
    compare: <><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
    check: <polyline points="20,6 9,17 4,12" strokeWidth="2.5"/>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    refresh: <><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></>,
    chevron: <polyline points="9,18 15,12 9,6"/>,
    download: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    lock: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>,
    zap: <><polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, flexShrink: 0 }}>
      {paths[name]}
    </svg>
  );
};

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("home");
  const [readings, setReadings] = useState([]);
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([api("GET", "/api/readings"), api("GET", "/api/statements")]);
      setReadings(r); setStatements(s);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const tabs = [
    { id: "home", label: "Home", icon: "home" },
    { id: "capture", label: "Capture", icon: "camera" },
    { id: "history", label: "History", icon: "list" },
    { id: "upload", label: "Statement", icon: "upload" },
    { id: "compare", label: "Compare", icon: "compare" },
  ];

  const Screens = { home: HomeScreen, capture: CaptureScreen, history: HistoryScreen, upload: UploadScreen, compare: CompareScreen };
  const Screen = Screens[tab];

  return (
    <>
      <style>{css}</style>
      <div className="app">
        {loading
          ? <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
              <div className="spinner" />
              <div style={{ fontSize: 13, color: T.muted }}>Loading MeterWatch…</div>
            </div>
          : <Screen readings={readings} statements={statements} onRefresh={loadData} goTo={setTab} />
        }
        <nav className="bottomnav">
          {tabs.map(t => (
            <button key={t.id} className={`nav-item ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              <Ico name={t.icon} size={22} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}

// ── Home Screen ───────────────────────────────────────────────────────────────
function HomeScreen({ readings, statements, goTo }) {
  const latest = readings[0];
  const prev = readings[1];
  const consumed = latest && prev ? (latest.reading_kwh - prev.reading_kwh).toFixed(1) : null;

  return (
    <div className="screen">
      <div className="screen-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Ico name="zap" size={22} color={T.accent} />
          <span className="screen-title">MeterWatch</span>
        </div>
        <p className="screen-sub">Verified electricity monitoring · Cape Town</p>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="stat-n" style={{ color: T.accent, fontSize: 22 }}>{latest ? latest.reading_kwh.toLocaleString() : "—"}</div>
          <div className="stat-l">Latest kWh</div>
        </div>
        <div className="stat">
          <div className="stat-n" style={{ fontSize: 22 }}>{consumed ?? "—"}</div>
          <div className="stat-l">Since Last</div>
        </div>
        <div className="stat">
          <div className="stat-n">{readings.length}</div>
          <div className="stat-l">Readings</div>
        </div>
        <div className="stat">
          <div className="stat-n">{statements.length}</div>
          <div className="stat-l">Statements</div>
        </div>
      </div>

      {latest && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-label">Most Recent Reading</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div className="card-value">{latest.reading_kwh.toLocaleString()}<span style={{ fontSize: 16, color: T.muted, fontWeight: 400 }}> kWh</span></div>
              <div className="card-sub">{new Date(latest.timestamp).toLocaleString("en-ZA")}</div>
            </div>
            <span className="badge badge-ok"><Ico name="shield" size={11} /> Verified</span>
          </div>
          {latest.fraudFlags?.length > 0 && (
            <div style={{ marginTop: 10, padding: "8px 10px", background: "#1a1000", borderRadius: 8, fontSize: 12, color: T.accent }}>
              ⚠ {latest.fraudFlags.length} integrity flag{latest.fraudFlags.length > 1 ? "s" : ""} — tap History to review
            </div>
          )}
        </div>
      )}

      {!latest && (
        <div className="alert alert-info">
          <span className="alert-icon">💡</span>
          <div>No readings yet. Tap <strong>Capture</strong> to photograph your meter and start tracking.</div>
        </div>
      )}

      <div className="alert alert-info">
        <Ico name="lock" size={15} />
        <div style={{ fontSize: 12 }}>
          Every photo is cryptographically fingerprinted on our server. Readings are hash-chained and GPS-stamped. You cannot alter a saved reading.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
        <button className="btn btn-primary" onClick={() => goTo("capture")}><Ico name="camera" size={18} /> Capture</button>
        <button className="btn btn-secondary" onClick={() => goTo("compare")}><Ico name="compare" size={18} /> Compare</button>
      </div>
    </div>
  );
}

// ── Capture Screen ─────────────────────────────────────────────────────────────
function CaptureScreen({ onRefresh }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [phase, setPhase] = useState("start"); // start|camera|preview|extracting|confirm|submitting|done|error
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [capturedUrl, setCapturedUrl] = useState(null);
  const [captureTs, setCaptureTs] = useState(null);
  const [aiReading, setAiReading] = useState(null);
  const [confirmedReading, setConfirmedReading] = useState("");
  const [gps, setGps] = useState(null);
  const [error, setError] = useState("");
  const [savedResult, setSavedResult] = useState(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(p => setGps({ lat: p.coords.latitude, lng: p.coords.longitude }), () => {}, { timeout: 5000 });
  }, []);

  const stopStream = useCallback(() => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
  }, [stream]);

  useEffect(() => () => stopStream(), [stopStream]);

  const startCamera = async () => {
    setError("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      setStream(s);
      if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play(); }
      setPhase("camera");
    } catch {
      setError("Camera access denied. Please enable camera permissions in your browser settings.");
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ts = Date.now();
    setCaptureTs(ts);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(async blob => {
      stopStream();
      const url = URL.createObjectURL(blob);
      setCapturedBlob(blob);
      setCapturedUrl(url);
      setPhase("extracting");
      // Get AI reading without saving yet
      try {
        const fd = new FormData();
        fd.append("photo", blob, "meter.jpg");
        const result = await api("POST", "/api/readings/extract-only", fd, true);
        setAiReading(result.aiReading);
        setConfirmedReading(result.aiReading ? result.aiReading.toString() : "");
        setPhase("confirm");
      } catch (e) {
        setAiReading(null);
        setConfirmedReading("");
        setPhase("confirm");
      }
    }, "image/jpeg", 0.93);
  };

  const submitReading = async () => {
    const val = parseFloat(confirmedReading);
    if (isNaN(val) || val <= 0) { setError("Please enter a valid reading."); return; }
    setError("");
    setPhase("submitting");
    try {
      const fd = new FormData();
      fd.append("photo", capturedBlob, "meter.jpg");
      fd.append("clientTimestamp", captureTs.toString());
      fd.append("confirmedReading", val.toString());
      if (gps) { fd.append("gpsLat", gps.lat); fd.append("gpsLng", gps.lng); }
      const result = await api("POST", "/api/readings/capture", fd, true);
      setSavedResult(result);
      setPhase("done");
      onRefresh();
    } catch (e) {
      setError(e.message);
      setPhase("confirm");
    }
  };

  const reset = () => {
    stopStream();
    setCapturedBlob(null); setCapturedUrl(null); setCaptureTs(null);
    setAiReading(null); setConfirmedReading(""); setError(""); setSavedResult(null);
    setPhase("start");
  };

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-title">Capture Reading</div>
        <p className="screen-sub">Live camera only — no uploads accepted</p>
      </div>

      {phase === "start" && (
        <div>
          <div className="alert alert-warn" style={{ marginBottom: 20 }}>
            <Ico name="lock" size={16} />
            <div style={{ fontSize: 13 }}>
              <strong>Camera-only capture.</strong> File uploads are disabled to prevent fraud. Your photo is fingerprinted and GPS-stamped the moment it's taken.
            </div>
          </div>
          <button className="btn btn-primary btn-full btn-lg" onClick={startCamera}>
            <Ico name="camera" size={20} /> Open Camera
          </button>
          {error && <div className="alert alert-err" style={{ marginTop: 12 }}><span className="alert-icon">✕</span><div>{error}</div></div>}
          <div style={{ marginTop: 20, padding: 16, background: T.surface, borderRadius: 12, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.7 }}>
              <div style={{ fontWeight: 500, color: T.text, marginBottom: 6 }}>How it works</div>
              1. Point your phone camera at the meter display<br />
              2. AI reads the digits automatically<br />
              3. Confirm or correct the reading<br />
              4. Reading is saved with cryptographic proof
            </div>
          </div>
        </div>
      )}

      {phase === "camera" && (
        <div>
          <div className="camera-wrap" style={{ marginBottom: 16 }}>
            <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div className="camera-frame">
              <div className="camera-guide">
                <div className="camera-corner tl" /><div className="camera-corner tr" />
                <div className="camera-corner bl" /><div className="camera-corner br" />
              </div>
            </div>
          </div>
          <canvas ref={canvasRef} style={{ display: "none" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button className="btn btn-ghost" onClick={reset}><Ico name="x" size={18} /> Cancel</button>
            <button className="capture-btn" onClick={capturePhoto} aria-label="Capture">
              <Ico name="camera" size={28} color="#0a0700" />
            </button>
            <div style={{ width: 80 }} />
          </div>
        </div>
      )}

      {phase === "extracting" && (
        <div>
          {capturedUrl && <img src={capturedUrl} alt="captured" style={{ width: "100%", borderRadius: 16, marginBottom: 16, border: `1px solid ${T.border}` }} />}
          <div className="card" style={{ textAlign: "center", padding: 28 }}>
            <div className="spinner" style={{ margin: "0 auto 12px" }} />
            <div style={{ color: T.muted }}>AI reading your meter…</div>
          </div>
        </div>
      )}

      {phase === "confirm" && (
        <div className="slide-up">
          {capturedUrl && <img src={capturedUrl} alt="captured" style={{ width: "100%", borderRadius: 16, marginBottom: 14, maxHeight: 260, objectFit: "cover", border: `1px solid ${T.border}` }} />}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-label">AI Extracted Reading</div>
            <div style={{ fontFamily: T.mono, fontSize: 28, color: aiReading ? T.accent : T.danger, fontWeight: 600, marginBottom: 12 }}>
              {aiReading != null ? `${aiReading.toLocaleString()} kWh` : "Could not read — enter manually"}
            </div>
            <div className="card-label">Confirm or Correct Reading (kWh)</div>
            <input
              className="input-field input-mono"
              type="number"
              min="0"
              step="0.1"
              placeholder="e.g. 12345.6"
              value={confirmedReading}
              onChange={e => { setConfirmedReading(e.target.value); setError(""); }}
            />
            {error && <div style={{ color: T.danger, fontSize: 13, marginTop: 8 }}>{error}</div>}
          </div>
          {gps && <div style={{ fontSize: 11, color: T.muted, textAlign: "center", marginBottom: 10 }}>📍 GPS: {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary btn-full" onClick={submitReading}><Ico name="check" size={18} /> Save Reading</button>
            <button className="btn btn-secondary" style={{ paddingLeft: 16, paddingRight: 16 }} onClick={reset}>Retake</button>
          </div>
        </div>
      )}

      {phase === "submitting" && (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <div className="spinner" style={{ margin: "0 auto 12px" }} />
          <div style={{ color: T.muted }}>Validating & saving reading…</div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>Server is verifying your photo for authenticity</div>
        </div>
      )}

      {phase === "done" && savedResult && (
        <div className="slide-up">
          <div className="alert alert-ok" style={{ marginBottom: 16 }}>
            <Ico name="check" size={16} />
            <div><strong>Reading verified and saved!</strong><br /><span style={{ fontSize: 12 }}>Cryptographic fingerprint recorded.</span></div>
          </div>
          <div className="card">
            <div className="card-label">Reading</div>
            <div className="card-value">{savedResult.reading.toLocaleString()} kWh</div>
            <div className="divider" />
            <div className="card-label">SHA-256 Fingerprint</div>
            <div style={{ fontFamily: T.mono, fontSize: 10, wordBreak: "break-all", color: T.muted, lineHeight: 1.7 }}>{savedResult.imageHash}</div>
            <div className="divider" />
            <div className="card-label">Chain Hash</div>
            <div style={{ fontFamily: T.mono, fontSize: 10, wordBreak: "break-all", color: T.muted, lineHeight: 1.7 }}>{savedResult.chainHash}</div>
            {savedResult.fraudFlags?.length > 0 && (
              <>
                <div className="divider" />
                <div className="card-label" style={{ color: T.accent }}>Integrity Flags</div>
                {savedResult.fraudFlags.map((f, i) => <div key={i} style={{ fontSize: 12, color: T.accent, padding: "3px 0" }}>⚠ {f}</div>)}
              </>
            )}
          </div>
          <button className="btn btn-primary btn-full" onClick={reset} style={{ marginTop: 12 }}>Capture Another</button>
        </div>
      )}

      {phase === "error" && (
        <div>
          <div className="alert alert-err"><span className="alert-icon">✕</span><div>{error}</div></div>
          <button className="btn btn-secondary btn-full" onClick={reset}>Try Again</button>
        </div>
      )}
    </div>
  );
}

// ── History Screen ─────────────────────────────────────────────────────────────
function HistoryScreen({ readings }) {
  const [selected, setSelected] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [imageIntegrity, setImageIntegrity] = useState(null); // from response headers

  const loadImageWithIntegrityCheck = async (r) => {
    try {
      const resp = await fetch(`${API}${r.imagePath}`, { headers: { "x-user-id": USER_ID } });
      const integrity = resp.headers.get("X-Integrity");
      const liveHash  = resp.headers.get("X-Live-Hash");
      const stored    = resp.headers.get("X-Stored-Hash");
      setImageIntegrity({ integrity, liveHash, stored, match: integrity === "VERIFIED" });
    } catch {
      setImageIntegrity({ integrity: "ERROR", match: false });
    }
  };

  const runVerify = async (r) => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const result = await api("GET", `/api/readings/${r.id}/verify`);
      setVerifyResult(result);
    } catch (e) {
      setVerifyResult({ pass: false, checks: [{ name: "Verification", pass: false, detail: e.message }] });
    }
    setVerifying(false);
  };

  const selectReading = (r) => {
    setSelected(r);
    setVerifyResult(null);
    setImageIntegrity(null);
    loadImageWithIntegrityCheck(r);
  };

  if (selected) {
    const r = selected;
    return (
      <div className="screen slide-up">
        <button className="btn btn-ghost" onClick={() => setSelected(null)} style={{ marginBottom: 16 }}>← Back</button>

        {/* Meter photo with live integrity badge */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <img
            src={`${API}${r.imagePath}`}
            alt="meter"
            style={{ width: "100%", borderRadius: 14, border: `1px solid ${T.border}`, display: "block" }}
            onError={e => { e.target.style.display = "none"; }}
          />
          {imageIntegrity && (
            <div style={{
              position: "absolute", top: 10, right: 10,
              background: imageIntegrity.match ? "rgba(8,26,16,.9)" : "rgba(26,8,8,.9)",
              border: `1px solid ${imageIntegrity.match ? "#0e5025" : "#5a1010"}`,
              color: imageIntegrity.match ? T.success : T.danger,
              borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 500,
            }}>
              {imageIntegrity.match ? "✓ Image Verified" : "⚠ Hash Mismatch"}
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 10 }}>
          <div className="card-label">Reading</div>
          <div className="card-value">{r.reading_kwh.toLocaleString()} <span style={{ fontSize: 16, color: T.muted, fontWeight: 400 }}>kWh</span></div>
          <div className="card-sub">
            {new Date(r.server_ts).toLocaleString("en-ZA")} · {r.reading_source?.replace("_", " ")}
          </div>
          {r.ai_reading_kwh && r.ai_reading_kwh !== r.reading_kwh && (
            <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
              AI read: {r.ai_reading_kwh} kWh (user corrected to {r.reading_kwh})
            </div>
          )}
        </div>

        {r.gps_lat && (
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="card-label">GPS Location</div>
            <div style={{ fontFamily: T.mono, fontSize: 13 }}>{r.gps_lat.toFixed(6)}, {r.gps_lng.toFixed(6)}</div>
          </div>
        )}

        <div className="card" style={{ marginBottom: 10 }}>
          <div className="card-label">Image SHA-256 Fingerprint</div>
          <div style={{ fontFamily: T.mono, fontSize: 10, wordBreak: "break-all", color: T.muted, lineHeight: 1.8 }}>{r.image_hash}</div>
          <div className="card-label" style={{ marginTop: 10 }}>Chain Hash</div>
          <div style={{ fontFamily: T.mono, fontSize: 10, wordBreak: "break-all", color: T.muted, lineHeight: 1.8 }}>{r.chain_hash}</div>
        </div>

        <div className="card" style={{ marginBottom: 10 }}>
          <div className="card-label">HMAC Proof Payload (what was signed)</div>
          <div style={{ fontFamily: T.mono, fontSize: 10, wordBreak: "break-all", color: T.muted, lineHeight: 1.9 }}>
            {r.proof?.payload?.split("|").map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </div>

        {r.fraudFlags?.length > 0 && (
          <div className="card" style={{ borderColor: T.accentDark, marginBottom: 10 }}>
            <div className="card-label" style={{ color: T.accent }}>Integrity Flags</div>
            {r.fraudFlags.map((f, i) => (
              <div key={i} style={{ fontSize: 12, color: T.accent, padding: "4px 0", borderBottom: i < r.fraudFlags.length - 1 ? `1px solid ${T.border}` : "none" }}>⚠ {f}</div>
            ))}
          </div>
        )}

        {/* Live verification button */}
        <button
          className="btn btn-secondary btn-full"
          onClick={() => runVerify(r)}
          disabled={verifying}
          style={{ marginBottom: 10 }}
        >
          {verifying ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Verifying…</> : <><Ico name="shield" size={16} /> Run Integrity Verification</>}
        </button>

        {verifyResult && (
          <div className="card slide-up" style={{ borderColor: verifyResult.pass ? "#0e5025" : "#5a1010" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Ico name={verifyResult.pass ? "check" : "x"} size={18} color={verifyResult.pass ? T.success : T.danger} />
              <div style={{ fontWeight: 500, color: verifyResult.pass ? T.success : T.danger }}>
                {verifyResult.pass ? "All checks passed — record is genuine" : "Verification failed — record integrity compromised"}
              </div>
            </div>
            {verifyResult.checks?.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: `1px solid ${T.border}`, alignItems: "flex-start" }}>
                <span style={{ color: c.pass ? T.success : T.danger, flexShrink: 0, marginTop: 1 }}>{c.pass ? "✓" : "✗"}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{c.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-title">Reading History</div>
        <p className="screen-sub">{readings.length} verified readings</p>
      </div>
      {readings.length === 0
        ? <div className="alert alert-info"><span className="alert-icon">📋</span><div>No readings yet. Capture your first meter reading to start your history.</div></div>
        : readings.map((r, i) => (
          <button key={r.id} onClick={() => selectReading(r)} style={{ width: "100%", background: "none", border: "none", textAlign: "left" }}>
            <div className="reading-item">
              <div className="chain-indicator">
                <div className="chain-dot" />
                {i < readings.length - 1 && <div className="chain-line" />}
              </div>
              <div className="reading-thumb-placeholder">⚡</div>
              <div className="reading-body">
                <div className="reading-val">{r.reading_kwh.toLocaleString()} <span style={{ fontSize: 14, color: T.muted }}>kWh</span></div>
                <div className="reading-date">{new Date(r.server_ts).toLocaleDateString("en-ZA")} {new Date(r.server_ts).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</div>
                <div style={{ marginTop: 5 }}>
                  {r.fraudFlags?.length > 0
                    ? <span className="badge badge-warn">⚠ {r.fraudFlags.length} flag{r.fraudFlags.length > 1 ? "s" : ""}</span>
                    : <span className="badge badge-ok"><Ico name="check" size={10} /> Verified</span>
                  }
                </div>
              </div>
              <Ico name="chevron" size={16} color={T.muted} />
            </div>
          </button>
        ))
      }
    </div>
  );
}

// ── Upload Statement ───────────────────────────────────────────────────────────
function UploadScreen({ statements, onRefresh }) {
  const [drag, setDrag] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle|uploading|done|error
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const processFile = async file => {
    setPhase("uploading"); setError("");
    try {
      const fd = new FormData();
      fd.append("statement", file, file.name);
      const result = await api("POST", "/api/statements/upload", fd, true);
      setParsed(result); setPhase("done");
      onRefresh();
    } catch (e) { setError(e.message); setPhase("error"); }
  };

  const onDrop = e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); };

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-title">Upload Statement</div>
        <p className="screen-sub">Photo or screenshot of your municipal electricity bill</p>
      </div>

      {phase === "idle" && (
        <>
          <div className={`dropzone ${drag ? "drag" : ""}`}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}>
            <div className="dropzone-icon">📄</div>
            <div className="dropzone-title">Tap to upload your bill</div>
            <div className="dropzone-sub">Photo, screenshot, or PDF of your statement</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) processFile(e.target.files[0]); }} />
        </>
      )}

      {phase === "uploading" && (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <div className="spinner" style={{ margin: "0 auto 12px" }} />
          <div style={{ color: T.muted }}>AI parsing your statement…</div>
        </div>
      )}

      {phase === "error" && (
        <div>
          <div className="alert alert-err"><span className="alert-icon">✕</span><div>{error}</div></div>
          <button className="btn btn-secondary btn-full" onClick={() => setPhase("idle")}>Try Again</button>
        </div>
      )}

      {phase === "done" && parsed && (
        <div className="slide-up">
          <div className="alert alert-ok" style={{ marginBottom: 14 }}><Ico name="check" size={14} /><div>Statement parsed successfully</div></div>
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="card-label">Billing Period</div>
            <div style={{ fontFamily: T.mono, fontSize: 15 }}>{parsed.billingPeriodStart || "?"} → {parsed.billingPeriodEnd || "?"}</div>
          </div>
          <div className="stat-row">
            <div className="stat"><div className="stat-n" style={{ fontSize: 20 }}>{parsed.openingReading?.toLocaleString() ?? "—"}</div><div className="stat-l">Opening kWh</div></div>
            <div className="stat"><div className="stat-n" style={{ fontSize: 20 }}>{parsed.closingReading?.toLocaleString() ?? "—"}</div><div className="stat-l">Closing kWh</div></div>
          </div>
          <div className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div className="card-label">Reading Type</div><div style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 600 }}>{parsed.readingType || "UNKNOWN"}</div></div>
              <span className={`badge ${parsed.readingType === "ESTIMATED" ? "badge-err" : parsed.readingType === "ACTUAL" ? "badge-ok" : "badge-warn"}`}>
                {parsed.readingType === "ESTIMATED" ? "⚠ Estimated" : parsed.readingType === "ACTUAL" ? "✓ Actual" : "? Unknown"}
              </span>
            </div>
          </div>
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="card-label">Amount Due</div>
            <div className="card-value">R {parsed.amountDue?.toFixed(2) ?? "—"}</div>
            {parsed.municipality && <div className="card-sub">{parsed.municipality}</div>}
          </div>
          <button className="btn btn-secondary btn-full" onClick={() => setPhase("idle")}>Upload Another</button>
        </div>
      )}

      {statements.length > 0 && phase === "idle" && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Uploaded Statements</div>
          {statements.map(s => (
            <div key={s.id} className="card" style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, fontFamily: T.mono }}>{s.billing_start || "?"} → {s.billing_end || "?"}</div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{s.municipality || "Municipal"} · R {s.amount_due?.toFixed(2) || "—"}</div>
                </div>
                <span className={`badge ${s.reading_type === "ESTIMATED" ? "badge-err" : s.reading_type === "ACTUAL" ? "badge-ok" : "badge-warn"}`}>
                  {s.reading_type || "?"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Compare Screen ─────────────────────────────────────────────────────────────
function CompareScreen({ readings, statements }) {
  const [analysis, setAnalysis] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState("");

  const runAnalysis = async () => {
    if (readings.length === 0) { setError("No meter readings captured yet."); return; }
    if (statements.length === 0) { setError("No statements uploaded yet."); return; }
    setPhase("loading"); setError("");
    try {
      const result = await api("POST", "/api/compare");
      setAnalysis(result); setPhase("done");
    } catch (e) { setError(e.message); setPhase("idle"); }
  };

  const exportLetter = () => {
    if (!analysis?.disputeLetter) return;
    const blob = new Blob([analysis.disputeLetter], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "MeterWatch_Dispute_Letter.txt"; a.click();
  };

  const statusColors = { OVERBILLED: T.danger, ACCURATE: T.success, UNDERBILLED: T.accent, INSUFFICIENT_DATA: T.muted };

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-title">Dispute Analysis</div>
        <p className="screen-sub">Compare your readings against municipal billing</p>
      </div>

      <div className="stat-row" style={{ marginBottom: 16 }}>
        <div className="stat"><div className="stat-n">{readings.length}</div><div className="stat-l">Your Readings</div></div>
        <div className="stat"><div className="stat-n">{statements.length}</div><div className="stat-l">Statements</div></div>
      </div>

      {error && <div className="alert alert-err" style={{ marginBottom: 12 }}><span className="alert-icon">✕</span><div>{error}</div></div>}

      {phase === "idle" && (
        <button className="btn btn-primary btn-full btn-lg" onClick={runAnalysis}>
          <Ico name="compare" size={20} /> Run Discrepancy Analysis
        </button>
      )}

      {phase === "loading" && (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <div className="spinner" style={{ margin: "0 auto 12px" }} />
          <div style={{ color: T.muted }}>AI analysing billing data…</div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>Comparing your meter photos against statement readings</div>
        </div>
      )}

      {phase === "done" && analysis && (
        <div className="slide-up">
          <div className="card" style={{ borderColor: statusColors[analysis.overallStatus] || T.border, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="card-label">Overall Status</div>
              <span className={`badge ${analysis.overallStatus === "OVERBILLED" ? "badge-err" : analysis.overallStatus === "ACCURATE" ? "badge-ok" : "badge-warn"}`}>
                {analysis.overallStatus}
              </span>
            </div>
            <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.6 }}>{analysis.summary}</div>
          </div>

          {analysis.estimatedOverbillingTotal > 0 && (
            <div className="card" style={{ background: "#1a0606", borderColor: "#5a1010", marginBottom: 12 }}>
              <div className="card-label" style={{ color: T.danger }}>Estimated Overbilling</div>
              <div style={{ fontFamily: T.mono, fontSize: 32, color: T.danger, fontWeight: 600, lineHeight: 1 }}>
                {analysis.estimatedOverbillingTotal.toFixed(1)}<span style={{ fontSize: 16 }}> kWh</span>
              </div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>potentially incorrectly billed</div>
            </div>
          )}

          {analysis.discrepancies?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Discrepancies</div>
              {analysis.discrepancies.map((d, i) => (
                <div key={i} className={`discrepancy-row ${d.severity?.toLowerCase()}`} style={{ marginBottom: 10 }}>
                  <div className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{d.period}</div>
                      <span className={`badge ${d.severity === "HIGH" ? "badge-err" : d.severity === "MEDIUM" ? "badge-warn" : "badge-ok"}`}>{d.severity}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <div><div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: 1 }}>Bill says ({d.readingType})</div><div style={{ fontFamily: T.mono, fontSize: 15 }}>{d.statementReading ?? "—"}</div></div>
                      <div><div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: 1 }}>Your reading</div><div style={{ fontFamily: T.mono, fontSize: 15 }}>{d.actualReading ?? "—"}</div></div>
                    </div>
                    {d.difference != null && <div style={{ fontFamily: T.mono, fontSize: 13, color: d.difference > 0 ? T.danger : T.success, marginBottom: 6 }}>Δ {d.difference > 0 ? "+" : ""}{d.difference} kWh</div>}
                    <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>{d.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {analysis.recommendedAction && (
            <div className="alert alert-warn" style={{ marginBottom: 14 }}>
              <span className="alert-icon">→</span>
              <div><strong>Next step:</strong><br /><span style={{ fontSize: 13 }}>{analysis.recommendedAction}</span></div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary btn-full" onClick={exportLetter}><Ico name="download" size={18} /> Dispute Letter</button>
            <button className="btn btn-secondary" style={{ padding: "14px 16px" }} onClick={() => setPhase("idle")}><Ico name="refresh" size={18} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

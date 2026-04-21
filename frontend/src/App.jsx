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

// Mogale City - light, high-contrast theme
const T = {
  bg: "#f4f6f0",
  surface: "#ffffff",
  card: "#ffffff",
  border: "#c8d8b8",
  borderHover: "#8ab870",
  accent: "#3a7520",       // Mogale green
  accentDark: "#2a5515",
  accentLight: "#e8f5e0",
  gold: "#b8860b",         // Mogale gold
  goldLight: "#fff8e0",
  goldBorder: "#d4a820",
  success: "#2a7a40",
  danger: "#c0392b",
  warn: "#b8860b",
  text: "#1a2a10",         // very dark green-black - high contrast
  textSub: "#3a4a30",
  muted: "#5a7045",
  mutedLight: "#8a9a78",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
  sans: "'DM Sans', system-ui, sans-serif",
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;600&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-tap-highlight-color: transparent; }
body { background: ${T.bg}; color: ${T.text}; font-family: ${T.sans}; font-size: 16px; line-height: 1.5; min-height: 100dvh; overscroll-behavior: none; }
button { cursor: pointer; border: none; background: none; font-family: inherit; color: inherit; }
input { font-family: inherit; color: inherit; }
img { display: block; }
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 2px; }
.app { display: flex; flex-direction: column; min-height: 100dvh; max-width: 430px; margin: 0 auto; }
.screen { flex: 1; padding: 20px 16px 100px; overflow-y: auto; }
.bottomnav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 430px; background: ${T.surface}; border-top: 2px solid ${T.border}; display: flex; z-index: 100; padding-bottom: env(safe-area-inset-bottom); box-shadow: 0 -2px 12px rgba(0,0,0,0.08); }
.nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 10px 4px 8px; font-size: 10px; font-weight: 600; letter-spacing: .3px; color: ${T.mutedLight}; transition: color .15s; border: none; background: none; cursor: pointer; }
.nav-item svg { width: 22px; height: 22px; stroke-width: 1.8; transition: transform .15s; }
.nav-item.active { color: ${T.accent}; }
.nav-item.active svg { transform: scale(1.1); }
.nav-item:active svg { transform: scale(.92); }
.screen-header { margin-bottom: 20px; }
.screen-title { font-size: 18px; font-weight: 700; color: ${T.accent}; letter-spacing: .3px; }
.screen-sub { font-size: 13px; color: ${T.muted}; margin-top: 2px; font-weight: 500; }
.card { background: ${T.card}; border: 1.5px solid ${T.border}; border-radius: 14px; padding: 16px; box-shadow: 0 1px 6px rgba(0,0,0,0.06); }
.card + .card { margin-top: 10px; }
.card-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px; color: ${T.mutedLight}; font-weight: 700; margin-bottom: 6px; }
.card-value { font-family: ${T.mono}; font-size: 30px; font-weight: 600; line-height: 1; color: ${T.text}; }
.card-sub { font-size: 12px; color: ${T.muted}; margin-top: 5px; font-weight: 500; }
.stat-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
.stat { background: ${T.surface}; border: 1.5px solid ${T.border}; border-radius: 12px; padding: 14px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
.stat-n { font-family: ${T.mono}; font-size: 26px; font-weight: 600; line-height: 1; color: ${T.text}; }
.stat-l { font-size: 11px; color: ${T.muted}; margin-top: 5px; font-weight: 600; letter-spacing: .3px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 14px 20px; border-radius: 12px; font-size: 15px; font-weight: 600; transition: all .15s; line-height: 1; }
.btn:active { transform: scale(.96); }
.btn-primary { background: ${T.accent}; color: #fff; box-shadow: 0 2px 8px rgba(58,117,32,0.3); }
.btn-primary:hover { background: #2d5e1a; }
.btn-secondary { background: ${T.surface}; color: ${T.text}; border: 1.5px solid ${T.border}; }
.btn-secondary:hover { border-color: ${T.accent}; color: ${T.accent}; }
.btn-ghost { color: ${T.muted}; padding: 10px 14px; font-size: 14px; font-weight: 600; }
.btn-ghost:hover { color: ${T.accent}; }
.btn-full { width: 100%; }
.btn-lg { padding: 18px 24px; font-size: 16px; border-radius: 14px; }
.btn-sm { padding: 8px 14px; font-size: 13px; border-radius: 8px; }
.alert { padding: 12px 14px; border-radius: 10px; font-size: 13px; line-height: 1.5; display: flex; gap: 10px; align-items: flex-start; margin-bottom: 12px; font-weight: 500; }
.alert-icon { font-size: 15px; flex-shrink: 0; margin-top: 1px; }
.alert-warn { background: ${T.goldLight}; border: 1.5px solid ${T.goldBorder}; color: #7a5a00; }
.alert-err { background: #fdecea; border: 1.5px solid #e88; color: #8b1a1a; }
.alert-ok { background: #e8f5e8; border: 1.5px solid #6abf6a; color: #1a5a1a; }
.alert-info { background: ${T.accentLight}; border: 1.5px solid ${T.border}; color: ${T.textSub}; }
.badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: .3px; }
.badge-ok { background: #e0f5e8; color: ${T.success}; border: 1.5px solid #6abf6a; }
.badge-warn { background: ${T.goldLight}; color: #7a5a00; border: 1.5px solid ${T.goldBorder}; }
.badge-err { background: #fdecea; color: ${T.danger}; border: 1.5px solid #e88; }
.badge-green { background: ${T.accentLight}; color: ${T.accent}; border: 1.5px solid ${T.borderHover}; }
.reading-item { display: flex; gap: 12px; align-items: center; padding: 12px 0; border-bottom: 1.5px solid ${T.border}; cursor: pointer; }
.reading-item:last-child { border-bottom: none; }
.reading-thumb { width: 54px; height: 54px; border-radius: 10px; object-fit: cover; background: ${T.bg}; flex-shrink: 0; border: 1.5px solid ${T.border}; }
.reading-thumb-placeholder { width: 54px; height: 54px; border-radius: 10px; background: ${T.bg}; border: 1.5px solid ${T.border}; display: flex; align-items: center; justify-content: center; color: ${T.mutedLight}; font-size: 20px; flex-shrink: 0; }
.reading-body { flex: 1; min-width: 0; }
.reading-val { font-family: ${T.mono}; font-size: 22px; font-weight: 600; color: ${T.text}; }
.reading-date { font-size: 12px; color: ${T.muted}; margin-top: 2px; font-weight: 500; }
.chain-indicator { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
.chain-dot { width: 8px; height: 8px; border-radius: 50%; background: ${T.accent}; }
.chain-line { width: 2px; flex: 1; background: ${T.border}; min-height: 20px; }
.spinner { width: 22px; height: 22px; border: 2.5px solid ${T.border}; border-top-color: ${T.accent}; border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.dropzone { border: 2px dashed ${T.border}; border-radius: 14px; padding: 36px 16px; text-align: center; cursor: pointer; transition: all .2s; background: ${T.surface}; }
.dropzone:hover, .dropzone.drag { border-color: ${T.accent}; background: ${T.accentLight}; }
.dropzone-icon { font-size: 40px; margin-bottom: 12px; }
.dropzone-title { font-size: 15px; font-weight: 600; color: ${T.text}; margin-bottom: 4px; }
.dropzone-sub { font-size: 13px; color: ${T.muted}; font-weight: 500; }
.discrepancy-row { border-left: 3px solid ${T.danger}; padding-left: 12px; margin-bottom: 10px; }
.discrepancy-row.low { border-left-color: ${T.success}; }
.discrepancy-row.medium { border-left-color: ${T.gold}; }
.input-field { width: 100%; background: ${T.bg}; border: 1.5px solid ${T.border}; color: ${T.text}; padding: 12px 14px; border-radius: 10px; font-size: 16px; outline: none; transition: border-color .15s; font-weight: 500; }
.input-field:focus { border-color: ${T.accent}; background: ${T.surface}; }
.input-mono { font-family: ${T.mono}; font-size: 24px; padding: 14px; }
.divider { height: 1.5px; background: ${T.border}; margin: 16px 0; }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.slide-up { animation: slideUp .25s ease; }
.mogale-header { background: ${T.accent}; margin: -20px -16px 20px; padding: 20px 16px 16px; color: white; }
.mogale-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
.mogale-city-name { font-size: 22px; font-weight: 700; color: #fff; letter-spacing: .3px; font-style: italic; }
.mogale-sub-name { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.85); font-style: italic; }
.mogale-tagline { font-size: 11px; color: ${T.goldBorder}; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 600; margin-top: 2px; }
.mogale-link { font-size: 11px; color: rgba(255,255,255,0.75); display: flex; align-items: center; gap: 4px; margin-top: 8px; text-decoration: none; }
.mogale-link:hover { color: #fff; }
.gold-bar { height: 3px; background: linear-gradient(90deg, ${T.goldBorder}, #f0c030, ${T.goldBorder}); margin: 10px 0 0; border-radius: 2px; }
`;

const MogaleIcon = ({ size = 36, light = false }) => (
  <svg width={size} height={size} viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="mg1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={light ? "#c8a830" : "#7a5020"} />
        <stop offset="100%" stopColor="#d4a017" />
      </linearGradient>
      <linearGradient id="mg2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#d4a017" />
        <stop offset="100%" stopColor="#f0c840" />
      </linearGradient>
    </defs>
    <ellipse cx="30" cy="30" rx="22" ry="26" stroke="url(#mg2)" strokeWidth="3.5" fill="none"/>
    <ellipse cx="30" cy="30" rx="14" ry="18" stroke="url(#mg1)" strokeWidth="2.5" fill="none"/>
    <line x1="22" y1="18" x2="38" y2="42" stroke={light ? "#d4a017" : "#7a5020"} strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="26" y1="15" x2="34" y2="45" stroke={light ? "#d4a017" : "#7a5020"} strokeWidth="1" strokeLinecap="round" opacity="0.7"/>
    <line x1="18" y1="22" x2="42" y2="38" stroke={light ? "#d4a017" : "#7a5020"} strokeWidth="1" strokeLinecap="round" opacity="0.7"/>
  </svg>
);

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
    globe: <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></>,
    admin: <><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, flexShrink: 0 }}>
      {paths[name]}
    </svg>
  );
};

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
    { id: "home",    label: "Home",      icon: "home"    },
    { id: "capture", label: "Capture",   icon: "camera"  },
    { id: "history", label: "History",   icon: "list"    },
    { id: "upload",  label: "Statement", icon: "upload"  },
    { id: "compare", label: "Compare",   icon: "compare" },
    { id: "admin",   label: "Admin",     icon: "admin"   },
  ];

  const Screens = { home: HomeScreen, capture: CaptureScreen, history: HistoryScreen, upload: UploadScreen, compare: CompareScreen, admin: AdminScreen };
  const Screen = Screens[tab];

  return (
    <>
      <style>{css}</style>
      <div className="app">
        {loading
          ? <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, background: T.accent }}>
              <MogaleIcon size={56} light />
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>Loading...</div>
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

// --- Home Screen ---
function HomeScreen({ readings, statements, goTo }) {
  const latest = readings[0];
  const prev = readings[1];
  const consumed = latest && prev ? (latest.reading_kwh - prev.reading_kwh).toFixed(1) : null;
  const latestTs = latest ? (latest.server_ts || latest.timestamp) : null;

  return (
    <div className="screen" style={{ paddingTop: 0 }}>
      <div className="mogale-header">
        <div className="mogale-brand">
          <MogaleIcon size={44} light />
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span className="mogale-city-name">Mogale City</span>
              <span className="mogale-sub-name">Local Municipality</span>
            </div>
            <div className="mogale-tagline">Meter Monitoring System</div>
          </div>
        </div>
        <div className="gold-bar" />
        <a href="https://mogalecity.gov.za" target="_blank" rel="noopener noreferrer" className="mogale-link">
          <Ico name="globe" size={11} color="rgba(255,255,255,0.75)" />
          mogalecity.gov.za &mdash; <em>The City of Human Origin</em>
        </a>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="stat-n" style={{ color: T.accent, fontSize: 22 }}>{latest ? latest.reading_kwh.toLocaleString() : "-"}</div>
          <div className="stat-l">Latest kWh</div>
        </div>
        <div className="stat">
          <div className="stat-n" style={{ fontSize: 22 }}>{consumed ?? "-"}</div>
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
              <div className="card-value">{latest.reading_kwh.toLocaleString()}<span style={{ fontSize: 16, color: T.muted, fontWeight: 500 }}> kWh</span></div>
              <div className="card-sub">{latestTs ? new Date(latestTs).toLocaleString("en-ZA") : "-"}</div>
            </div>
            <span className="badge badge-green"><Ico name="shield" size={11} /> Verified</span>
          </div>
          {latest.fraudFlags?.length > 0 && (
            <div style={{ marginTop: 10, padding: "8px 10px", background: T.goldLight, borderRadius: 8, fontSize: 12, color: "#7a5a00", border: `1px solid ${T.goldBorder}` }}>
              &#9888; {latest.fraudFlags.length} integrity flag{latest.fraudFlags.length > 1 ? "s" : ""} - tap History to review
            </div>
          )}
        </div>
      )}

      {!latest && (
        <div className="alert alert-info">
          <span className="alert-icon">&#128161;</span>
          <div>No readings yet. Tap <strong>Capture</strong> to photograph your meter and start tracking.</div>
        </div>
      )}

      <div className="alert alert-info">
        <Ico name="lock" size={15} color={T.accent} />
        <div style={{ fontSize: 12, color: T.textSub }}>
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

// --- Image compression utility ---
async function compressImage(file, maxSizePx = 1400) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > h && w > maxSizePx) { h = Math.round(h * maxSizePx / w); w = maxSizePx; }
      else if (h > maxSizePx) { w = Math.round(w * maxSizePx / h); h = maxSizePx; }
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => resolve(blob || file), "image/jpeg", 0.82);
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

// --- Capture Screen ---
function CaptureScreen({ onRefresh }) {
  const [phase, setPhase] = useState("start");
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [capturedUrl, setCapturedUrl] = useState(null);
  const [captureTs, setCaptureTs] = useState(null);
  const [aiReading, setAiReading] = useState(null);
  const [confirmedReading, setConfirmedReading] = useState("");
  const [gps, setGps] = useState(null);
  const [error, setError] = useState("");
  const [savedResult, setSavedResult] = useState(null);
  const [meterNumber, setMeterNumber] = useState("");
  const [aiMeterNumber, setAiMeterNumber] = useState(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      p => setGps({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { timeout: 5000 }
    );
  }, []);

  const processCapture = async (file) => {
    const ts = Date.now();
    setCaptureTs(ts);
    setPhase("extracting");
    try {
      const compressed = await compressImage(file, 1400);
      setCapturedBlob(compressed);
      setCapturedUrl(URL.createObjectURL(compressed));
    } catch {
      setCapturedBlob(file);
      setCapturedUrl(URL.createObjectURL(file));
    }
    try {
      const fd = new FormData();
      fd.append("photo", file, "meter.jpg");
      const result = await api("POST", "/api/readings/preview", fd, true);
      setAiReading(result.aiReading);
      setAiMeterNumber(result.meterNumber || null);
      setMeterNumber(result.meterNumber ? String(result.meterNumber) : "");
      setConfirmedReading(result.aiReading != null ? result.aiReading.toString() : "");
      setPhase("confirm");
    } catch {
      setAiReading(null);
      setConfirmedReading("");
      setPhase("confirm");
    }
  };

  const startCamera = () => {
    setError("");
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.style.display = "none";
    document.body.appendChild(input);
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      document.body.removeChild(input);
      if (file) processCapture(file);
    };
    input.click();
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
      if (meterNumber) fd.append("meterNumber", meterNumber);
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
    setCapturedBlob(null); setCapturedUrl(null); setCaptureTs(null);
    setAiReading(null); setConfirmedReading(""); setError(""); setSavedResult(null);
    setPhase("start");
  };

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-title">Capture Reading</div>
        <p className="screen-sub">Take a photo of your electricity meter</p>
      </div>

      {phase === "start" && (
        <div>
          <div className="alert alert-info" style={{ marginBottom: 20 }}>
            <Ico name="lock" size={16} color={T.accent} />
            <div style={{ fontSize: 13, color: T.textSub }}>
              <strong>Live photo required.</strong> Your photo is fingerprinted and GPS-stamped the moment it's taken to prevent fraud.
            </div>
          </div>
          <button className="btn btn-primary btn-full btn-lg" onClick={startCamera}>
            <Ico name="camera" size={20} /> Open Camera
          </button>
          {error && <div className="alert alert-err" style={{ marginTop: 12 }}><span className="alert-icon">&#10007;</span><div>{error}</div></div>}
          <div style={{ marginTop: 20, padding: 16, background: T.surface, borderRadius: 12, border: `1.5px solid ${T.border}` }}>
            <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.8 }}>
              <div style={{ fontWeight: 700, color: T.text, marginBottom: 6 }}>How it works</div>
              1. Point your phone camera at the meter display<br />
              2. AI reads the digits automatically<br />
              3. Confirm or correct the reading<br />
              4. Reading is saved with cryptographic proof
            </div>
          </div>
        </div>
      )}

      {phase === "extracting" && (
        <div>
          {capturedUrl && <img src={capturedUrl} alt="captured" style={{ width: "100%", borderRadius: 16, marginBottom: 16, border: `1.5px solid ${T.border}` }} />}
          <div className="card" style={{ textAlign: "center", padding: 28 }}>
            <div className="spinner" style={{ margin: "0 auto 12px" }} />
            <div style={{ color: T.muted, fontWeight: 500 }}>AI reading your meter...</div>
          </div>
        </div>
      )}

      {phase === "confirm" && (
        <div className="slide-up">
          {capturedUrl && <img src={capturedUrl} alt="captured" style={{ width: "100%", borderRadius: 16, marginBottom: 14, maxHeight: 260, objectFit: "cover", border: `1.5px solid ${T.border}` }} />}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-label">AI Extracted Reading</div>
            <div style={{ fontFamily: T.mono, fontSize: 28, color: aiReading != null ? T.accent : T.danger, fontWeight: 600, marginBottom: 12 }}>
              {aiReading != null ? `${aiReading.toLocaleString()} kWh` : "Could not read - enter manually"}
            </div>
            <div className="card-label">Confirm or Correct Reading (kWh)</div>
            <input className="input-field input-mono" type="number" min="0" step="0.1" placeholder="e.g. 12345.6"
              value={confirmedReading} onChange={e => { setConfirmedReading(e.target.value); setError(""); }} />
            {error && <div style={{ color: T.danger, fontSize: 13, marginTop: 8, fontWeight: 600 }}>{error}</div>}
            <div className="card-label" style={{ marginTop: 12 }}>Meter Number</div>
            <input className="input-field" type="text" placeholder={aiMeterNumber ? "" : "Not detected - enter manually"}
              value={meterNumber} onChange={e => setMeterNumber(e.target.value)} />
            {!aiMeterNumber && <div style={{ fontSize: 11, color: T.warn, marginTop: 4, fontWeight: 600 }}>&#9888; Enter meter number manually</div>}
          </div>
          {gps && <div style={{ fontSize: 11, color: T.muted, textAlign: "center", marginBottom: 10, fontWeight: 500 }}>&#128205; GPS: {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary btn-full" onClick={submitReading}><Ico name="check" size={18} /> Save Reading</button>
            <button className="btn btn-secondary" style={{ paddingLeft: 16, paddingRight: 16 }} onClick={reset}>Retake</button>
          </div>
        </div>
      )}

      {phase === "submitting" && (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <div className="spinner" style={{ margin: "0 auto 12px" }} />
          <div style={{ color: T.muted, fontWeight: 500 }}>Validating & saving reading...</div>
          <div style={{ fontSize: 12, color: T.mutedLight, marginTop: 8 }}>Server is verifying your photo for authenticity</div>
        </div>
      )}

      {phase === "done" && savedResult && (
        <div className="slide-up">
          <div className="alert alert-ok" style={{ marginBottom: 16 }}>
            <Ico name="check" size={16} color={T.success} />
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
                <div className="card-label" style={{ color: T.warn }}>Integrity Flags</div>
                {savedResult.fraudFlags.map((f, i) => <div key={i} style={{ fontSize: 12, color: T.warn, padding: "3px 0", fontWeight: 600 }}>&#9888; {f}</div>)}
              </>
            )}
          </div>
          <button className="btn btn-primary btn-full" onClick={reset} style={{ marginTop: 12 }}>Capture Another</button>
        </div>
      )}

      {phase === "error" && (
        <div>
          <div className="alert alert-err"><span className="alert-icon">&#10007;</span><div>{error}</div></div>
          <button className="btn btn-secondary btn-full" onClick={reset}>Try Again</button>
        </div>
      )}
    </div>
  );
}

// --- History Screen ---
function HistoryScreen({ readings }) {
  const [selected, setSelected] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  const runVerify = async (r) => {
    setVerifying(true); setVerifyResult(null);
    try {
      const result = await api("GET", `/api/readings/${r.id}/verify`);
      setVerifyResult(result);
    } catch (e) {
      setVerifyResult({ pass: false, checks: [{ name: "Verification", pass: false, detail: e.message }] });
    }
    setVerifying(false);
  };

  if (selected) {
    const r = selected;
    const ts = r.server_ts || r.timestamp;
    return (
      <div className="screen slide-up">
        <button className="btn btn-ghost" onClick={() => { setSelected(null); setVerifyResult(null); }} style={{ marginBottom: 16 }}>&#8592; Back</button>
        <div style={{ position: "relative", marginBottom: 12 }}>
          <img src={`${API}${r.imagePath}`} alt="meter" style={{ width: "100%", borderRadius: 14, border: `1.5px solid ${T.border}`, display: "block" }} onError={e => { e.target.style.display = "none"; }} />
        </div>
        <div className="card" style={{ marginBottom: 10 }}>
          <div className="card-label">Reading</div>
          <div className="card-value">{r.reading_kwh.toLocaleString()} <span style={{ fontSize: 16, color: T.muted, fontWeight: 500 }}>kWh</span></div>
          <div className="card-sub">{ts ? new Date(ts).toLocaleString("en-ZA") : "-"} &middot; {r.reading_source?.replace("_", " ")}</div>
          {r.ai_reading_kwh && r.ai_reading_kwh !== r.reading_kwh && (
            <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>AI read: {r.ai_reading_kwh} kWh (user corrected to {r.reading_kwh})</div>
          )}
        </div>
        {r.gps_lat && (
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="card-label">GPS Location</div>
            <div style={{ fontFamily: T.mono, fontSize: 13, color: T.text }}>{r.gps_lat.toFixed(6)}, {r.gps_lng.toFixed(6)}</div>
          </div>
        )}
        <div className="card" style={{ marginBottom: 10 }}>
          <div className="card-label">Image SHA-256 Fingerprint</div>
          <div style={{ fontFamily: T.mono, fontSize: 10, wordBreak: "break-all", color: T.muted, lineHeight: 1.8 }}>{r.image_hash}</div>
          <div className="card-label" style={{ marginTop: 10 }}>Chain Hash</div>
          <div style={{ fontFamily: T.mono, fontSize: 10, wordBreak: "break-all", color: T.muted, lineHeight: 1.8 }}>{r.chain_hash}</div>
        </div>
        {r.fraudFlags?.length > 0 && (
          <div className="card" style={{ borderColor: T.goldBorder, marginBottom: 10, background: T.goldLight }}>
            <div className="card-label" style={{ color: T.warn }}>Integrity Flags</div>
            {r.fraudFlags.map((f, i) => (
              <div key={i} style={{ fontSize: 12, color: "#7a5a00", padding: "4px 0", borderBottom: i < r.fraudFlags.length - 1 ? `1px solid ${T.border}` : "none", fontWeight: 600 }}>&#9888; {f}</div>
            ))}
          </div>
        )}
        <button className="btn btn-secondary btn-full" onClick={() => runVerify(r)} disabled={verifying} style={{ marginBottom: 10 }}>
          {verifying ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Verifying...</> : <><Ico name="shield" size={16} /> Run Integrity Verification</>}
        </button>
        {verifyResult && (
          <div className="card slide-up" style={{ borderColor: verifyResult.pass ? "#6abf6a" : "#e88" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Ico name={verifyResult.pass ? "check" : "x"} size={18} color={verifyResult.pass ? T.success : T.danger} />
              <div style={{ fontWeight: 700, color: verifyResult.pass ? T.success : T.danger }}>
                {verifyResult.pass ? "All checks passed - record is genuine" : "Verification failed - record may be compromised"}
              </div>
            </div>
            {verifyResult.checks?.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: `1.5px solid ${T.border}`, alignItems: "flex-start" }}>
                <span style={{ color: c.pass ? T.success : T.danger, flexShrink: 0, marginTop: 1, fontWeight: 700 }}>{c.pass ? "✓" : "✗"}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{c.name}</div>
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
        ? <div className="alert alert-info"><span className="alert-icon">&#128247;</span><div>No readings yet. Capture your first meter reading to start your history.</div></div>
        : readings.map((r, i) => {
          const ts = r.server_ts || r.timestamp;
          return (
            <button key={r.id} onClick={() => setSelected(r)} style={{ width: "100%", background: "none", border: "none", textAlign: "left" }}>
              <div className="reading-item">
                <div className="chain-indicator">
                  <div className="chain-dot" />
                  {i < readings.length - 1 && <div className="chain-line" />}
                </div>
                <img className="reading-thumb" src={`${API}${r.imagePath}`} alt="meter" onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="flex"; }} />
                <div className="reading-thumb-placeholder" style={{ display: "none" }}>&#9889;</div>
                <div className="reading-body">
                  <div className="reading-val">{r.reading_kwh.toLocaleString()} <span style={{ fontSize: 14, color: T.muted }}>kWh</span></div>
                  <div className="reading-date">{ts ? new Date(ts).toLocaleDateString("en-ZA") : "-"} {ts ? new Date(ts).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }) : ""}</div>
                  <div style={{ marginTop: 5 }}>
                    {r.fraudFlags?.length > 0
                      ? <span className="badge badge-warn">&#9888; {r.fraudFlags.length} flag{r.fraudFlags.length > 1 ? "s" : ""}</span>
                      : <span className="badge badge-green"><Ico name="check" size={10} /> Verified</span>
                    }
                  </div>
                </div>
                <Ico name="chevron" size={16} color={T.mutedLight} />
              </div>
            </button>
          );
        })
      }
    </div>
  );
}

// --- Upload Statement ---
function UploadScreen({ statements, onRefresh }) {
  const [drag, setDrag] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const processFile = async file => {
    setPhase("uploading"); setError("");
    try {
      const compressed = file.type.startsWith("image/") ? await compressImage(file, 1600) : file;
      const fd = new FormData();
      fd.append("statement", compressed, file.name);
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
        <p className="screen-sub">Photo or screenshot of your Mogale City electricity bill</p>
      </div>
      {phase === "idle" && (
        <>
          <div className={`dropzone ${drag ? "drag" : ""}`}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}>
            <div className="dropzone-icon">&#128196;</div>
            <div className="dropzone-title">Tap to upload your bill</div>
            <div className="dropzone-sub">Photo, screenshot, or PDF of your Mogale City statement</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) processFile(e.target.files[0]); }} />
        </>
      )}
      {phase === "uploading" && (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <div className="spinner" style={{ margin: "0 auto 12px" }} />
          <div style={{ color: T.muted, fontWeight: 500 }}>AI parsing your statement...</div>
        </div>
      )}
      {phase === "error" && (
        <div>
          <div className="alert alert-err"><span className="alert-icon">&#10007;</span><div>{error}</div></div>
          <button className="btn btn-secondary btn-full" onClick={() => setPhase("idle")}>Try Again</button>
        </div>
      )}
      {phase === "done" && parsed && (
        <div className="slide-up">
          <div className="alert alert-ok" style={{ marginBottom: 14 }}><Ico name="check" size={14} color={T.success} /><div>Statement parsed successfully</div></div>
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="card-label">Billing Period</div>
            <div style={{ fontFamily: T.mono, fontSize: 15, color: T.text, fontWeight: 600 }}>{parsed.billingPeriodStart || "?"} - {parsed.billingPeriodEnd || "?"}</div>
          </div>
          <div className="stat-row">
            <div className="stat"><div className="stat-n" style={{ fontSize: 20 }}>{parsed.openingReading?.toLocaleString() ?? "-"}</div><div className="stat-l">Opening kWh</div></div>
            <div className="stat"><div className="stat-n" style={{ fontSize: 20 }}>{parsed.closingReading?.toLocaleString() ?? "-"}</div><div className="stat-l">Closing kWh</div></div>
          </div>
          <div className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div className="card-label">Reading Type</div><div style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 600, color: T.text }}>{parsed.readingType || "UNKNOWN"}</div></div>
              <span className={`badge ${parsed.readingType === "ESTIMATED" ? "badge-err" : parsed.readingType === "ACTUAL" ? "badge-ok" : "badge-warn"}`}>
                {parsed.readingType === "ESTIMATED" ? "Estimated" : parsed.readingType === "ACTUAL" ? "Actual" : "Unknown"}
              </span>
            </div>
          </div>
          <div className="card" style={{ marginBottom: 10 }}>
            <div className="card-label">Amount Due</div>
            <div className="card-value">R {parsed.amountDue?.toFixed(2) ?? "-"}</div>
            {parsed.municipality && <div className="card-sub">{parsed.municipality}</div>}
            {parsed.accountNumber && <div className="card-sub">Account: {parsed.accountNumber}</div>}
          </div>
          {parsed.notes && <div className="alert alert-info" style={{ marginBottom: 10 }}><span className="alert-icon">&#8505;</span><div style={{ fontSize: 12 }}>{parsed.notes}</div></div>}
          <button className="btn btn-secondary btn-full" onClick={() => setPhase("idle")}>Upload Another</button>
        </div>
      )}
      {statements.length > 0 && phase === "idle" && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, color: T.mutedLight, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Uploaded Statements ({statements.length})</div>
          {statements.map(s => (
            <div key={s.id} className="card" style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, fontFamily: T.mono, color: T.text }}>{s.billing_start || "?"} - {s.billing_end || "?"}</div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2, fontWeight: 500 }}>{s.municipality || "Mogale City"} &middot; R {s.amount_due?.toFixed(2) || "-"}</div>
                  {s.account_number && <div style={{ fontSize: 11, color: T.mutedLight }}>Acc: {s.account_number}</div>}
                </div>
                <span className={`badge ${s.reading_type === "ESTIMATED" ? "badge-err" : s.reading_type === "ACTUAL" ? "badge-ok" : "badge-warn"}`}>{s.reading_type || "?"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Compare Screen ---
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
    const a = document.createElement("a");
    a.href = url; a.download = "MogaleCity_Dispute_Letter.txt"; a.click();
  };

  const statusColors = { OVERBILLED: T.danger, ACCURATE: T.success, UNDERBILLED: T.warn, INSUFFICIENT_DATA: T.mutedLight };

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-title">Dispute Analysis</div>
        <p className="screen-sub">Compare your readings against Mogale City billing</p>
      </div>
      <div className="stat-row" style={{ marginBottom: 16 }}>
        <div className="stat"><div className="stat-n">{readings.length}</div><div className="stat-l">Your Readings</div></div>
        <div className="stat"><div className="stat-n">{statements.length}</div><div className="stat-l">Statements</div></div>
      </div>
      {error && <div className="alert alert-err" style={{ marginBottom: 12 }}><span className="alert-icon">&#10007;</span><div>{error}</div></div>}
      {phase === "idle" && (
        <button className="btn btn-primary btn-full btn-lg" onClick={runAnalysis}>
          <Ico name="compare" size={20} /> Run Discrepancy Analysis
        </button>
      )}
      {phase === "loading" && (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <div className="spinner" style={{ margin: "0 auto 12px" }} />
          <div style={{ color: T.muted, fontWeight: 500 }}>AI analysing billing data...</div>
          <div style={{ fontSize: 12, color: T.mutedLight, marginTop: 6 }}>Comparing your meter photos against Mogale City statement readings</div>
        </div>
      )}
      {phase === "done" && analysis && (
        <div className="slide-up">
          <div className="card" style={{ borderColor: statusColors[analysis.overallStatus] || T.border, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="card-label">Overall Status</div>
              <span className={`badge ${analysis.overallStatus === "OVERBILLED" ? "badge-err" : analysis.overallStatus === "ACCURATE" ? "badge-ok" : "badge-warn"}`}>{analysis.overallStatus}</span>
            </div>
            <div style={{ fontSize: 14, color: T.textSub, lineHeight: 1.6 }}>{analysis.summary}</div>
          </div>
          {(analysis.totalOverbilledKwh > 0 || analysis.estimatedOverbillingTotal > 0) && (
            <div className="card" style={{ background: "#fdecea", borderColor: "#e88", marginBottom: 12 }}>
              <div className="card-label" style={{ color: T.danger }}>Estimated Overbilling</div>
              <div style={{ fontFamily: T.mono, fontSize: 32, color: T.danger, fontWeight: 600, lineHeight: 1 }}>
                {(analysis.totalOverbilledKwh || analysis.estimatedOverbillingTotal || 0).toFixed(1)}<span style={{ fontSize: 16 }}> kWh</span>
              </div>
              {analysis.totalRandOverbilled && (
                <div style={{ fontFamily: T.mono, fontSize: 20, color: T.danger, marginTop: 6, fontWeight: 600 }}>approx. R {analysis.totalRandOverbilled.toFixed(2)}</div>
              )}
              <div style={{ fontSize: 12, color: "#8b1a1a", marginTop: 6, fontWeight: 500 }}>potentially incorrectly billed</div>
            </div>
          )}
          {analysis.discrepancies?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: T.mutedLight, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Discrepancies Found</div>
              {analysis.discrepancies.map((d, i) => (
                <div key={i} className={`discrepancy-row ${(d.severity || "").toLowerCase()}`} style={{ marginBottom: 10 }}>
                  <div className="card">
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{d.period}</div>
                      <span className={`badge ${d.severity === "HIGH" ? "badge-err" : d.severity === "MEDIUM" ? "badge-warn" : "badge-ok"}`}>{d.severity}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <div><div style={{ fontSize: 10, color: T.mutedLight, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Bill says ({d.readingType})</div><div style={{ fontFamily: T.mono, fontSize: 15, color: T.text, fontWeight: 600 }}>{d.municipalReading ?? d.statementReading ?? "-"}</div></div>
                      <div><div style={{ fontSize: 10, color: T.mutedLight, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Your reading</div><div style={{ fontFamily: T.mono, fontSize: 15, color: T.text, fontWeight: 600 }}>{d.actualReading ?? "-"}</div></div>
                    </div>
                    {(d.differenceKwh ?? d.difference) != null && (
                      <div style={{ fontFamily: T.mono, fontSize: 13, color: (d.differenceKwh ?? d.difference) > 0 ? T.danger : T.success, marginBottom: 6, fontWeight: 600 }}>
                        &Delta; {(d.differenceKwh ?? d.difference) > 0 ? "+" : ""}{d.differenceKwh ?? d.difference} kWh
                        {d.estimatedRandOverbilled ? ` approx. R ${d.estimatedRandOverbilled.toFixed(2)}` : ""}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.5 }}>{d.explanation || d.description}</div>
                    {d.overbilledKwh > 0 && <div style={{ fontSize: 12, color: T.danger, marginTop: 4, fontWeight: 600 }}>Overbilled: {d.overbilledKwh} kWh</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {analysis.recommendedAction && (
            <div className="alert alert-warn" style={{ marginBottom: 14 }}>
              <span className="alert-icon">&#9888;</span>
              <div><strong>Next step:</strong><br /><span style={{ fontSize: 13 }}>{analysis.recommendedAction}</span></div>
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            {analysis.disputeLetter && <button className="btn btn-primary btn-full" onClick={exportLetter}><Ico name="download" size={18} /> Dispute Letter</button>}
            <button className="btn btn-secondary" style={{ padding: "14px 16px" }} onClick={() => setPhase("idle")}><Ico name="refresh" size={18} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Admin Screen ---
function AdminScreen({ readings, statements, onRefresh }) {
  const [audit, setAudit] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("readings");

  const loadAudit = async () => {
    setAuditLoading(true);
    try { const a = await api("GET", "/api/audit"); setAudit(a); }
    catch (e) { console.error(e); }
    setAuditLoading(false);
  };

  useEffect(() => { if (activeTab === "audit") loadAudit(); }, [activeTab]);

  const tabStyle = (id) => ({
    flex: 1, padding: "10px 4px", fontSize: 12, fontWeight: 700,
    color: activeTab === id ? T.accent : T.mutedLight,
    background: "none", border: "none",
    borderBottom: `2.5px solid ${activeTab === id ? T.accent : "transparent"}`,
    cursor: "pointer",
  });

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="screen-title">Admin Panel</div>
        <p className="screen-sub">All readings, statements & audit log</p>
      </div>
      <div style={{ display: "flex", borderBottom: `1.5px solid ${T.border}`, marginBottom: 16 }}>
        <button style={tabStyle("readings")} onClick={() => setActiveTab("readings")}>Readings ({readings.length})</button>
        <button style={tabStyle("statements")} onClick={() => setActiveTab("statements")}>Statements ({statements.length})</button>
        <button style={tabStyle("audit")} onClick={() => setActiveTab("audit")}>Audit Log</button>
      </div>
      {activeTab === "readings" && (
        <div>
          {readings.length === 0
            ? <div className="alert alert-info"><span className="alert-icon">&#128247;</span><div>No readings yet.</div></div>
            : readings.map(r => {
              const ts = r.server_ts || r.timestamp;
              return (
                <div key={r.id} className="card" style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <img src={`${API}${r.imagePath}`} alt="meter" style={{ width: 54, height: 54, borderRadius: 8, objectFit: "cover", border: `1.5px solid ${T.border}`, flexShrink: 0 }} onError={e => { e.target.style.display = "none"; }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: T.mono, fontSize: 18, fontWeight: 600, color: T.text }}>{r.reading_kwh.toLocaleString()} kWh</div>
                      <div style={{ fontSize: 11, color: T.muted, fontWeight: 500 }}>{ts ? new Date(ts).toLocaleString("en-ZA") : "-"}</div>
                      <div style={{ fontSize: 11, color: T.mutedLight }}>User: {r.user_id} &middot; {r.reading_source}</div>
                      {r.gps_lat && <div style={{ fontSize: 11, color: T.mutedLight }}>&#128205; {r.gps_lat.toFixed(4)}, {r.gps_lng.toFixed(4)}</div>}
                    </div>
                    <div>{r.fraudFlags?.length > 0 ? <span className="badge badge-warn">&#9888; {r.fraudFlags.length}</span> : <span className="badge badge-green">&#10003;</span>}</div>
                  </div>
                </div>
              );
            })
          }
        </div>
      )}
      {activeTab === "statements" && (
        <div>
          {statements.length === 0
            ? <div className="alert alert-info"><span className="alert-icon">&#128247;</span><div>No statements uploaded yet.</div></div>
            : statements.map(s => (
              <div key={s.id} className="card" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 600, color: T.text }}>{s.billing_start || "?"} - {s.billing_end || "?"}</div>
                    <div style={{ fontSize: 12, color: T.muted, fontWeight: 500 }}>{s.municipality || "Mogale City"}</div>
                    {s.account_number && <div style={{ fontSize: 11, color: T.mutedLight }}>Acc: {s.account_number}</div>}
                  </div>
                  <span className={`badge ${s.reading_type === "ESTIMATED" ? "badge-err" : s.reading_type === "ACTUAL" ? "badge-ok" : "badge-warn"}`}>{s.reading_type || "?"}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div><div style={{ fontSize: 10, color: T.mutedLight, fontWeight: 700 }}>Opening</div><div style={{ fontFamily: T.mono, fontSize: 13, color: T.text }}>{s.opening_kwh ?? "-"}</div></div>
                  <div><div style={{ fontSize: 10, color: T.mutedLight, fontWeight: 700 }}>Closing</div><div style={{ fontFamily: T.mono, fontSize: 13, color: T.text }}>{s.closing_kwh ?? "-"}</div></div>
                  <div><div style={{ fontSize: 10, color: T.mutedLight, fontWeight: 700 }}>Amount</div><div style={{ fontFamily: T.mono, fontSize: 13, color: T.text }}>R {s.amount_due?.toFixed(2) || "-"}</div></div>
                </div>
                <div style={{ fontSize: 10, color: T.mutedLight, marginTop: 8 }}>User: {s.user_id} &middot; {new Date(s.server_ts).toLocaleString("en-ZA")}</div>
              </div>
            ))
          }
        </div>
      )}
      {activeTab === "audit" && (
        <div>
          <button className="btn btn-secondary btn-sm" onClick={loadAudit} style={{ marginBottom: 12 }}><Ico name="refresh" size={14} /> Refresh</button>
          {auditLoading
            ? <div style={{ textAlign: "center", padding: 24 }}><div className="spinner" style={{ margin: "0 auto" }} /></div>
            : audit.length === 0
              ? <div className="alert alert-info"><span className="alert-icon">&#128247;</span><div>No audit entries yet.</div></div>
              : [...audit].reverse().map((a, i) => (
                <div key={i} style={{ padding: "10px 0", borderBottom: `1.5px solid ${T.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 700, color: a.event?.includes("FRAUD") ? T.danger : a.event?.includes("SUCCESS") ? T.success : T.accent }}>{a.event}</span>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 2, fontWeight: 500 }}>User: {a.user_id}</div>
                    </div>
                    <div style={{ fontSize: 10, color: T.mutedLight, textAlign: "right" }}>{a.server_ts ? new Date(a.server_ts).toLocaleString("en-ZA") : "-"}</div>
                  </div>
                  {a.details && <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, marginTop: 4, wordBreak: "break-all" }}>{typeof a.details === "string" ? a.details : JSON.stringify(a.details)}</div>}
                </div>
              ))
          }
        </div>
      )}
      <button className="btn btn-secondary btn-full" onClick={onRefresh} style={{ marginTop: 16 }}><Ico name="refresh" size={16} /> Refresh All Data</button>
    </div>
  );
}

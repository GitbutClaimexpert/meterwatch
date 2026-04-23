import express from "express";
import cors from "cors";
import multer from "multer";
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { JsonDB } from "./db.js";

process.on("uncaughtException", (err) => { console.error("[CRASH]", err.message, err.stack); });
process.on("unhandledRejection", (err) => { console.error("[REJECTION]", err); });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../../data");
const IMAGES_DIR = path.join(DATA_DIR, "images");
const STMTS_DIR = path.join(DATA_DIR, "statements");
fs.mkdirSync(IMAGES_DIR, { recursive: true });
fs.mkdirSync(STMTS_DIR, { recursive: true });

const SIGNING_SECRET = process.env.SIGNING_SECRET || (() => {
  const f = path.join(DATA_DIR, ".signing_secret");
  if (fs.existsSync(f)) return fs.readFileSync(f, "utf8").trim();
  const s = crypto.randomBytes(64).toString("hex");
  fs.writeFileSync(f, s, { mode: 0o600 });
  return s;
})();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const MODEL = "claude-sonnet-4-6";

// Single shared client — no timeout set here so it doesn't interfere
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });

function hmacSign(data) { return crypto.createHmac("sha256", SIGNING_SECRET).update(data).digest("hex"); }
function sha256hex(buffer) { return crypto.createHash("sha256").update(buffer).digest("hex"); }
const db = new JsonDB(path.join(DATA_DIR, "meterwatch.json"));

function auditLog(event, userId, details, ip) {
  db.insertAudit({ server_ts: Date.now(), event, user_id: userId || "anon", details: JSON.stringify(details), ip: ip || "", entry_hash: sha256hex(Buffer.from(JSON.stringify({ event, userId, details, ip, ts: Date.now() }))) });
}

// Proper abort — passes signal directly to messages.create()
async function callAI(params, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    console.error("[AI] Hard abort after " + timeoutMs + "ms");
    controller.abort();
  }, timeoutMs);
  try {
    // signal is a valid option on messages.create() in the SDK
    const result = await anthropic.messages.create(params, { signal: controller.signal });
    clearTimeout(timer);
    return result;
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = controller.signal.aborted || err.name === "AbortError" || (err.message && err.message.includes("aborted"));
    if (isTimeout) throw new Error("AI_TIMEOUT after " + timeoutMs + "ms");
    throw err;
  }
}

const COMBINED_PROMPT = `You are reading an electricity meter. Extract the kWh reading.

This is an ANALOG DRUM METER (like a car odometer) with rotating number cylinders.
The digits are: 6 8 2 5 1 (reading left to right across the black/white drums).
The rightmost drum is RED/ORANGE — this is the decimal indicator, IGNORE IT.
Only read the BLACK AND WHITE drums.

Steps:
1. Look at the row of number drums at the top of the meter face
2. Read each black/white drum left to right as a single number
3. Ignore any red or orange drum on the far right
4. The meter number is printed on a plate at the bottom (labelled No.)

Return ONLY valid JSON, no markdown:
{"isElectricityMeter":true,"isPhotoOfScreen":false,"isEdited":false,"reading":12345,"meterNumber":"ABC123 or null","rawText":"digits you see","confidence":90,"reason":"brief note"}

- reading: the integer kWh value from the black/white drums only, or null if truly unreadable
- meterNumber: serial number from the plate at the bottom, or null
- confidence: 0-100`;

async function analyzeImage(imageBuffer) {
  // Anthropic API max is 5MB — resize if needed, keep colour
  const MAX_BYTES = 4 * 1024 * 1024;
  let buf = imageBuffer;
  if (buf.length > MAX_BYTES) {
    try {
      buf = await sharp(buf)
        .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      console.log("[analyzeImage] Resized from", imageBuffer.length, "to", buf.length, "bytes");
    } catch (e) {
      console.error("[analyzeImage] Resize failed:", e.message);
      // proceed with original — will likely get 400 but at least we tried
    }
  }
  const b64 = buf.toString("base64");
  let resp;
  try {
    resp = await callAI({
      model: MODEL,
      max_tokens: 300,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } },
        { type: "text", text: COMBINED_PROMPT }
      ]}]
    }, 25000);
  } catch (err) {
    console.error("[analyzeImage]", err.message);
    // Return safe fallback — image already saved, user will be prompted for manual entry
    return { isElectricityMeter: true, isPhotoOfScreen: false, isEdited: false, reading: null, meterNumber: null, confidence: 0, reason: "AI error: " + err.message, timedOut: err.message.startsWith("AI_TIMEOUT") };
  }
  const text = resp.content.filter(b => b.type === "text").map(b => b.text).join("");
  console.log("[AI raw]", text.slice(0, 200));
  try {
    return JSON.parse(text.replace(/```json?|```/g, "").trim());
  } catch {
    console.error("[AI parse fail]", text);
    return { isElectricityMeter: true, isPhotoOfScreen: false, isEdited: false, reading: null, meterNumber: null, confidence: 0, reason: "JSON parse error" };
  }
}

function buildProof({ userId, serverTs, imageHash, readingKwh, aiReadingKwh, gpsLat, gpsLng, prevChainHash }) {
  const payload = ["user_id=" + userId, "server_ts=" + serverTs, "image_hash=" + imageHash, "reading_kwh=" + readingKwh, "ai_reading_kwh=" + (aiReadingKwh ?? "null"), "gps_lat=" + (gpsLat ?? "null"), "gps_lng=" + (gpsLng ?? "null"), "prev_chain_hash=" + prevChainHash].join("|");
  const hmac = hmacSign(payload);
  const chainHash = sha256hex(Buffer.from(prevChainHash + ":" + imageHash + ":" + readingKwh + ":" + serverTs + ":" + userId));
  return { payload, hmac, chainHash };
}

function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (!token || token !== hmacSign(ADMIN_PASSWORD)) return res.status(401).json({ error: "Unauthorized" });
  next();
}

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: (req, file, cb) => file.mimetype.startsWith("image/") ? cb(null, true) : cb(new Error("Images only")) });
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use((req, _res, next) => { req.userId = req.headers["x-user-id"] || "default"; next(); });

app.get("/api/ping", (req, res) => res.json({ ok: true, ts: Date.now(), model: MODEL }));

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (!password || password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Wrong password" });
  res.json({ token: hmacSign(ADMIN_PASSWORD) });
});

app.get("/api/admin/readings", requireAdmin, (req, res) => {
  res.json(db.getAllReadings().map(r => ({ ...r, fraudFlags: Array.isArray(r.fraud_flags) ? r.fraud_flags : [], aiValidation: r.ai_validation || {}, imagePath: "/api/images/" + r.image_path, proof: { payload: r.proof_payload, hmac: r.proof_hmac } })));
});

app.delete("/api/admin/readings/:id", requireAdmin, (req, res) => {
  const row = db.findReadingByIdAdmin(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  const p = path.join(IMAGES_DIR, row.image_path);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  db.deleteReading(req.params.id);
  auditLog("ADMIN_DELETE_READING", "admin", { id: req.params.id }, req.ip);
  res.json({ ok: true });
});

app.delete("/api/admin/wipe", requireAdmin, (req, res) => {
  try {
    const readings = db.getAllReadings();
    readings.forEach(r => { const p = path.join(IMAGES_DIR, r.image_path); if (fs.existsSync(p)) fs.unlinkSync(p); });
    const statements = db.getAllStatements();
    statements.forEach(s => { const p = path.join(STMTS_DIR, s.image_path); if (fs.existsSync(p)) fs.unlinkSync(p); });
    db.deleteAllReadings(); db.clearStatements(); db.clearAudit();
    auditLog("ADMIN_WIPE_ALL", "admin", { readingsDeleted: readings.length, statementsDeleted: statements.length }, req.ip);
    res.json({ ok: true, message: "All data wiped.", readingsDeleted: readings.length, statementsDeleted: statements.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/admin/readings", requireAdmin, (req, res) => {
  const rows = db.getAllReadings();
  rows.forEach(r => { const p = path.join(IMAGES_DIR, r.image_path); if (fs.existsSync(p)) fs.unlinkSync(p); });
  db.deleteAllReadings();
  auditLog("ADMIN_DELETE_ALL_READINGS", "admin", { count: rows.length }, req.ip);
  res.json({ ok: true, deleted: rows.length });
});

app.get("/api/admin/audit", requireAdmin, (req, res) => { res.json(db.getAudit()); });
app.delete("/api/admin/audit", requireAdmin, (req, res) => { db.clearAudit(); res.json({ ok: true }); });
app.get("/api/admin/statements", requireAdmin, (req, res) => { res.json(db.getAllStatements()); });
app.delete("/api/admin/statements/:id", requireAdmin, (req, res) => {
  const row = db.findStatementByIdAdmin(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  const p = path.join(STMTS_DIR, row.image_path);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  db.deleteStatement(req.params.id);
  res.json({ ok: true });
});

app.get("/api/images/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(IMAGES_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Not found" });
  const fileBuffer = fs.readFileSync(filePath);
  res.set("X-Live-Hash", sha256hex(fileBuffer)).set("Content-Type", "image/jpeg").send(fileBuffer);
});

app.post("/api/readings/preview", upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No photo" });
  try {
    const analysis = await analyzeImage(req.file.buffer);
    res.json({ imageHash: sha256hex(req.file.buffer), aiReading: analysis.reading, meterNumber: analysis.meterNumber, extraction: analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/readings/extract-only", upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No photo" });
  try {
    const analysis = await analyzeImage(req.file.buffer);
    res.json({ imageHash: sha256hex(req.file.buffer), aiReading: analysis.reading, meterNumber: analysis.meterNumber, extraction: analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- MAIN CAPTURE ---
app.post("/api/readings/capture", upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No photo" });
  const serverTs = Date.now();
  const clientTs = parseInt(req.body.clientTimestamp, 10) || serverTs;
  const gpsLat = req.body.gpsLat ? parseFloat(req.body.gpsLat) : null;
  const gpsLng = req.body.gpsLng ? parseFloat(req.body.gpsLng) : null;
  const userConfirmed = req.body.confirmedReading ? parseFloat(req.body.confirmedReading) : null;
  const manualMeterNumber = req.body.meterNumber || null;
  auditLog("CAPTURE_ATTEMPT", req.userId, { bytes: req.file.size }, req.ip);
  try {
    const imageHash = sha256hex(req.file.buffer);
    if (db.findReadingByHash(imageHash)) return res.status(409).json({ error: "This photo has already been submitted" });

    const imageFilename = imageHash + ".jpg";
    const imageDiskPath = path.join(IMAGES_DIR, imageFilename);
    fs.writeFileSync(imageDiskPath, req.file.buffer);

    const flags = [];
    const analysis = await analyzeImage(req.file.buffer);
    console.log("[CAPTURE] AI result:", JSON.stringify(analysis));

    if (analysis.isPhotoOfScreen === true || analysis.isEdited === true) {
      fs.unlinkSync(imageDiskPath);
      const reason = analysis.isPhotoOfScreen ? "Photo of a screen detected" : "Digital editing detected";
      auditLog("FRAUD_BLOCKED", req.userId, { reason }, req.ip);
      return res.status(422).json({ error: "Photo failed authenticity check", reason, flags: ["CRITICAL: " + reason] });
    }

    const aiReading = (analysis.reading !== undefined && analysis.reading !== null) ? Number(analysis.reading) : null;
    const aiMeterNumber = analysis.meterNumber || null;

    let finalReading, readingSource;
    if (userConfirmed !== null && !isNaN(userConfirmed) && userConfirmed > 0) {
      finalReading = userConfirmed;
      readingSource = (aiReading !== null && Math.abs(userConfirmed - aiReading) < 0.5) ? "AI_CONFIRMED" : "AI_CORRECTED";
    } else if (aiReading !== null && !isNaN(aiReading)) {
      finalReading = aiReading;
      readingSource = "AI_CONFIRMED";
    } else {
      return res.status(202).json({ status: "manual_required", imageHash, imageSaved: true, aiTimedOut: !!analysis.timedOut, meterNumber: aiMeterNumber, message: "Photo saved. AI could not read the meter — please enter the reading manually." });
    }

    const finalMeterNumber = manualMeterNumber || aiMeterNumber || null;
    if (finalReading < 0) flags.push("Negative reading");
    const last = db.getLastReading(req.userId);
    if (last && finalReading < last.reading_kwh) flags.push("Reading " + finalReading + " below previous " + last.reading_kwh);
    const prevChainHash = last ? last.chain_hash : "genesis";
    const { payload: proofPayload, hmac: proofHmac, chainHash } = buildProof({ userId: req.userId, serverTs, imageHash, readingKwh: finalReading, aiReadingKwh: aiReading, gpsLat, gpsLng, prevChainHash });
    const id = "r_" + serverTs + "_" + crypto.randomBytes(4).toString("hex");
    db.insertReading({ id, user_id: req.userId, server_ts: serverTs, client_ts: clientTs, reading_kwh: finalReading, ai_reading_kwh: aiReading, reading_source: readingSource, meter_number: finalMeterNumber, image_hash: imageHash, image_path: imageFilename, image_size_bytes: req.file.size, image_mime: req.file.mimetype, gps_lat: gpsLat, gps_lng: gpsLng, ai_validation: analysis, fraud_flags: flags, prev_chain_hash: prevChainHash, chain_hash: chainHash, proof_hmac: proofHmac, proof_payload: proofPayload });
    auditLog("CAPTURE_SUCCESS", req.userId, { id, reading: finalReading, hash: imageHash, meterNumber: finalMeterNumber }, req.ip);
    res.json({ id, reading: finalReading, aiReading, readingSource, meterNumber: finalMeterNumber, meterNumberSource: manualMeterNumber ? "manual" : (aiMeterNumber ? "ai" : "unknown"), serverTs, imageHash, chainHash, fraudFlags: flags, imagePath: "/api/images/" + imageFilename, proof: { payload: proofPayload, hmac: proofHmac } });
  } catch (err) {
    auditLog("CAPTURE_ERROR", req.userId, { error: err.message }, req.ip);
    console.error("[CAPTURE ERROR]", err);
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/readings/manual", upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No photo" });
  const serverTs = Date.now();
  const clientTs = parseInt(req.body.clientTimestamp, 10) || serverTs;
  const manualReading = parseFloat(req.body.confirmedReading);
  const manualMeterNumber = req.body.meterNumber || null;
  const gpsLat = req.body.gpsLat ? parseFloat(req.body.gpsLat) : null;
  const gpsLng = req.body.gpsLng ? parseFloat(req.body.gpsLng) : null;
  if (!manualReading || isNaN(manualReading) || manualReading <= 0) return res.status(400).json({ error: "Valid reading required" });
  try {
    const imageHash = sha256hex(req.file.buffer);
    const imageFilename = imageHash + ".jpg";
    const imageDiskPath = path.join(IMAGES_DIR, imageFilename);
    if (!fs.existsSync(imageDiskPath)) fs.writeFileSync(imageDiskPath, req.file.buffer);
    const last = db.getLastReading(req.userId);
    const prevChainHash = last ? last.chain_hash : "genesis";
    const { payload: proofPayload, hmac: proofHmac, chainHash } = buildProof({ userId: req.userId, serverTs, imageHash, readingKwh: manualReading, aiReadingKwh: null, gpsLat, gpsLng, prevChainHash });
    const id = "r_" + serverTs + "_" + crypto.randomBytes(4).toString("hex");
    db.insertReading({ id, user_id: req.userId, server_ts: serverTs, client_ts: clientTs, reading_kwh: manualReading, ai_reading_kwh: null, reading_source: "MANUAL", meter_number: manualMeterNumber, image_hash: imageHash, image_path: imageFilename, image_size_bytes: req.file.size, image_mime: req.file.mimetype, gps_lat: gpsLat, gps_lng: gpsLng, ai_validation: {}, fraud_flags: [], prev_chain_hash: prevChainHash, chain_hash: chainHash, proof_hmac: proofHmac, proof_payload: proofPayload });
    auditLog("MANUAL_READING", req.userId, { id, reading: manualReading, meterNumber: manualMeterNumber, hash: imageHash }, req.ip);
    res.json({ id, reading: manualReading, readingSource: "MANUAL", meterNumber: manualMeterNumber, serverTs, imageHash, chainHash, imagePath: "/api/images/" + imageFilename, proof: { payload: proofPayload, hmac: proofHmac } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/readings", (req, res) => {
  res.json(db.getReadings(req.userId).map(r => ({ ...r, fraudFlags: Array.isArray(r.fraud_flags) ? r.fraud_flags : [], aiValidation: r.ai_validation || {}, imagePath: "/api/images/" + r.image_path, proof: { payload: r.proof_payload, hmac: r.proof_hmac } })));
});

app.get("/api/readings/:id/verify", (req, res) => {
  const row = db.findReadingById(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: "Not found" });
  const checks = [];
  const diskPath = path.join(IMAGES_DIR, row.image_path);
  if (fs.existsSync(diskPath)) { const h = sha256hex(fs.readFileSync(diskPath)); checks.push({ name: "Image file integrity", pass: h === row.image_hash, detail: h === row.image_hash ? "SHA-256 verified" : "MISMATCH" }); }
  else checks.push({ name: "Image file integrity", pass: false, detail: "File missing" });
  const { hmac: recomputed } = buildProof({ userId: row.user_id, serverTs: row.server_ts, imageHash: row.image_hash, readingKwh: row.reading_kwh, aiReadingKwh: row.ai_reading_kwh, gpsLat: row.gps_lat, gpsLng: row.gps_lng, prevChainHash: row.prev_chain_hash });
  checks.push({ name: "HMAC proof", pass: recomputed === row.proof_hmac, detail: recomputed === row.proof_hmac ? "Valid" : "TAMPERED" });
  const prev = db.getReadingsBefore(req.userId, row.server_ts)[0];
  const expectedPrev = prev ? prev.chain_hash : "genesis";
  checks.push({ name: "Hash chain", pass: row.prev_chain_hash === expectedPrev, detail: row.prev_chain_hash === expectedPrev ? "Chain intact" : "BROKEN" });
  res.json({ id: row.id, pass: checks.every(c => c.pass), checks, proofPayload: row.proof_payload });
});

app.post("/api/statements/upload", upload.single("statement"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  try {
    const imageHash = sha256hex(req.file.buffer);
    fs.writeFileSync(path.join(STMTS_DIR, imageHash + "_stmt.jpg"), req.file.buffer);
    const b64 = req.file.buffer.toString("base64");
    const resp = await callAI({ model: MODEL, max_tokens: 1200, system: "Parse South African municipal electricity bills. Return only valid JSON, no markdown.", messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } }, { type: "text", text: 'Parse this bill. Return JSON:\n{"accountNumber":"string or null","billingPeriodStart":"YYYY-MM-DD or null","billingPeriodEnd":"YYYY-MM-DD or null","openingReading":"number or null","closingReading":"number or null","unitsConsumed":"number or null","readingType":"ACTUAL or ESTIMATED or UNKNOWN","amountDue":"number or null","currency":"ZAR","municipality":"string or null","notes":"key observations"}' }] }] }, 30000);
    const text = resp.content.filter(b => b.type === "text").map(b => b.text).join("");
    const parsed = JSON.parse(text.replace(/```json?|```/g, "").trim());
    const id = "s_" + Date.now() + "_" + crypto.randomBytes(4).toString("hex");
    db.insertStatement({ id, user_id: req.userId, server_ts: Date.now(), image_hash: imageHash, image_path: imageHash + "_stmt.jpg", billing_start: parsed.billingPeriodStart, billing_end: parsed.billingPeriodEnd, opening_kwh: parsed.openingReading, closing_kwh: parsed.closingReading, units_consumed: parsed.unitsConsumed, reading_type: parsed.readingType, amount_due: parsed.amountDue, currency: parsed.currency || "ZAR", municipality: parsed.municipality, account_number: parsed.accountNumber, raw_json: JSON.stringify(parsed) });
    res.json({ id, imageHash, ...parsed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/statements", (req, res) => { res.json(db.getStatements(req.userId)); });

app.post("/api/compare", async (req, res) => {
  try {
    const readings = db.getReadings(req.userId, 60);
    const statements = db.getStatements(req.userId);
    if (!readings.length || !statements.length) return res.status(400).json({ error: "Need both readings and statements" });
    const rSummary = readings.map(r => ({ date: new Date(r.server_ts).toISOString().slice(0,10), reading_kwh: r.reading_kwh, source: r.reading_source }));
    const sSummary = statements.map(s => ({ period: s.billing_start + " to " + s.billing_end, opening_kwh: s.opening_kwh, closing_kwh: s.closing_kwh, units: s.units_consumed, readingType: s.reading_type, amountZAR: s.amount_due }));
    const resp = await callAI({ model: MODEL, max_tokens: 2000, system: "South African municipal billing dispute analyst. Return only valid JSON, no markdown.", messages: [{ role: "user", content: "Verified meter readings: " + JSON.stringify(rSummary) + "\n\nMunicipal statements: " + JSON.stringify(sSummary) + '\n\nReturn JSON: {"summary":"","overallStatus":"OVERBILLED|ACCURATE|UNDERBILLED|INSUFFICIENT_DATA","discrepancies":[{"period":"","municipalReading":null,"actualReading":null,"differenceKwh":null,"readingType":"","severity":"HIGH|MEDIUM|LOW","explanation":"","overbilledKwh":null,"estimatedRandOverbilled":null}],"totalOverbilledKwh":null,"totalRandOverbilled":null,"recommendedAction":"","disputeLetter":""}' }] }, 30000);
    const text = resp.content.filter(b => b.type === "text").map(b => b.text).join("");
    res.json(JSON.parse(text.replace(/```json?|```/g, "").trim()));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/audit", (_req, res) => { res.json(db.getAudit()); });

const ADMIN_HTML = path.join(__dirname, "admin.html");
app.get("/mw-admin", (_req, res) => {
  if (fs.existsSync(ADMIN_HTML)) res.sendFile(ADMIN_HTML);
  else res.status(404).send("Admin portal not found");
});

const FRONTEND_DIST = "/app/frontend/dist";
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST, { index: false }));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/") || req.path === "/mw-admin") return res.status(404).json({ error: "Not found" });
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
  console.log("[MeterWatch] Frontend -> " + FRONTEND_DIST);
} else {
  console.warn("[MeterWatch] No frontend dist found - API only mode");
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log("[MeterWatch] Backend :" + PORT);
  console.log("[MeterWatch] Model: " + MODEL);
  console.log("[MeterWatch] Images -> " + IMAGES_DIR);
});

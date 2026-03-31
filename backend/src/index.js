import express from "express";
import cors from "cors";
import multer from "multer";
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { JsonDB } from "./db.js";

process.on("uncaughtException", (err) => { console.error("[CRASH]", err.message, err.stack); });
process.on("unhandledRejection", (err) => { console.error("[REJECTION]", err); });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR   = path.join(__dirname, "../../data");
const IMAGES_DIR = path.join(DATA_DIR, "images");
const STMTS_DIR  = path.join(DATA_DIR, "statements");
fs.mkdirSync(IMAGES_DIR, { recursive: true });
fs.mkdirSync(STMTS_DIR,  { recursive: true });

const SIGNING_SECRET = process.env.SIGNING_SECRET || (() => {
  const f = path.join(DATA_DIR, ".signing_secret");
  if (fs.existsSync(f)) return fs.readFileSync(f, "utf8").trim();
  const s = crypto.randomBytes(64).toString("hex");
  fs.writeFileSync(f, s, { mode: 0o600 });
  return s;
})();

function hmacSign(data) {
  return crypto.createHmac("sha256", SIGNING_SECRET).update(data).digest("hex");
}
function sha256hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function resizeImageBuffer(buffer, maxPx = 1600) {
  try {
    return await sharp(buffer)
      .resize(maxPx, maxPx, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch (e) {
    console.warn("[RESIZE] Failed, using original:", e.message);
    return buffer;
  }
}

const db = new JsonDB(path.join(DATA_DIR, "meterwatch.json"));
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-20250514";

function auditLog(event, userId, details, ip) {
  db.insertAudit({
    server_ts: Date.now(), event,
    user_id: userId || "anon",
    details: JSON.stringify(details),
    ip: ip || "",
    entry_hash: sha256hex(Buffer.from(JSON.stringify({ event, userId, details, ip, ts: Date.now() })))
  });
}

async function validateMeterImage(imageBuffer, mimeType, clientTs) {
  const flags = [];
  if (imageBuffer.length < 15 * 1024) flags.push("Image too small");
  const timeDiff = Math.abs(Date.now() - clientTs);
  if (timeDiff > 5 * 60 * 1000) flags.push(`Timestamp gap: ${Math.round(timeDiff/1000)}s`);

  const resized = await resizeImageBuffer(imageBuffer, 1400);
  const b64 = resized.toString("base64");
  let validation = {};
  try {
    const resp = await anthropic.messages.create({
      model: MODEL, max_tokens: 400,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } },
        { type: "text", text: `Analyse this image. Return ONLY valid JSON:
{
  "isElectricityMeter": boolean,
  "hasVisibleMeterDisplay": boolean,
  "appearsGenuine": boolean,
  "isScreenshot": boolean,
  "isPhotoOfScreen": boolean,
  "isEdited": boolean,
  "isPhotoOfPrintedDocument": boolean,
  "confidencePercent": 0-100,
  "notes": "brief note"
}` }
      ]}]
    });
    validation = JSON.parse(resp.content.filter(b => b.type === "text").map(b => b.text).join("").replace(/```json?|```/g, "").trim());
  } catch (e) {
    validation = { appearsGenuine: true, notes: "Validation skipped: " + e.message };
  }

  if (validation.isScreenshot) flags.push("CRITICAL: Screenshot detected");
  if (validation.isPhotoOfScreen) flags.push("CRITICAL: Photo of a screen");
  if (validation.isEdited) flags.push("CRITICAL: Digital editing detected");
  if (validation.isPhotoOfPrintedDocument) flags.push("CRITICAL: Photo of printed document");

  const criticalFlags = flags.filter(f => f.startsWith("CRITICAL:"));
  return { flags, criticalFlags, validation };
}

async function extractReading(imageBuffer, mimeType) {
  const resized = await resizeImageBuffer(imageBuffer, 1400);
  const b64 = resized.toString("base64");
  const resp = await anthropic.messages.create({
    model: MODEL, max_tokens: 250,
    messages: [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } },
      { type: "text", text: `Read the electricity meter. Return ONLY valid JSON:
{
  "reading": number or null,
  "rawText": "what you see",
  "confidence": 0-100
}
Return your best guess even if not 100% certain. Only return null if you cannot see any digits at all.` }
    ]}]
  });
  const text = resp.content.filter(b => b.type === "text").map(b => b.text).join("");
  try { return JSON.parse(text.replace(/```json?|```/g, "").trim()); }
  catch { return { reading: null, rawText: text.trim(), confidence: 0 }; }
}

function buildProof({ userId, serverTs, imageHash, readingKwh, aiReadingKwh, gpsLat, gpsLng, prevChainHash }) {
  const payload = [
    `user_id=${userId}`, `server_ts=${serverTs}`, `image_hash=${imageHash}`,
    `reading_kwh=${readingKwh}`, `ai_reading_kwh=${aiReadingKwh ?? "null"}`,
    `gps_lat=${gpsLat ?? "null"}`, `gps_lng=${gpsLng ?? "null"}`,
    `prev_chain_hash=${prevChainHash}`,
  ].join("|");
  const hmac = hmacSign(payload);
  const chainHash = sha256hex(Buffer.from(`${prevChainHash}:${imageHash}:${readingKwh}:${serverTs}:${userId}`));
  return { payload, hmac, chainHash };
}

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => file.mimetype.startsWith("image/") ? cb(null, true) : cb(new Error("Images only"))
});

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use((req, _res, next) => { req.userId = req.headers["x-user-id"] || "default"; next(); });

app.get("/api/images/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(IMAGES_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Not found" });
  const fileBuffer = fs.readFileSync(filePath);
  const liveHash = sha256hex(fileBuffer);
  res.set("X-Live-Hash", liveHash);
  res.set("Content-Type", "image/jpeg");
  res.send(fileBuffer);
});

app.post("/api/readings/preview", upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No photo" });
  try {
    const imageHash = sha256hex(req.file.buffer);
    const extraction = await extractReading(req.file.buffer, req.file.mimetype);
    res.json({ imageHash, aiReading: extraction.reading, extraction });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/readings/extract-only", upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No photo" });
  try {
    const imageHash = sha256hex(req.file.buffer);
    const extraction = await extractReading(req.file.buffer, req.file.mimetype);
    res.json({ imageHash, aiReading: extraction.reading, extraction });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/readings/capture", upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No photo" });
  const serverTs = Date.now();
  const clientTs = parseInt(req.body.clientTimestamp, 10) || serverTs;
  const gpsLat = req.body.gpsLat ? parseFloat(req.body.gpsLat) : null;
  const gpsLng = req.body.gpsLng ? parseFloat(req.body.gpsLng) : null;
  const userConfirmed = req.body.confirmedReading ? parseFloat(req.body.confirmedReading) : null;

  auditLog("CAPTURE_ATTEMPT", req.userId, { bytes: req.file.size }, req.ip);
  try {
    const imageHash = sha256hex(req.file.buffer);
    if (db.findReadingByHash(imageHash)) {
      return res.status(409).json({ error: "This photo has already been submitted" });
    }

    const { flags, criticalFlags, validation } = await validateMeterImage(req.file.buffer, req.file.mimetype, clientTs);
    if (criticalFlags.length > 0) {
      auditLog("FRAUD_BLOCKED", req.userId, { criticalFlags }, req.ip);
      return res.status(422).json({ error: "Photo failed authenticity check", reason: criticalFlags[0].replace("CRITICAL: ", ""), flags });
    }

    const imageFilename = `${imageHash}.jpg`;
    const imageDiskPath = path.join(IMAGES_DIR, imageFilename);
    fs.writeFileSync(imageDiskPath, req.file.buffer);
    const writtenHash = sha256hex(fs.readFileSync(imageDiskPath));
    if (writtenHash !== imageHash) {
      fs.unlinkSync(imageDiskPath);
      return res.status(500).json({ error: "Image storage verification failed" });
    }

    const extraction = await extractReading(fs.readFileSync(imageDiskPath), req.file.mimetype);
    const aiReading = extraction.reading;

    let finalReading, readingSource;
    if (userConfirmed !== null && !isNaN(userConfirmed) && userConfirmed > 0) {
      finalReading = userConfirmed;
      readingSource = (aiReading !== null && Math.abs(userConfirmed - aiReading) < 0.5) ? "AI_CONFIRMED" : "AI_CORRECTED";
    } else if (aiReading !== null) {
      finalReading = aiReading;
      readingSource = "AI_CONFIRMED";
    } else {
      if (userConfirmed !== null && !isNaN(userConfirmed) && userConfirmed > 0) {
        finalReading = userConfirmed;
        readingSource = "MANUAL";
      } else {
        fs.unlinkSync(imageDiskPath);
        return res.status(422).json({ error: "Please enter the meter reading manually.", aiNotes: extraction.rawText });
      }
    }

    const last = db.getLastReading(req.userId);
    if (last && finalReading < last.reading_kwh) flags.push(`Reading ${finalReading} below previous ${last.reading_kwh}`);

    const prevChainHash = last ? last.chain_hash : "genesis";
    const { payload: proofPayload, hmac: proofHmac, chainHash } = buildProof({
      userId: req.userId, serverTs, imageHash,
      readingKwh: finalReading, aiReadingKwh: aiReading,
      gpsLat, gpsLng, prevChainHash,
    });

    const id = `r_${serverTs}_${crypto.randomBytes(4).toString("hex")}`;
    const reading = {
      id, user_id: req.userId, server_ts: serverTs, client_ts: clientTs,
      reading_kwh: finalReading, ai_reading_kwh: aiReading, reading_source: readingSource,
      image_hash: imageHash, image_path: imageFilename,
      image_size_bytes: req.file.size, image_mime: req.file.mimetype,
      gps_lat: gpsLat, gps_lng: gpsLng,
      ai_validation: validation, fraud_flags: flags,
      prev_chain_hash: prevChainHash, chain_hash: chainHash,
      proof_hmac: proofHmac, proof_payload: proofPayload
    };
    db.insertReading(reading);
    auditLog("CAPTURE_SUCCESS", req.userId, { id, reading: finalReading, hash: imageHash }, req.ip);

    res.json({
      id, reading: finalReading, aiReading, readingSource, serverTs,
      imageHash, chainHash, fraudFlags: flags,
      imagePath: `/api/images/${imageFilename}`,
      proof: { payload: proofPayload, hmac: proofHmac },
    });
  } catch (err) {
    auditLog("CAPTURE_ERROR", req.userId, { error: err.message }, req.ip);
    console.error("[CAPTURE ERROR]", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/readings", (req, res) => {
  const rows = db.getReadings(req.userId);
  res.json(rows.map(r => ({
    ...r,
    fraudFlags: Array.isArray(r.fraud_flags) ? r.fraud_flags : [],
    aiValidation: r.ai_validation || {},
    imagePath: `/api/images/${r.image_path}`,
    proof: { payload: r.proof_payload, hmac: r.proof_hmac },
  })));
});

app.get("/api/readings/:id/verify", (req, res) => {
  const row = db.findReadingById(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: "Not found" });
  const checks = [];
  const diskPath = path.join(IMAGES_DIR, row.image_path);
  if (fs.existsSync(diskPath)) {
    const liveHash = sha256hex(fs.readFileSync(diskPath));
    checks.push({ name: "Image file integrity", pass: liveHash === row.image_hash, detail: liveHash === row.image_hash ? "SHA-256 verified" : "MISMATCH" });
  } else {
    checks.push({ name: "Image file integrity", pass: false, detail: "File missing" });
  }
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
    // Resize before saving and sending to AI
    const resized = await resizeImageBuffer(req.file.buffer, 1600);
    fs.writeFileSync(path.join(STMTS_DIR, `${imageHash}_stmt.jpg`), resized);
    const b64 = resized.toString("base64");
    const resp = await anthropic.messages.create({
      model: MODEL, max_tokens: 1200,
      system: "Parse South African municipal electricity bills. Return only valid JSON, no markdown.",
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } },
        { type: "text", text: `Parse this bill. Return JSON:
{
  "accountNumber": "string or null",
  "billingPeriodStart": "YYYY-MM-DD or null",
  "billingPeriodEnd": "YYYY-MM-DD or null",
  "openingReading": number or null,
  "closingReading": number or null,
  "unitsConsumed": number or null,
  "readingType": "ACTUAL or ESTIMATED or UNKNOWN",
  "amountDue": number or null,
  "currency": "ZAR",
  "municipality": "string or null",
  "notes": "key observations"
}` }
      ]}]
    });
    const text = resp.content.filter(b => b.type === "text").map(b => b.text).join("");
    const parsed = JSON.parse(text.replace(/```json?|```/g, "").trim());
    const id = `s_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    db.insertStatement({ id, user_id: req.userId, server_ts: Date.now(), image_hash: imageHash, image_path: `${imageHash}_stmt.jpg`, billing_start: parsed.billingPeriodStart, billing_end: parsed.billingPeriodEnd, opening_kwh: parsed.openingReading, closing_kwh: parsed.closingReading, units_consumed: parsed.unitsConsumed, reading_type: parsed.readingType, amount_due: parsed.amountDue, currency: parsed.currency || "ZAR", municipality: parsed.municipality, account_number: parsed.accountNumber, raw_json: JSON.stringify(parsed) });
    res.json({ id, imageHash, ...parsed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/statements", (req, res) => {
  res.json(db.getStatements(req.userId));
});

app.post("/api/compare", async (req, res) => {
  try {
    const readings = db.getReadings(req.userId, 60);
    const statements = db.getStatements(req.userId);
    if (!readings.length || !statements.length) return res.status(400).json({ error: "Need both readings and statements" });
    const rSummary = readings.map(r => ({ date: new Date(r.server_ts).toISOString().slice(0,10), reading_kwh: r.reading_kwh, source: r.reading_source }));
    const sSummary = statements.map(s => ({ period: `${s.billing_start} to ${s.billing_end}`, opening_kwh: s.opening_kwh, closing_kwh: s.closing_kwh, units: s.units_consumed, readingType: s.reading_type, amountZAR: s.amount_due }));
    const resp = await anthropic.messages.create({
      model: MODEL, max_tokens: 2000,
      system: "South African municipal billing dispute analyst. Return only valid JSON, no markdown.",
      messages: [{ role: "user", content: `Verified meter readings: ${JSON.stringify(rSummary)}\n\nMunicipal statements: ${JSON.stringify(sSummary)}\n\nReturn JSON: { "summary": "", "overallStatus": "OVERBILLED|ACCURATE|UNDERBILLED|INSUFFICIENT_DATA", "discrepancies": [{"period":"","municipalReading":null,"actualReading":null,"differenceKwh":null,"readingType":"","severity":"HIGH|MEDIUM|LOW","explanation":"","overbilledKwh":null,"estimatedRandOverbilled":null}], "totalOverbilledKwh":null,"totalRandOverbilled":null,"recommendedAction":"","disputeLetter":"" }` }]
    });
    const text = resp.content.filter(b => b.type === "text").map(b => b.text).join("");
    res.json(JSON.parse(text.replace(/```json?|```/g, "").trim()));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/audit", (_req, res) => { res.json(db.getAudit()); });

// Serve built frontend — must be after all API routes
const FRONTEND_DIST = "/app/frontend/dist";
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
  console.log(`[MeterWatch] Frontend → ${FRONTEND_DIST}`);
} else {
  console.warn("[MeterWatch] No frontend dist found — API only mode");
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[MeterWatch] Backend :${PORT}`);
  console.log(`[MeterWatch] Images → ${IMAGES_DIR}`);
});

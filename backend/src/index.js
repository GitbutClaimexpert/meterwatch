import express from "express";
import cors from "cors";
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import sharp from "sharp"; 
import { JsonDB } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB and ensure audit array exists to prevent .push() crashes [cite: 2412, 2421]
const db = new JsonDB(path.join(__dirname, "db.json"));
if (!db.data.audit) db.data.audit = []; 

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const FRONTEND_DIST = path.join(__dirname, "../../frontend/dist");
const ADMIN_HTML = path.join(__dirname, "admin.html");

// --- Helper Functions ---

async function auditLog(action, details = {}) {
  const entry = {
    ts: new Date().toISOString(),
    action,
    ...details
  };
  await db.insertAudit(entry);
}

/**
 * Combined AI Analysis: Validates and extracts in one call to reduce latency [cite: 2129]
 * Uses sharp to resize images over 4MB to stay under the 5MB API limit [cite: 2444, 2526]
 */
async function analyzeMeterImage(base64Data) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout [cite: 2200]

  try {
    let buffer = Buffer.from(base64Data, "base64");
    
    if (buffer.length > 4 * 1024 * 1024) {
      console.log(`[analyzeImage] Resizing large image: ${buffer.length} bytes`);
      buffer = await sharp(buffer)
        .resize(1800, 1800, { fit: "inside" })
        .jpeg({ quality: 85 })
        .toBuffer();
    }

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620", // Upgraded model for better analog drum accuracy [cite: 1986, 2580]
      max_tokens: 400,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: buffer.toString("base64"),
            },
          },
          {
            type: "text",
            text: `Analyze this electricity meter. 
            METER TYPES: Both digital and analog drum (odometer style) are valid[cite: 1661]. 
            ANALOG DRUMS: Read black/white drums left-to-right. IGNORE red/orange decimal drums[cite: 1667, 1716]. 
            Respond ONLY in JSON: {"isElectricityMeter": true, "reading": "12345", "confidence": "high", "meterNumber": "optional"}`
          }
        ],
      }],
    }, { signal: controller.signal });

    clearTimeout(timeoutId);
    const result = JSON.parse(response.content[0].text);
    console.log("[AI raw]", result);
    return result;
  } catch (err) {
    console.error("[AI Error]", err.message);
    return { isElectricityMeter: true, reading: null, confidence: "low", error: err.message };
  }
}

// --- API Routes (Must be defined BEFORE static middleware) [cite: 1491, 1532] ---

app.get("/api/ping", (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.get("/mw-admin", (req, res) => {
  res.sendFile(ADMIN_HTML);
});

app.post("/api/readings/capture", async (req, res) => {
  const { photo, clientTs, location } = req.body;
  
  if (!photo) return res.status(400).json({ error: "No photo provided" });

  try {
    await auditLog("CAPTURE_ATTEMPT", { clientTs });
    
    const aiResult = await analyzeMeterImage(photo);

    const reading = {
      id: "rd_" + Date.now(),
      ts: new Date().toISOString(),
      clientTs,
      location,
      reading_kwh: aiResult.reading,
      meter_no: aiResult.meterNumber || "Unknown",
      status: aiResult.reading ? "confirmed" : "manual_required",
      confidence: aiResult.confidence,
      isElectricityMeter: aiResult.isElectricityMeter
    };

    await db.insertReading(reading);
    res.json(reading);
  } catch (err) {
    console.error("Capture failed:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/admin/wipe", (req, res) => {
  db.data.readings = [];
  db.data.audit = [];
  db.save();
  res.json({ success: true, message: "All data wiped" });
});

// --- Static Middleware & Frontend Catch-all ---

app.use(express.static(FRONTEND_DIST, { index: false })); // index: false prevents auto-serving index.html [cite: 1534]

app.get("*", (req, res) => {
  // If request is for an API that doesn't exist, don't serve the React app
  if (req.path.startsWith("/api")) return res.status(404).json({ error: "API not found" });
  res.sendFile(path.join(FRONTEND_DIST, "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[MeterWatch] Server running on port ${PORT}`);
});

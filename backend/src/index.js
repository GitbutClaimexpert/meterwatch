import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";
import path from "path";
import sharp from "sharp"; 
import { JsonDB } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB with internal safety checks
const db = new JsonDB(path.join(__dirname, "db.json"));

const app = express();

// 1. ENABLE CORS: This stops the "Blocked by CORS" errors in the browser console
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// 2. PAYLOAD LIMITS: Allows the server to receive 5MB+ high-res images
app.use(express.json({ limit: "50mb" }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FRONTEND_DIST = path.join(__dirname, "../../frontend/dist");
const ADMIN_HTML = path.join(__dirname, "admin.html");

/**
 * AI Logic: Resizes image to stay under API limits and extracts digits from analog drums
 */
async function analyzeMeterImage(base64Data) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    let buffer = Buffer.from(base64Data, "base64");
    
    // Server-side resize for large iPhone photos (anything > 4MB)
    if (buffer.length > 4 * 1024 * 1024) {
      buffer = await sharp(buffer)
        .resize(1800, 1800, { fit: "inside" })
        .jpeg({ quality: 85 })
        .toBuffer();
    }

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620", 
      max_tokens: 400,
      messages: [{
        role: "user",
        content: [
          { 
            type: "image", 
            source: { type: "base64", media_type: "image/jpeg", data: buffer.toString("base64") } 
          },
          { 
            type: "text", 
            text: "Read this analog drum meter. Read BLACK/WHITE drums left-to-right. IGNORE red drum. Respond ONLY valid JSON: {\"isElectricityMeter\": true, \"reading\": \"12345\", \"confidence\": \"high\"}" 
          }
        ],
      }],
    }, { signal: controller.signal });

    clearTimeout(timeoutId);
    return JSON.parse(response.content[0].text);
  } catch (err) {
    console.error("AI processing error:", err);
    return { isElectricityMeter: true, reading: null, confidence: "low" };
  }
}

// --- API ROUTES (MUST BE ABOVE STATIC FRONTEND) ---

app.get("/api/ping", (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.post("/api/readings/capture", async (req, res) => {
  const aiResult = await analyzeMeterImage(req.body.photo);
  const reading = { 
    id: "rd_" + Date.now(), 
    ts: new Date().toISOString(), 
    reading_kwh: aiResult.reading, 
    status: aiResult.reading ? "confirmed" : "manual_required" 
  };
  await db.insertReading(reading);
  res.json(reading);
});

app.delete("/api/admin/wipe", async (req, res) => {
  try {
    db.data.readings = [];
    db.data.audit = [];
    await db.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Wipe failed" });
  }
});

// --- FRONTEND CATCH-ALL (MUST BE THE LAST LINES) ---

app.use(express.static(FRONTEND_DIST, { index: false }));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "API not found" });
  }
  res.sendFile(path.join(FRONTEND_DIST, "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[MeterWatch] Server running on port ${PORT}`);
});

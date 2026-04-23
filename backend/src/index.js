import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";
import path from "path";
import sharp from "sharp"; 
import { JsonDB } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new JsonDB(path.join(__dirname, "db.json"));
const app = express();

// 1. ALLOW CONNECTION: Stops the "Blocked by CORS" error
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// 2. ALLOW LARGE PHOTOS: Essential for high-res iPhone photos
app.use(express.json({ limit: "50mb" }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const FRONTEND_DIST = path.join(__dirname, "../../frontend/dist");

/**
 * AI Processing: Shrinks the image and reads the analog meter digits
 */
async function analyzeMeterImage(base64Data) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    let buffer = Buffer.from(base64Data, "base64");
    
    // Auto-resize large photos so the AI server doesn't reject them
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
            text: "Read this analog drum meter. Read BLACK/WHITE drums left-to-right. IGNORE red drum. Respond ONLY JSON: {\"isElectricityMeter\": true, \"reading\": \"12345\", \"confidence\": \"high\"}" 
          }
        ],
      }],
    }, { signal: controller.signal });

    clearTimeout(timeoutId);
    return JSON.parse(response.content[0].text);
  } catch (err) {
    console.error("AI Error:", err);
    return { isElectricityMeter: true, reading: null, confidence: "low" };
  }
}

// API Routes
app.get("/api/ping", (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

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

// Serve frontend
app.use(express.static(FRONTEND_DIST, { index: false }));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) return res.status(404).json({ error: "API not found" });
  res.sendFile(path.join(FRONTEND_DIST, "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server active on port ${PORT}`));

import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";
import path from "path";
import sharp from "sharp"; 
import { JsonDB } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Database
const db = new JsonDB(path.join(__dirname, "db.json"));
const app = express();

// 1. SECURITY: Allow your iPhone/Vercel to talk to this server
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// 2. CAPACITY: Allow high-res 5MB+ iPhone photos
app.use(express.json({ limit: "50mb" }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const FRONTEND_DIST = path.join(__dirname, "../../frontend/dist");

/**
 * AI CORE LOGIC
 * Optimized for analog meters with rotating drums and cobwebs.
 */
async function analyzeMeterImage(base64Data) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 28000); // 28s timeout

  try {
    let buffer = Buffer.from(base64Data, "base64");
    
    // Resize massive photos so the AI doesn't hang
    if (buffer.length > 3 * 1024 * 1024) {
      buffer = await sharp(buffer)
        .resize(1600, 1600, { fit: "inside" })
        .jpeg({ quality: 80 })
        .toBuffer();
    }

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620", 
      max_tokens: 500,
      messages: [{
        role: "user",
        content: [
          { 
            type: "image", 
            source: { type: "base64", media_type: "image/jpeg", data: buffer.toString("base64") } 
          },
          { 
            type: "text", 
            text: `ACT AS AN EXPERT UTILITY METER READER.
            1. Look at the analog kWh drums.
            2. Identify the 5 main digits from left to right.
            3. RULE: If a digit is rotated halfway between two numbers, always pick the LOWER number.
            4. STRICT RULE: Ignore the red drum on the far right.
            5. Even if there are cobwebs or glare, provide your best numerical estimate.
            6. Respond ONLY in valid JSON format: {"isElectricityMeter": true, "reading": "68251", "confidence": "high"}` 
          }
        ],
      }],
    }, { signal: controller.signal });

    clearTimeout(timeoutId);
    
    // Clean the response in case Claude adds extra text
    const textResponse = response.content[0].text;
    const jsonMatch = textResponse.match(/\{.*\}/s);
    return JSON.parse(jsonMatch[0]);

  } catch (err) {
    console.error("AI Analysis error:", err);
    return { isElectricityMeter: true, reading: null, confidence: "low" };
  }
}

// --- API ENDPOINTS ---

app.get("/api/ping", (req, res) => {
  res.json({ ok: true, status: "System Ready", time: new Date().toISOString() });
});

app.post("/api/readings/capture", async (req, res) => {
  try {
    const aiResult = await analyzeMeterImage(req.body.photo);
    
    const reading = { 
      id: "rd_" + Date.now(), 
      ts: new Date().toISOString(), 
      reading_kwh: aiResult.reading, 
      status: aiResult.reading ? "confirmed" : "manual_required",
      confidence: aiResult.confidence
    };

    await db.insertReading(reading);
    res.json(reading);
  } catch (error) {
    res.status(500).json({ error: "Processing failed" });
  }
});

// --- SERVE THE APP ---
app.use(express.static(FRONTEND_DIST, { index: false }));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) return res.status(404).json({ error: "API not found" });
  res.sendFile(path.join(FRONTEND_DIST, "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`MeterWatch Backend Live on Port ${PORT}`));

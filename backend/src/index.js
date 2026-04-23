import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";
import path from "path";
import sharp from "sharp"; 
import { JsonDB } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB
const db = new JsonDB(path.join(__dirname, "db.json"));

const app = express();

// SECURITY: Allow connection from your Vercel frontend
app.use(cors({ 
  origin: "*", 
  methods: ["GET", "POST", "DELETE", "PATCH", "OPTIONS"], 
  allowedHeaders: ["Content-Type", "Authorization"] 
}));

// CAPACITY: Allow the massive 5MB+ strings from iPhone cameras
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const FRONTEND_DIST = path.join(__dirname, "../../frontend/dist");

/**
 * AI CORE: Optimized for Sangamo Weston analog meters
 */
async function analyzeMeterImage(base64Data) {
  try {
    let buffer = Buffer.from(base64Data, "base64");
    
    // Resize image to ensure it doesn't time out the AI server
    buffer = await sharp(buffer)
      .resize(1600, 1600, { fit: "inside" })
      .jpeg({ quality: 80 })
      .toBuffer();

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620", 
      max_tokens: 500,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: buffer.toString("base64") } },
          { 
            type: "text", 
            text: "ACT AS AN EXPERT UTILITY AUDITOR. 1. Identify the 5 digits on the black/white drums. 2. If a digit is obscured by white flash glare, infer the number from the visible top/bottom edges. 3. If a digit is rolling/halfway between numbers, always pick the LOWER number. 4. IGNORE the red drum and the cobwebs. Respond ONLY with JSON: {\"reading\": \"12345\"}" 
          }
        ],
      }],
    });

    const rawText = response.content[0].text;
    const jsonMatch = rawText.match(/\{.*\}/s);
    if (!jsonMatch) throw new Error("No JSON found");
    
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("[AI ERROR]:", err.message);
    return { reading: null };
  }
}

// --- ROUTES ---

app.get("/api/ping", (req, res) => res.json({ ok: true, status: "Ready" }));

app.post("/api/readings/capture", async (req, res) => {
  console.log("[API] Received capture request");
  try {
    if (!req.body.photo) {
      console.error("[API] Error: req.body.photo is missing");
      return res.status(400).json({ error: "No photo provided" });
    }

    const aiResult = await analyzeMeterImage(req.body.photo);
    const cleanReading = aiResult?.reading ? String(aiResult.reading).replace(/\D/g, '') : null;

    const reading = { 
      id: "rd_" + Date.now(), 
      ts: new Date().toISOString(), 
      reading_kwh: cleanReading, 
      status: cleanReading ? "confirmed" : "manual_required" 
    };

    await db.insertReading(reading);
    res.json(reading);
  } catch (error) {
    console.error("[API] Fatal Error:", error);
    res.status(500).json({ error: "Processing failed" });
  }
});

// Serve frontend files
app.use(express.static(FRONTEND_DIST, { index: false }));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) return res.status(404).end();
  res.sendFile(path.join(FRONTEND_DIST, "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend live on port ${PORT}`));

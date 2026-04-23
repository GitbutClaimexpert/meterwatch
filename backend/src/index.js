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

// 1. WIDE OPEN CORS: Removes every possible browser barrier
app.use(cors({ origin: "*", methods: "*" }));

// 2. MASSIVE LIMITS: Ensures 10MB+ raw iPhone photos don't get rejected
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const FRONTEND_DIST = path.join(__dirname, "../../frontend/dist");

async function analyzeMeterImage(base64Data) {
  try {
    console.log("[AI] Starting analysis...");
    let buffer = Buffer.from(base64Data, "base64");
    
    // Resize to standard 1200px to ensure AI speed
    buffer = await sharp(buffer)
      .resize(1200, 1200, { fit: "inside" })
      .jpeg({ quality: 80 })
      .toBuffer();

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620", 
      max_tokens: 500,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: buffer.toString("base64") } },
          { type: "text", text: "Identify the 5 kWh digits. Choose the lower number if between digits. Ignore red. Respond ONLY: {\"reading\": \"12345\"}" }
        ],
      }],
    });

    const rawText = response.content[0].text;
    console.log("[AI] Raw Response:", rawText);

    const jsonMatch = rawText.match(/\{.*\}/s);
    if (!jsonMatch) throw new Error("No JSON found in AI response");
    
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("[AI] Error:", err.message);
    return { reading: null };
  }
}

app.get("/api/ping", (req, res) => res.json({ ok: true, status: "System Live" }));

app.post("/api/readings/capture", async (req, res) => {
  console.log("[API] Capture request received");
  try {
    if (!req.body.photo) {
      console.error("[API] No photo data received in request body");
      return res.status(400).json({ error: "No photo provided" });
    }

    const aiResult = await analyzeMeterImage(req.body.photo);
    const val = aiResult?.reading ? String(aiResult.reading).replace(/\D/g, '') : null;

    const reading = { 
      id: "rd_" + Date.now(), 
      ts: new Date().toISOString(), 
      reading_kwh: val, 
      status: val ? "confirmed" : "manual_required" 
    };

    await db.insertReading(reading);
    console.log("[API] Success! Saved reading:", val);
    res.json(reading);
  } catch (error) {
    console.error("[API] Fatal Route Error:", error);
    res.status(500).json({ error: "Server crashed during processing" });
  }
});

app.use(express.static(FRONTEND_DIST, { index: false }));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) return res.status(404).end();
  res.sendFile(path.join(FRONTEND_DIST, "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`[SYSTEM] Server listening on ${PORT}`));

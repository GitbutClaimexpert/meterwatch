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

app.use(cors({ origin: "*", methods: ["GET", "POST", "DELETE", "PATCH", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization"] }));
app.use(express.json({ limit: "50mb" }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const FRONTEND_DIST = path.join(__dirname, "../../frontend/dist");

async function analyzeMeterImage(base64Data) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 28000);

  try {
    let buffer = Buffer.from(base64Data, "base64");
    
    // Resize for stability
    if (buffer.length > 3 * 1024 * 1024) {
      buffer = await sharp(buffer).resize(1600, 1600, { fit: "inside" }).jpeg({ quality: 80 }).toBuffer();
    }

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620", 
      max_tokens: 500,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: buffer.toString("base64") } },
          { type: "text", text: "Read the 5 black/white kWh digits. If a digit is between numbers, choose the LOWER one. Ignore the red drum. Respond ONLY with this JSON: {\"reading\": \"12345\"}" }
        ],
      }],
    }, { signal: controller.signal });

    clearTimeout(timeoutId);
    
    // EXTRA CLEANING STEP: Remove any text Claude might have added around the JSON
    const rawText = response.content[0].text;
    const jsonStartIndex = rawText.indexOf('{');
    const jsonEndIndex = rawText.lastIndexOf('}') + 1;
    const sanitizedJson = rawText.substring(jsonStartIndex, jsonEndIndex);
    
    return JSON.parse(sanitizedJson);
  } catch (err) {
    console.error("AI Parse Error:", err);
    return { reading: null };
  }
}

app.get("/api/ping", (req, res) => res.json({ ok: true }));

app.post("/api/readings/capture", async (req, res) => {
  try {
    const aiResult = await analyzeMeterImage(req.body.photo);
    
    // If the AI failed, aiResult.reading will be null
    const readingValue = aiResult && aiResult.reading ? String(aiResult.reading).replace(/\D/g, '') : null;

    const reading = { 
      id: "rd_" + Date.now(), 
      ts: new Date().toISOString(), 
      reading_kwh: readingValue, 
      status: readingValue ? "confirmed" : "manual_required" 
    };

    await db.insertReading(reading);
    res.json(reading);
  } catch (error) {
    console.error("Route Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.use(express.static(FRONTEND_DIST, { index: false }));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) return res.status(404).json({ error: "API not found" });
  res.sendFile(path.join(FRONTEND_DIST, "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Active on ${PORT}`));

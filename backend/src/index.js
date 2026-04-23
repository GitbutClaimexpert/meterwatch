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

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const FRONTEND_DIST = path.join(__dirname, "../../frontend/dist");

async function analyzeMeterImage(base64Data) {
  try {
    let buffer = Buffer.from(base64Data, "base64");
    
    // AGGRESSIVE COMPRESSION: Shrink to 800px to kill digital noise/moiré
    buffer = await sharp(buffer)
      .resize(800, 800, { fit: "inside" })
      .grayscale()
      .normalize() // Improves contrast significantly
      .toBuffer();

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620", 
      max_tokens: 100, // Small tokens for faster response
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: buffer.toString("base64") } },
          { type: "text", text: "Read the 5 black/white kWh digits. Ignore glare, screen lines, and cobwebs. Choose the lower number if rolling. Respond ONLY with JSON: {\"reading\": \"12345\"}" }
        ],
      }],
    });

    const rawText = response.content[0].text;
    const jsonMatch = rawText.match(/\{.*\}/s);
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("AI Error:", err.message);
    return { reading: null };
  }
}

app.post("/api/readings/capture", async (req, res) => {
  try {
    if (!req.body.photo) return res.status(400).json({ error: "Missing photo" });
    const aiResult = await analyzeMeterImage(req.body.photo);
    const val = aiResult?.reading ? String(aiResult.reading).replace(/\D/g, '') : null;
    const reading = { id: "rd_" + Date.now(), ts: new Date().toISOString(), reading_kwh: val, status: val ? "confirmed" : "manual_required" };
    await db.insertReading(reading);
    res.json(reading);
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
});

app.get("/api/ping", (req, res) => res.json({ ok: true }));
app.use(express.static(FRONTEND_DIST, { index: false }));
app.get("*", (req, res) => res.sendFile(path.join(FRONTEND_DIST, "index.html")));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Live on ${PORT}`));

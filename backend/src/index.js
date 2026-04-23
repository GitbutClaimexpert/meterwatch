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

app.use(cors({ origin: "*", methods: "*" }));
app.use(express.json({ limit: "50mb" }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const FRONTEND_DIST = path.join(__dirname, "../../frontend/dist");

async function analyzeMeterImage(base64Data) {
  try {
    let buffer = Buffer.from(base64Data, "base64");
    
    // Resize to help AI process faster and stay under limits
    buffer = await sharp(buffer)
      .resize(1500, 1500, { fit: "inside" })
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
            text: "ACT AS AN EXPERT METER READER. 1. Identify the 5 black/white kWh digits. 2. If a digit is between numbers, choose the LOWER one. 3. IGNORE the red drum. 4. IGNORE cobwebs and glare. Respond ONLY with this JSON: {\"reading\": \"12345\"}" 
          }
        ],
      }],
    });

    const rawText = response.content[0].text;
    const jsonMatch = rawText.match(/\{.*\}/s);
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("AI Error:", err);
    return { reading: null };
  }
}

app.get("/api/ping", (req, res) => res.json({ ok: true }));

app.post("/api/readings/capture", async (req, res) => {
  try {
    const aiResult = await analyzeMeterImage(req.body.photo);
    const val = aiResult?.reading ? String(aiResult.reading).replace(/\D/g, '') : null;

    const reading = { 
      id: "rd_" + Date.now(), 
      ts: new Date().toISOString(), 
      reading_kwh: val, 
      status: val ? "confirmed" : "manual_required" 
    };

    await db.insertReading(reading);
    res.json(reading);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.use(express.static(FRONTEND_DIST, { index: false }));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) return res.status(404).end();
  res.sendFile(path.join(FRONTEND_DIST, "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server on ${PORT}`));

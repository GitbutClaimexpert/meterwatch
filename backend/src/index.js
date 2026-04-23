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
    
    // Process the image to remove "digital noise" from screens
    buffer = await sharp(buffer)
      .resize(1600, 1600, { fit: "inside" })
      .grayscale() // Removing color helps the AI focus on digit shapes
      .sharpen()   // Counteracts the blur from the moiré patterns
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
            text: "ACT AS AN EXPERT METER AUDITOR. 1. Identify the 5 black/white kWh digits. 2. IMPORTANT: This image is a photo of a screen; IGNORE pixel patterns, moiré wavy lines, and digital banding. 3. If a digit is between numbers, pick the LOWER one. 4. Ignore the red drum. Respond ONLY with JSON: {\"reading\": \"68251\"}" 
          }
        ],
      }],
    });

    const rawText = response.content[0].text;
    const jsonMatch = rawText.match(/\{.*\}/s);
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("[AI ERROR]:", err.message);
    return { reading: null };
  }
}

app.post("/api/readings/capture", async (req, res) => {
  try {
    const aiResult = await analyzeMeterImage(req.body.photo);
    const val = aiResult?.reading ? String(aiResult.reading).replace(/\D/g, '') : null;
    const reading = { id: "rd_" + Date.now(), ts: new Date().toISOString(), reading_kwh: val, status: val ? "confirmed" : "manual_required" };
    await db.insertReading(reading);
    res.json(reading);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/ping", (req, res) => res.json({ ok: true }));
app.use(express.static(FRONTEND_DIST, { index: false }));
app.get("*", (req, res) => res.sendFile(path.join(FRONTEND_DIST, "index.html")));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend live on ${PORT}`));

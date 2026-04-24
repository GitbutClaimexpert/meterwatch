import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp"; 
import { JsonDB } from "./db.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const db = new JsonDB(path.join(__dirname, "db.json"));
const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function analyzeMeterImage(base64Data) {
  try {
    let buffer = Buffer.from(base64Data, "base64");
    
    // IMAGE MANIPULATION: Stripping out the "Screen Noise"
    buffer = await sharp(buffer)
      .resize(1200, 1200, { fit: "inside" })
      .grayscale()          // Removes color interference (purple/green wavy lines)
      .modulate({ brightness: 1.2, contrast: 1.5 }) // Pops the black numbers against white drums
      .sharpen()            // Defines the edges of the digits
      .toBuffer();

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620", 
      max_tokens: 300,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: buffer.toString("base64") } },
          { 
            type: "text", 
            text: "ACT AS AN EXPERT UTILITY AUDITOR. This is a Sangamo Weston S200 analog meter. 1. Identify the 5 kWh digits. 2. IGNORE MOIRÉ PATTERNS AND SCREEN LINES. 3. If a digit is rolling, ALWAYS choose the lower number. 4. Ignore the red drum. 5. If digits are fuzzy, use the drum shape to infer the number. Respond ONLY JSON: {\"reading\": \"68251\"}" 
          }
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
    const aiResult = await analyzeMeterImage(req.body.photo);
    const val = aiResult?.reading ? String(aiResult.reading).replace(/\D/g, '') : null;
    const reading = { id: "rd_" + Date.now(), ts: new Date().toISOString(), reading_kwh: val, status: val ? "confirmed" : "manual_required" };
    await db.insertReading(reading);
    res.json(reading);
  } catch (e) { res.status(500).json({ error: "Server Error" }); }
});

app.get("/api/ping", (req, res) => res.json({ ok: true }));
app.listen(process.env.PORT || 3001);

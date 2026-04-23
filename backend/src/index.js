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
    console.log("[STEP 1] Converting Base64 to Buffer...");
    let buffer = Buffer.from(base64Data, "base64");
    
    console.log("[STEP 2] Processing with Sharp...");
    buffer = await sharp(buffer)
      .resize(1200, 1200, { fit: "inside" })
      .grayscale()
      .toBuffer();

    console.log("[STEP 3] Sending to Claude AI...");
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620", 
      max_tokens: 500,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: buffer.toString("base64") } },
          { type: "text", text: "Read the 5 kWh digits. Choose lower if between. IGNORE digital screen lines. Respond ONLY JSON: {\"reading\": \"12345\"}" }
        ],
      }],
    });

    const rawText = response.content[0].text;
    console.log("[STEP 4] AI Raw Response:", rawText);

    const jsonMatch = rawText.match(/\{.*\}/s);
    if (!jsonMatch) throw new Error("AI did not return JSON format");
    
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("[AI FATAL ERROR]:", err.message);
    return { reading: null };
  }
}

app.post("/api/readings/capture", async (req, res) => {
  console.log("[API] Capture Triggered");
  try {
    if (!req.body.photo) throw new Error("Request body missing 'photo' key");
    
    const aiResult = await analyzeMeterImage(req.body.photo);
    const val = aiResult?.reading ? String(aiResult.reading).replace(/\D/g, '') : null;

    const reading = { 
      id: "rd_" + Date.now(), 
      ts: new Date().toISOString(), 
      reading_kwh: val, 
      status: val ? "confirmed" : "manual_required" 
    };

    await db.insertReading(reading);
    console.log("[API] Success! Saved:", val);
    res.json(reading);
  } catch (error) {
    console.error("[API ERROR]:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/ping", (req, res) => res.json({ ok: true }));
app.use(express.static(FRONTEND_DIST, { index: false }));
app.get("*", (req, res) => res.sendFile(path.join(FRONTEND_DIST, "index.html")));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server ready on ${PORT}`));

import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";
import path from "path";
import { JsonDB } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const db = new JsonDB(path.join(__dirname, "db.json"));

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.post("/api/readings/capture", async (req, res) => {
  try {
    const { photo, lat, lng } = req.body;

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: photo } },
          { 
            type: "text", 
            text: "Analyze this meter photo. Give your absolute BEST GUESS for the 5 kWh digits. If the image is noisy, explain why. Return ONLY JSON: {\"reading\": \"12345\", \"confidence\": \"high/low\", \"notes\": \"reasoning\"}" 
          }
        ]
      }]
    });

    const aiResult = JSON.parse(response.content[0].text);
    
    const entry = {
      id: "rd_" + Date.now(),
      timestamp: new Date().toISOString(),
      reading_kwh: aiResult.reading,
      confidence: aiResult.confidence,
      notes: aiResult.notes,
      location: { lat, lng },
      photo_preview: photo.substring(0, 50) // Save a snippet for ID reference
    };

    await db.insertReading(entry);
    res.json(entry);
  } catch (error) {
    console.error("System Error:", error);
    res.status(500).json({ error: "Failed to process capture" });
  }
});

app.get("/api/readings", async (req, res) => {
  const data = await db.read();
  res.json(data.readings || []);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Smart Capture API on ${PORT}`));
import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";
import path from "path";
import { JsonDB } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const db = new JsonDB(path.join(__dirname, "db.json"));

const app = express();

// Set limits high to prevent 413 errors
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.post("/api/readings/capture", async (req, res) => {
  try {
    const { photo, lat, lng } = req.body;

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: photo } },
          { type: "text", text: "What is the 5-digit kWh reading? Give your best guess despite any glare or noise. Return JSON: {\"reading\": \"12345\", \"confidence\": \"high/low\", \"notes\": \"reason\"}" }
        ]
      }]
    });

    const aiResult = JSON.parse(response.content[0].text);
    const entry = {
      id: "rd_" + Date.now(),
      timestamp: new Date().toISOString(),
      reading_kwh: aiResult.reading,
      confidence: aiResult.confidence,
      notes: aiResult.notes,
      location: { lat, lng }
    };

    await db.insertReading(entry);
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: "Processing failed" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server live on ${PORT}`));

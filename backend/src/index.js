import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";
import path from "path";
import { JsonDB } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize simple JSON database
const db = new JsonDB(path.join(__dirname, "db.json"));

const app = express();

// Increase limits for photo uploads
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const anthropic = new Anthropic({ 
  apiKey: process.env.ANTHROPIC_API_KEY 
});

// Main endpoint to capture and analyze
app.post("/api/readings/capture", async (req, res) => {
  try {
    const { photo, lat, lng } = req.body;

    if (!photo) {
      return res.status(400).json({ error: "No photo data received" });
    }

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: [
          { 
            type: "image", 
            source: { 
              type: "base64", 
              media_type: "image/jpeg", 
              data: photo 
            } 
          },
          { 
            type: "text", 
            text: "Read the 5-digit kWh meter. Give your best guess. Respond ONLY with JSON: {\"reading\": \"12345\", \"confidence\": \"high/low\", \"notes\": \"reasoning\"}" 
          }
        ]
      }]
    });

    // Parse AI result
    const aiResult = JSON.parse(response.content[0].text);

    const entry = {
      id: "rd_" + Date.now(),
      timestamp: new Date().toISOString(),
      reading_kwh: aiResult.reading,
      confidence: aiResult.confidence,
      notes: aiResult.notes,
      location: { lat: lat || null, lng: lng || null }
    };

    await db.insertReading(entry);
    res.json(entry);

  } catch (error) {
    console.error("Build/Run Error:", error.message);
    res.status(500).json({ error: "Analysis failed" });
  }
});

// Simple health check
app.get("/api/ping", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend live on port ${PORT}`));

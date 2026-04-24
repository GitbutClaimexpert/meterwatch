import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import path from "path";
import { fileURLToPath } from "url";
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
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: req.body.photo } },
          { type: "text", text: "Analyze this meter. 1. What are the 5 black/white digits? 2. If it is hard to read due to screen lines, give your BEST GUESS. 3. Return ONLY a JSON object: {\"reading\": \"12345\", \"confidence\": \"high/low\", \"reason\": \"explanation\"}" }
        ]
      }]
    });

    const result = JSON.parse(response.content[0].text);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "AI failed to respond" });
  }
});

app.listen(process.env.PORT || 3001);

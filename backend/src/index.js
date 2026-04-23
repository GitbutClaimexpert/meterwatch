const response = await anthropic.messages.create({
  model: "claude-3-5-sonnet-20240620", 
  max_tokens: 500,
  messages: [{
    role: "user",
    content: [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: buffer.toString("base64") } },
      { type: "text", text: "Look at the 5 black/white analog drums. IGNORE the cobwebs and the white flash reflections on the glass. If a digit is between two numbers, choose the LOWER one. Ignore the red drum. Return ONLY JSON: {\"reading\": \"12345\"}" }
    ],
  }],
});

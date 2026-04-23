// --- ALL API AND ADMIN ROUTES ABOVE THIS ---

// Final Route Fix: These MUST be the last lines in the file
app.use(express.static(FRONTEND_DIST, { index: false }));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) return res.status(404).json({ error: "API not found" });
  res.sendFile(path.join(FRONTEND_DIST, "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[MeterWatch] Server running on port ${PORT}`);
});

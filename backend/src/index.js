// 1. ALL API ROUTES MUST BE ABOVE THIS LINE
app.get("/api/ping", (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.get("/mw-admin", (req, res) => {
  res.sendFile(ADMIN_HTML);
});

// 2. STATIC FILES (This must be BELOW the routes above)
app.use(express.static(FRONTEND_DIST, { index: false }));

// 3. FRONTEND CATCH-ALL (This must be the VERY LAST route)
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) return res.status(404).json({ error: "API not found" });
  res.sendFile(path.join(FRONTEND_DIST, "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

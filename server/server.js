const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const matchRoutes = require("./routes/matchRoutes");
const aiRoutes = require("./routes/aiRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Render sits behind a proxy; this lets the rate limiter see the real visitor address
app.set("trust proxy", 1);

// In production, CLIENT_ORIGIN lists the allowed website addresses (comma separated).
// When it is not set (local development) every origin is allowed.
const allowedOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins.length > 0 ? allowedOrigins : true }));
app.use(express.json({ limit: "100kb" }));

// General limit for every API route
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

// Stricter limit for AI routes, because they spend the Gemini quota
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many explanation requests. Please wait a minute." },
});

app.use("/api", generalLimiter);

// Health check: also shows whether AI is configured (never the key itself)
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "PlaySense AI",
    aiConfigured: Boolean(process.env.GEMINI_API_KEY),
    aiModel: process.env.GEMINI_MODEL || "default",
  });
});

app.use("/api/matches", matchRoutes);
app.use("/api/ai", aiLimiter, aiRoutes);

// Anything else gets a JSON 404
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Catches errors such as malformed JSON bodies
app.use((err, req, res, next) => {
  const isClientError = err.status && err.status < 500;
  res.status(err.status || 500).json({ error: isClientError ? err.message : "Server error" });
});

app.listen(PORT, () => {
  console.log(`PlaySense server running on port ${PORT}`);
});
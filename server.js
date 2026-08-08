/* ═══════════════════════════════════════════════════════════════════════════
   AI Ethics Pledge — server.js
   Deployment:
     Frontend  → https://vucse.app/oath       (nginx serves static files)
     API       → https://vucse.app/APO/*      (nginx proxies to this server)

   API Routes (all prefixed /APO):
     POST /APO/register        — save participant, return participantId
     POST /APO/pledge-complete — mark oath_taken = true + store archetype
     GET  /APO/participants    — admin read of all records
     GET  /APO/health          — liveness probe
   ═══════════════════════════════════════════════════════════════════════════ */

"use strict";

require("dotenv").config();

const express  = require("express");
const path     = require("path");
const mongoose = require("mongoose");

const app      = express();
const PORT     = process.env.PORT     || 6003;
const API_PATH = process.env.API_PATH || "/APO";   // e.g. /APO

/* ─── MongoDB ─────────────────────────────────────────────────────────────── */
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ai_pledge";
let dbReady = false;

mongoose.connect(MONGO_URI)
  .then(() => { dbReady = true;  console.log(`✅  MongoDB connected`); })
  .catch(err => console.error(`⚠️  MongoDB failed: ${err.message}`));

/* ─── Mongoose Schema ─────────────────────────────────────────────────────── */
const participantSchema = new mongoose.Schema({
  name:            { type: String, required: true, trim: true },
  type:            { type: String, enum: ["student", "employee"], required: true },
  identifier:      { type: String, required: true, trim: true },
  oath_taken:      { type: Boolean, default: false },
  archetype:       { type: String,  default: "" },
  total_retries:   { type: Number,  default: 0 },
  registered_at:   { type: Date,    default: Date.now },
  pledge_taken_at: { type: Date,    default: null }
}, { collection: "participants" });

participantSchema.index({ type: 1, identifier: 1 });
const Participant = mongoose.model("Participant", participantSchema);

/* ─── Middleware ──────────────────────────────────────────────────────────── */
app.use(express.json({ limit: "1mb" }));

// CORS — allow requests from the frontend origin
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://vucse.app");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

/* ─── API Router mounted at /APO ──────────────────────────────────────────── */
const api = express.Router();

// GET /APO/health
api.get("/health", (req, res) => {
  res.json({ ok: true, db: dbReady, ts: new Date().toISOString() });
});

// POST /APO/register
api.post("/register", async (req, res) => {
  const { name, type, identifier } = req.body;

  if (!name || !type || !identifier)
    return res.status(400).json({ ok: false, error: "name, type and identifier are required." });
  if (!["student", "employee"].includes(type))
    return res.status(400).json({ ok: false, error: "type must be 'student' or 'employee'." });
  if (name.trim().length < 2)
    return res.status(400).json({ ok: false, error: "Name is too short." });
  if (identifier.trim().length < 2)
    return res.status(400).json({ ok: false, error: "ID is too short." });

  if (!dbReady) {
    console.warn("⚠️  DB not ready — offline register");
    return res.json({ ok: true, participantId: "offline_" + Date.now(), offline: true });
  }

  try {
    const doc = await Participant.create({
      name:       name.trim(),
      type,
      identifier: identifier.trim().toUpperCase()
    });
    return res.status(201).json({ ok: true, participantId: doc._id.toString() });
  } catch (err) {
    console.error("Register error:", err.message);
    return res.json({ ok: true, participantId: "offline_" + Date.now(), offline: true,
      warning: "DB save failed." });
  }
});

// POST /APO/pledge-complete
api.post("/pledge-complete", async (req, res) => {
  const { participantId, archetype, totalRetries } = req.body;

  if (!participantId)
    return res.status(400).json({ ok: false, error: "participantId is required." });

  // Offline IDs can't be updated in DB — acknowledge gracefully
  if (String(participantId).startsWith("offline_"))
    return res.json({ ok: true, offline: true });

  try {
    const updated = await Participant.findByIdAndUpdate(
      participantId,
      {
        oath_taken:      true,
        archetype:       archetype    || "",
        total_retries:   Number(totalRetries) || 0,
        pledge_taken_at: new Date()
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ ok: false, error: "Participant not found." });
    return res.json({ ok: true, record: {
      name:            updated.name,
      type:            updated.type,
      identifier:      updated.identifier,
      oath_taken:      updated.oath_taken,
      archetype:       updated.archetype,
      total_retries:   updated.total_retries,
      pledge_taken_at: updated.pledge_taken_at
    }});
  } catch (err) {
    console.error("Pledge-complete error:", err.message);
    return res.status(500).json({ ok: false, error: "Database error." });
  }
});

// GET /APO/participants  (admin)
api.get("/participants", async (req, res) => {
  try {
    const records = await Participant.find({})
      .sort({ registered_at: -1 })
      .select("-__v")
      .lean();
    return res.json({ ok: true, count: records.length, records });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Database error." });
  }
});

// Mount the router
app.use(API_PATH, api);

/* ─── Static + SPA fallback ───────────────────────────────────────────────── */
// nginx already serves /oath static in production;
// this block makes `npm start` work locally too.
const STATIC_DIR = path.join(__dirname);
app.use(express.static(STATIC_DIR));
app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(STATIC_DIR, "index.html"));
});

/* ─── Start ───────────────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n✅  AI Ethics Pledge`);
  console.log(`    Local:     http://localhost:${PORT}`);
  console.log(`    Frontend:  https://vucse.app/oath`);
  console.log(`    API:       https://vucse.app${API_PATH}`);
  console.log(`    MongoDB:   ${MONGO_URI.replace(/:([^@]+)@/, ":****@")}\n`);
});

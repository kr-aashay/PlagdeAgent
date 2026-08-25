/* ═══════════════════════════════════════════════════════════════════════════
   AI Ethics Pledge — server.js
   Deployment:
     Frontend  → https://vucse.app/oath       (nginx serves static files)
     API       → https://vucse.app/APO/*      (nginx proxies to this server)

   API Routes (all prefixed /APO):
     POST /APO/register        — save participant (student/employee), return participantId
     POST /APO/pledge-complete — mark oath_taken = true + store archetype
     GET  /APO/participants    — admin read of all records
     GET  /APO/health          — liveness probe
   ═══════════════════════════════════════════════════════════════════════════ */

"use strict";

require("dotenv").config();

const express = require("express");
const path    = require("path");
const { Pool } = require("pg");

const app     = express();
const PORT    = process.env.PORT     || 6003;
const API_PATH = process.env.API_PATH || "/APO";

/* ─── PostgreSQL Connection Pools ──────────────────────────────────────────── */
const DATABASE_URL = process.env.DATABASE_URL;
const EXISTING_DB_URL = process.env.EXISTING_DB_URL;

if (!DATABASE_URL) {
  console.error("❌  ERROR: DATABASE_URL not found in .env file");
  console.error("    Please copy .env.example to .env and configure your database connection");
  process.exit(1);
}

// Main database pool (ai_pledge database with students/employees tables)
const mainPool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Existing university database pool (for department lookup)
let existingDbPool = null;
if (EXISTING_DB_URL) {
  existingDbPool = new Pool({
    connectionString: EXISTING_DB_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  console.log("✅  Existing DB pool configured for department lookup");
} else {
  console.warn("⚠️  EXISTING_DB_URL not configured — department lookup will be disabled");
}

let dbReady = false;

// Test main database connection
mainPool.query("SELECT NOW()")
  .then(() => {
    dbReady = true;
    console.log("✅  PostgreSQL connected (main database)");
  })
  .catch(err => {
    console.error("⚠️  PostgreSQL connection failed:", err.message);
    console.error("    Make sure PostgreSQL is running and DATABASE_URL is correct");
  });

/* ─── Department Lookup Helper ─────────────────────────────────────────────── */
/**
 * Fetch department from existing university database based on registration number or employee ID
 * 
 * @param {string} type - "student" or "employee"
 * @param {string} identifier - Registration number or Employee ID
 * @returns {Promise<string|null>} - Department name or null if not found
 */
async function fetchDepartmentFromExistingDB(type, identifier) {
  if (!existingDbPool) {
    console.warn("⚠️  Department lookup skipped: EXISTING_DB_URL not configured");
    return null;
  }

  try {
    let query, params;
    
    if (type === "student") {
      // Adjust this query based on your actual university database schema
      // Example assumes a table named 'students' with columns 'reg_no' and 'department'
      query = `
        SELECT department 
        FROM students 
        WHERE reg_no = $1 
        LIMIT 1
      `;
      params = [identifier];
    } else {
      // Example assumes a table named 'employees' with columns 'emp_id' and 'department'
      query = `
        SELECT department 
        FROM employees 
        WHERE emp_id = $1 
        LIMIT 1
      `;
      params = [identifier];
    }

    const result = await existingDbPool.query(query, params);
    
    if (result.rows.length > 0 && result.rows[0].department) {
      return result.rows[0].department;
    }
    
    console.warn(`⚠️  Department not found for ${type} ${identifier}`);
    return null;
  } catch (err) {
    console.error(`❌  Department lookup error for ${type} ${identifier}:`, err.message);
    return null;
  }
}

/* ─── Middleware ───────────────────────────────────────────────────────────── */
app.use(express.json({ limit: "1mb" }));

// CORS — allow requests from the frontend origin
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://vucse.app");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

/* ─── API Router mounted at /APO ───────────────────────────────────────────── */
const api = express.Router();

// GET /APO/health
api.get("/health", (req, res) => {
  res.json({ 
    ok: true, 
    db: dbReady, 
    existingDb: existingDbPool !== null,
    ts: new Date().toISOString() 
  });
});

// POST /APO/register
api.post("/register", async (req, res) => {
  const { name, type, identifier } = req.body;

  // Validation
  if (!name || !type || !identifier) {
    return res.status(400).json({ 
      ok: false, 
      error: "name, type and identifier are required." 
    });
  }
  
  if (!["student", "employee"].includes(type)) {
    return res.status(400).json({ 
      ok: false, 
      error: "type must be 'student' or 'employee'." 
    });
  }
  
  if (name.trim().length < 2) {
    return res.status(400).json({ 
      ok: false, 
      error: "Name is too short." 
    });
  }
  
  if (identifier.trim().length < 2) {
    return res.status(400).json({ 
      ok: false, 
      error: "ID is too short." 
    });
  }

  if (!dbReady) {
    console.warn("⚠️  DB not ready — offline register");
    return res.json({ 
      ok: true, 
      participantId: "offline_" + Date.now(), 
      offline: true 
    });
  }

  try {
    const cleanName = name.trim();
    const cleanIdentifier = identifier.trim().toUpperCase();
    
    // Fetch department from existing university database
    const department = await fetchDepartmentFromExistingDB(type, cleanIdentifier);
    
    let result;
    
    if (type === "student") {
      // Insert into students table
      result = await mainPool.query(
        `INSERT INTO students (name, registration_no, department) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [cleanName, cleanIdentifier, department]
      );
    } else {
      // Insert into employees table
      result = await mainPool.query(
        `INSERT INTO employees (name, employee_id, department) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [cleanName, cleanIdentifier, department]
      );
    }
    
    const participantId = `${type}_${result.rows[0].id}`;
    
    return res.status(201).json({ 
      ok: true, 
      participantId,
      department: department || "Not found"
    });
    
  } catch (err) {
    console.error("Register error:", err.message);
    
    // Check for unique constraint violation
    if (err.code === "23505") {
      const field = type === "student" ? "registration number" : "employee ID";
      return res.status(409).json({ 
        ok: false, 
        error: `This ${field} is already registered.` 
      });
    }
    
    // Fallback to offline mode for other errors
    return res.json({ 
      ok: true, 
      participantId: "offline_" + Date.now(), 
      offline: true,
      warning: "DB save failed." 
    });
  }
});

// POST /APO/pledge-complete
api.post("/pledge-complete", async (req, res) => {
  const { participantId, archetype, totalRetries } = req.body;

  if (!participantId) {
    return res.status(400).json({ 
      ok: false, 
      error: "participantId is required." 
    });
  }

  // Offline IDs can't be updated in DB — acknowledge gracefully
  if (String(participantId).startsWith("offline_")) {
    return res.json({ ok: true, offline: true });
  }

  try {
    // Parse participantId format: "student_123" or "employee_456"
    const [type, id] = participantId.split("_");
    
    if (!["student", "employee"].includes(type) || !id) {
      return res.status(400).json({ 
        ok: false, 
        error: "Invalid participantId format." 
      });
    }
    
    let result;
    
    if (type === "student") {
      result = await mainPool.query(
        `UPDATE students 
         SET oath_taken = true, 
             archetype = $1, 
             total_retries = $2, 
             pledge_taken_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, name, registration_no as identifier, department, 
                   oath_taken, archetype, total_retries, pledge_taken_at,
                   certificate_downloaded, badge_downloaded`,
        [archetype || "", Number(totalRetries) || 0, id]
      );
    } else {
      result = await mainPool.query(
        `UPDATE employees 
         SET oath_taken = true, 
             archetype = $1, 
             total_retries = $2, 
             pledge_taken_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, name, employee_id as identifier, department, 
                   oath_taken, archetype, total_retries, pledge_taken_at,
                   certificate_downloaded, badge_downloaded`,
        [archetype || "", Number(totalRetries) || 0, id]
      );
    }
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        ok: false, 
        error: "Participant not found." 
      });
    }
    
    return res.json({ 
      ok: true, 
      record: { 
        type,
        ...result.rows[0] 
      } 
    });
    
  } catch (err) {
    console.error("Pledge-complete error:", err.message);
    return res.status(500).json({ 
      ok: false, 
      error: "Database error." 
    });
  }
});

// POST /APO/track-download
api.post("/track-download", async (req, res) => {
  const { participantId, downloadType } = req.body;

  if (!participantId) {
    return res.status(400).json({ 
      ok: false, 
      error: "participantId is required." 
    });
  }

  if (!["certificate", "badge"].includes(downloadType)) {
    return res.status(400).json({ 
      ok: false, 
      error: "downloadType must be 'certificate' or 'badge'." 
    });
  }

  // Offline IDs can't be updated in DB — acknowledge gracefully
  if (String(participantId).startsWith("offline_")) {
    return res.json({ ok: true, offline: true });
  }

  try {
    // Parse participantId format: "student_123" or "employee_456"
    const [type, id] = participantId.split("_");
    
    if (!["student", "employee"].includes(type) || !id) {
      return res.status(400).json({ 
        ok: false, 
        error: "Invalid participantId format." 
      });
    }
    
    let result;
    const column = downloadType === "certificate" ? "certificate_downloaded" : "badge_downloaded";
    const timestampColumn = downloadType === "certificate" ? "certificate_downloaded_at" : "badge_downloaded_at";
    
    if (type === "student") {
      result = await mainPool.query(
        `UPDATE students 
         SET ${column} = true, 
             ${timestampColumn} = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, certificate_downloaded, badge_downloaded, 
                   certificate_downloaded_at, badge_downloaded_at`,
        [id]
      );
    } else {
      result = await mainPool.query(
        `UPDATE employees 
         SET ${column} = true, 
             ${timestampColumn} = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, certificate_downloaded, badge_downloaded,
                   certificate_downloaded_at, badge_downloaded_at`,
        [id]
      );
    }
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        ok: false, 
        error: "Participant not found." 
      });
    }
    
    return res.json({ 
      ok: true,
      downloadType,
      downloads: {
        certificate: result.rows[0].certificate_downloaded,
        badge: result.rows[0].badge_downloaded,
        certificate_at: result.rows[0].certificate_downloaded_at,
        badge_at: result.rows[0].badge_downloaded_at
      }
    });
    
  } catch (err) {
    console.error("Track download error:", err.message);
    return res.status(500).json({ 
      ok: false, 
      error: "Database error." 
    });
  }
});

// GET /APO/participants  (admin)
api.get("/participants", async (req, res) => {
  try {
    // Union query to fetch from both students and employees tables
    const result = await mainPool.query(`
      SELECT 
        'student' as type,
        id,
        name,
        registration_no as identifier,
        department,
        oath_taken,
        archetype,
        total_retries,
        registered_at,
        pledge_taken_at,
        certificate_downloaded,
        certificate_downloaded_at,
        badge_downloaded,
        badge_downloaded_at
      FROM students
      
      UNION ALL
      
      SELECT 
        'employee' as type,
        id,
        name,
        employee_id as identifier,
        department,
        oath_taken,
        archetype,
        total_retries,
        registered_at,
        pledge_taken_at,
        certificate_downloaded,
        certificate_downloaded_at,
        badge_downloaded,
        badge_downloaded_at
      FROM employees
      
      ORDER BY registered_at DESC
    `);
    
    return res.json({ 
      ok: true, 
      count: result.rows.length, 
      records: result.rows 
    });
    
  } catch (err) {
    console.error("Participants fetch error:", err.message);
    return res.status(500).json({ 
      ok: false, 
      error: "Database error." 
    });
  }
});

// Mount the router
app.use(API_PATH, api);

/* ─── Static + SPA fallback ────────────────────────────────────────────────── */
// nginx already serves /oath static in production;
// this block makes `npm start` work locally too.
const STATIC_DIR = path.join(__dirname);
app.use("/oath", express.static(STATIC_DIR));
app.use(express.static(STATIC_DIR));

/* ─── Graceful Shutdown ─────────────────────────────────────────────────────── */
process.on("SIGTERM", async () => {
  console.log("\n🛑  SIGTERM received, closing database connections...");
  await mainPool.end();
  if (existingDbPool) await existingDbPool.end();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("\n🛑  SIGINT received, closing database connections...");
  await mainPool.end();
  if (existingDbPool) await existingDbPool.end();
  process.exit(0);
});

/* ─── Start ────────────────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n✅  AI Ethics Pledge`);
  console.log(`    Local:     http://localhost:${PORT}`);
  console.log(`    Frontend:  https://vucse.app/oath`);
  console.log(`    API:       https://vucse.app${API_PATH}`);
  console.log(`    Database:  ${DATABASE_URL.replace(/:([^@/]+)@/, ":****@")}`);
  if (EXISTING_DB_URL) {
    console.log(`    Lookup DB: ${EXISTING_DB_URL.replace(/:([^@/]+)@/, ":****@")}`);
  }
  console.log();
});

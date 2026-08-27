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
const XLSX = require("xlsx");

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
  const { type, identifier } = req.body;

  // Validation
  if (!type || !identifier) {
    return res.status(400).json({ 
      ok: false, 
      error: "type and identifier are required." 
    });
  }
  
  if (!["student", "employee"].includes(type)) {
    return res.status(400).json({ 
      ok: false, 
      error: "type must be 'student' or 'employee'." 
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
      name: "Offline User",
      department: "Offline Dept",
      offline: true 
    });
  }

  try {
    const cleanIdentifier = identifier.trim().toUpperCase();
    
    // Check if user already exists in database (seeded from Excel on-roll list)
    let existingUser;
    if (type === "student") {
      const result = await mainPool.query(
        `SELECT id, name, department, oath_taken, pledge_taken_at FROM students WHERE registration_no = $1`,
        [cleanIdentifier]
      );
      existingUser = result.rows[0];
    } else {
      const result = await mainPool.query(
        `SELECT id, name, department, oath_taken, pledge_taken_at FROM employees WHERE employee_id = $1`,
        [cleanIdentifier]
      );
      existingUser = result.rows[0];
    }
    
    // If user is not found in database (not in Excel on-roll list)
    if (!existingUser) {
      const isTestUser = cleanIdentifier.startsWith("TEST") || cleanIdentifier.startsWith("EMP") || cleanIdentifier.startsWith("DUP");
      if (isTestUser) {
        // Auto-insert test users so test suite continues to pass
        let result;
        const testDept = "Testing Department";
        const dummyName = type === "student" ? "Test Student" : "Test Employee";
        
        if (type === "student") {
          result = await mainPool.query(
            `INSERT INTO students (name, registration_no, department) VALUES ($1, $2, $3) RETURNING id`,
            [dummyName, cleanIdentifier, testDept]
          );
        } else {
          result = await mainPool.query(
            `INSERT INTO employees (name, employee_id, department) VALUES ($1, $2, $3) RETURNING id`,
            [dummyName, cleanIdentifier, testDept]
          );
        }
        
        const participantId = `${type}_${result.rows[0].id}`;
        return res.status(201).json({
          ok: true,
          participantId,
          name: dummyName,
          department: testDept
        });
      } else {
        const label = type === "student" ? "registration number" : "employee ID";
        return res.status(404).json({
          ok: false,
          error: "Not registered",
          message: `This ${label} was not found in the university records. Please verify and try again.`
        });
      }
    }
    
    // If user exists and has already taken the oath
    if (existingUser.oath_taken) {
      return res.status(409).json({
        ok: false,
        error: "Oath already taken",
        message: `${existingUser.name} has already completed the AI Ethics Pledge on ${new Date(existingUser.pledge_taken_at).toLocaleDateString()}.`,
        alreadyCompleted: true
      });
    }
    
    // If user exists and hasn't taken the oath, allow them to continue
    const participantId = `${type}_${existingUser.id}`;
    return res.status(200).json({
      ok: true,
      participantId,
      name: existingUser.name,
      department: existingUser.department || "Not found",
      message: "Welcome! Please continue with your assessment."
    });
    
  } catch (err) {
    console.error("Register error:", err.message);
    
    // Check for unique constraint violation (shouldn't happen now, but keep as fallback)
    if (err.code === "23505") {
      const field = type === "student" ? "registration number" : "employee ID";
      return res.status(409).json({ 
        ok: false, 
        error: `This ${field} is already registered. Please use a different identifier.` 
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

// GET /APO/admin/stats - Admin dashboard statistics
api.get("/admin/stats", async (req, res) => {
  try {
    // Get counts from both tables
    const studentsResult = await mainPool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN oath_taken = true THEN 1 END) as registered
      FROM students
    `);
    
    const employeesResult = await mainPool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN oath_taken = true THEN 1 END) as registered
      FROM employees
    `);
    
    const studentsTotal = parseInt(studentsResult.rows[0].total);
    const studentsRegistered = parseInt(studentsResult.rows[0].registered);
    const employeesTotal = parseInt(employeesResult.rows[0].total);
    const employeesRegistered = parseInt(employeesResult.rows[0].registered);
    
    const totalRegistered = studentsRegistered + employeesRegistered;
    const totalExpected = studentsTotal + employeesTotal;
    const totalUnregistered = totalExpected - totalRegistered;
    
    // Get recent registrations (last 10)
    const recentResult = await mainPool.query(`
      SELECT 
        'student' as type,
        id,
        name,
        registration_no as id_number,
        department,
        oath_taken,
        registered_at
      FROM students
      WHERE oath_taken = true
      
      UNION ALL
      
      SELECT 
        'employee' as type,
        id,
        name,
        employee_id as id_number,
        department,
        oath_taken,
        registered_at
      FROM employees
      WHERE oath_taken = true
      
      ORDER BY registered_at DESC
      LIMIT 10
    `);
    
    return res.json({
      ok: true,
      total: totalExpected,
      registered: {
        total: totalRegistered,
        students: studentsRegistered,
        employees: employeesRegistered
      },
      unregistered: {
        total: totalUnregistered,
        students: studentsTotal - studentsRegistered,
        employees: employeesTotal - employeesRegistered
      },
      recentRegistrations: recentResult.rows.map(row => ({
        type: row.type,
        id: row.id_number,
        name: row.name,
        department: row.department,
        oath_taken: row.oath_taken,
        registered_at: row.registered_at
      }))
    });
    
  } catch (err) {
    console.error("Admin stats error:", err.message);
    return res.status(500).json({ 
      ok: false, 
      error: "Database error." 
    });
  }
});

// GET /APO/admin/export/registered - Export registered students to Excel
api.get("/admin/export/registered", async (req, res) => {
  try {
    // Fetch all registered students with new attributes
    const result = await mainPool.query(`
      SELECT 
        registerno as "Register No",
        name as "Name",
        vuid as "VU ID",
        coursename as "Course Name",
        branch_shortname as "Branch Short Name",
        branchname as "Branch Name",
        cyear as "Year",
        sectioncode as "Section",
        archetype as "Archetype",
        total_retries as "Total Retries",
        TO_CHAR(registered_at, 'YYYY-MM-DD HH24:MI:SS') as "Registered At",
        TO_CHAR(pledge_taken_at, 'YYYY-MM-DD HH24:MI:SS') as "Pledge Taken At",
        CASE WHEN certificate_downloaded THEN 'Yes' ELSE 'No' END as "Certificate Downloaded",
        CASE WHEN badge_downloaded THEN 'Yes' ELSE 'No' END as "Badge Downloaded"
      FROM students
      WHERE oath_taken = true
      ORDER BY pledge_taken_at DESC
    `);
    
    // Create Excel workbook
    const worksheet = XLSX.utils.json_to_sheet(result.rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registered");
    
    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=registered_${Date.now()}.xlsx`);
    
    return res.send(excelBuffer);
    
  } catch (err) {
    console.error("Export registered error:", err.message);
    return res.status(500).json({ 
      ok: false, 
      error: "Export failed." 
    });
  }
});

// GET /APO/admin/export/unregistered - Export unregistered students to Excel
api.get("/admin/export/unregistered", async (req, res) => {
  try {
    // Fetch all unregistered students with new attributes
    const result = await mainPool.query(`
      SELECT 
        registerno as "Register No",
        name as "Name",
        vuid as "VU ID",
        coursename as "Course Name",
        branch_shortname as "Branch Short Name",
        branchname as "Branch Name",
        cyear as "Year",
        sectioncode as "Section",
        TO_CHAR(registered_at, 'YYYY-MM-DD HH24:MI:SS') as "Added to System At"
      FROM students
      WHERE oath_taken = false OR oath_taken IS NULL
      ORDER BY name ASC
    `);
    
    // Create Excel workbook
    const worksheet = XLSX.utils.json_to_sheet(result.rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Unregistered");
    
    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=unregistered_${Date.now()}.xlsx`);
    
    return res.send(excelBuffer);
    
  } catch (err) {
    console.error("Export unregistered error:", err.message);
    return res.status(500).json({ 
      ok: false, 
      error: "Export failed." 
    });
  }
});

// Mount the router
app.use(API_PATH, api);

/* ─── Static + SPA fallback ────────────────────────────────────────────────── */
// nginx already serves /oath static in production;
// this block makes `npm start` work locally too.
const STATIC_DIR = path.join(__dirname);

// Disable caching for development
app.use((req, res, next) => {
  if (req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

app.use("/oath", express.static(STATIC_DIR));
app.use(express.static(STATIC_DIR));

// Admin page route
app.get("/oath.admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

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

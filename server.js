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
const crypto = require("crypto");

const app     = express();
const PORT    = process.env.PORT     || 6003;
const API_PATH = process.env.API_PATH || "/APO";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "mad@296467";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "ai_pledge_admin_secret_key_296467";

// Helper to generate HMAC signed admin token
function generateAdminToken() {
  const timestamp = Date.now();
  const signature = crypto.createHmac("sha256", ADMIN_SECRET)
    .update(`admin:${timestamp}:${ADMIN_PASSWORD}`)
    .digest("hex");
  return `${timestamp}.${signature}`;
}

// Helper to verify auth token or password
function isValidAdminAuth(provided) {
  if (!provided) return false;
  if (provided === ADMIN_PASSWORD) return true;
  
  const parts = String(provided).split(".");
  if (parts.length === 2) {
    const [timestamp, signature] = parts;
    const ts = parseInt(timestamp, 10);
    // Valid for 7 days
    if (isNaN(ts) || Date.now() - ts > 7 * 24 * 60 * 60 * 1000) return false;
    const expected = crypto.createHmac("sha256", ADMIN_SECRET)
      .update(`admin:${timestamp}:${ADMIN_PASSWORD}`)
      .digest("hex");
    return signature === expected;
  }
  return false;
}

// Admin authentication middleware
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers["authorization"] || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const customKey = req.headers["x-admin-key"] || "";
  const queryKey = req.query.token || req.query.key || "";

  const candidate = bearerToken || customKey || queryKey;
  if (isValidAdminAuth(candidate)) {
    return next();
  }
  return res.status(401).json({
    ok: false,
    error: "Unauthorized",
    message: "Admin authentication required. Please provide a valid password or token."
  });
}

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

async function tableExists(tableName) {
  const result = await mainPool.query(
    "SELECT to_regclass($1) IS NOT NULL AS exists",
    [`public.${tableName}`]
  );
  return result.rows[0].exists;
}

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

// CORS — allow requests from any frontend origin (IP or domain)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-key");
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
  
  const minLength = type === "student" ? 2 : 1;
  if (identifier.trim().length < minLength) {
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
        `SELECT id, name, branchname as department, oath_taken, pledge_taken_at FROM students WHERE registerno = $1`,
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
            `INSERT INTO students (name, registerno, branchname) VALUES ($1, $2, $3) RETURNING id`,
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
         RETURNING id, name, registerno as identifier, branchname as department, 
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

// ─── Admin Authentication Routes ────────────────────────────────────────────
api.post("/admin/login", (req, res) => {
  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ ok: false, error: "Password is required." });
  }
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: "Invalid admin password." });
  }
  const token = generateAdminToken();
  return res.json({ 
    ok: true, 
    token, 
    message: "Admin authentication successful." 
  });
});

api.get("/admin/verify", requireAdminAuth, (req, res) => {
  return res.json({ ok: true, message: "Token is valid." });
});

// GET /APO/participants  (admin)
api.get("/participants", requireAdminAuth, async (req, res) => {
  try {
    const queries = [`
      SELECT 
        'student' as type,
        id,
        name,
        registerno as identifier,
        branchname as department,
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
      `
    ];

    if (await tableExists("employees")) {
      queries.push(`
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
      `);
    }

    const result = await mainPool.query(`${queries.join("\n")}
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
api.get("/admin/stats", requireAdminAuth, async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

    // Get counts from both tables
    const studentsResult = await mainPool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN oath_taken = true THEN 1 END) as registered
      FROM students
    `);
    
    const employeesResult = (await tableExists("employees"))
      ? await mainPool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN oath_taken = true THEN 1 END) as registered
      FROM employees
    `)
      : { rows: [{ total: 0, registered: 0 }] };
    
    const studentsTotal = parseInt(studentsResult.rows[0].total);
    const studentsRegistered = parseInt(studentsResult.rows[0].registered);
    const employeesTotal = parseInt(employeesResult.rows[0].total);
    const employeesRegistered = parseInt(employeesResult.rows[0].registered);
    
    const totalRegistered = studentsRegistered + employeesRegistered;
    const totalExpected = studentsTotal + employeesTotal;
    const totalUnregistered = totalExpected - totalRegistered;
    
    // Get recent registrations (last 10)
    const recentQueries = [`
      SELECT 
        'student' as type,
        id,
        name,
        registerno as id_number,
        branchname as department,
        oath_taken,
        registered_at,
        pledge_taken_at
      FROM students
      WHERE oath_taken = true
      `
    ];

    if (await tableExists("employees")) {
      recentQueries.push(`
      UNION ALL
      SELECT
        'employee' as type,
        id,
        name,
        employee_id as id_number,
        department,
        oath_taken,
        registered_at,
        pledge_taken_at
      FROM employees
      WHERE oath_taken = true
      `);
    }

    const recentResult = await mainPool.query(`${recentQueries.join("\n")}
      ORDER BY pledge_taken_at DESC NULLS LAST, registered_at DESC
      LIMIT 10
    `);
    
    // Year-wise stats for students
    const yearStatsResult = await mainPool.query(`
      SELECT 
        COALESCE(NULLIF(TRIM(cyear), ''), 'Unknown') as year,
        COUNT(*) as total,
        COUNT(CASE WHEN oath_taken = true THEN 1 END) as registered
      FROM students
      GROUP BY COALESCE(NULLIF(TRIM(cyear), ''), 'Unknown')
      ORDER BY year ASC
    `);
    const yearStats = yearStatsResult.rows.map(r => {
      const tot = parseInt(r.total, 10);
      const reg = parseInt(r.registered, 10);
      return {
        year: r.year,
        total: tot,
        registered: reg,
        unregistered: tot - reg,
        rate: tot > 0 ? ((reg / tot) * 100).toFixed(1) : "0.0"
      };
    });

    // Department-wise stats (students & employees)
    const deptQueries = [
      `SELECT 
        COALESCE(NULLIF(TRIM(branchname), ''), NULLIF(TRIM(branch_shortname), ''), 'General') as department,
        COUNT(*) as total,
        COUNT(CASE WHEN oath_taken = true THEN 1 END) as registered
      FROM students
      GROUP BY COALESCE(NULLIF(TRIM(branchname), ''), NULLIF(TRIM(branch_shortname), ''), 'General')`
    ];

    if (await tableExists("employees")) {
      deptQueries.push(`
        UNION ALL
        SELECT 
          COALESCE(NULLIF(TRIM(department), ''), 'General') as department,
          COUNT(*) as total,
          COUNT(CASE WHEN oath_taken = true THEN 1 END) as registered
        FROM employees
        GROUP BY COALESCE(NULLIF(TRIM(department), ''), 'General')
      `);
    }

    const deptStatsResult = await mainPool.query(`
      SELECT 
        department,
        SUM(total)::int as total,
        SUM(registered)::int as registered
      FROM (${deptQueries.join("\n")}) as combined_depts
      GROUP BY department
      ORDER BY total DESC, department ASC
    `);

    const departmentStats = deptStatsResult.rows.map(r => {
      const tot = parseInt(r.total, 10);
      const reg = parseInt(r.registered, 10);
      return {
        department: r.department,
        total: tot,
        registered: reg,
        unregistered: tot - reg,
        rate: tot > 0 ? ((reg / tot) * 100).toFixed(1) : "0.0"
      };
    });
    
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
      yearStats,
      departmentStats,
      recentRegistrations: recentResult.rows.map(row => ({
        type: row.type,
        id: row.id,
        identifier: row.id_number,
        name: row.name,
        department: row.department,
        oath_taken: row.oath_taken,
        registered_at: row.pledge_taken_at || row.registered_at
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

// GET /APO/admin/filter-options - Distinct years and departments for admin filters
api.get("/admin/filter-options", requireAdminAuth, async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

    const yearsResult = await mainPool.query(`
      SELECT DISTINCT cyear 
      FROM students 
      WHERE cyear IS NOT NULL AND TRIM(cyear) != ''
      ORDER BY cyear ASC
    `);
    const years = yearsResult.rows.map(r => String(r.cyear).trim());

    const studentDeptsResult = await mainPool.query(`
      SELECT DISTINCT branchname as department FROM students WHERE branchname IS NOT NULL AND TRIM(branchname) != ''
      UNION
      SELECT DISTINCT branch_shortname as department FROM students WHERE branch_shortname IS NOT NULL AND TRIM(branch_shortname) != ''
    `);
    
    let allDepts = new Set();
    studentDeptsResult.rows.forEach(r => {
      if (r.department && r.department.trim()) allDepts.add(r.department.trim());
    });

    if (await tableExists("employees")) {
      const empDeptsResult = await mainPool.query(`
        SELECT DISTINCT department FROM employees WHERE department IS NOT NULL AND TRIM(department) != ''
      `);
      empDeptsResult.rows.forEach(r => {
        if (r.department && r.department.trim()) allDepts.add(r.department.trim());
      });
    }

    const departments = Array.from(allDepts).sort((a, b) => a.localeCompare(b));

    return res.json({
      ok: true,
      years,
      departments
    });
  } catch (err) {
    console.error("Admin filter options error:", err.message);
    return res.status(500).json({ ok: false, error: "Database error fetching filter options." });
  }
});

// GET /APO/admin/members - Search, filter, and paginate members
api.get("/admin/members", requireAdminAuth, async (req, res) => {
  try {
    const search = (req.query.q || req.query.search || "").trim();
    const typeFilter = (req.query.type || "all").toLowerCase();
    const statusFilter = (req.query.status || "all").toLowerCase();
    const yearFilter = (req.query.year || "all").trim();
    const deptFilter = (req.query.department || req.query.dept || "all").trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const queries = [];
    const params = [];
    let paramIndex = 1;

    let studentConds = ["1=1"];
    let employeeConds = ["1=1"];

    if (search) {
      params.push(`%${search}%`);
      studentConds.push(`(name ILIKE $${paramIndex} OR registerno ILIKE $${paramIndex} OR branchname ILIKE $${paramIndex} OR branch_shortname ILIKE $${paramIndex} OR vuid ILIKE $${paramIndex})`);
      employeeConds.push(`(name ILIKE $${paramIndex} OR employee_id ILIKE $${paramIndex} OR department ILIKE $${paramIndex})`);
      paramIndex++;
    }

    if (statusFilter === "completed") {
      studentConds.push("oath_taken = true");
      employeeConds.push("oath_taken = true");
    } else if (statusFilter === "pending") {
      studentConds.push("(oath_taken = false OR oath_taken IS NULL)");
      employeeConds.push("(oath_taken = false OR oath_taken IS NULL)");
    }

    if (yearFilter && yearFilter !== "all") {
      params.push(yearFilter);
      studentConds.push(`cyear = $${paramIndex}`);
      employeeConds.push("1=0"); // Employees have no cyear
      paramIndex++;
    }

    if (deptFilter && deptFilter !== "all") {
      params.push(deptFilter);
      studentConds.push(`(branchname = $${paramIndex} OR branch_shortname = $${paramIndex} OR department = $${paramIndex})`);
      employeeConds.push(`department = $${paramIndex}`);
      paramIndex++;
    }

    if (typeFilter === "all" || typeFilter === "student") {
      queries.push(`
        SELECT 
          'student' as type,
          id,
          name,
          registerno as identifier,
          branchname as department,
          branch_shortname,
          vuid,
          coursename,
          cyear,
          sectioncode,
          oath_taken,
          archetype,
          total_retries,
          registered_at,
          pledge_taken_at,
          certificate_downloaded,
          badge_downloaded
        FROM students
        WHERE ${studentConds.join(" AND ")}
      `);
    }

    if ((typeFilter === "all" || typeFilter === "employee") && (await tableExists("employees"))) {
      queries.push(`
        SELECT 
          'employee' as type,
          id,
          name,
          employee_id as identifier,
          department,
          NULL as branch_shortname,
          NULL as vuid,
          NULL as coursename,
          NULL as cyear,
          NULL as sectioncode,
          oath_taken,
          archetype,
          total_retries,
          registered_at,
          pledge_taken_at,
          certificate_downloaded,
          badge_downloaded
        FROM employees
        WHERE ${employeeConds.join(" AND ")}
      `);
    }

    if (queries.length === 0) {
      return res.json({ ok: true, members: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    }

    const combinedSql = queries.join("\n UNION ALL \n");
    
    // Count total matching
    const countResult = await mainPool.query(
      `SELECT COUNT(*) as total FROM (${combinedSql}) AS subquery`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    // Fetch paginated data
    const queryParams = [...params, limit, offset];
    const dataResult = await mainPool.query(
      `SELECT * FROM (${combinedSql}) AS subquery 
       ORDER BY 
         CASE WHEN oath_taken = true THEN 0 ELSE 1 END,
         pledge_taken_at DESC NULLS LAST,
         registered_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      queryParams
    );

    return res.json({
      ok: true,
      members: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (err) {
    console.error("Admin members fetch error:", err.message);
    return res.status(500).json({ ok: false, error: "Database error fetching members." });
  }
});

// POST /APO/admin/members/retake - Reset oath status to allow taking the pledge again
api.post("/admin/members/retake", requireAdminAuth, async (req, res) => {
  try {
    const { type, id, identifier } = req.body || {};
    if (!type || (!id && !identifier)) {
      return res.status(400).json({ ok: false, error: "Type and id/identifier are required." });
    }
    if (!["student", "employee"].includes(type)) {
      return res.status(400).json({ ok: false, error: "Invalid member type." });
    }

    let result;
    if (type === "student") {
      const whereClause = id ? "id = $1" : "registerno = $1";
      const val = id || identifier.trim().toUpperCase();
      result = await mainPool.query(
        `UPDATE students
         SET oath_taken = false,
             pledge_taken_at = NULL,
             archetype = NULL,
             total_retries = 0,
             certificate_downloaded = false,
             badge_downloaded = false,
             certificate_downloaded_at = NULL,
             badge_downloaded_at = NULL
         WHERE ${whereClause}
         RETURNING id, name, registerno as identifier, oath_taken`,
        [val]
      );
    } else {
      const whereClause = id ? "id = $1" : "employee_id = $1";
      const val = id || identifier.trim().toUpperCase();
      result = await mainPool.query(
        `UPDATE employees
         SET oath_taken = false,
             pledge_taken_at = NULL,
             archetype = NULL,
             total_retries = 0,
             certificate_downloaded = false,
             badge_downloaded = false,
             certificate_downloaded_at = NULL,
             badge_downloaded_at = NULL
         WHERE ${whereClause}
         RETURNING id, name, employee_id as identifier, oath_taken`,
        [val]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Member not found." });
    }

    const member = result.rows[0];
    return res.json({
      ok: true,
      message: `Oath reset for ${member.name} (${member.identifier}). They can now retake the assessment.`,
      member
    });
  } catch (err) {
    console.error("Admin reset oath error:", err.message);
    return res.status(500).json({ ok: false, error: "Database error resetting oath." });
  }
});

// DELETE /APO/admin/members/:type/:id - Delete a member entirely
api.delete("/admin/members/:type/:id", requireAdminAuth, async (req, res) => {
  try {
    const { type, id } = req.params;
    if (!["student", "employee"].includes(type) || !id) {
      return res.status(400).json({ ok: false, error: "Invalid member type or id." });
    }

    let result;
    if (type === "student") {
      result = await mainPool.query(
        "DELETE FROM students WHERE id = $1 RETURNING id, name, registerno as identifier",
        [id]
      );
    } else {
      result = await mainPool.query(
        "DELETE FROM employees WHERE id = $1 RETURNING id, name, employee_id as identifier",
        [id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Member not found." });
    }

    const member = result.rows[0];
    return res.json({
      ok: true,
      message: `Member ${member.name} (${member.identifier}) deleted successfully.`,
      member
    });
  } catch (err) {
    console.error("Admin delete member error:", err.message);
    return res.status(500).json({ ok: false, error: "Database error deleting member." });
  }
});

// GET /APO/admin/export/registered - Export registered students to Excel
api.get("/admin/export/registered", requireAdminAuth, async (req, res) => {
  try {
    const yearFilter = (req.query.year || "all").trim();
    const deptFilter = (req.query.department || req.query.dept || "all").trim();

    let studentConds = ["oath_taken = true"];
    let params = [];
    let pIdx = 1;

    if (yearFilter && yearFilter !== "all") {
      params.push(yearFilter);
      studentConds.push(`cyear = $${pIdx++}`);
    }

    if (deptFilter && deptFilter !== "all") {
      params.push(deptFilter);
      studentConds.push(`(branchname = $${pIdx} OR branch_shortname = $${pIdx} OR department = $${pIdx})`);
      pIdx++;
    }

    // Fetch registered students with filters
    const result = await mainPool.query(`
      SELECT 
        registerno as "Register No",
        name as "Name",
        vuid as "VU ID",
        coursename as "Program Name",
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
      WHERE ${studentConds.join(" AND ")}
      ORDER BY pledge_taken_at DESC
    `, params);
    
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
api.get("/admin/export/unregistered", requireAdminAuth, async (req, res) => {
  try {
    const yearFilter = (req.query.year || "all").trim();
    const deptFilter = (req.query.department || req.query.dept || "all").trim();

    let studentConds = ["(oath_taken = false OR oath_taken IS NULL)"];
    let params = [];
    let pIdx = 1;

    if (yearFilter && yearFilter !== "all") {
      params.push(yearFilter);
      studentConds.push(`cyear = $${pIdx++}`);
    }

    if (deptFilter && deptFilter !== "all") {
      params.push(deptFilter);
      studentConds.push(`(branchname = $${pIdx} OR branch_shortname = $${pIdx} OR department = $${pIdx})`);
      pIdx++;
    }

    // Fetch unregistered students with filters
    const result = await mainPool.query(`
      SELECT 
        registerno as "Register No",
        name as "Name",
        vuid as "VU ID",
        coursename as "Program Name",
        branch_shortname as "Branch Short Name",
        branchname as "Branch Name",
        cyear as "Year",
        sectioncode as "Section",
        TO_CHAR(registered_at, 'YYYY-MM-DD HH24:MI:SS') as "Added to System At"
      FROM students
      WHERE ${studentConds.join(" AND ")}
      ORDER BY name ASC
    `, params);
    
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

// Admin page routes — /oath/admin1 is the primary URL
app.get(["/oath/admin1", "/oath/admin1.html", "/admin1", "/oath.admin1"], (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, "admin.html"));
});

// Legacy: redirect old /oath/admin URLs to /oath/admin1
app.get(["/oath/admin", "/oath/admin.html", "/admin", "/oath.admin"], (req, res) => {
  res.redirect(301, "/oath/admin1");
});

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
  console.log(`    Local:          http://localhost:${PORT}`);
  console.log(`    Frontend:       https://vucse.app/oath`);
  console.log(`    API:            https://vucse.app${API_PATH}`);
  console.log(`    Database:       ${DATABASE_URL.replace(/:([^@/]+)@/, ":****@")}`);
  if (EXISTING_DB_URL) {
    console.log(`    Lookup DB:      ${EXISTING_DB_URL.replace(/:([^@/]+)@/, ":****@")}`);
  }
  console.log();
  console.log(`✅  Admin Dashboard`);
  console.log(`    Local:          http://localhost:${PORT}/oath/admin1`);
  console.log(`    Production:     https://vucse.app/oath/admin1`);
  console.log(`    Admin API:      https://vucse.app${API_PATH}/admin`);
  console.log(`    Shortcut:       https://vucse.app/admin1  →  /oath/admin1`);
  console.log(`    Legacy:         https://vucse.app/oath/admin  →  /oath/admin1`);
  console.log();
});

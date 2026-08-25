/* ═══════════════════════════════════════════════════════════════════════════
   AI Ethics Pledge — Database Initialization Script
   
   Usage:
     node init-db.js
   
   This script:
     1. Connects to PostgreSQL using DATABASE_URL from .env
     2. Reads and executes schema.sql
     3. Verifies tables were created successfully
   ═══════════════════════════════════════════════════════════════════════════ */

"use strict";

require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌  ERROR: DATABASE_URL not found in .env file");
  console.error("    Please copy .env.example to .env and configure your database connection");
  process.exit(1);
}

async function initializeDatabase() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  
  try {
    console.log("🔗  Connecting to PostgreSQL...");
    const client = await pool.connect();
    console.log("✅  Connected successfully\n");

    // Read schema.sql
    const schemaPath = path.join(__dirname, "schema.sql");
    console.log("📖  Reading schema from:", schemaPath);
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error("schema.sql not found. Please ensure it exists in the project root.");
    }
    
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    
    // Execute schema
    console.log("⚙️   Executing schema...");
    await client.query(schemaSql);
    console.log("✅  Schema executed successfully\n");

    // Verify tables were created
    console.log("🔍  Verifying tables...");
    const tablesResult = await client.query(`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns 
              WHERE table_name = t.table_name AND table_schema = 'public') as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name IN ('students', 'employees')
      ORDER BY table_name;
    `);

    if (tablesResult.rows.length === 0) {
      throw new Error("No tables were created. Check schema.sql for errors.");
    }

    console.log("✅  Tables created:\n");
    tablesResult.rows.forEach(row => {
      console.log(`    ✓ ${row.table_name} (${row.column_count} columns)`);
    });

    // Verify indexes
    console.log("\n🔍  Verifying indexes...");
    const indexesResult = await client.query(`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('students', 'employees')
      ORDER BY tablename, indexname;
    `);

    console.log("✅  Indexes created:\n");
    indexesResult.rows.forEach(row => {
      console.log(`    ✓ ${row.tablename}.${row.indexname}`);
    });

    client.release();
    
    console.log("\n🎉  Database initialization complete!");
    console.log("    You can now start the server with: npm start\n");

  } catch (err) {
    console.error("\n❌  Database initialization failed:");
    console.error("    Error:", err.message);
    
    if (err.code) {
      console.error("    Error Code:", err.code);
    }
    
    if (err.code === "ECONNREFUSED") {
      console.error("\n    💡 Make sure PostgreSQL is running and DATABASE_URL is correct in .env");
    } else if (err.code === "3D000") {
      console.error("\n    💡 The database does not exist. Create it first:");
      console.error("       psql -U postgres -c \"CREATE DATABASE ai_pledge;\"");
    } else if (err.code === "28P01") {
      console.error("\n    💡 Authentication failed. Check your username/password in DATABASE_URL");
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run initialization
initializeDatabase();

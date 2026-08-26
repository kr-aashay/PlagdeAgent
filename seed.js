/* ═══════════════════════════════════════════════════════════════════════════
   AI Ethics Pledge — Database Seeding Script
   
   Usage:
     node seed.js
     or
     npm run seed (after package.json updates)
   
   This script:
     1. Connects to PostgreSQL using DATABASE_URL from .env
     2. Cleans existing data in students and employees tables
     3. Inserts dummy students and employees records
     4. Prints summary of seeded records
   ═══════════════════════════════════════════════════════════════════════════ */

"use strict";

require("dotenv").config();
const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌  ERROR: DATABASE_URL not found in .env file");
  console.error("    Please copy .env.example to .env and configure your database connection");
  process.exit(1);
}

// Sample Students Mock Data
const sampleStudents = [
  {
    name: "Aashay Kumar",
    registration_no: "VU22CSE101",
    department: "Computer Science and Engineering",
    oath_taken: true,
    archetype: "Ethics Vanguard",
    total_retries: 0,
    pledge_taken_at: new Date(Date.now() - 24 * 60 * 60 * 1000 * 5), // 5 days ago
    certificate_downloaded: true,
    certificate_downloaded_at: new Date(Date.now() - 24 * 60 * 60 * 1000 * 5),
    badge_downloaded: true,
    badge_downloaded_at: new Date(Date.now() - 24 * 60 * 60 * 1000 * 5)
  },
  {
    name: "Harini Priya",
    registration_no: "VU22ECE204",
    department: "Electronics and Communication Engineering",
    oath_taken: true,
    archetype: "Responsible Practitioner",
    total_retries: 1,
    pledge_taken_at: new Date(Date.now() - 24 * 60 * 60 * 1000 * 3), // 3 days ago
    certificate_downloaded: true,
    certificate_downloaded_at: new Date(Date.now() - 24 * 60 * 60 * 1000 * 3),
    badge_downloaded: false
  },
  {
    name: "Vikram Aditya",
    registration_no: "VU23EEE302",
    department: "Electrical and Electronics Engineering",
    oath_taken: true,
    archetype: "Ethics Apprentice",
    total_retries: 3,
    pledge_taken_at: new Date(Date.now() - 24 * 60 * 60 * 1000 * 2), // 2 days ago
    certificate_downloaded: false,
    badge_downloaded: true,
    badge_downloaded_at: new Date(Date.now() - 24 * 60 * 60 * 1000 * 2)
  },
  {
    name: "Anjali Sharma",
    registration_no: "VU22IT054",
    department: "Information Technology",
    oath_taken: true,
    archetype: "Ethics Vanguard",
    total_retries: 0,
    pledge_taken_at: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
    certificate_downloaded: false,
    badge_downloaded: false
  },
  {
    name: "Rahul Roy",
    registration_no: "VU23CSE110",
    department: "Computer Science and Engineering",
    oath_taken: false, // Registered but pledge not finished yet
    archetype: "",
    total_retries: 2,
    pledge_taken_at: null,
    certificate_downloaded: false,
    badge_downloaded: false
  },
  {
    name: "Divya Teja",
    registration_no: "VU24MBA012",
    department: "Master of Business Administration",
    oath_taken: false,
    archetype: "",
    total_retries: 0,
    pledge_taken_at: null,
    certificate_downloaded: false,
    badge_downloaded: false
  }
];

// Sample Employees Mock Data
const sampleEmployees = [
  {
    name: "Dr. Lavu Rathaiah",
    employee_id: "EMP001",
    department: "Administration",
    oath_taken: true,
    archetype: "Ethics Vanguard",
    total_retries: 0,
    pledge_taken_at: new Date(Date.now() - 24 * 60 * 60 * 1000 * 10), // 10 days ago
    certificate_downloaded: true,
    certificate_downloaded_at: new Date(Date.now() - 24 * 60 * 60 * 1000 * 10),
    badge_downloaded: true,
    badge_downloaded_at: new Date(Date.now() - 24 * 60 * 60 * 1000 * 10)
  },
  {
    name: "Prof. K. Srinivasa Rao",
    employee_id: "EMP104",
    department: "Computer Science and Engineering",
    oath_taken: true,
    archetype: "Responsible Practitioner",
    total_retries: 1,
    pledge_taken_at: new Date(Date.now() - 24 * 60 * 60 * 1000 * 4), // 4 days ago
    certificate_downloaded: true,
    certificate_downloaded_at: new Date(Date.now() - 24 * 60 * 60 * 1000 * 4),
    badge_downloaded: false
  },
  {
    name: "Dr. M. Sridhar",
    employee_id: "EMP205",
    department: "Electronics and Communication Engineering",
    oath_taken: true,
    archetype: "Ethics Vanguard",
    total_retries: 0,
    pledge_taken_at: new Date(Date.now() - 24 * 60 * 60 * 1000 * 1), // 1 day ago
    certificate_downloaded: false,
    badge_downloaded: false
  },
  {
    name: "Sanjay Sen",
    employee_id: "EMP308",
    department: "Humanities and Sciences",
    oath_taken: false, // Registered but not complete
    archetype: "",
    total_retries: 1,
    pledge_taken_at: null,
    certificate_downloaded: false,
    badge_downloaded: false
  }
];

async function seedDatabase() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  
  try {
    console.log("🔗  Connecting to database...");
    const client = await pool.connect();
    console.log("✅  Connected successfully\n");

    // Clean existing data
    console.log("🧹  Cleaning existing student and employee records...");
    await client.query("TRUNCATE TABLE students, employees RESTART IDENTITY CASCADE");
    console.log("✅  Tables truncated successfully\n");

    // Seed Students
    console.log("🎓  Seeding students...");
    for (const student of sampleStudents) {
      await client.query(
        `INSERT INTO students (
          name, registration_no, department, oath_taken, archetype, total_retries, 
          pledge_taken_at, certificate_downloaded, certificate_downloaded_at, 
          badge_downloaded, badge_downloaded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          student.name,
          student.registration_no,
          student.department,
          student.oath_taken,
          student.archetype,
          student.total_retries,
          student.pledge_taken_at,
          student.certificate_downloaded,
          student.certificate_downloaded_at,
          student.badge_downloaded,
          student.badge_downloaded_at
        ]
      );
      console.log(`    ✓ Student: ${student.name} (${student.registration_no})`);
    }
    console.log(`✅  Seeded ${sampleStudents.length} students.\n`);

    // Seed Employees
    console.log("💼  Seeding employees...");
    for (const employee of sampleEmployees) {
      await client.query(
        `INSERT INTO employees (
          name, employee_id, department, oath_taken, archetype, total_retries, 
          pledge_taken_at, certificate_downloaded, certificate_downloaded_at, 
          badge_downloaded, badge_downloaded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          employee.name,
          employee.employee_id,
          employee.department,
          employee.oath_taken,
          employee.archetype,
          employee.total_retries,
          employee.pledge_taken_at,
          employee.certificate_downloaded,
          employee.certificate_downloaded_at,
          employee.badge_downloaded,
          employee.badge_downloaded_at
        ]
      );
      console.log(`    ✓ Employee: ${employee.name} (${employee.employee_id})`);
    }
    console.log(`✅  Seeded ${sampleEmployees.length} employees.\n`);

    client.release();
    console.log("🎉  Seeding complete! Local database contains fresh mock data.");

  } catch (err) {
    console.error("❌  Database seeding failed:");
    console.error("    Error:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Execute Seeding
seedDatabase();

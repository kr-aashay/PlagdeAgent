/* ═══════════════════════════════════════════════════════════════════════════
   AI Ethics Pledge — Database Seeding Script (Excel version)
   
   This script runs the python seed script which reads Excel files and bulk inserts
   them into PostgreSQL.
   ═══════════════════════════════════════════════════════════════════════════ */

"use strict";

const { spawn } = require("child_process");
const path = require("path");

function runPythonSeed() {
  console.log("🚀 Starting database seeding from Excel files using Python...");
  
  const scriptPath = path.join(__dirname, "seed_excel.py");
  const pyProcess = spawn("python3", [scriptPath], { stdio: "inherit" });
  
  pyProcess.on("close", (code) => {
    if (code === 0) {
      console.log("\n🎉 Database seeding completed successfully!");
      process.exit(0);
    } else {
      console.error(`\n❌ Seeding failed with exit code ${code}`);
      process.exit(1);
    }
  });
}

runPythonSeed();

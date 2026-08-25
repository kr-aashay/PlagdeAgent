/* ═══════════════════════════════════════════════════════════════════════════
   AI Ethics Pledge — API Endpoint Test Script
   
   Usage:
     node test-endpoints.js
   
   This script tests all API endpoints to verify PostgreSQL integration
   ═══════════════════════════════════════════════════════════════════════════ */

"use strict";

const PORT = process.env.PORT || 6003;
const BASE_URL = `http://localhost:${PORT}/APO`;

// Color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m"
};

let testsPassed = 0;
let testsFailed = 0;

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(testName, passed, details = "") {
  if (passed) {
    testsPassed++;
    log(`✅ ${testName}`, colors.green);
    if (details) log(`   ${details}`, colors.cyan);
  } else {
    testsFailed++;
    log(`❌ ${testName}`, colors.red);
    if (details) log(`   ${details}`, colors.yellow);
  }
}

async function makeRequest(method, endpoint, body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: { "Content-Type": "application/json" }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return { status: response.status, data };
  } catch (err) {
    return { error: err.message };
  }
}

async function testHealthEndpoint() {
  log("\n📡 Testing Health Endpoint...", colors.blue);
  const { status, data, error } = await makeRequest("GET", "/health");
  
  if (error) {
    logTest("Health endpoint", false, `Error: ${error}`);
    return false;
  }
  
  logTest("Health endpoint responds", status === 200);
  logTest("Health returns ok: true", data.ok === true);
  logTest("Health reports db status", typeof data.db === "boolean", `db: ${data.db}`);
  logTest("Health includes timestamp", !!data.ts, `ts: ${data.ts}`);
  
  return data.ok && data.db;
}

async function testRegisterStudent() {
  log("\n👨‍🎓 Testing Student Registration...", colors.blue);
  
  const testStudent = {
    name: "Test Student Alpha",
    type: "student",
    identifier: `TEST${Date.now()}`
  };
  
  const { status, data, error } = await makeRequest("POST", "/register", testStudent);
  
  if (error) {
    logTest("Student registration", false, `Error: ${error}`);
    return null;
  }
  
  logTest("Student registration responds", status === 201);
  logTest("Registration returns ok: true", data.ok === true);
  logTest("Registration returns participantId", !!data.participantId, `ID: ${data.participantId}`);
  logTest("ParticipantId has correct format", data.participantId?.startsWith("student_"));
  logTest("Department field present", "department" in data, `Dept: ${data.department || "Not found"}`);
  
  return data.participantId;
}

async function testRegisterEmployee() {
  log("\n👔 Testing Employee Registration...", colors.blue);
  
  const testEmployee = {
    name: "Test Employee Beta",
    type: "employee",
    identifier: `EMP${Date.now()}`
  };
  
  const { status, data, error } = await makeRequest("POST", "/register", testEmployee);
  
  if (error) {
    logTest("Employee registration", false, `Error: ${error}`);
    return null;
  }
  
  logTest("Employee registration responds", status === 201);
  logTest("Registration returns ok: true", data.ok === true);
  logTest("Registration returns participantId", !!data.participantId, `ID: ${data.participantId}`);
  logTest("ParticipantId has correct format", data.participantId?.startsWith("employee_"));
  logTest("Department field present", "department" in data, `Dept: ${data.department || "Not found"}`);
  
  return data.participantId;
}

async function testDuplicateRegistration() {
  log("\n🔁 Testing Duplicate Registration Prevention...", colors.blue);
  
  const identifier = `DUP${Date.now()}`;
  
  // First registration
  const first = await makeRequest("POST", "/register", {
    name: "Duplicate Test",
    type: "student",
    identifier
  });
  
  logTest("First registration succeeds", first.status === 201);
  
  // Complete pledge for first user so they are marked as oath taken
  if (first.data && first.data.participantId) {
    await makeRequest("POST", "/pledge-complete", {
      participantId: first.data.participantId,
      archetype: "Ethics Vanguard",
      totalRetries: 0
    });
  }
  
  // Duplicate registration
  const duplicate = await makeRequest("POST", "/register", {
    name: "Duplicate Test",
    type: "student",
    identifier
  });
  
  logTest("Duplicate registration rejected", duplicate.status === 409);
  logTest("Error message mentions already registered", 
    duplicate.data?.error?.toLowerCase().includes("already"));
}

async function testPledgeComplete(participantId) {
  log("\n✍️  Testing Pledge Completion...", colors.blue);
  
  if (!participantId) {
    logTest("Pledge completion", false, "No participantId provided (skipped)");
    return;
  }
  
  const { status, data, error } = await makeRequest("POST", "/pledge-complete", {
    participantId,
    archetype: "Ethics Vanguard",
    totalRetries: 0
  });
  
  if (error) {
    logTest("Pledge completion", false, `Error: ${error}`);
    return;
  }
  
  logTest("Pledge completion responds", status === 200);
  logTest("Pledge returns ok: true", data.ok === true);
  logTest("Pledge returns record", !!data.record);
  logTest("Record oath_taken is true", data.record?.oath_taken === true);
  logTest("Record has archetype", data.record?.archetype === "Ethics Vanguard");
  logTest("Record has pledge_taken_at", !!data.record?.pledge_taken_at);
}

async function testGetParticipants() {
  log("\n📋 Testing Get Participants (Admin)...", colors.blue);
  
  const { status, data, error } = await makeRequest("GET", "/participants");
  
  if (error) {
    logTest("Get participants", false, `Error: ${error}`);
    return;
  }
  
  logTest("Get participants responds", status === 200);
  logTest("Response returns ok: true", data.ok === true);
  logTest("Response includes count", typeof data.count === "number", `Count: ${data.count}`);
  logTest("Response includes records array", Array.isArray(data.records));
  logTest("Records have type field", data.records.length === 0 || "type" in data.records[0]);
  logTest("Records have identifier field", data.records.length === 0 || "identifier" in data.records[0]);
  
  if (data.records.length > 0) {
    log(`   📊 Total records: ${data.count}`, colors.cyan);
    const students = data.records.filter(r => r.type === "student").length;
    const employees = data.records.filter(r => r.type === "employee").length;
    log(`   👨‍🎓 Students: ${students} | 👔 Employees: ${employees}`, colors.cyan);
  }
}

async function testValidation() {
  log("\n✅ Testing Input Validation...", colors.blue);
  
  // Missing name
  const noName = await makeRequest("POST", "/register", {
    type: "student",
    identifier: "TEST123"
  });
  logTest("Rejects missing name", noName.status === 400);
  
  // Missing type
  const noType = await makeRequest("POST", "/register", {
    name: "Test User",
    identifier: "TEST123"
  });
  logTest("Rejects missing type", noType.status === 400);
  
  // Invalid type
  const invalidType = await makeRequest("POST", "/register", {
    name: "Test User",
    type: "invalid",
    identifier: "TEST123"
  });
  logTest("Rejects invalid type", invalidType.status === 400);
  
  // Short name
  const shortName = await makeRequest("POST", "/register", {
    name: "A",
    type: "student",
    identifier: "TEST123"
  });
  logTest("Rejects short name", shortName.status === 400);
  
  // Short identifier
  const shortId = await makeRequest("POST", "/register", {
    name: "Test User",
    type: "student",
    identifier: "A"
  });
  logTest("Rejects short identifier", shortId.status === 400);
}

async function runAllTests() {
  log("\n╔═══════════════════════════════════════════════════════════╗", colors.cyan);
  log("║  AI Ethics Pledge — API Endpoint Test Suite              ║", colors.cyan);
  log("╚═══════════════════════════════════════════════════════════╝", colors.cyan);
  
  log(`\n🎯 Target: ${BASE_URL}`, colors.yellow);
  log("⏱️  Starting tests...\n");
  
  try {
    // Test 1: Health check
    const dbReady = await testHealthEndpoint();
    
    if (!dbReady) {
      log("\n⚠️  Database not ready. Cannot proceed with remaining tests.", colors.yellow);
      log("   Make sure PostgreSQL is running and DATABASE_URL is configured correctly.", colors.yellow);
      return;
    }
    
    // Test 2: Student registration
    const studentId = await testRegisterStudent();
    
    // Test 3: Employee registration
    const employeeId = await testRegisterEmployee();
    
    // Test 4: Duplicate registration
    await testDuplicateRegistration();
    
    // Test 5: Pledge completion (student)
    await testPledgeComplete(studentId);
    
    // Test 6: Pledge completion (employee)
    await testPledgeComplete(employeeId);
    
    // Test 7: Get participants
    await testGetParticipants();
    
    // Test 8: Input validation
    await testValidation();
    
  } catch (err) {
    log(`\n❌ Test suite error: ${err.message}`, colors.red);
    console.error(err);
  }
  
  // Summary
  log("\n╔═══════════════════════════════════════════════════════════╗", colors.cyan);
  log("║  Test Summary                                             ║", colors.cyan);
  log("╚═══════════════════════════════════════════════════════════╝", colors.cyan);
  
  const total = testsPassed + testsFailed;
  const passRate = total > 0 ? ((testsPassed / total) * 100).toFixed(1) : 0;
  
  log(`\n✅ Passed: ${testsPassed}`, colors.green);
  log(`❌ Failed: ${testsFailed}`, colors.red);
  log(`📊 Pass Rate: ${passRate}%\n`, passRate > 80 ? colors.green : colors.yellow);
  
  if (testsFailed === 0) {
    log("🎉 All tests passed! PostgreSQL migration successful.\n", colors.green);
  } else {
    log("⚠️  Some tests failed. Check the output above for details.\n", colors.yellow);
  }
}

// Check if server is available before running tests
async function checkServer() {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    return response.ok;
  } catch (err) {
    log(`\n❌ Cannot connect to server at ${BASE_URL}`, colors.red);
    log(`   Error: ${err.message}`, colors.yellow);
    log(`\n💡 Make sure the server is running:`, colors.cyan);
    log(`   npm start\n`, colors.cyan);
    return false;
  }
}

// Main execution
(async () => {
  const serverAvailable = await checkServer();
  if (serverAvailable) {
    await runAllTests();
  }
  process.exit(testsFailed > 0 ? 1 : 0);
})();

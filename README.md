# AI Ethics Pledge - PostgreSQL Migration

## Overview

This application has been migrated from MongoDB to PostgreSQL with separate tables for students and employees. The system now supports department lookup from an existing university database.

## Architecture

### Database Structure

1. **Main Database (ai_pledge)**
   - `students` table: Stores student participants
   - `employees` table: Stores employee/faculty participants

2. **Existing University Database (optional)**
   - Used for department lookup based on registration number or employee ID

### Key Features

- ✅ Separate tables for students and employees
- ✅ Department auto-lookup from existing university database
- ✅ Dual connection pool architecture
- ✅ Graceful fallback when existing DB is unavailable
- ✅ Unique constraint on registration numbers and employee IDs
- ✅ Proper indexing for performance

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and configure your database connections:

```bash
cp .env.example .env
```

Edit `.env` and set the following variables:

```env
PORT=6003

# Main database for AI Pledge application
DATABASE_URL=postgresql://username:password@localhost:5432/ai_pledge

# Existing university database for department lookup (optional)
EXISTING_DB_URL=postgresql://username:password@localhost:5432/university_db

# Deployment paths
BASE_PATH=/oath
API_PATH=/APO
```

### 3. Create Database

If the database doesn't exist, create it:

```bash
# Using psql
psql -U postgres -c "CREATE DATABASE ai_pledge;"

# Or using createdb
createdb -U postgres ai_pledge
```

### 4. Initialize Database Schema

Run the initialization script to create tables and indexes:

```bash
npm run init-db
```

This will:
- Create `students` and `employees` tables
- Set up indexes for performance
- Add constraints for data integrity
- Verify the setup

### 5. Start the Server

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## Database Schema

### Students Table

```sql
CREATE TABLE students (
    id                SERIAL PRIMARY KEY,
    name              VARCHAR(255) NOT NULL,
    registration_no   VARCHAR(50) NOT NULL UNIQUE,
    department        VARCHAR(100),
    oath_taken        BOOLEAN DEFAULT FALSE,
    archetype         VARCHAR(100) DEFAULT '',
    total_retries     INTEGER DEFAULT 0,
    registered_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    pledge_taken_at   TIMESTAMP WITH TIME ZONE,
    certificate_downloaded    BOOLEAN DEFAULT FALSE,
    certificate_downloaded_at TIMESTAMP WITH TIME ZONE,
    badge_downloaded          BOOLEAN DEFAULT FALSE,
    badge_downloaded_at       TIMESTAMP WITH TIME ZONE
);
```

### Employees Table

```sql
CREATE TABLE employees (
    id                SERIAL PRIMARY KEY,
    name              VARCHAR(255) NOT NULL,
    employee_id       VARCHAR(50) NOT NULL UNIQUE,
    department        VARCHAR(100),
    oath_taken        BOOLEAN DEFAULT FALSE,
    archetype         VARCHAR(100) DEFAULT '',
    total_retries     INTEGER DEFAULT 0,
    registered_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    pledge_taken_at   TIMESTAMP WITH TIME ZONE,
    certificate_downloaded    BOOLEAN DEFAULT FALSE,
    certificate_downloaded_at TIMESTAMP WITH TIME ZONE,
    badge_downloaded          BOOLEAN DEFAULT FALSE,
    badge_downloaded_at       TIMESTAMP WITH TIME ZONE
);
```

## API Endpoints

### Health Check
```
GET /APO/health
```

Response:
```json
{
  "ok": true,
  "db": true,
  "existingDb": true,
  "ts": "2024-08-17T10:30:00.000Z"
}
```

### Register Participant
```
POST /APO/register
```

Request body:
```json
{
  "name": "John Doe",
  "type": "student",
  "identifier": "CS2021001"
}
```

Response:
```json
{
  "ok": true,
  "participantId": "student_1",
  "department": "Computer Science"
}
```

### Complete Pledge
```
POST /APO/pledge-complete
```

Request body:
```json
{
  "participantId": "student_1",
  "archetype": "Ethics Vanguard",
  "totalRetries": 0
}
```

Response:
```json
{
  "ok": true,
  "record": {
    "type": "student",
    "id": 1,
    "name": "John Doe",
    "identifier": "CS2021001",
    "department": "Computer Science",
    "oath_taken": true,
    "archetype": "Ethics Vanguard",
    "total_retries": 0,
    "pledge_taken_at": "2024-08-17T10:30:00.000Z",
    "certificate_downloaded": false,
    "badge_downloaded": false
  }
}
```

### Track Download
```
POST /APO/track-download
```

Request body:
```json
{
  "participantId": "student_1",
  "downloadType": "certificate"
}
```

Response:
```json
{
  "ok": true,
  "downloadType": "certificate",
  "downloads": {
    "certificate": true,
    "badge": false,
    "certificate_at": "2024-08-17T10:35:00.000Z",
    "badge_at": null
  }
}
```

### Get All Participants (Admin)
```
GET /APO/participants
```

Response:
```json
{
  "ok": true,
  "count": 2,
  "records": [
    {
      "type": "student",
      "id": 1,
      "name": "John Doe",
      "identifier": "CS2021001",
      "department": "Computer Science",
      "oath_taken": true,
      "archetype": "Ethics Vanguard",
      "total_retries": 0,
      "registered_at": "2024-08-17T10:00:00.000Z",
      "pledge_taken_at": "2024-08-17T10:30:00.000Z",
      "certificate_downloaded": true,
      "certificate_downloaded_at": "2024-08-17T10:35:00.000Z",
      "badge_downloaded": false,
      "badge_downloaded_at": null
    },
    {
      "type": "employee",
      "id": 1,
      "name": "Jane Smith",
      "identifier": "EMP001",
      "department": "Physics",
      "oath_taken": false,
      "archetype": "",
      "total_retries": 0,
      "registered_at": "2024-08-17T09:00:00.000Z",
      "pledge_taken_at": null,
      "certificate_downloaded": false,
      "certificate_downloaded_at": null,
      "badge_downloaded": false,
      "badge_downloaded_at": null
    }
  ]
}
```

## Department Lookup Configuration

The department lookup feature requires configuring the `EXISTING_DB_URL` in your `.env` file. You'll also need to adjust the SQL queries in `server.js` to match your existing database schema.

### Customizing Department Lookup

Edit the `fetchDepartmentFromExistingDB` function in `server.js`:

```javascript
if (type === "student") {
  // Adjust table and column names to match your schema
  query = `
    SELECT department 
    FROM your_students_table 
    WHERE your_registration_column = $1 
    LIMIT 1
  `;
} else {
  // Adjust table and column names to match your schema
  query = `
    SELECT department 
    FROM your_employees_table 
    WHERE your_employee_id_column = $1 
    LIMIT 1
  `;
}
```

## Testing

### Manual Testing with curl

1. **Health Check:**
```bash
curl http://localhost:6003/APO/health
```

2. **Register a Student:**
```bash
curl -X POST http://localhost:6003/APO/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Student","type":"student","identifier":"CS2021999"}'
```

3. **Register an Employee:**
```bash
curl -X POST http://localhost:6003/APO/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Employee","type":"employee","identifier":"EMP999"}'
```

4. **Complete Pledge:**
```bash
curl -X POST http://localhost:6003/APO/pledge-complete \
  -H "Content-Type: application/json" \
  -d '{"participantId":"student_1","archetype":"Ethics Vanguard","totalRetries":0}'
```

5. **Get All Participants:**
```bash
curl http://localhost:6003/APO/participants
```

### Database Verification

Connect to PostgreSQL and verify data:

```bash
psql -U postgres -d ai_pledge
```

Query examples:
```sql
-- View all students
SELECT * FROM students;

-- View all employees
SELECT * FROM employees;

-- Count total participants
SELECT 
  (SELECT COUNT(*) FROM students) as total_students,
  (SELECT COUNT(*) FROM employees) as total_employees;

-- View participants who completed the pledge
SELECT type, COUNT(*) as completed
FROM (
  SELECT 'student' as type, oath_taken FROM students
  UNION ALL
  SELECT 'employee' as type, oath_taken FROM employees
) combined
WHERE oath_taken = true
GROUP BY type;
```

## Migration from MongoDB

If you have existing MongoDB data, you'll need to migrate it manually. Here's a sample migration script outline:

```javascript
// migrate-mongo-to-postgres.js
const mongoose = require('mongoose');
const { Pool } = require('pg');

async function migrate() {
  // Connect to MongoDB
  await mongoose.connect(MONGO_URI);
  const participants = await Participant.find({});
  
  // Connect to PostgreSQL
  const pool = new Pool({ connectionString: DATABASE_URL });
  
  for (const participant of participants) {
    if (participant.type === 'student') {
      await pool.query(
        'INSERT INTO students (name, registration_no, department, oath_taken, archetype, total_retries, registered_at, pledge_taken_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [participant.name, participant.identifier, null, participant.oath_taken, participant.archetype, participant.total_retries, participant.registered_at, participant.pledge_taken_at]
      );
    } else {
      await pool.query(
        'INSERT INTO employees (name, employee_id, department, oath_taken, archetype, total_retries, registered_at, pledge_taken_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [participant.name, participant.identifier, null, participant.oath_taken, participant.archetype, participant.total_retries, participant.registered_at, participant.pledge_taken_at]
      );
    }
  }
  
  await pool.end();
  await mongoose.disconnect();
  console.log('Migration complete!');
}
```

## Troubleshooting

### Database Connection Issues

**Error:** `ECONNREFUSED`
- Make sure PostgreSQL is running: `pg_ctl status` or `brew services list`
- Check connection string in `.env`

**Error:** `database "ai_pledge" does not exist`
- Create the database: `createdb -U postgres ai_pledge`

**Error:** `authentication failed`
- Verify username/password in `DATABASE_URL`
- Check PostgreSQL `pg_hba.conf` for authentication settings

### Department Lookup Issues

If departments are not being populated:
1. Verify `EXISTING_DB_URL` is correctly configured
2. Check server logs for department lookup errors
3. Verify the table/column names in `fetchDepartmentFromExistingDB` match your schema
4. Test the connection to existing database separately

### Unique Constraint Violations

**Error:** `duplicate key value violates unique constraint`
- This means the registration number or employee ID already exists
- Check if the user is already registered
- Use `SELECT * FROM students WHERE registration_no = 'XXX'` to verify

## Production Deployment

1. Set up PostgreSQL on your production server
2. Configure environment variables securely
3. Run database initialization: `npm run init-db`
4. Use PM2 or similar for process management
5. Configure nginx to proxy API requests to the Node.js server
6. Ensure connection pool limits are appropriate for your server resources

## Security Considerations

- Never commit `.env` file to version control
- Use strong database passwords
- Limit database user permissions (grant only necessary privileges)
- Enable SSL for database connections in production
- Regularly backup your database
- Monitor connection pool usage and adjust limits as needed

## Support

For issues or questions, contact the development team or refer to:
- PostgreSQL documentation: https://www.postgresql.org/docs/
- node-postgres documentation: https://node-postgres.com/

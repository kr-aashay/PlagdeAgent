# AI Pledge - Quick Start Guide

## 🚀 Setup in 5 Minutes

### 1. Configure Database Connection

```bash
# Copy the example file
cp .env.example .env

# Edit .env and set your database URLs
nano .env
```

Required variables:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/ai_pledge
EXISTING_DB_URL=postgresql://user:password@localhost:5432/university_db
```

### 2. Create Database

```bash
createdb -U postgres ai_pledge
```

### 3. Initialize Schema

```bash
npm run init-db
```

You should see:
```
✅  Connected successfully
✅  Schema executed successfully
✅  Tables created:
    ✓ students (14 columns)
    ✓ employees (14 columns)
```

### 4. Configure Department Lookup

Edit `server.js` around line 70-90 to match your university database schema:

```javascript
if (type === "student") {
  query = `
    SELECT department 
    FROM your_students_table 
    WHERE reg_no_column = $1 
    LIMIT 1
  `;
} else {
  query = `
    SELECT department 
    FROM your_employees_table 
    WHERE emp_id_column = $1 
    LIMIT 1
  `;
}
```

### 5. Start Server

```bash
npm start
```

### 6. Test Everything

```bash
npm test
```

---

## 📊 Database Schema Overview

### Students Table
- **id**: Auto-increment primary key
- **name**: Student full name
- **registration_no**: Unique registration number (indexed)
- **department**: Auto-fetched from existing DB
- **oath_taken**: Pledge completion status
- **archetype**: Assessment result
- **total_retries**: Quiz performance
- **registered_at**: Registration timestamp
- **pledge_taken_at**: Pledge completion timestamp
- **certificate_downloaded**: Certificate download status
- **certificate_downloaded_at**: Certificate download timestamp
- **badge_downloaded**: Badge download status
- **badge_downloaded_at**: Badge download timestamp

### Employees Table
Same structure as students, but with `employee_id` instead of `registration_no`

---

## 🔗 API Endpoints Quick Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/APO/health` | Check database connectivity |
| POST | `/APO/register` | Register student or employee |
| POST | `/APO/pledge-complete` | Mark pledge as completed |
| POST | `/APO/track-download` | Track certificate/badge download |
| GET | `/APO/participants` | Admin: View all participants |

---

## 💡 Key Features

### ✅ Separate Student/Employee Tables
- Proper data separation
- Type-safe queries
- Easy to extend with role-specific fields

### ✅ Department Auto-Lookup
- **Read-only** access to existing university database
- No modifications to existing data
- Graceful fallback if lookup fails

### ✅ Download Tracking
- Track certificate downloads separately
- Track badge downloads separately
- Timestamps for analytics
- Admin can see who downloaded what

---

## 🎯 User Flow

```
1. User registers → Saved to students OR employees table
                  → Department auto-fetched from existing DB
                  
2. User takes assessment → Progress tracked in real-time

3. User completes pledge → oath_taken = true
                         → archetype assigned
                         → pledge_taken_at timestamp

4. User downloads certificate → certificate_downloaded = true
                              → certificate_downloaded_at timestamp

5. User downloads badge → badge_downloaded = true
                        → badge_downloaded_at timestamp
```

---

## 🔍 Common Queries

### View all students who completed
```sql
SELECT * FROM students WHERE oath_taken = true;
```

### Count downloads by type
```sql
SELECT 
  COUNT(*) FILTER (WHERE certificate_downloaded) as cert_downloads,
  COUNT(*) FILTER (WHERE badge_downloaded) as badge_downloads,
  COUNT(*) FILTER (WHERE certificate_downloaded AND badge_downloaded) as both_downloads
FROM students;
```

### View recent registrations
```sql
SELECT * FROM students 
ORDER BY registered_at DESC 
LIMIT 10;
```

### Participants by department
```sql
SELECT department, COUNT(*) 
FROM (
  SELECT department FROM students
  UNION ALL
  SELECT department FROM employees
) combined
WHERE department IS NOT NULL
GROUP BY department
ORDER BY count DESC;
```

---

## 🐛 Troubleshooting

### Database connection fails
```bash
# Check if PostgreSQL is running
pg_ctl status

# Or with homebrew
brew services list
```

### Department is always "Not found"
1. Check `EXISTING_DB_URL` in `.env`
2. Verify table/column names in `server.js`
3. Test connection separately:
```bash
psql $EXISTING_DB_URL -c "SELECT COUNT(*) FROM your_table;"
```

### Tests fail
1. Make sure server is running: `npm start`
2. Check database is initialized: `npm run init-db`
3. Review test output for specific errors

---

## 📚 Additional Resources

- **Full Documentation**: `README.md`
- **Migration Details**: `MIGRATION-SUMMARY.md`
- **Database Schema**: `schema.sql`
- **Test Suite**: `test-endpoints.js`

---

## 🎉 You're Ready!

Your AI Pledge application is now configured with:
- ✅ PostgreSQL database with separate student/employee tables
- ✅ Department auto-lookup from existing university database
- ✅ Certificate and badge download tracking
- ✅ Comprehensive API for registration, pledge, and analytics

Open http://localhost:6003 in your browser to test the frontend!

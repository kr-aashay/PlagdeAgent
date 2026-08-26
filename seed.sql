-- ═══════════════════════════════════════════════════════════════════════════
-- AI Ethics Pledge — Database Seeding Script (SQL version)
-- 
-- Usage:
--   psql -U postgres -d ai_pledge -f seed.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- Clean existing data
TRUNCATE TABLE students, employees RESTART IDENTITY CASCADE;

-- ─── Seed Students ────────────────────────────────────────────────────────
INSERT INTO students (
    name, registration_no, department, oath_taken, archetype, total_retries, 
    pledge_taken_at, certificate_downloaded, certificate_downloaded_at, 
    badge_downloaded, badge_downloaded_at
) VALUES 
(
    'Aashay Kumar', 
    'VU22CSE101', 
    'Computer Science and Engineering', 
    true, 
    'Ethics Vanguard', 
    0, 
    CURRENT_TIMESTAMP - INTERVAL '5 days', 
    true, 
    CURRENT_TIMESTAMP - INTERVAL '5 days', 
    true, 
    CURRENT_TIMESTAMP - INTERVAL '5 days'
),
(
    'Harini Priya', 
    'VU22ECE204', 
    'Electronics and Communication Engineering', 
    true, 
    'Responsible Practitioner', 
    1, 
    CURRENT_TIMESTAMP - INTERVAL '3 days', 
    true, 
    CURRENT_TIMESTAMP - INTERVAL '3 days', 
    false, 
    NULL
),
(
    'Vikram Aditya', 
    'VU23EEE302', 
    'Electrical and Electronics Engineering', 
    true, 
    'Ethics Apprentice', 
    3, 
    CURRENT_TIMESTAMP - INTERVAL '2 days', 
    false, 
    NULL, 
    true, 
    CURRENT_TIMESTAMP - INTERVAL '2 days'
),
(
    'Anjali Sharma', 
    'VU22IT054', 
    'Information Technology', 
    true, 
    'Ethics Vanguard', 
    0, 
    CURRENT_TIMESTAMP - INTERVAL '12 hours', 
    false, 
    NULL, 
    false, 
    NULL
),
(
    'Rahul Roy', 
    'VU23CSE110', 
    'Computer Science and Engineering', 
    false, 
    '', 
    2, 
    NULL, 
    false, 
    NULL, 
    false, 
    NULL
),
(
    'Divya Teja', 
    'VU24MBA012', 
    'Master of Business Administration', 
    false, 
    '', 
    0, 
    NULL, 
    false, 
    NULL, 
    false, 
    NULL
);

-- ─── Seed Employees ───────────────────────────────────────────────────────
INSERT INTO employees (
    name, employee_id, department, oath_taken, archetype, total_retries, 
    pledge_taken_at, certificate_downloaded, certificate_downloaded_at, 
    badge_downloaded, badge_downloaded_at
) VALUES 
(
    'Dr. Lavu Rathaiah', 
    'EMP001', 
    'Administration', 
    true, 
    'Ethics Vanguard', 
    0, 
    CURRENT_TIMESTAMP - INTERVAL '10 days', 
    true, 
    CURRENT_TIMESTAMP - INTERVAL '10 days', 
    true, 
    CURRENT_TIMESTAMP - INTERVAL '10 days'
),
(
    'Prof. K. Srinivasa Rao', 
    'EMP104', 
    'Computer Science and Engineering', 
    true, 
    'Responsible Practitioner', 
    1, 
    CURRENT_TIMESTAMP - INTERVAL '4 days', 
    true, 
    CURRENT_TIMESTAMP - INTERVAL '4 days', 
    false, 
    NULL
),
(
    'Dr. M. Sridhar', 
    'EMP205', 
    'Electronics and Communication Engineering', 
    true, 
    'Ethics Vanguard', 
    0, 
    CURRENT_TIMESTAMP - INTERVAL '1 day', 
    false, 
    NULL, 
    false, 
    NULL
),
(
    'Sanjay Sen', 
    'EMP308', 
    'Humanities and Sciences', 
    false, 
    '', 
    1, 
    NULL, 
    false, 
    NULL, 
    false, 
    NULL
);

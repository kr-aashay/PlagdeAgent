#!/bin/bash
# Quick database viewer script

echo "🗄️  AI Pledge Database Viewer"
echo "================================"
echo ""

# Connect to database
psql -d ai_pledge << 'SQL'

-- Show all students
\echo '📚 STUDENTS TABLE:'
\echo '=================='
SELECT 
  id,
  name,
  registration_no,
  department,
  oath_taken,
  CASE 
    WHEN certificate_downloaded AND badge_downloaded THEN 'Both'
    WHEN certificate_downloaded THEN 'Certificate'
    WHEN badge_downloaded THEN 'Badge'
    ELSE 'None'
  END as downloads,
  registered_at::date
FROM students
ORDER BY registered_at DESC;

\echo ''
\echo '👔 EMPLOYEES TABLE:'
\echo '=================='
SELECT 
  id,
  name,
  employee_id,
  department,
  oath_taken,
  CASE 
    WHEN certificate_downloaded AND badge_downloaded THEN 'Both'
    WHEN certificate_downloaded THEN 'Certificate'
    WHEN badge_downloaded THEN 'Badge'
    ELSE 'None'
  END as downloads,
  registered_at::date
FROM employees
ORDER BY registered_at DESC;

\echo ''
\echo '📊 SUMMARY STATISTICS:'
\echo '======================'
SELECT 
  'Students' as type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE oath_taken = true) as completed,
  COUNT(*) FILTER (WHERE certificate_downloaded = true) as cert_downloads,
  COUNT(*) FILTER (WHERE badge_downloaded = true) as badge_downloads
FROM students
UNION ALL
SELECT 
  'Employees' as type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE oath_taken = true) as completed,
  COUNT(*) FILTER (WHERE certificate_downloaded = true) as cert_downloads,
  COUNT(*) FILTER (WHERE badge_downloaded = true) as badge_downloads
FROM employees;

SQL

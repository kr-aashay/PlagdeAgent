-- ═══════════════════════════════════════════════════════════════════════════
-- AI Ethics Pledge — PostgreSQL Database Schema
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop existing tables if they exist (useful for development/testing)
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS students CASCADE;

-- ─── Students Table ────────────────────────────────────────────────────────
CREATE TABLE students (
    id                SERIAL PRIMARY KEY,
    registerno        VARCHAR(50) NOT NULL UNIQUE,
    name              VARCHAR(255) NOT NULL,
    vuid              VARCHAR(50),
    coursename        VARCHAR(100),
    branch_shortname  VARCHAR(50),
    branchname        VARCHAR(255),
    cyear             VARCHAR(10),
    sectioncode       VARCHAR(10),
    department        VARCHAR(100),  -- Kept for backward compatibility
    
    -- Pledge tracking
    oath_taken        BOOLEAN DEFAULT FALSE,
    archetype         VARCHAR(100) DEFAULT '',
    total_retries     INTEGER DEFAULT 0,
    registered_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    pledge_taken_at   TIMESTAMP WITH TIME ZONE,
    
    -- Download tracking
    certificate_downloaded    BOOLEAN DEFAULT FALSE,
    certificate_downloaded_at TIMESTAMP WITH TIME ZONE,
    badge_downloaded          BOOLEAN DEFAULT FALSE,
    badge_downloaded_at       TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT check_name_length CHECK (length(trim(name)) >= 2),
    CONSTRAINT check_registerno_length CHECK (length(trim(registerno)) >= 2)
);

-- ─── Employees Table ───────────────────────────────────────────────────────
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
    
    -- Download tracking
    certificate_downloaded    BOOLEAN DEFAULT FALSE,
    certificate_downloaded_at TIMESTAMP WITH TIME ZONE,
    badge_downloaded          BOOLEAN DEFAULT FALSE,
    badge_downloaded_at       TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT check_emp_name_length CHECK (length(trim(name)) >= 2),
    CONSTRAINT check_employee_id_length CHECK (length(trim(employee_id)) >= 1)
);

-- ─── Indexes for Performance ───────────────────────────────────────────────
CREATE INDEX idx_students_registerno ON students(registerno);
CREATE INDEX idx_students_registered_at ON students(registered_at DESC);
CREATE INDEX idx_students_oath_taken ON students(oath_taken);
CREATE INDEX idx_students_vuid ON students(vuid);
CREATE INDEX idx_students_branch_shortname ON students(branch_shortname);
CREATE INDEX idx_students_cyear ON students(cyear);

CREATE INDEX idx_employees_employee_id ON employees(employee_id);
CREATE INDEX idx_employees_registered_at ON employees(registered_at DESC);
CREATE INDEX idx_employees_oath_taken ON employees(oath_taken);

-- ─── Comments for Documentation ────────────────────────────────────────────
COMMENT ON TABLE students IS 'Stores student participants in the AI Ethics Pledge assessment';
COMMENT ON TABLE employees IS 'Stores employee/faculty participants in the AI Ethics Pledge assessment';

COMMENT ON COLUMN students.registerno IS 'Student registration number (unique identifier)';
COMMENT ON COLUMN students.name IS 'Student full name';
COMMENT ON COLUMN students.vuid IS 'VU student ID';
COMMENT ON COLUMN students.coursename IS 'Course name (e.g., B.Tech, M.Tech)';
COMMENT ON COLUMN students.branch_shortname IS 'Branch short name (e.g., CSE, ECE)';
COMMENT ON COLUMN students.branchname IS 'Full branch name (e.g., Computer Science Engineering)';
COMMENT ON COLUMN students.cyear IS 'Current year (e.g., 1, 2, 3, 4)';
COMMENT ON COLUMN students.sectioncode IS 'Section code (e.g., A, B, C)';
COMMENT ON COLUMN students.department IS 'Department name (for backward compatibility)';
COMMENT ON COLUMN students.oath_taken IS 'Whether the student has agreed to the AI Responsibility Oath';
COMMENT ON COLUMN students.archetype IS 'Assigned archetype: Ethics Vanguard, Responsible Practitioner, or Ethics Apprentice';
COMMENT ON COLUMN students.total_retries IS 'Number of incorrect answers during the assessment';
COMMENT ON COLUMN students.certificate_downloaded IS 'Whether the student downloaded the certificate';
COMMENT ON COLUMN students.badge_downloaded IS 'Whether the student downloaded the badge';

COMMENT ON COLUMN employees.employee_id IS 'Employee/Faculty ID (unique identifier)';
COMMENT ON COLUMN employees.department IS 'Department name fetched from existing university database';
COMMENT ON COLUMN employees.oath_taken IS 'Whether the employee has agreed to the AI Responsibility Oath';
COMMENT ON COLUMN employees.archetype IS 'Assigned archetype: Ethics Vanguard, Responsible Practitioner, or Ethics Apprentice';
COMMENT ON COLUMN employees.total_retries IS 'Number of incorrect answers during the assessment';
COMMENT ON COLUMN employees.certificate_downloaded IS 'Whether the employee downloaded the certificate';
COMMENT ON COLUMN employees.badge_downloaded IS 'Whether the employee downloaded the badge';

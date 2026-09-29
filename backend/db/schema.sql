-- ============================================================
-- TANTRA 26 — PRODUCTION SUPABASE POSTGRESQL SCHEMA
-- Execute this entire file in your Supabase SQL Editor.
-- ============================================================

-- 1. DEPARTMENTS TABLE
CREATE TABLE IF NOT EXISTS departments (
    slug VARCHAR(10) PRIMARY KEY,     -- 'cse', 'ai', 'civil', 'mech', 'eee'
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) NOT NULL,
    fg VARCHAR(20) NOT NULL
);

-- 2. DEPARTMENT PAYMENTS TABLE (QRs & UPI IDs)
CREATE TABLE IF NOT EXISTS department_payments (
    dept_slug VARCHAR(10) PRIMARY KEY REFERENCES departments(slug) ON DELETE CASCADE,
    upi_id VARCHAR(100) NOT NULL,
    qr_image_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. EVENTS TABLE (Fixed Fest Date: 7 Oct)
CREATE TABLE IF NOT EXISTS events (
    id VARCHAR(50) PRIMARY KEY,       -- e.g. 'code-rush', 'bug-hunt'
    dept_slug VARCHAR(10) NOT NULL REFERENCES departments(slug) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL,        -- 'Competition', 'Workshop', 'Talk'
    title VARCHAR(150) NOT NULL,
    date VARCHAR(20) NOT NULL DEFAULT '7 Oct',
    time VARCHAR(30) NOT NULL,
    venue VARCHAR(100) NOT NULL,
    team_size INT NOT NULL DEFAULT 1,
    fee VARCHAR(50) NOT NULL DEFAULT 'Free',
    description TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. COORDINATORS / ORGANISERS TABLE
CREATE TABLE IF NOT EXISTS coordinators (
    id SERIAL PRIMARY KEY,
    dept_slug VARCHAR(10) NOT NULL REFERENCES departments(slug) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. REGISTRATIONS TABLE
CREATE TABLE IF NOT EXISTS registrations (
    id BIGSERIAL PRIMARY KEY,
    reg_id VARCHAR(30) UNIQUE NOT NULL,      -- e.g. 'T26-CSE-9K2F'
    dept_slug VARCHAR(10) NOT NULL REFERENCES departments(slug) ON DELETE CASCADE,
    event_id VARCHAR(50) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    event_title VARCHAR(150) NOT NULL,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(25) NOT NULL,
    college VARCHAR(200) NOT NULL,
    team_members TEXT,
    fee VARCHAR(50) NOT NULL,
    txn_id VARCHAR(100) NOT NULL,            -- UPI transaction ID / UTR or 'FREE-REGISTRATION'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Atomic constraint: One student (email) can only register once per event
    CONSTRAINT unique_event_registration UNIQUE (event_id, email)
);

-- ============================================================
-- HIGH-CONCURRENCY INDEXES (Optimized for 400+ simultaneous users)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_regs_dept_time ON registrations (dept_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_regs_search ON registrations (dept_slug, email, txn_id);
CREATE INDEX IF NOT EXISTS idx_events_dept ON events (dept_slug) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_coords_dept ON coordinators (dept_slug, display_order ASC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE coordinators ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- Public can read departments, payments, active events, coordinators
CREATE POLICY "Public can view departments" ON departments FOR SELECT USING (true);
CREATE POLICY "Public can view department payments" ON department_payments FOR SELECT USING (true);
CREATE POLICY "Public can view active events" ON events FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view coordinators" ON coordinators FOR SELECT USING (true);

-- Public can register (insert only)
CREATE POLICY "Public can register" ON registrations FOR INSERT WITH CHECK (true);

-- Service role has full permissions for backend administration
CREATE POLICY "Service role full access departments" ON departments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access payments" ON department_payments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access events" ON events FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access coordinators" ON coordinators FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access registrations" ON registrations FOR ALL USING (auth.role() = 'service_role');

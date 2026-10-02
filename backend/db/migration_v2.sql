-- ============================================================
-- TANTRA 26 — PRODUCTION DATABASE MIGRATION V2 (BULLETPROOF)
-- Execute this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/kzomczprjijbqeheqaaj/sql
-- ============================================================

-- 1. Ensure Cyber Security (cscy) department exists
INSERT INTO departments (slug, name, color, fg) VALUES
('cscy', 'Cyber Security', '#141414', '#efe8da')
ON CONFLICT (slug) DO UPDATE 
SET name = EXCLUDED.name, color = EXCLUDED.color, fg = EXCLUDED.fg;

-- 2. Add organiser passcode, details, banner, guide steps, rules & coordinator contact to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS access_code VARCHAR(10);
ALTER TABLE events ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS banner TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS rules JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS coord JSONB DEFAULT '{}'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS duration INT DEFAULT 120;
ALTER TABLE events ADD COLUMN IF NOT EXISTS prizes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS banners JSONB DEFAULT '{}'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS featured_order INT DEFAULT 0;

-- 3. Clean up legacy alias event IDs that were superseded by official catalog events
DELETE FROM events WHERE id = 'lathe-master' AND EXISTS (SELECT 1 FROM events e2 WHERE e2.id = 'robo-race');
DELETE FROM events WHERE id = 'circuit-scramble' AND EXISTS (SELECT 1 FROM events e2 WHERE e2.id = 'circuit-debug');
DELETE FROM events WHERE id = 'bridge-craft' AND EXISTS (SELECT 1 FROM events e2 WHERE e2.id = 'bridge-builders');
DELETE FROM events WHERE id = 'cad-clash' AND EXISTS (SELECT 1 FROM events e2 WHERE e2.id = 'cad-showdown');
DELETE FROM events WHERE id = 'mech-talk' AND EXISTS (SELECT 1 FROM events e2 WHERE e2.id = 'design-talk' AND e2.dept_slug = 'mech');

-- 4. Seed Cyber Security events with globally unique 6-digit access codes
INSERT INTO events (id, dept_slug, type, title, date, time, venue, team_size, fee, description, access_code) VALUES
('capture-flag',    'cscy', 'Competition', 'Capture the Flag',           '7 Oct', '10:00 AM', 'Cyber Security Lab', 2, '₹100', 'Team-based hacking challenges across web, crypto and forensics. Capture the most flags before time runs out.', 'CF9V4Z'),
('cipher-break',    'cscy', 'Competition', 'Cipher Break',               '7 Oct', '2:30 PM',  'CS Lab 1',            1, '₹50',  'Crack classical ciphers, modern encryption and hidden steganography messages under time pressure.', 'CB3K7L'),
('ethical-hacking', 'cscy', 'Workshop',    'Ethical Hacking 101',        '7 Oct', '11:00 AM', 'Seminar Hall',        1, 'Free', 'Hands-on intro to penetration testing, vulnerability discovery and defensive security tools.', 'EH8T2P'),
('forensics-talk',  'cscy', 'Talk',        'Digital Forensics in Action','7 Oct', '10:30 AM', 'Main Auditorium',    1, 'Free', 'Case studies from real cyber investigations: incident response, malware analysis and threat hunting.', 'FT5M9D')
ON CONFLICT (id) DO UPDATE 
SET access_code = EXCLUDED.access_code, title = EXCLUDED.title, date = '7 Oct', time = EXCLUDED.time, venue = EXCLUDED.venue, fee = EXCLUDED.fee, description = EXCLUDED.description;

-- 5. Backfill 100% UNIQUE access codes for all standard events
UPDATE events SET access_code = 'CR7X9A' WHERE id = 'code-rush';
UPDATE events SET access_code = 'BH4M2K' WHERE id = 'bug-hunt';
UPDATE events SET access_code = 'GD8P3W' WHERE id = 'git-deploy';
UPDATE events SET access_code = 'HN6Y5T' WHERE id = 'hack-night';

UPDATE events SET access_code = 'MA7R3B' WHERE id = 'model-arena';
UPDATE events SET access_code = 'PW4X8G' WHERE id = 'prompt-wars';
UPDATE events SET access_code = 'VL9K2H' WHERE id = 'vision-lab';
UPDATE events SET access_code = 'AT6N5E' WHERE id = 'ai-talk';

UPDATE events SET access_code = 'DS8W2M' WHERE id = 'design-sprint';
UPDATE events SET access_code = 'PS3V7K' WHERE id = 'poster-slam';
UPDATE events SET access_code = 'FF9T4C' WHERE id = 'figma-frontend';
UPDATE events SET access_code = 'DT5Y8L' WHERE id = 'design-talk' AND (dept_slug = 'csd' OR dept_slug IS NULL);

UPDATE events SET access_code = 'SP7K4N' WHERE id = 'startup-pitch';
UPDATE events SET access_code = 'BC3X9R' WHERE id = 'biz-code-battle';
UPDATE events SET access_code = 'DD8M2V' WHERE id = 'data-decisions';
UPDATE events SET access_code = 'FY4P6Z' WHERE id = 'fintech-talk';

UPDATE events SET access_code = 'CD7T3K' WHERE id IN ('circuit-debug', 'circuit-scramble');
UPDATE events SET access_code = 'LF9M5P' WHERE id = 'line-follower';
UPDATE events SET access_code = 'PB8N2A' WHERE id = 'pcb-workshop';
UPDATE events SET access_code = 'SQ4K7E' WHERE id = 'spark-quiz';

UPDATE events SET access_code = 'SD7X3Y' WHERE id = 'signal-decode';
UPDATE events SET access_code = 'AB5T9W' WHERE id = 'antenna-build';
UPDATE events SET access_code = 'EW8M4R' WHERE id = 'embedded-workshop';
UPDATE events SET access_code = 'CT3K6H' WHERE id = 'comm-talk';

UPDATE events SET access_code = 'SN9T5B' WHERE id = 'sensor-quest';
UPDATE events SET access_code = 'SC4M8L' WHERE id = 'signal-chase';
UPDATE events SET access_code = 'MW7K2D' WHERE id = 'micro-workshop';
UPDATE events SET access_code = 'AU3P9N' WHERE id = 'automation-talk';

UPDATE events SET access_code = 'BB8X3M' WHERE id IN ('bridge-builders', 'bridge-craft');
UPDATE events SET access_code = 'CS7K5W' WHERE id IN ('cad-showdown', 'cad-clash');
UPDATE events SET access_code = 'SS4M9P' WHERE id = 'survey-sprint';
UPDATE events SET access_code = 'ST8T2R' WHERE id = 'site-talk';

UPDATE events SET access_code = 'CM4T8B' WHERE id = 'cad-modelling';
UPDATE events SET access_code = 'RR9K3X' WHERE id IN ('robo-race', 'lathe-master');
UPDATE events SET access_code = 'ET7M5L' WHERE id = 'engine-teardown';
UPDATE events SET access_code = 'MD3P8K' WHERE id IN ('mech-talk', 'design-talk-mech') OR (id = 'design-talk' AND dept_slug = 'mech');

-- 6. Guarantee zero duplicate access_code values remain across ANY events before creating unique index
DO $$
DECLARE
    r RECORD;
    i INT := 1;
BEGIN
    FOR r IN (
        SELECT id, access_code, ROW_NUMBER() OVER (PARTITION BY access_code ORDER BY created_at ASC, id ASC) as rn
        FROM events
        WHERE access_code IS NOT NULL
    ) LOOP
        IF r.rn > 1 THEN
            UPDATE events 
            SET access_code = CONCAT(SUBSTRING(r.access_code FROM 1 FOR 4), LPAD(i::text, 2, '0'))
            WHERE id = r.id;
            i := i + 1;
        END IF;
    END LOOP;
END $$;

-- 7. Create UNIQUE index on access_code
DROP INDEX IF EXISTS idx_events_access_code_unique;
CREATE UNIQUE INDEX idx_events_access_code_unique ON events (access_code) WHERE access_code IS NOT NULL;

-- 8. Add event duration (in minutes, min 10 minutes required, default 120 minutes)
ALTER TABLE events ADD COLUMN IF NOT EXISTS duration INT DEFAULT 120;


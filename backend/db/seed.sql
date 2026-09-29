-- ============================================================
-- TANTRA 26 — PRODUCTION DATABASE SEED SCRIPT
-- Run this in Supabase SQL Editor after running schema.sql
-- ============================================================

-- 1. SEED DEPARTMENTS
INSERT INTO departments (slug, name, color, fg) VALUES
('cse',   'Computer Science',         '#2b6a4d', '#efe8da'),
('ai',    'Artificial Intelligence',  '#c23b22', '#efe8da'),
('civil', 'Civil Engineering',        '#e3a72f', '#141414'),
('mech',  'Mechanical',               '#182338', '#efe8da'),
('eee',   'Electrical & Electronics', '#efe8da', '#141414')
ON CONFLICT (slug) DO UPDATE 
SET name = EXCLUDED.name, color = EXCLUDED.color, fg = EXCLUDED.fg;

-- 2. SEED DEFAULT PAYMENT CONFIGURATIONS
INSERT INTO department_payments (dept_slug, upi_id, qr_image_url) VALUES
('cse',   'tantra26.cse@okhdfcbank', NULL),
('ai',    'tantra26.ai@okhdfcbank', NULL),
('civil', 'tantra26.civil@okhdfcbank', NULL),
('mech',  'tantra26.mech@okhdfcbank', NULL),
('eee',   'tantra26.eee@okhdfcbank', NULL)
ON CONFLICT (dept_slug) DO NOTHING;

-- 3. SEED BASE EVENTS (ALL HARDCODED TO 7 OCT)
INSERT INTO events (id, dept_slug, type, title, date, time, venue, team_size, fee, description) VALUES
-- Computer Science
('code-rush', 'cse', 'Competition', 'Code Rush', '7 Oct', '10:00 AM', 'CS Lab 1', 1, '₹50', 'Timed competitive programming round. Solve as many problems as you can before the clock runs out.'),
('bug-hunt', 'cse', 'Competition', 'Bug Hunt', '7 Oct', '2:00 PM', 'CS Lab 2', 2, '₹100', 'Teams get a broken codebase and a ticking timer. Find the bugs, fix them, climb the board.'),
('git-deploy', 'cse', 'Workshop', 'Git & Deploy', '7 Oct', '11:00 AM', 'Seminar Hall', 1, 'Free', 'Hands-on session: version control, pull requests and putting a project live in under an hour.'),
('hack-night', 'cse', 'Competition', 'Hack Night', '7 Oct', '6:00 PM', 'Main Auditorium', 4, '₹200', 'A night-long build sprint. Pitch an idea, ship a prototype, demo it to the judges.'),

-- Artificial Intelligence
('model-arena', 'ai', 'Competition', 'Model Arena', '7 Oct', '10:30 AM', 'AI Lab', 2, '₹100', 'Same dataset, same clock. Build the most accurate model and take the top of the leaderboard.'),
('prompt-wars', 'ai', 'Competition', 'Prompt Wars', '7 Oct', '3:00 PM', 'Seminar Hall', 1, '₹50', 'Head-to-head prompt challenges. Get the best result out of the machine in the fewest tries.'),
('vision-lab', 'ai', 'Workshop', 'Vision Lab', '7 Oct', '11:00 AM', 'AI Lab', 1, 'Free', 'Build an image-recognition pipeline from scratch and see how it learns.'),
('ai-talk', 'ai', 'Talk', 'Where AI Goes Next', '7 Oct', '10:00 AM', 'Main Auditorium', 1, 'Free', 'An open talk on what is changing in AI and what it means for engineers.'),

-- Civil Engineering
('bridge-craft', 'civil', 'Competition', 'Bridge Craft', '7 Oct', '10:00 AM', 'Structures Lab', 2, '₹100', 'Design and assemble a truss bridge from provided materials. Tested to failure under load.'),
('cad-clash', 'civil', 'Competition', 'CAD Clash', '7 Oct', '2:00 PM', 'CAD Lab', 1, '₹50', 'Draft a structure from a brief inside a strict time limit.'),
('survey-sprint', 'civil', 'Competition', 'Survey Sprint', '7 Oct', '9:30 AM', 'Campus Ground', 3, '₹100', 'Field survey race: measure, map and close your traverse with the smallest error.'),
('site-talk', 'civil', 'Talk', 'Building in the Real World', '7 Oct', '11:00 AM', 'Seminar Hall', 1, 'Free', 'A practising engineer on how projects go from drawing to site.'),

-- Mechanical
('cad-modelling', 'mech', 'Competition', 'CAD Modelling', '7 Oct', '11:00 AM', 'CAD Lab', 1, '₹50', 'Model a mechanical assembly from a reference and a deadline.'),
('lathe-master', 'mech', 'Competition', 'Lathe Master', '7 Oct', '2:00 PM', 'Machine Shop', 1, '₹100', 'Turn a raw workpiece to print with tight tolerances. Speed and finish both count.'),
('engine-teardown', 'mech', 'Workshop', 'Engine Teardown', '7 Oct', '10:00 AM', 'Automobile Lab', 2, 'Free', 'Strip down an engine, learn what each part does, then put it back together.'),
('design-talk', 'mech', 'Talk', 'Design for Manufacture', '7 Oct', '10:30 AM', 'Seminar Hall', 1, 'Free', 'How ideas turn into parts that can actually be made.'),

-- Electrical & Electronics
('circuit-scramble', 'eee', 'Competition', 'Circuit Scramble', '7 Oct', '10:30 AM', 'Circuits Lab', 2, '₹100', 'Diagnose, wire and debug a live board while the clock ticks down.'),
('line-follower', 'eee', 'Competition', 'Line Follower', '7 Oct', '2:30 PM', 'College Corridors', 3, '₹150', 'Program a bot to follow the track and finish first without leaving the line.'),
('pcb-workshop', 'eee', 'Workshop', 'PCB Design', '7 Oct', '11:00 AM', 'Electronics Lab', 1, 'Free', 'From schematic to a board ready to print, step by step.'),
('spark-quiz', 'eee', 'Competition', 'Spark Quiz', '7 Oct', '10:00 AM', 'Seminar Hall', 2, '₹50', 'Rapid-fire quiz on circuits, machines and power. Buzzers included.')
ON CONFLICT (id) DO UPDATE 
SET title = EXCLUDED.title, date = '7 Oct', time = EXCLUDED.time, venue = EXCLUDED.venue, fee = EXCLUDED.fee, description = EXCLUDED.description;

-- 4. SEED DEFAULT COORDINATORS / ORGANISERS
INSERT INTO coordinators (dept_slug, name, phone, display_order) VALUES
('cse', 'Student Organiser', '+91 98765 43210', 1),
('cse', 'Faculty Coordinator', '+91 98765 43211', 2),
('ai', 'Student Organiser', '+91 98765 43212', 1),
('ai', 'Faculty Coordinator', '+91 98765 43213', 2),
('civil', 'Student Organiser', '+91 98765 43214', 1),
('civil', 'Faculty Coordinator', '+91 98765 43215', 2),
('mech', 'Student Organiser', '+91 98765 43216', 1),
('mech', 'Faculty Coordinator', '+91 98765 43217', 2),
('eee', 'Student Organiser', '+91 98765 43218', 1),
('eee', 'Faculty Coordinator', '+91 98765 43219', 2)
ON CONFLICT DO NOTHING;

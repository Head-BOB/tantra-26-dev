-- ============================================================
-- TANTRA 26 — PRODUCTION DATABASE SEED SCRIPT
-- Run this in Supabase SQL Editor after running schema.sql
-- ============================================================

-- 1. SEED DEPARTMENTS (All 10 departments)
INSERT INTO departments (slug, name, color, fg) VALUES
('cse',   'Computer Science & Engineering',         '#2b6a4d', '#efe8da'),
('cscy',  'Cyber Security',                         '#141414', '#efe8da'),
('ai',    'Artificial Intelligence & Data Science',  '#c23b22', '#efe8da'),
('csd',   'Computer Science & Design',              '#e3a72f', '#141414'),
('csbs',  'Computer Science & Business Systems',     '#182338', '#efe8da'),
('eee',   'Electrical & Electronics Engineering',    '#efe8da', '#141414'),
('ece',   'Electronics & Communication Engineering', '#c23b22', '#efe8da'),
('aei',   'Applied Electronics & Instrumentation',   '#2b6a4d', '#efe8da'),
('civil', 'Civil Engineering',                      '#e3a72f', '#141414'),
('mech',  'Mechanical Engineering',                 '#243a5e', '#efe8da')
ON CONFLICT (slug) DO UPDATE 
SET name = EXCLUDED.name, color = EXCLUDED.color, fg = EXCLUDED.fg;

-- 2. SEED DEFAULT PAYMENT CONFIGURATIONS
INSERT INTO department_payments (dept_slug, upi_id, qr_image_url) VALUES
('cse',   'tantra26.cse@okhdfcbank', NULL),
('cscy',  'tantra26.cscy@okhdfcbank', NULL),
('ai',    'tantra26.ai@okhdfcbank', NULL),
('csd',   'tantra26.csd@okhdfcbank', NULL),
('csbs',  'tantra26.csbs@okhdfcbank', NULL),
('eee',   'tantra26.eee@okhdfcbank', NULL),
('ece',   'tantra26.ece@okhdfcbank', NULL),
('aei',   'tantra26.aei@okhdfcbank', NULL),
('civil', 'tantra26.civil@okhdfcbank', NULL),
('mech',  'tantra26.mech@okhdfcbank', NULL)
ON CONFLICT (dept_slug) DO NOTHING;

-- 3. SEED BASE EVENTS (ALL HARDCODED TO 7 OCT WITH UNIQUE 6-DIGIT PASSCODES)
INSERT INTO events (id, dept_slug, type, title, date, time, venue, team_size, fee, description, access_code) VALUES
-- Computer Science & Engineering
('code-rush', 'cse', 'Competition', 'Code Rush', '7 Oct', '10:00 AM', 'CS Lab 1', 1, '₹50', 'Timed competitive programming round. Solve as many problems as you can before the clock runs out.', 'CR7X9A'),
('bug-hunt', 'cse', 'Competition', 'Bug Hunt', '7 Oct', '2:00 PM', 'CS Lab 2', 2, '₹100', 'Teams get a broken codebase and a ticking timer. Find the bugs, fix them, climb the board.', 'BH4M2K'),
('git-deploy', 'cse', 'Workshop', 'Git & Deploy', '7 Oct', '11:00 AM', 'Seminar Hall', 1, 'Free', 'Hands-on session: version control, pull requests and putting a project live in under an hour.', 'GD8P3W'),
('hack-night', 'cse', 'Competition', 'Hack Night', '7 Oct', '6:00 PM', 'Main Auditorium', 4, '₹200', 'A night-long build sprint. Pitch an idea, ship a prototype, demo it to the judges.', 'HN6Y5T'),

-- Cyber Security
('capture-flag', 'cscy', 'Competition', 'Capture the Flag', '7 Oct', '10:00 AM', 'Cyber Security Lab', 2, '₹100', 'Team-based hacking challenges across web, crypto and forensics. Capture the most flags before time runs out.', 'CF9V4Z'),
('cipher-break', 'cscy', 'Competition', 'Cipher Break', '7 Oct', '2:30 PM', 'CS Lab 1', 1, '₹50', 'Crack classical ciphers, modern encryption and hidden steganography messages under time pressure.', 'CB3K7L'),
('ethical-hacking', 'cscy', 'Workshop', 'Ethical Hacking 101', '7 Oct', '11:00 AM', 'Seminar Hall', 1, 'Free', 'Hands-on intro to penetration testing, vulnerability discovery and defensive security tools.', 'EH8T2P'),
('forensics-talk', 'cscy', 'Talk', 'Digital Forensics in Action', '7 Oct', '10:30 AM', 'Main Auditorium', 1, 'Free', 'Case studies from real cyber investigations: incident response, malware analysis and threat hunting.', 'FT5M9D'),

-- Artificial Intelligence & Data Science
('model-arena', 'ai', 'Competition', 'Model Arena', '7 Oct', '10:30 AM', 'AI Lab', 2, '₹100', 'Same dataset, same clock. Build the most accurate model and take the top of the leaderboard.', 'MA7R3B'),
('prompt-wars', 'ai', 'Competition', 'Prompt Wars', '7 Oct', '3:00 PM', 'Seminar Hall', 1, '₹50', 'Head-to-head prompt challenges. Get the best result out of the machine in the fewest tries.', 'PW4X8G'),
('vision-lab', 'ai', 'Workshop', 'Vision Lab', '7 Oct', '11:00 AM', 'AI Lab', 1, 'Free', 'Build an image-recognition pipeline from scratch and see how it learns.', 'VL9K2H'),
('ai-talk', 'ai', 'Talk', 'Where AI Goes Next', '7 Oct', '10:00 AM', 'Main Auditorium', 1, 'Free', 'An open talk on what is changing in AI and what it means for engineers.', 'AT6N5E'),

-- Computer Science & Design
('design-sprint', 'csd', 'Competition', 'Design Sprint', '7 Oct', '10:00 AM', 'Design Studio', 2, '₹100', 'Redesign a broken app screen from a short brief before the timer ends.', 'DS8W2M'),
('poster-slam', 'csd', 'Competition', 'Poster Slam', '7 Oct', '2:30 PM', 'Design Studio', 1, '₹50', 'One theme, one canvas, two hours. Make the poster that stops people walking.', 'PS3V7K'),
('figma-frontend', 'csd', 'Workshop', 'Figma to Front-end', '7 Oct', '11:00 AM', 'Computer Lab', 1, 'Free', 'Take a design from a Figma file to a working web page.', 'FF9T4C'),
('design-talk', 'csd', 'Talk', 'Designing for People', '7 Oct', '10:30 AM', 'Seminar Hall', 1, 'Free', 'A designer talks through how good products get made.', 'DT5Y8L'),

-- Computer Science & Business Systems
('startup-pitch', 'csbs', 'Competition', 'Startup Pitch', '7 Oct', '11:00 AM', 'Seminar Hall', 3, '₹150', 'Pitch an idea to a panel in five minutes. Best plan takes the prize.', 'SP7K4N'),
('biz-code-battle', 'csbs', 'Competition', 'Biz Code Battle', '7 Oct', '2:30 PM', 'CS Lab 1', 2, '₹100', 'A business case with a coding twist. Solve it with logic and code.', 'BC3X9R'),
('data-decisions', 'csbs', 'Workshop', 'Data to Decisions', '7 Oct', '10:30 AM', 'Computer Lab', 1, 'Free', 'Turn a spreadsheet into a decision using simple analytics.', 'DD8M2V'),
('fintech-talk', 'csbs', 'Talk', 'Inside Fintech', '7 Oct', '11:00 AM', 'Main Auditorium', 1, 'Free', 'How software is changing money, payments and markets.', 'FY4P6Z'),

-- Electrical & Electronics Engineering
('circuit-scramble', 'eee', 'Competition', 'Circuit Scramble', '7 Oct', '10:30 AM', 'Circuits Lab', 2, '₹100', 'Diagnose, wire and debug a live board while the clock ticks down.', 'CD7T3K'),
('circuit-debug', 'eee', 'Competition', 'Circuit Debug', '7 Oct', '10:30 AM', 'Circuits Lab', 2, '₹100', 'Diagnose, wire and debug a live board while the clock ticks down.', 'CD7T3K'),
('line-follower', 'eee', 'Competition', 'Line Follower', '7 Oct', '2:30 PM', 'College Corridors', 3, '₹150', 'Program a bot to follow the track and finish first without leaving the line.', 'LF9M5P'),
('pcb-workshop', 'eee', 'Workshop', 'PCB Design', '7 Oct', '11:00 AM', 'Electronics Lab', 1, 'Free', 'From schematic to a board ready to print, step by step.', 'PB8N2A'),
('spark-quiz', 'eee', 'Competition', 'Spark Quiz', '7 Oct', '10:00 AM', 'Seminar Hall', 2, '₹50', 'Rapid-fire quiz on circuits, machines and power. Buzzers included.', 'SQ4K7E'),

-- Electronics & Communication Engineering
('signal-decode', 'ece', 'Competition', 'Signal Decode', '7 Oct', '10:30 AM', 'Communication Lab', 2, '₹100', 'Recover a message hidden in a noisy signal. The cleanest decode wins.', 'SD7X3Y'),
('antenna-build', 'ece', 'Competition', 'Antenna Build', '7 Oct', '2:30 PM', 'Electronics Lab', 3, '₹150', 'Build an antenna from scratch and see whose reaches the farthest.', 'AB5T9W'),
('embedded-workshop', 'ece', 'Workshop', 'Embedded Basics', '7 Oct', '11:00 AM', 'Electronics Lab', 1, 'Free', 'Program a board to send and receive data wirelessly.', 'EW8M4R'),
('comm-talk', 'ece', 'Talk', 'How the World Connects', '7 Oct', '10:00 AM', 'Seminar Hall', 1, 'Free', 'A talk on how signals travel from a tower to your phone.', 'CT3K6H'),

-- Applied Electronics & Instrumentation
('sensor-quest', 'aei', 'Competition', 'Sensor Quest', '7 Oct', '10:30 AM', 'Instrumentation Lab', 3, '₹100', 'Build a small sensor project that measures something real and shows the reading.', 'SN9T5B'),
('signal-chase', 'aei', 'Competition', 'Signal Chase', '7 Oct', '2:30 PM', 'Electronics Lab', 2, '₹100', 'Trace faults in a signal chain using an oscilloscope. Fastest clean fix wins.', 'SC4M8L'),
('micro-workshop', 'aei', 'Workshop', 'Microcontroller Basics', '7 Oct', '11:00 AM', 'Electronics Lab', 1, 'Free', 'Program a microcontroller to read a sensor and drive an output.', 'MW7K2D'),
('automation-talk', 'aei', 'Talk', 'Automation in Industry', '7 Oct', '10:00 AM', 'Seminar Hall', 1, 'Free', 'How measurement and control keep factories running.', 'AU3P9N'),

-- Civil Engineering
('bridge-craft', 'civil', 'Competition', 'Bridge Craft', '7 Oct', '10:00 AM', 'Structures Lab', 2, '₹100', 'Design and assemble a truss bridge from provided materials. Tested to failure under load.', 'BB8X3M'),
('bridge-builders', 'civil', 'Competition', 'Bridge Builders', '7 Oct', '10:00 AM', 'Structures Lab', 2, '₹100', 'Design and assemble a truss bridge from provided materials. Tested to failure under load.', 'BB8X3M'),
('cad-clash', 'civil', 'Competition', 'CAD Clash', '7 Oct', '2:00 PM', 'CAD Lab', 1, '₹50', 'Draft a structure from a brief inside a strict time limit.', 'CS7K5W'),
('cad-showdown', 'civil', 'Competition', 'CAD Showdown', '7 Oct', '2:00 PM', 'CAD Lab', 1, '₹50', 'Draft a structure from a brief inside a strict time limit.', 'CS7K5W'),
('survey-sprint', 'civil', 'Competition', 'Survey Sprint', '7 Oct', '9:30 AM', 'Campus Ground', 3, '₹100', 'Field survey race: measure, map and close your traverse with the smallest error.', 'SS4M9P'),
('site-talk', 'civil', 'Talk', 'Building in the Real World', '7 Oct', '11:00 AM', 'Seminar Hall', 1, 'Free', 'A practising engineer on how projects go from drawing to site.', 'ST8T2R'),

-- Mechanical Engineering
('cad-modelling', 'mech', 'Competition', 'CAD Modelling', '7 Oct', '11:00 AM', 'CAD Lab', 1, '₹50', 'Model a mechanical assembly from a reference and a deadline.', 'CM4T8B'),
('lathe-master', 'mech', 'Competition', 'Lathe Master', '7 Oct', '2:00 PM', 'Machine Shop', 1, '₹100', 'Turn a raw workpiece to print with tight tolerances. Speed and finish both count.', 'RR9K3X'),
('robo-race', 'mech', 'Competition', 'Robo Race', '7 Oct', '11:00 AM', 'Workshop Ground', 4, '₹200', 'Build a bot and race it around the obstacle track. Fastest clean lap wins.', 'RR9K3X'),
('engine-teardown', 'mech', 'Workshop', 'Engine Teardown', '7 Oct', '10:00 AM', 'Automobile Lab', 2, 'Free', 'Strip down an engine, learn what each part does, then put it back together.', 'ET7M5L'),
('mech-talk', 'mech', 'Talk', 'Design for Manufacture', '7 Oct', '10:30 AM', 'Seminar Hall', 1, 'Free', 'How ideas turn into parts that can actually be made.', 'MD3P8K'),
('design-talk-mech', 'mech', 'Talk', 'Design for Manufacture', '7 Oct', '10:30 AM', 'Seminar Hall', 1, 'Free', 'How ideas turn into parts that can actually be made.', 'MD3P8K')
ON CONFLICT (id) DO UPDATE 
SET title = EXCLUDED.title, date = '7 Oct', time = EXCLUDED.time, venue = EXCLUDED.venue, fee = EXCLUDED.fee, description = EXCLUDED.description, access_code = EXCLUDED.access_code;

-- 4. SEED DEFAULT COORDINATORS / ORGANISERS
INSERT INTO coordinators (dept_slug, name, phone, display_order) VALUES
('cse', 'Student Organiser', '+91 98765 43210', 1),
('cse', 'Faculty Coordinator', '+91 98765 43211', 2),
('cscy', 'Student Organiser', '+91 98765 43230', 1),
('cscy', 'Faculty Coordinator', '+91 98765 43231', 2),
('ai', 'Student Organiser', '+91 98765 43212', 1),
('ai', 'Faculty Coordinator', '+91 98765 43213', 2),
('csd', 'Student Organiser', '+91 98765 43220', 1),
('csd', 'Faculty Coordinator', '+91 98765 43221', 2),
('csbs', 'Student Organiser', '+91 98765 43222', 1),
('csbs', 'Faculty Coordinator', '+91 98765 43223', 2),
('eee', 'Student Organiser', '+91 98765 43218', 1),
('eee', 'Faculty Coordinator', '+91 98765 43219', 2),
('ece', 'Student Organiser', '+91 98765 43226', 1),
('ece', 'Faculty Coordinator', '+91 98765 43227', 2),
('aei', 'Student Organiser', '+91 98765 43224', 1),
('aei', 'Faculty Coordinator', '+91 98765 43225', 2),
('civil', 'Student Organiser', '+91 98765 43214', 1),
('civil', 'Faculty Coordinator', '+91 98765 43215', 2),
('mech', 'Student Organiser', '+91 98765 43216', 1),
('mech', 'Faculty Coordinator', '+91 98765 43217', 2)
ON CONFLICT DO NOTHING;

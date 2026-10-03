/**
 * api/event.js — Tantra 26 Dynamic Open Graph & Link Embed Generator
 * Runs on Vercel Serverless / Edge to generate rich social media preview embeds
 * (banner image, title, date, venue, prize pool, and description) for WhatsApp,
 * Telegram, Discord, Twitter/X, Facebook, LinkedIn, iMessage, and Slack.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://hdclbulbjmntzjssynwc.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkY2xidWxiam1udHpqc3N5bndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5Mzg2NzEsImV4cCI6MjEwNjUxNDY3MX0.YWw8Zqxm6iUTZ3j5Fw-LY5_5r6FemkFcX-N_zQar0jA';

const DEPT_NAMES = {
  cse: 'Computer Science & Engineering',
  cscy: 'Computer Science and Cyber Security',
  ai: 'Artificial Intelligence & Data Science',
  csd: 'Computer Science & Design',
  csbs: 'Computer Science & Business Systems',
  eee: 'Electrical & Electronics Engineering',
  ece: 'Electronics & Communication Engineering',
  aei: 'Applied Electronics & Instrumentation',
  civil: 'Civil Engineering',
  mech: 'Mechanical Engineering',
};

// Fallback seed events across all 10 departments in case database is cold-starting or offline
const SEED_EVENTS = {
  // CSE
  'code-rush': { title: 'Code Rush', dept_slug: 'cse', type: 'Competition', date: '7 Oct', time: '10:00 AM', venue: 'CS Lab 1', fee: '₹50', description: 'Timed competitive programming round. Solve as many problems as you can before the clock runs out.' },
  'bug-hunt': { title: 'Bug Hunt', dept_slug: 'cse', type: 'Competition', date: '7 Oct', time: '2:00 PM', venue: 'CS Lab 2', fee: '₹100', description: 'Teams get a broken codebase and a ticking timer. Find the bugs, fix them, climb the board.' },
  'git-deploy': { title: 'Git & Deploy', dept_slug: 'cse', type: 'Workshop', date: '7 Oct', time: '11:00 AM', venue: 'Seminar Hall', fee: 'Free', description: 'Hands-on session: version control, pull requests and putting a project live in under an hour.' },
  'hack-night': { title: 'Hack Night', dept_slug: 'cse', type: 'Competition', date: '7 Oct', time: '6:00 PM', venue: 'Main Auditorium', fee: '₹200', description: 'A night-long build sprint. Pitch an idea, ship a prototype, demo it to the judges.' },

  // AI & Data Science
  'model-arena': { title: 'Model Arena', dept_slug: 'ai', type: 'Competition', date: '7 Oct', time: '10:30 AM', venue: 'AI Lab', fee: '₹100', description: 'Train and tune an ML model on a live dataset. Highest accuracy on hidden test data wins.' },
  'prompt-craft': { title: 'Prompt Craft', dept_slug: 'ai', type: 'Competition', date: '7 Oct', time: '2:00 PM', venue: 'Computer Lab 3', fee: '₹50', description: 'Write the best prompts to get precise outputs across image, text and reasoning benchmarks.' },
  'llm-workshop': { title: 'Building with LLMs', dept_slug: 'ai', type: 'Workshop', date: '7 Oct', time: '11:00 AM', venue: 'Seminar Hall', fee: 'Free', description: 'Hands-on session on APIs, function calling and connecting models to external tools.' },
  'ai-ethics-talk': { title: 'AI Beyond the Hype', dept_slug: 'ai', type: 'Talk', date: '7 Oct', time: '10:00 AM', venue: 'Main Auditorium', fee: 'Free', description: 'A fast-paced talk on what is real in modern AI and what is marketing.' },

  // CSD
  'ui-redesign': { title: 'UI Redesign Challenge', dept_slug: 'csd', type: 'Competition', date: '7 Oct', time: '10:00 AM', venue: 'Design Studio', fee: '₹100', description: 'Pick an ugly or broken interface and rebuild it from scratch in three hours.' },
  'motion-sprint': { title: 'Motion Sprint', dept_slug: 'csd', type: 'Competition', date: '7 Oct', time: '2:00 PM', venue: 'Computer Lab', fee: '₹100', description: 'Animate a product interaction or micro-animation from a short creative brief.' },
  'figma-systems': { title: 'Design Systems in Figma', dept_slug: 'csd', type: 'Workshop', date: '7 Oct', time: '11:00 AM', venue: 'Design Studio', fee: 'Free', description: 'Tokens, auto-layout and components: build a production-grade system in two hours.' },
  'brand-talk': { title: 'Design That Scales', dept_slug: 'csd', type: 'Talk', date: '7 Oct', time: '10:00 AM', venue: 'Seminar Hall', fee: 'Free', description: 'How early stage design choices save or sink a product later on.' },

  // CSBS
  'startup-pitch': { title: 'Startup Pitch', dept_slug: 'csbs', type: 'Competition', date: '7 Oct', time: '11:00 AM', venue: 'Seminar Hall', fee: '₹150', description: 'Pitch an idea to a panel in five minutes. Best plan takes the prize.' },
  'biz-code-battle': { title: 'Biz Code Battle', dept_slug: 'csbs', type: 'Competition', date: '7 Oct', time: '2:30 PM', venue: 'CS Lab 1', fee: '₹100', description: 'A business case with a coding twist. Solve it with logic and code.' },
  'data-decisions': { title: 'Data to Decisions', dept_slug: 'csbs', type: 'Workshop', date: '7 Oct', time: '10:30 AM', venue: 'Computer Lab', fee: 'Free', description: 'Turn a spreadsheet into a decision using simple analytics.' },
  'fintech-talk': { title: 'Inside Fintech', dept_slug: 'csbs', type: 'Talk', date: '7 Oct', time: '11:00 AM', venue: 'Main Auditorium', fee: 'Free', description: 'How software is changing money, payments and markets.' },

  // EEE
  'circuit-debug': { title: 'Circuit Debug', dept_slug: 'eee', type: 'Competition', date: '7 Oct', time: '10:00 AM', venue: 'Electronics Lab', fee: '₹100', description: 'Faulty boards, a multimeter and a countdown. Find every fault before the others do.' },
  'line-follower': { title: 'Line Follower', dept_slug: 'eee', type: 'Competition', date: '7 Oct', time: '2:30 PM', venue: 'Workshop Ground', fee: '₹150', description: 'Program a bot to follow the track and finish first without leaving the line.' },
  'pcb-workshop': { title: 'PCB Design', dept_slug: 'eee', type: 'Workshop', date: '7 Oct', time: '11:00 AM', venue: 'Electronics Lab', fee: 'Free', description: 'From schematic to a board ready to print, step by step.' },
  'spark-quiz': { title: 'Spark Quiz', dept_slug: 'eee', type: 'Competition', date: '7 Oct', time: '10:00 AM', venue: 'Seminar Hall', fee: '₹50', description: 'Rapid-fire quiz on circuits, machines and power. Buzzers included.' },

  // ECE
  'signal-decode': { title: 'Signal Decode', dept_slug: 'ece', type: 'Competition', date: '7 Oct', time: '10:30 AM', venue: 'Communication Lab', fee: '₹100', description: 'Recover a message hidden in a noisy signal. The cleanest decode wins.' },
  'antenna-build': { title: 'Antenna Build', dept_slug: 'ece', type: 'Competition', date: '7 Oct', time: '2:30 PM', venue: 'Electronics Lab', fee: '₹150', description: 'Build an antenna from scratch and see whose reaches the farthest.' },
  'embedded-workshop': { title: 'Embedded Basics', dept_slug: 'ece', type: 'Workshop', date: '7 Oct', time: '11:00 AM', venue: 'Electronics Lab', fee: 'Free', description: 'Program a board to send and receive data wirelessly.' },
  'comm-talk': { title: 'How the World Connects', dept_slug: 'ece', type: 'Talk', date: '7 Oct', time: '10:00 AM', venue: 'Seminar Hall', fee: 'Free', description: 'A talk on how signals travel from a tower to your phone.' },

  // AEI
  'sensor-quest': { title: 'Sensor Quest', dept_slug: 'aei', type: 'Competition', date: '7 Oct', time: '10:30 AM', venue: 'Instrumentation Lab', fee: '₹100', description: 'Build a small sensor project that measures something real and shows the reading.' },
  'signal-chase': { title: 'Signal Chase', dept_slug: 'aei', type: 'Competition', date: '7 Oct', time: '2:30 PM', venue: 'Electronics Lab', fee: '₹100', description: 'Trace faults in a signal chain using an oscilloscope. Fastest clean fix wins.' },
  'micro-workshop': { title: 'Microcontroller Basics', dept_slug: 'aei', type: 'Workshop', date: '7 Oct', time: '11:00 AM', venue: 'Electronics Lab', fee: 'Free', description: 'Program a microcontroller to read a sensor and drive an output.' },
  'automation-talk': { title: 'Automation in Industry', dept_slug: 'aei', type: 'Talk', date: '7 Oct', time: '10:00 AM', venue: 'Seminar Hall', fee: 'Free', description: 'How measurement and control keep factories running.' },

  // Civil
  'bridge-builders': { title: 'Bridge Builders', dept_slug: 'civil', type: 'Competition', date: '7 Oct', time: '10:00 AM', venue: 'Civil Workshop', fee: '₹150', description: 'Build a bridge from limited material. The one that holds the most load wins.' },
  'cad-showdown': { title: 'CAD Showdown', dept_slug: 'civil', type: 'Competition', date: '7 Oct', time: '2:00 PM', venue: 'Computer Lab', fee: '₹50', description: 'Draft a structure from a brief inside a strict time limit.' },
  'survey-sprint': { title: 'Survey Sprint', dept_slug: 'civil', type: 'Competition', date: '7 Oct', time: '9:30 AM', venue: 'Campus Ground', fee: '₹100', description: 'Field survey race: measure, map and close your traverse with the smallest error.' },
  'site-talk': { title: 'Building in the Real World', dept_slug: 'civil', type: 'Talk', date: '7 Oct', time: '11:00 AM', venue: 'Seminar Hall', fee: 'Free', description: 'A practising engineer on how projects go from drawing to site.' },

  // Mechanical
  'robo-race': { title: 'Robo Race', dept_slug: 'mech', type: 'Competition', date: '7 Oct', time: '11:00 AM', venue: 'Workshop Ground', fee: '₹200', description: 'Build a bot and race it around the obstacle track. Fastest clean lap wins.' },
  'cad-modelling': { title: 'CAD Modelling', dept_slug: 'mech', type: 'Competition', date: '7 Oct', time: '3:00 PM', venue: 'CAD Lab', fee: '₹50', description: 'Model a mechanical assembly from a reference and a deadline.' },
  'engine-teardown': { title: 'Engine Teardown', dept_slug: 'mech', type: 'Workshop', date: '7 Oct', time: '10:00 AM', venue: 'Automobile Lab', fee: 'Free', description: 'Strip down an engine, learn what each part does, then put it back together.' },

  // CSCY
  'capture-flag': { title: 'Capture the Flag', dept_slug: 'cscy', type: 'Competition', date: '7 Oct', time: '10:00 AM', venue: 'CS Lab 1', fee: '₹150', description: 'Team-based hacking challenges across web, crypto and forensics. Capture the most flags before time runs out.' },
  'cipher-break': { title: 'Cipher Break', dept_slug: 'cscy', type: 'Competition', date: '7 Oct', time: '2:30 PM', venue: 'CS Lab 2', fee: '₹100', description: 'Decode layered ciphers and puzzles. First to the final plaintext wins.' },
  'ethical-hacking': { title: 'Ethical Hacking 101', dept_slug: 'cscy', type: 'Workshop', date: '8 Oct', time: '11:00 AM', venue: 'Seminar Hall', fee: 'Free', description: 'How attackers think and how defenders stop them, with live demos on a safe practice lab.' },
  'forensics-talk': { title: 'Digital Forensics in Action', dept_slug: 'cscy', type: 'Talk', date: '9 Oct', time: '10:30 AM', venue: 'Main Auditorium', fee: 'Free', description: 'A look at how investigators trace what happened after a breach.' },
};

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function fetchEventData(deptSlug, eventId) {
  if (!eventId) return null;

  // 1. Try Supabase REST query
  try {
    const url = `${SUPABASE_URL}/rest/v1/events?id=eq.${encodeURIComponent(eventId)}&select=*`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        const row = rows[0];
        let banners = row.banners || {};
        let prizes = row.prizes || [];
        let fee = row.fee || 'Free';
        let duration = row.duration || 120;
        let eventDate = row.date || '7 Oct';
        let eventTime = row.time || '';

        // Check if envelope JSON was stored in description
        if (typeof row.description === 'string' && row.description.startsWith('{"_meta":true')) {
          try {
            const parsed = JSON.parse(row.description);
            if (parsed.banners) banners = { ...banners, ...parsed.banners };
            if (parsed.prizes) prizes = parsed.prizes;
            if (parsed.fee) fee = parsed.fee;
            if (parsed.duration) duration = parsed.duration;
            if (parsed.date) eventDate = parsed.date;
            if (parsed.time) eventTime = parsed.time;
            if (parsed.desc || parsed.details) row.description = parsed.details || parsed.desc;
            else if (parsed.text) row.description = parsed.text;
          } catch {}
        }

        return {
          id: row.id,
          title: row.title,
          dept_slug: row.dept_slug || deptSlug,
          type: row.type || 'Event',
          date: eventDate,
          time: eventTime,
          duration,
          venue: row.venue || 'Campus',
          fee,
          description: row.description || '',
          banner: row.banner || '',
          banners,
          prizes,
        };
      }
    }
  } catch (err) {
    console.warn('api/event fetch error:', err.message);
  }

  // 2. Check fallback catalog events
  const fallback = SEED_EVENTS[eventId] || SEED_EVENTS[eventId.toLowerCase()];
  if (fallback) {
    return {
      id: eventId,
      ...fallback,
      dept_slug: fallback.dept_slug || deptSlug,
      banners: {},
      prizes: [],
    };
  }

  // 3. Fuzzy slug fallback
  const slugId = eventId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (SEED_EVENTS[slugId]) {
    const f = SEED_EVENTS[slugId];
    return {
      id: eventId,
      ...f,
      dept_slug: f.dept_slug || deptSlug,
      banners: {},
      prizes: [],
    };
  }

  return null;
}

export default async function handler(req, res) {
  const query = req.query || {};
  let deptSlug = (query.d || query.dept || query.slug || '').toLowerCase();
  let eventId  = (query.e || query.id || query.eventId || '').trim();

  if (!eventId && req.url) {
    try {
      const u = new URL(req.url, 'http://localhost');
      deptSlug = deptSlug || (u.searchParams.get('d') || u.searchParams.get('dept') || u.searchParams.get('slug') || '').toLowerCase();
      eventId  = eventId  || (u.searchParams.get('e') || u.searchParams.get('id') || u.searchParams.get('eventId') || '').trim();
    } catch {}
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host || 'tantra26.vjec.in';
  const proto = (req.headers['x-forwarded-proto'] || 'https').replace(/:$/, '');
  const baseUrl = `${proto}://${host}`;

  const event = await fetchEventData(deptSlug, eventId);

  // If no event found, fallback to main techfest metadata
  if (!event) {
    const defaultTitle = 'Tantra 26 | National Level Techfest';
    const defaultDesc = 'Tantra 26 — the annual national level techfest at Vimal Jyothi Engineering College. 7-8 October 2026.';
    const defaultRedirect = `${baseUrl}/#departments`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(defaultTitle)}</title>
  <meta name="description" content="${escapeHtml(defaultDesc)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Tantra 26 | National Level Techfest">
  <meta property="og:title" content="${escapeHtml(defaultTitle)}">
  <meta property="og:description" content="${escapeHtml(defaultDesc)}">
  <meta property="og:url" content="${baseUrl}/">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(defaultTitle)}">
  <meta name="twitter:description" content="${escapeHtml(defaultDesc)}">
</head>
<body>
  <p>Redirecting to <a href="${defaultRedirect}">Tantra 26</a>...</p>
  <script>location.replace(${JSON.stringify(defaultRedirect)});</script>
  <noscript><meta http-equiv="refresh" content="0;url=${defaultRedirect}"></noscript>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  }

  // Extract metadata details
  const deptName = DEPT_NAMES[event.dept_slug] || 'Tantra 26';
  const b = event.banners || {};
  // Prioritize normal event banner over featured showcase banner
  const rawBanner = b.event_desktop || event.banner || b.event_mobile || b.featured_desktop || b.featured_mobile || '';

  let bannerUrl = '';
  if (rawBanner && typeof rawBanner === 'string' && rawBanner.trim()) {
    if (/^https?:\/\//i.test(rawBanner.trim())) {
      bannerUrl = rawBanner.trim();
    } else {
      // Decode Base64 or serve via binary endpoint
      bannerUrl = `${baseUrl}/api/banner?e=${encodeURIComponent(event.id)}`;
    }
  }

  // Calculate prize pool if present
  let prizeText = '';
  if (Array.isArray(event.prizes) && event.prizes.length > 0) {
    let total = 0;
    for (const p of event.prizes) {
      const num = parseInt(String(p.reward || '').replace(/[^0-9]/g, ''), 10);
      if (!isNaN(num) && num > 0) total += num;
    }
    if (total > 0) {
      prizeText = `Prize Pool: ₹${total.toLocaleString('en-IN')}`;
    } else if (event.prizes[0] && event.prizes[0].reward) {
      prizeText = `Prize: ${event.prizes[0].reward}`;
    }
  }

  const metaTitle = `${event.title} · Tantra 26 | National Level Techfest`;
  const metaDescParts = [
    deptName,
    `${event.date}${event.time ? ` · ${event.time}` : ''}`,
    `Venue: ${event.venue}`,
    prizeText,
    event.fee ? `Fee: ${event.fee}` : '',
  ].filter(Boolean);

  const metaDesc = `${metaDescParts.join(' · ')} — ${event.description || 'Join at Vimal Jyothi Engineering College.'}`.slice(0, 240);

  const targetPage = `/event?d=${encodeURIComponent(event.dept_slug || deptSlug)}&e=${encodeURIComponent(event.id)}`;
  const canonicalUrl = `${baseUrl}${targetPage}`;

  // Check if requester is a crawler bot
  const ua = req.headers['user-agent'] || '';
  const isBot = /facebookexternalhit|WhatsApp|TelegramBot|Twitterbot|Discordbot|Slackbot|LinkedInBot|SkypeUriPreview|Googlebot|bingbot|crawler|spider|bot/i.test(ua);

  // Return full HTML with Open Graph & Twitter Cards
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(metaTitle)}</title>
  <meta name="description" content="${escapeHtml(metaDesc)}">

  <!-- Open Graph / Facebook / WhatsApp / Discord / LinkedIn -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Tantra 26 | National Level Techfest">
  <meta property="og:title" content="${escapeHtml(metaTitle)}">
  <meta property="og:description" content="${escapeHtml(metaDesc)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  ${bannerUrl ? `<meta property="og:image" content="${escapeHtml(bannerUrl)}">
  <meta property="og:image:secure_url" content="${escapeHtml(bannerUrl)}">
  <meta property="og:image:type" content="image/webp">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(event.title)} Banner">
  <meta itemprop="image" content="${escapeHtml(bannerUrl)}">
  <link rel="image_src" href="${escapeHtml(bannerUrl)}">` : ''}

  <!-- Twitter / X -->
  <meta name="twitter:card" content="${bannerUrl ? 'summary_large_image' : 'summary'}">
  <meta name="twitter:title" content="${escapeHtml(metaTitle)}">
  <meta name="twitter:description" content="${escapeHtml(metaDesc)}">
  ${bannerUrl ? `<meta name="twitter:image" content="${escapeHtml(bannerUrl)}">` : ''}

  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
</head>
<body style="background:#0a0e1c;color:#efe8da;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;text-align:center;">
  <div>
    <h2>${escapeHtml(event.title)}</h2>
    <p>${escapeHtml(deptName)} · Tantra 26 National Level Techfest</p>
    <p><a href="${targetPage}" style="color:#e3a72f;font-weight:bold;">Click here to open event page &rarr;</a></p>
  </div>
  <script>
    if (!${JSON.stringify(isBot)}) {
      window.location.replace(${JSON.stringify(targetPage)});
    }
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0;url=${targetPage}">
  </noscript>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
  return res.status(200).send(html);
}

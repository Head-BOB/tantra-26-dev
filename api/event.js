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

// Fallback seed events in case database is cold-starting or offline
const SEED_EVENTS = {
  'code-rush': { title: 'Code Rush', dept_slug: 'cse', type: 'Competition', date: '7 Oct', time: '10:00 AM', venue: 'CS Lab 1', fee: '₹50', description: 'Timed competitive programming round. Solve as many problems as you can before the clock runs out.' },
  'hack-night': { title: 'Hack Night', dept_slug: 'cse', type: 'Competition', date: '7 Oct', time: '6:00 PM', venue: 'Main Auditorium', fee: '₹200', description: 'A night-long build sprint. Pitch an idea, ship a prototype, demo it to the judges.' },
  'capture-flag': { title: 'Capture the Flag', dept_slug: 'cscy', type: 'Competition', date: '7 Oct', time: '10:00 AM', venue: 'Cyber Security Lab', fee: '₹100', description: 'Team-based hacking challenges across web, crypto and forensics. Capture the most flags.' },
  'model-arena': { title: 'Model Arena', dept_slug: 'ai', type: 'Competition', date: '7 Oct', time: '10:30 AM', venue: 'AI Lab', fee: '₹100', description: 'Same dataset, same clock. Build the most accurate machine learning model.' },
  'design-sprint': { title: 'Design Sprint', dept_slug: 'csd', type: 'Competition', date: '7 Oct', time: '10:00 AM', venue: 'Design Studio', fee: '₹100', description: 'Redesign a broken app screen from a short brief before the timer ends.' },
  'startup-pitch': { title: 'Startup Pitch', dept_slug: 'csbs', type: 'Competition', date: '7 Oct', time: '11:00 AM', venue: 'Seminar Hall', fee: '₹150', description: 'Pitch a viable tech business model to investor judges.' },
  'line-follower': { title: 'Line Follower', dept_slug: 'eee', type: 'Competition', date: '7 Oct', time: '2:30 PM', venue: 'Workshop Ground', fee: '₹100', description: 'High-speed autonomous line tracer robot showdown.' },
  'antenna-build': { title: 'Antenna Build', dept_slug: 'ece', type: 'Competition', date: '7 Oct', time: '2:30 PM', venue: 'Electronics Lab', fee: '₹100', description: 'Design, simulate and construct an RF antenna for maximum gain.' },
  'signal-chase': { title: 'Signal Chase', dept_slug: 'aei', type: 'Competition', date: '7 Oct', time: '2:30 PM', venue: 'Electronics Lab', fee: '₹100', description: 'Decode hidden frequencies and sensor signals under time pressure.' },
  'bridge-it': { title: 'Bridge It', dept_slug: 'civil', type: 'Competition', date: '7 Oct', time: '11:00 AM', venue: 'Civil Workshop', fee: '₹100', description: 'Truss design and load testing competition. Maximize load-to-weight ratio.' },
  'robo-race': { title: 'Robo Race', dept_slug: 'mech', type: 'Competition', date: '7 Oct', time: '11:00 AM', venue: 'Workshop Ground', fee: '₹150', description: 'All-terrain robotic racing through sharp obstacles and ramps.' },
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
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        const row = rows[0];
        let banners = row.banners || {};
        let prizes = row.prizes || [];

        // Check if envelope JSON was stored in description
        if (typeof row.description === 'string' && row.description.startsWith('{"_meta":true')) {
          try {
            const parsed = JSON.parse(row.description);
            if (parsed.banners) banners = { ...banners, ...parsed.banners };
            if (parsed.prizes) prizes = parsed.prizes;
            if (parsed.text) row.description = parsed.text;
          } catch {}
        }

        return {
          id: row.id,
          title: row.title,
          dept_slug: row.dept_slug || deptSlug,
          type: row.type || 'Event',
          date: row.date || '7 Oct',
          time: row.time || '',
          venue: row.venue || 'Campus',
          fee: row.fee || 'Free',
          description: row.description || '',
          banners,
          prizes,
        };
      }
    }
  } catch (err) {
    console.warn('api/event fetch error:', err.message);
  }

  // 2. Check fallback seed events
  const fallback = SEED_EVENTS[eventId];
  if (fallback) {
    return {
      id: eventId,
      ...fallback,
      dept_slug: fallback.dept_slug || deptSlug,
      banners: {},
      prizes: [],
    };
  }

  return null;
}

export default async function handler(req, res) {
  const query = req.query || {};
  // Handle query params from rewrites or direct URL
  const deptSlug = (query.d || query.dept || query.slug || '').toLowerCase();
  const eventId  = (query.e || query.id || query.eventId || '').trim();

  const host = req.headers['x-forwarded-host'] || req.headers.host || 'tantra26.com';
  const proto = (req.headers['x-forwarded-proto'] || 'https').replace(/:$/, '');
  const baseUrl = `${proto}://${host}`;

  const event = await fetchEventData(deptSlug, eventId);

  // If no event found, fallback to main techfest metadata
  if (!event) {
    const defaultTitle = 'Tantra 26 | National Level Techfest';
    const defaultDesc = 'Tantra 26 — the annual national level techfest at Vimal Jyothi Engineering College. 7-8 October 2026.';
    const defaultBanner = `${baseUrl}/images/banners/default.png`;
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
  <meta property="og:image" content="${defaultBanner}">
  <meta property="og:image:secure_url" content="${defaultBanner}">
  <meta property="og:url" content="${baseUrl}/">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(defaultTitle)}">
  <meta name="twitter:description" content="${escapeHtml(defaultDesc)}">
  <meta name="twitter:image" content="${defaultBanner}">
  <meta http-equiv="refresh" content="0;url=${defaultRedirect}">
</head>
<body>
  <p>Redirecting to <a href="${defaultRedirect}">Tantra 26</a>...</p>
  <script>location.replace(${JSON.stringify(defaultRedirect)});</script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  }

  // Extract metadata details
  const deptName = DEPT_NAMES[event.dept_slug] || 'Tantra 26';
  const b = event.banners || {};
  let customBanner = b.featured_desktop || b.event_desktop || b.featured_mobile || b.event_mobile || '';
  let bannerUrl = '';
  if (customBanner && /^https?:\/\//i.test(customBanner)) {
    bannerUrl = customBanner;
  } else {
    // Serve binary image via /api/banner (handles base64 decoding & department fallback)
    bannerUrl = `${baseUrl}/api/banner?e=${encodeURIComponent(event.id)}&d=${encodeURIComponent(event.dept_slug || deptSlug)}`;
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

  const targetPage = `/event.html?d=${encodeURIComponent(event.dept_slug || deptSlug)}&e=${encodeURIComponent(event.id)}`;
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
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Tantra 26 | National Level Techfest">
  <meta property="og:title" content="${escapeHtml(metaTitle)}">
  <meta property="og:description" content="${escapeHtml(metaDesc)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  ${bannerUrl ? `<meta property="og:image" content="${escapeHtml(bannerUrl)}">
  <meta property="og:image:secure_url" content="${escapeHtml(bannerUrl)}">
  <meta property="og:image:alt" content="${escapeHtml(event.title)} Banner">` : ''}

  <!-- Twitter / X -->
  <meta name="twitter:card" content="${bannerUrl ? 'summary_large_image' : 'summary'}">
  <meta name="twitter:title" content="${escapeHtml(metaTitle)}">
  <meta name="twitter:description" content="${escapeHtml(metaDesc)}">
  ${bannerUrl ? `<meta name="twitter:image" content="${escapeHtml(bannerUrl)}">` : ''}

  <!-- Automatic redirect for humans -->
  <meta http-equiv="refresh" content="0;url=${targetPage}">
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
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
  return res.status(200).send(html);
}

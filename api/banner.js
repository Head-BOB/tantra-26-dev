/**
 * api/banner.js — Dynamic Social Share Banner Image Endpoint
 * Serves real binary JPEG/PNG banner images for Discord, WhatsApp, Twitter, and Facebook.
 * If the event has a custom uploaded banner (including Base64), serves it directly as binary image.
 * If no custom banner exists, serves the official 1200x630 department banner.
 */

import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://hdclbulbjmntzjssynwc.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkY2xidWxiam1udHpqc3N5bndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5Mzg2NzEsImV4cCI6MjEwNjUxNDY3MX0.YWw8Zqxm6iUTZ3j5Fw-LY5_5r6FemkFcX-N_zQar0jA';

function getFallbackBanner(deptSlug) {
  const slug = (deptSlug || 'default').toLowerCase();
  const candidate = path.join(process.cwd(), 'public', 'images', 'banners', `${slug}.png`);
  if (fs.existsSync(candidate)) return candidate;
  return path.join(process.cwd(), 'public', 'images', 'banners', 'default.png');
}

export default async function handler(req, res) {
  const query = req.query || {};
  const eventId = (query.e || query.id || query.eventId || '').trim();
  const deptSlug = (query.d || query.dept || query.slug || '').toLowerCase();

  let bannerRaw = '';

  if (eventId) {
    try {
      const url = `${SUPABASE_URL}/rest/v1/events?id=eq.${encodeURIComponent(eventId)}&select=id,banner,banners,dept_slug,description`;
      const sRes = await fetch(url, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        signal: AbortSignal.timeout(3000),
      });

      if (sRes.ok) {
        const rows = await sRes.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const row = rows[0];
          const b = row.banners || {};
          bannerRaw = b.featured_desktop || b.event_desktop || b.featured_mobile || b.event_mobile || row.banner || '';

          if (!bannerRaw && typeof row.description === 'string' && row.description.startsWith('{"_meta":true')) {
            try {
              const parsed = JSON.parse(row.description);
              if (parsed.banners) {
                bannerRaw = parsed.banners.featured_desktop || parsed.banners.event_desktop || parsed.banners.featured_mobile || parsed.banners.event_mobile || '';
              }
              if (!bannerRaw && parsed.banner) bannerRaw = parsed.banner;
            } catch {}
          }
        }
      }
    } catch (e) {
      console.warn('api/banner fetch error:', e.message);
    }
  }

  // 1. If banner is Base64 data URL
  if (bannerRaw && bannerRaw.startsWith('data:image/')) {
    const match = bannerRaw.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (match) {
      const ext = match[1].toLowerCase();
      const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      const buf = Buffer.from(match[2], 'base64');
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
      return res.status(200).send(buf);
    }
  }

  // 2. If banner is remote HTTP/HTTPS URL
  if (bannerRaw && /^https?:\/\//i.test(bannerRaw)) {
    res.setHeader('Location', bannerRaw);
    return res.status(302).end();
  }

  // 3. Fallback to pre-generated 1200x630 official department banner
  try {
    const fallbackPath = getFallbackBanner(deptSlug);
    if (fs.existsSync(fallbackPath)) {
      const fileBuf = fs.readFileSync(fallbackPath);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
      return res.status(200).send(fileBuf);
    }
  } catch {}

  // Minimal 1x1 transparent pixel if everything else fails
  const transparentPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64'
  );
  res.setHeader('Content-Type', 'image/png');
  return res.status(200).send(transparentPng);
}

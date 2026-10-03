/**
 * api/banner.js — Dynamic Social Share Banner Image Endpoint
 * Serves real binary JPEG/PNG/WebP banner images for Discord, WhatsApp, Twitter, and Facebook.
 * Only serves an image if an actual event banner has been uploaded.
 * If no banner has been uploaded, returns 404 (does NOT show any random placeholders).
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://hdclbulbjmntzjssynwc.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkY2xidWxiam1udHpqc3N5bndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5Mzg2NzEsImV4cCI6MjEwNjUxNDY3MX0.YWw8Zqxm6iUTZ3j5Fw-LY5_5r6FemkFcX-N_zQar0jA';

export default async function handler(req, res) {
  const query = req.query || {};
  let eventId = (query.e || query.id || query.eventId || '').trim();
  if (!eventId && req.url) {
    try {
      const u = new URL(req.url, 'http://localhost');
      eventId = (u.searchParams.get('e') || u.searchParams.get('id') || u.searchParams.get('eventId') || '').trim();
    } catch {}
  }

  let bannerRaw = '';

  if (eventId) {
    try {
      const url = `${SUPABASE_URL}/rest/v1/events?id=eq.${encodeURIComponent(eventId)}&select=id,banner,banners,dept_slug,description`;
      const sRes = await fetch(url, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        signal: AbortSignal.timeout(6000),
      });

      if (sRes.ok) {
        const rows = await sRes.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const row = rows[0];
          const b = row.banners || {};
          // Prioritize normal event banner over featured banner
          bannerRaw = b.event_desktop || row.banner || b.event_mobile || b.featured_desktop || b.featured_mobile || '';

          if (!bannerRaw && typeof row.description === 'string' && row.description.startsWith('{"_meta":true')) {
            try {
              const parsed = JSON.parse(row.description);
              if (parsed.banners) {
                bannerRaw = parsed.banners.event_desktop || parsed.banner || parsed.banners.event_mobile || parsed.banners.featured_desktop || parsed.banners.featured_mobile || '';
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
      res.setHeader('Content-Length', buf.length);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
      return res.status(200).send(buf);
    }
  }

  // 2. If banner is remote HTTP/HTTPS URL
  if (bannerRaw && /^https?:\/\//i.test(bannerRaw)) {
    res.setHeader('Location', bannerRaw);
    return res.status(302).end();
  }

  // 3. No banner uploaded -> return 404 (do not show any random image)
  return res.status(404).send('No banner uploaded');
}

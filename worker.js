// Cloudflare Worker: serves the static site (dist/) and handles the contact form.
// POST /api/contact -> validated here, then emailed by the Google Apps Script web app
// (apps-script/Code.gs). Secrets: GAS_URL (web app URL), GAS_TOKEN (shared token).
const LIMITS = { name: 100, company: 200, email: 200, topic: 100, message: 5000 };

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export function parseInquiry(form) {
  const get = (k) => String(form.get(k) ?? '').trim();
  if (get('website')) return { spam: true }; // honeypot: humans never fill this hidden field
  const d = { name: get('name'), company: get('company'), email: get('email'), topic: get('topic'), message: get('message') };
  for (const [k, max] of Object.entries(LIMITS)) if (d[k].length > max) return { error: `${k} too long` };
  if (!d.name || !d.message) return { error: 'missing fields' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return { error: 'invalid email' };
  if (get('privacy_consent') !== 'yes') return { error: 'consent required' };
  return { data: d };
}

async function handleContact(request, env) {
  // Per-IP limit (3 per minute, see wrangler.jsonc). Skipped if the binding is absent.
  if (env.CONTACT_LIMIT) {
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const { success } = await env.CONTACT_LIMIT.limit({ key: ip });
    if (!success) return json(429, { ok: false, error: 'rate limited' });
  }
  let form;
  try { form = await request.formData(); } catch { return json(400, { ok: false, error: 'bad request' }); }
  const r = parseInquiry(form);
  if (r.spam) return json(200, { ok: true });
  if (r.error) return json(400, { ok: false, error: r.error });

  // Hand off to the Google Apps Script mailer (apps-script/Code.gs). URL and token are Worker secrets.
  if (!env.GAS_URL || !env.GAS_TOKEN) return json(500, { ok: false, error: 'not configured' });
  try {
    const res = await fetch(env.GAS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: env.GAS_TOKEN, ...r.data }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) throw new Error(out.error || `HTTP ${res.status}`);
  } catch (e) {
    console.error('contact send failed', e.message);
    return json(502, { ok: false, error: 'send failed' });
  }
  return json(200, { ok: true });
}

export default {
  // Static files in dist/ are served before this runs; only unmatched paths reach here.
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/contact') {
      if (request.method !== 'POST') return json(405, { ok: false, error: 'method not allowed' });
      return handleContact(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};

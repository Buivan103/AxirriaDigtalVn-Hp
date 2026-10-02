// Cloudflare Worker: serves the static site (dist/) and handles the contact form.
// POST /api/contact -> validated here, then emailed by the Google Apps Script web app
// (apps-script/Code.gs). Secrets: GAS_URL (web app URL), GAS_TOKEN (shared token).
const LIMITS = { name: 100, company: 200, email: 200, topic: 100, message: 5000 };

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Spam signals. Matching messages are dropped silently (the sender still sees "sent").
const MIN_FILL_MS = 3000;          // humans take longer than this to fill the form
const MAX_AGE_MS = 24 * 3600e3;    // stale or replayed timestamps
const LINK_RE = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|info|biz|pro|io|co|xyz|top|site|online|shop|ru|cn)\b/gi;
const SPAM_WORDS = /\b(seo|search index|search results|backlinks?|guest post|link building|rank(?:ing)? on google|casino|crypto|forex|viagra|loan offer)\b/i;
const OWN_DOMAIN = 'axirriadigital.com';

// Drop control characters (keep tab/newline) so nothing odd reaches the email.
const clean = (s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();

export function spamReason(d, ts, now = Date.now()) {
  const t = Number(ts);
  if (!t || now - t < MIN_FILL_MS || now - t > MAX_AGE_MS) return 'timing';
  if ((d.message.match(LINK_RE) || []).length >= 2) return 'links';
  const domain = d.email.split('@')[1].toLowerCase();
  if (domain !== OWN_DOMAIN && domain.includes('axirriadigital')) return 'lookalike domain';
  if (SPAM_WORDS.test(`${d.name} ${d.company} ${d.message}`)) return 'keywords';
  return '';
}

export function parseInquiry(form, now = Date.now()) {
  const get = (k) => clean(String(form.get(k) ?? ''));
  if (get('website')) return { spam: 'honeypot' }; // humans never fill this hidden field
  const d = { name: get('name'), company: get('company'), email: get('email'), topic: get('topic'), message: get('message') };
  for (const [k, max] of Object.entries(LIMITS)) if (d[k].length > max) return { error: `${k} too long` };
  if (!d.name || !d.message) return { error: 'missing fields' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return { error: 'invalid email' };
  if (get('privacy_consent') !== 'yes') return { error: 'consent required' };
  const reason = spamReason(d, get('ts'), now);
  return reason ? { spam: reason } : { data: d };
}

// Optional Cloudflare Turnstile check, active only when the TURNSTILE_SECRET secret is set.
// Returns '' when OK, otherwise Cloudflare's error codes (no secrets) for diagnosis.
async function turnstileError(form, request, env) {
  if (!env.TURNSTILE_SECRET) return '';
  const body = new FormData();
  body.set('secret', env.TURNSTILE_SECRET);
  body.set('response', String(form.get('cf-turnstile-response') || ''));
  body.set('remoteip', request.headers.get('cf-connecting-ip') || '');
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const out = await r.json().catch(() => ({}));
  if (out.success === true) return '';
  const codes = (out['error-codes'] || []).join(',') || `HTTP ${r.status}`;
  console.error('turnstile failed:', codes);
  return codes;
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
  const captcha = await turnstileError(form, request, env);
  if (captcha) return json(400, { ok: false, error: 'captcha failed', codes: captcha });
  const r = parseInquiry(form);
  if (r.spam) { console.log('contact spam dropped:', r.spam); return json(200, { ok: true }); }
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

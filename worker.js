// Cloudflare Worker: serves the static site (dist/) and handles the contact form.
// POST /api/contact -> emails the inquiry to the addresses in the CONTACT_TO secret
// (comma-separated, each must be a verified Email Routing destination).
const FROM = { email: 'noreply@axirriadigital.com', name: 'Axirria Digital Vietnam Website' };
const LIMITS = { name: 100, company: 200, email: 200, topic: 100, message: 5000 };

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const oneLine = (s) => s.replace(/[\r\n]+/g, ' ').trim();
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

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

  const d = r.data;
  const to = String(env.CONTACT_TO || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!to.length) return json(500, { ok: false, error: 'not configured' });

  const rows = [['お名前 / Name', d.name], ['会社名 / Company', d.company || '-'], ['メール / Email', d.email],
    ['ご相談内容 / Topic', d.topic || '-'], ['メッセージ / Message', d.message]];
  try {
    await env.EMAIL.send({
      from: FROM,
      to,
      replyTo: { email: d.email, name: oneLine(d.name) },
      subject: oneLine(`[Webお問い合わせ] ${d.topic || 'お問い合わせ'} - ${d.name}`),
      text: rows.map(([k, v]) => `${k}: ${v}`).join('\n\n'),
      html: '<table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif">' +
        rows.map(([k, v]) => `<tr><th align="left" valign="top" style="white-space:nowrap">${esc(k)}</th><td style="white-space:pre-wrap">${esc(v)}</td></tr>`).join('') +
        '</table>',
    });
  } catch (e) {
    console.error('contact send failed', e.code, e.message);
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

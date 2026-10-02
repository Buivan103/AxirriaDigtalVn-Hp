// Run: node worker.test.mjs
import assert from 'node:assert/strict';
import worker, { parseInquiry } from './worker.js';

const fd = (o) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const NOW = 1_800_000_000_000;
const human = String(NOW - 20_000); // form opened 20s earlier
const ok = { name: 'Taro', email: 'taro@example.jp', message: 'Hello, please see our site example.co.jp', privacy_consent: 'yes', topic: 'Munemo', ts: human };
const parse = (o) => parseInquiry(fd(o), NOW);

// validation
assert.equal(parse(ok).data.name, 'Taro');
assert.equal(parse({ ...ok, email: 'nope' }).error, 'invalid email');
assert.equal(parse({ ...ok, privacy_consent: '' }).error, 'consent required');
assert.equal(parse({ ...ok, message: 'x'.repeat(5001) }).error, 'message too long');
assert.equal(parse({ ...ok, name: 'Ta\u0000ro\u0007' }).data.name, 'Taro', 'control chars stripped');

// spam signals
assert.equal(parse({ ...ok, website: 'x' }).spam, 'honeypot');
assert.equal(parse({ ...ok, ts: '' }).spam, 'timing', 'direct API post without the form');
assert.equal(parse({ ...ok, ts: String(NOW - 1000) }).spam, 'timing', 'filled in 1s');
assert.equal(parse({ ...ok, ts: String(NOW - 3 * 86400e3) }).spam, 'timing', 'stale timestamp');
assert.equal(parse({ ...ok, message: 'see https://a.com and https://b.com' }).spam, 'links');
assert.equal(parse({ ...ok, email: 'x@search-axirriadigital.com' }).spam, 'lookalike domain');
assert.equal(parse({ ...ok, email: 'duy@axirriadigital.com' }).data.email, 'duy@axirriadigital.com', 'own domain is fine');
assert.equal(parse({ ...ok, message: 'We offer SEO services' }).spam, 'keywords');
// the real spam received on 2026-10
const real = { name: 'Alan McCafferty', company: 'Alan McCafferty', email: 'domains@search-axirriadigital.com', privacy_consent: 'yes', ts: human,
  message: "Hey\n\nFeature axirriadigital.com in Google's Search Index and have it appear in Google search results!\n\nRegister axirriadigital.com now: indexhelper.pro" };
assert.ok(parse(real).spam, 'real spam sample is caught');

// hand-off to the Apps Script mailer (global fetch is stubbed)
const calls = [];
let gasReply = { ok: true };
let turnstile = { success: true };
globalThis.fetch = async (url, init) => {
  if (String(url).includes('turnstile')) return new Response(JSON.stringify(turnstile));
  calls.push({ url, body: JSON.parse(init.body) });
  return new Response(JSON.stringify(gasReply));
};
const env = { GAS_URL: 'https://script.example/exec', GAS_TOKEN: 't0k', ASSETS: { fetch: () => new Response('asset') } };
const post = (o, e = env) => worker.fetch(new Request('https://s/api/contact', { method: 'POST', body: fd({ ...o, ts: String(Date.now() - 20_000) }) }), e);

assert.equal((await post(ok)).status, 200);
assert.equal(calls[0].url, env.GAS_URL);
assert.equal(calls[0].body.token, 't0k');
assert.equal((await post({ ...ok, website: 'bot' })).status, 200); assert.equal(calls.length, 1, 'honeypot not forwarded');
assert.equal((await post(real)).status, 200); assert.equal(calls.length, 1, 'spam answered 200 but not forwarded');
assert.equal((await post({ ...ok, email: 'bad' })).status, 400); assert.equal(calls.length, 1, 'invalid not forwarded');
gasReply = { ok: false, error: 'unauthorized' };
assert.equal((await post(ok)).status, 502, 'mailer failure surfaces as 502');
gasReply = { ok: true };
assert.equal((await post(ok, { ...env, GAS_URL: '' })).status, 500, 'missing config');

// optional Turnstile
const withTs = { ...env, TURNSTILE_SECRET: 's' };
turnstile = { success: false };
const before = calls.length;
assert.equal((await post(ok, withTs)).status, 400); assert.equal(calls.length, before, 'captcha failure not forwarded');
turnstile = { success: true };
assert.equal((await post(ok, withTs)).status, 200);

// rate limit: blocked requests get 429 and forward nothing
const n = calls.length;
const limited = { ...env, CONTACT_LIMIT: { limit: async () => ({ success: false }) } };
assert.equal((await post(ok, limited)).status, 429); assert.equal(calls.length, n);

// routing
assert.equal((await worker.fetch(new Request('https://s/api/contact'), env)).status, 405);
assert.equal(await (await worker.fetch(new Request('https://s/'), env)).text(), 'asset');
console.log('worker tests passed');

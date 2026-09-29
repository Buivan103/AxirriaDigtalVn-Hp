// Run: node worker.test.mjs
import assert from 'node:assert/strict';
import worker, { parseInquiry } from './worker.js';

const fd = (o) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const ok = { name: 'Taro', email: 'taro@example.jp', message: 'Hello', privacy_consent: 'yes', topic: 'Munemo' };

// validation
assert.equal(parseInquiry(fd(ok)).data.name, 'Taro');
assert.equal(parseInquiry(fd({ ...ok, website: 'x' })).spam, true);
assert.equal(parseInquiry(fd({ ...ok, email: 'nope' })).error, 'invalid email');
assert.equal(parseInquiry(fd({ ...ok, privacy_consent: '' })).error, 'consent required');
assert.equal(parseInquiry(fd({ ...ok, message: 'x'.repeat(5001) })).error, 'message too long');

// hand-off to the Apps Script mailer (global fetch is stubbed)
const calls = [];
let gasReply = { ok: true };
globalThis.fetch = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return new Response(JSON.stringify(gasReply)); };
const env = { GAS_URL: 'https://script.example/exec', GAS_TOKEN: 't0k', ASSETS: { fetch: () => new Response('asset') } };
const post = (o, e = env) => worker.fetch(new Request('https://s/api/contact', { method: 'POST', body: fd(o) }), e);

assert.equal((await post(ok)).status, 200);
assert.equal(calls[0].url, env.GAS_URL);
assert.equal(calls[0].body.token, 't0k');
assert.equal(calls[0].body.email, 'taro@example.jp');
assert.equal((await post({ ...ok, website: 'bot' })).status, 200); assert.equal(calls.length, 1, 'honeypot not forwarded');
assert.equal((await post({ ...ok, email: 'bad' })).status, 400); assert.equal(calls.length, 1, 'invalid not forwarded');
gasReply = { ok: false, error: 'unauthorized' };
assert.equal((await post(ok)).status, 502, 'mailer failure surfaces as 502');
assert.equal((await post(ok, { ...env, GAS_URL: '' })).status, 500, 'missing config');

// rate limit: blocked requests get 429 and forward nothing
const before = calls.length;
const limited = { ...env, CONTACT_LIMIT: { limit: async () => ({ success: false }) } };
assert.equal((await post(ok, limited)).status, 429); assert.equal(calls.length, before);

// routing
assert.equal((await worker.fetch(new Request('https://s/api/contact'), env)).status, 405);
assert.equal(await (await worker.fetch(new Request('https://s/'), env)).text(), 'asset');
console.log('worker tests passed');

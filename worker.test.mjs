// Run: node worker.test.mjs
import assert from 'node:assert/strict';
import worker, { parseInquiry } from './worker.js';

const fd = (o) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const ok = { name: 'Taro', email: 'taro@example.jp', message: 'Hello', privacy_consent: 'yes', topic: 'Munemo' };

assert.deepEqual(parseInquiry(fd(ok)).data.name, 'Taro');
assert.equal(parseInquiry(fd({ ...ok, website: 'x' })).spam, true);
assert.equal(parseInquiry(fd({ ...ok, email: 'nope' })).error, 'invalid email');
assert.equal(parseInquiry(fd({ ...ok, privacy_consent: '' })).error, 'consent required');
assert.equal(parseInquiry(fd({ ...ok, message: 'x'.repeat(5001) })).error, 'message too long');

const sent = [];
const env = { CONTACT_TO: 'a@x.com, b@y.com', EMAIL: { send: async (m) => sent.push(m) }, ASSETS: { fetch: () => new Response('asset') } };
const post = (o) => worker.fetch(new Request('https://s/api/contact', { method: 'POST', body: fd(o) }), env);

assert.equal((await post({ ...ok, name: 'Taro\r\nBcc: evil@x.com' })).status, 200);
assert.deepEqual(sent[0].to, ['a@x.com', 'b@y.com']);
assert.equal(sent[0].replyTo.email, 'taro@example.jp');
assert.ok(!/[\r\n]/.test(sent[0].subject), 'no header injection via subject');
assert.equal((await post({ ...ok, website: 'bot' })).status, 200); assert.equal(sent.length, 1, 'honeypot not sent');
assert.equal((await post({ ...ok, email: 'bad' })).status, 400);
assert.equal((await worker.fetch(new Request('https://s/api/contact'), env)).status, 405);
assert.equal(await (await worker.fetch(new Request('https://s/'), env)).text(), 'asset');
console.log('worker tests passed');

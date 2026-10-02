// Renders src/*.html into static pages per language so the text is in the HTML
// (search engines, link previews, no-JS). Run: node build.js
const fs = require('fs');
const path = require('path');

const cfg = JSON.parse(fs.readFileSync('site.config.json', 'utf8'));
const I18N = new Function(fs.readFileSync('i18n.js', 'utf8') + ';return I18N;')();
const LANGS = { ja: { dir: '', og: 'ja_JP' }, en: { dir: 'en/', og: 'en_US' } };
const PAGES = [
  { src: 'src/index.html', dir: '', title: 'meta.title' },
  { src: 'src/privacy.html', dir: 'privacy/', title: 'pp.title' },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function render(page, lang) {
  const dict = I18N[lang];
  // Every page is a directory index (clean URLs like /en/privacy/), so links are dir-relative.
  const here = LANGS[lang].dir + page.dir;
  const base = '../'.repeat(here.split('/').filter(Boolean).length);
  const url = (l, dir = page.dir) => cfg.siteUrl + LANGS[l].dir + dir;
  const rel = (to) => (path.posix.relative('/' + here, '/' + to) || '.') + '/';
  const title = page.dir ? dict[page.title] + (lang === 'ja' ? '｜' : ' | ') + 'Axirria Digital Vietnam' : dict['meta.title'];

  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(dict['meta.desc'])}">`,
    `<link rel="canonical" href="${url(lang)}">`,
    `<link rel="alternate" hreflang="ja" href="${url('ja')}">`,
    `<link rel="alternate" hreflang="en" href="${url('en')}">`,
    `<link rel="alternate" hreflang="x-default" href="${url('ja')}">`,
    `<link rel="icon" href="${base}logo-mark.svg" type="image/svg+xml">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Axirria Digital Vietnam">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(dict['meta.desc'])}">`,
    `<meta property="og:url" content="${url(lang)}">`,
    `<meta property="og:image" content="${cfg.siteUrl}og.png">`,
    `<meta property="og:locale" content="${LANGS[lang].og}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].join('\n');

  const langSwitch = Object.keys(LANGS).map((l) =>
    `<a href="${rel(LANGS[l].dir + page.dir)}" hreflang="${l}" lang="${l}"${l === lang ? ' aria-current="true"' : ''}>${l === 'ja' ? '日本語' : 'EN'}</a>`
  ).join('');

  // Smallest-team size from site.config.json `plan` (no prices are published on the site).
  // Cloudflare Turnstile widget, only when a site key is configured.
  const turnstile = cfg.turnstileSiteKey
    ? `<div class="cf-turnstile" data-sitekey="${esc(cfg.turnstileSiteKey)}" data-language="${lang}" data-callback="axTurnstile" data-expired-callback="axTurnstile" data-error-callback="axTurnstile"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
    : '';
  const vars = { lang, base, head, langSwitch, turnstile, 'plan.hours': cfg.plan.devHoursPerMonth, homeHref: rel(LANGS[lang].dir), privacyHref: rel(LANGS[lang].dir + 'privacy/') };
  for (const [k, v] of Object.entries(cfg)) if (typeof v !== 'object') vars['cfg.' + k] = v;

  let html = fs.readFileSync(page.src, 'utf8');
  // Fill empty elements marked data-i18n="key"; textarea content is escaped.
  html = html.replace(/<(\w+)([^>]*?)\sdata-i18n="([^"]+)"([^>]*)><\/\1>/g, (m, tag, a, key, b) => {
    if (dict[key] == null) throw new Error(`${lang}: missing key ${key}`);
    return `<${tag}${a}${b}>${tag === 'textarea' ? esc(dict[key]) : dict[key]}</${tag}>`;
  });
  html = html.replace(/\sdata-i18n-label="([^"]+)"/g, (m, key) => ` aria-label="${esc(dict[key])}"`);
  // Two passes: copy may itself contain {{privacyHref}} / {{cfg.email}}.
  for (let i = 0; i < 2; i++) {
    html = html.replace(/\{\{([\w.]+)\}\}/g, (m, k) => {
      if (vars[k] == null) throw new Error(`${lang}: unknown placeholder ${k}`);
      return vars[k];
    });
  }
  if (/data-i18n=|\{\{/.test(html)) throw new Error(`${page.src} (${lang}): unrendered markers left`);
  return html;
}

// Everything the site serves goes to dist/ (the deploy folder); sources stay out of it.
const OUT = 'dist';
const ASSETS = ['style.css', 'main.js', 'i18n.js', 'logo-mark.svg', 'og.png'];
fs.rmSync(OUT, { recursive: true, force: true });
for (const page of PAGES) {
  for (const lang of Object.keys(LANGS)) {
    const out = path.join(OUT, LANGS[lang].dir, page.dir, 'index.html');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, render(page, lang));
    console.log('wrote', out);
  }
}
for (const f of ASSETS) fs.copyFileSync(f, path.join(OUT, f));
console.log('copied', ASSETS.join(', '));

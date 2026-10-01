# Axirria Digital Vietnam — Home page

Static site, Japanese at `/` and English at `/en/`. Pages are pre-rendered so the text is in the HTML (SEO, link previews).

## Files
- `src/index.html`, `src/privacy.html` — page templates (`data-i18n="key"` + `{{placeholders}}`)
- `i18n.js` — all copy, JA and EN. Also loaded at runtime for demo/form messages.
- `site.config.json` — site URL, email, form endpoint, Munemo link
- `style.css`, `main.js` — shared styles and interactions
- `worker.js` — Cloudflare Worker: serves `dist/` and handles the contact form at `POST /api/contact` (test: `node worker.test.mjs`)
- `build.js` — writes the deployable site to `dist/` (pages for JA/EN + assets). `dist/` is not committed.
- `og.png` — share image, rendered from `src/og.html`
- `logo-mark.svg` — favicon; `logo-options/` — logo exploration (not linked; delete before launch if not needed)

## Edit and build
Edit `src/*`, `i18n.js` or `site.config.json`, then:

```bash
node build.js
```

Never edit files in `dist/` directly.

Preview: `python3 -m http.server 8765 -d dist` → http://localhost:8765/

Regenerate `og.png` after changing the headline (serve the repo root, e.g. `python3 -m http.server 8765`):

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1200,630 --virtual-time-budget=5000 --screenshot="$PWD/og.png" http://localhost:8765/src/og.html
```

## Before going live
- `site.config.json`: real `email`, `formEndpoint` (`/api/contact`, handled by `worker.js`), the final `siteUrl` (used for canonical, hreflang and OGP), and `munemoUrl` (currently axirria.co.jp until Munemo has its own page).
- `i18n.js` `cs.1` / `cs.2`: the case studies are **samples** (tagged サンプル事例). Replace with real, approved cases or remove the section from `src/index.html`.
- `i18n.js` `pp.body`: privacy policy is a template — have it reviewed (Vietnam Decree 13/2023/ND-CP, Japan APPI).
- `i18n.js` `nw.items`: news list.
- `site.config.json` `plan.devHoursPerMonth`: engineer hours in the smallest team (used in the pricing block and FAQ). Prices are intentionally not published; quotes go through email/contact form.
- `i18n.js` `faq.items`: FAQ answers (team size, review, security, small projects) — confirm they match how you actually work.

## Deploy (Cloudflare Workers)
Workers & Pages → Create → Import a repository → this repo.
- Build command: `node build.js`
- Deploy command: `npx wrangler deploy` (uses `wrangler.jsonc`: `worker.js` + static assets from `dist/`)

Then Settings → Domains & Routes → add `axirriadigital.com` and `www.axirriadigital.com`. Every push to `main` redeploys.

### Contact form email
The form posts to `/api/contact`; `worker.js` validates it (honeypot, per-IP rate limit) and forwards it to a Google Apps Script web app (`apps-script/Code.gs`), which sends the email from the Workspace account.
1. script.google.com → New project → paste `apps-script/Code.gs`.
2. Project Settings → Script properties: `TOKEN` (random string) and `RECIPIENTS` (e.g. `duy@axirriadigital.com,tsuchida@axirriadigital.com`).
3. Deploy → New deployment → Web app, Execute as **Me**, Who has access **Anyone** → copy the `/exec` URL.
4. Worker → Settings → Variables and Secrets: secret `GAS_URL` = that URL, secret `GAS_TOKEN` = same value as `TOKEN`.

Recipients are addressed directly (not the `contact@` group) because Gmail hides group copies of mail sent by the account running the script.

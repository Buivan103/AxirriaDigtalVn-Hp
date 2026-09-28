# Axirria Digital Vietnam — Home page

Static site, Japanese at `/` and English at `/en/`. Pages are pre-rendered so the text is in the HTML (SEO, link previews).

## Files
- `src/index.html`, `src/privacy.html` — page templates (`data-i18n="key"` + `{{placeholders}}`)
- `i18n.js` — all copy, JA and EN. Also loaded at runtime for demo/form messages.
- `site.config.json` — site URL, email, form endpoint, Munemo link
- `style.css`, `main.js` — shared styles and interactions
- `build.js` — writes `index.html`, `en/index.html`, `privacy.html`, `en/privacy.html`
- `og.png` — share image, rendered from `src/og.html`
- `logo-mark.svg` — favicon; `logo-options/` — logo exploration (not linked; delete before launch if not needed)

## Edit and build
Edit `src/*`, `i18n.js` or `site.config.json`, then:

```bash
node build.js
```

Never edit the generated `index.html` / `en/` / `privacy.html` directly.

Preview: `python3 -m http.server 8765` → http://localhost:8765/

Regenerate `og.png` after changing the headline (server running):

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1200,630 --virtual-time-budget=5000 --screenshot="$PWD/og.png" http://localhost:8765/src/og.html
```

## Before going live
- `site.config.json`: real `email`, `formEndpoint` (Formspree form ID or your own API), the final `siteUrl` (used for canonical, hreflang and OGP), and `munemoUrl` (currently axirria.co.jp until Munemo has its own page).
- `i18n.js` `cs.1` / `cs.2`: the case studies are **samples** (tagged サンプル事例). Replace with real, approved cases or remove the section from `src/index.html`.
- `i18n.js` `pp.body`: privacy policy is a template — have it reviewed (Vietnam Decree 13/2023/ND-CP, Japan APPI).
- `i18n.js` `nw.items`: news list.

Deploy: any static host. GitHub Pages → Settings › Pages › branch `main`, root.

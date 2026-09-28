# Axirria Digital Vietnam — Home page

Static landing page (JP / EN). No build step.

- `index.html` — layout + styles + language switch + contact form
- `i18n.js` — all copy, keyed by `data-i18n`. Add a language = add a new object.

Run locally: `python3 -m http.server` then open http://localhost:8000 (`?lang=en` / `?lang=ja`).

## Before going live
- Company info in `co.info` is **mock** — replace in `i18n.js`.
- Email / Zalo links are mock — edit in `index.html` (Contact section).
- Web form posts to Formspree: replace `YOUR_FORM_ID` in the form `action`, or point it at your own endpoint.

Deploy: any static host (GitHub Pages → Settings › Pages › branch `main`).

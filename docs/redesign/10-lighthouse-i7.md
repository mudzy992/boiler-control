# Lighthouse Q8 — I7 baseline

Datum: 2026-11-07.

## Method

- Build: `VITE_API_URL=https://api.boiler-control.ba101.top/api npm run build`
- Serve: `vite preview --host 127.0.0.1 --port 4173`
- Tool: Lighthouse CLI (headless Chrome), categories: performance, accessibility, best-practices, seo
- URL: `http://127.0.0.1:4173/login`

## Scores (login)

| Category | Score |
|---|---|
| Performance | 100 |
| Accessibility | 88 |
| Best Practices | 96 |
| SEO | 82 |

## Protected route

**Skipped — no session** available in this CI/local baseline run (per `open-questions.md` Q8). Measure a protected route in a later session when an authenticated preview exists.

## Notes

- Post-I7 bundle has no `vendor-antd` / `vendor-plots` chunks.
- Accessibility 88 and SEO 82 are baseline; polish outside I7 acceptance if needed.

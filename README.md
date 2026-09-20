# 點一下 (MindTouch)

揀一個你現在的處境，隨機收到一句鼓勵。Mobile-first static site, no backend, no analytics.

## Stack

- Vite + React + TypeScript
- PWA (installable, works offline) via `vite-plugin-pwa`
- Data: `data/quotes.csv` → `scripts/build-data.mjs` → `src/data/quotes.json` (generated, git-ignored)

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build   # regenerates data, type-checks, outputs dist/
```

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds and deploys on every push to `main` (or the current default branch).

One-time setup: repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.

The site is served on a custom domain (see `public/CNAME`), so the build uses base `/`.
To publish at `https://isaachoo.github.io/MindTouch/` instead, set `VITE_BASE=/MindTouch/` in the workflow.

## Deploy (Cloudflare Pages, custom domain)

Connect the repo in Cloudflare Pages with:

- Build command: `npm run build`
- Build output directory: `dist`
- Node version: 22 (environment variable `NODE_VERSION=22`)

Default base is `/`, so no extra settings are needed for a custom domain.

## Updating quotes

Edit `data/quotes.csv` and push. Required columns: `quote_id`, `category_id`, `category_zh_hant`,
`psychological_need_zh_hant`, `quote_direction_zh_hant`, `original_language`, `quote_original`,
`quote_zh_hant`, `author_zh_hant`, `author_en`, `speaker`, `source_title`, `source_location`, `source_url`.
One quote may appear under several categories; it is de-duplicated at build time.

## 「多說一點」 (AI explanation)

The quote screen has a 多說一點 button that asks an LLM for a short, positive explanation
linking the quote to the chosen situation. The request goes to a Cloudflare Worker in
`worker/`, which holds the OpenRouter key as a secret and calls
`deepseek/deepseek-v4.1-flash` (configurable via `MODEL` in `worker/wrangler.toml`).
Responses are cached per (quote, situation) for 7 days.

Deployment is automatic via `.github/workflows/worker.yml`. It needs three GitHub Actions
secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `OPENROUTER_API_KEY`.
The site calls `https://api.mt.ohcasi.com` by default (override with `VITE_EXPLAIN_URL`);
attach that custom domain to the Worker once in the Cloudflare dashboard.

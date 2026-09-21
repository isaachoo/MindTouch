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
`deepseek/deepseek-v4-flash-0731` (configurable via `MODEL` in `worker/wrangler.toml`).
Responses are cached per (quote, situation) for 7 days.

Deployment is automatic via `.github/workflows/worker.yml`. It needs three GitHub Actions
secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `OPENROUTER_API_KEY`.
The site calls `https://mt-api.ohcasi.com` by default (override with `VITE_EXPLAIN_URL`);
attach that custom domain to the Worker once in the Cloudflare dashboard.

## 照顧者・點一下 (`/carer/`)

A separate app for carers of elderly people in Hong Kong, served at `https://mt.ohcasi.com/carer/`
with its own name, icon, manifest and 口語 UI. Entry: `carer/index.html` → `src/carer/`.
It shares only the design tokens (`src/styles.css`), the install hook and the loading component.

- **Part 1 想打打氣**: 10 feelings → one random quote from `data/carer_quotes.csv` (built to
  `src/carer/data/quotes.json`) → optional 多講一點 (Worker `POST /carer/explain`, 口語 listener prompt).
- **Part 2 想搵資源**: 12 needs (`src/carer/needs.ts`) → live listings from the carers.hk directory via the
  Worker (`GET /carer/services?need=H04&area=534`), de-duplicated across categories and cached 24 h.
  Every screen also deep-links to the pre-filtered carers.hk page as a fallback. District choice is remembered.
- Hotline 182 183 is shown on home, the needs list and every results page.

carers.hk has no documented API; the Worker calls the same `POST /zh_hk/ajax/map` endpoint the site uses
(`aduience[]`, `type[]`, `type5[]`, `area[]`, `page`). IDs are configured in `src/carer/needs.ts`.
Results always carry the source line 「資料來源：照顧者資訊網 carers.hk」 and link back to the unit page.

## Exporting the carers.hk directory to CSV

`scripts/scrape_carers.py` (standard library only) walks every audience/category of the
carers.hk directory, pages through results and writes one row per unit with all the
categories it appears under.

```bash
python3 scripts/scrape_carers.py                       # -> carers_hk_services.csv
python3 scripts/scrape_carers.py --subcategories       # also query type5 filters
python3 scripts/scrape_carers.py --details             # also fetch each unit page (detail_text column)
python3 scripts/scrape_carers.py --long -o rows.csv    # one row per (unit, category)
```

Default 1 s between requests. Category and district IDs live at the top of the script.

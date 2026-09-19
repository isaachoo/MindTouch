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

Site URL: `https://isaachoo.github.io/MindTouch/`

The site is built with `base: '/MindTouch/'`. For a custom domain at the root, build with `VITE_BASE=/`.

## Updating quotes

Edit `data/quotes.csv` and push. Required columns: `quote_id`, `category_id`, `category_zh_hant`,
`psychological_need_zh_hant`, `quote_direction_zh_hant`, `original_language`, `quote_original`,
`quote_zh_hant`, `author_zh_hant`, `author_en`, `speaker`, `source_title`, `source_location`, `source_url`.
One quote may appear under several categories; it is de-duplicated at build time.

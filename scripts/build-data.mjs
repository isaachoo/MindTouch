// Converts data/quotes.csv into a slim JSON the site ships.
// Quotes are de-duplicated (one quote can belong to several situations).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parse } from 'csv-parse/sync';

const csv = readFileSync('data/quotes.csv', 'utf8').replace(/^﻿/, '');
const rows = parse(csv, { columns: true, skip_empty_lines: true });

const categories = new Map();
const quotes = new Map();

for (const r of rows) {
  if (!categories.has(r.category_id)) {
    categories.set(r.category_id, {
      id: r.category_id,
      label: r.category_zh_hant,
      need: r.psychological_need_zh_hant,
      direction: r.quote_direction_zh_hant,
    });
  }
  let q = quotes.get(r.quote_id);
  if (!q) {
    q = {
      id: r.quote_id,
      zh: r.quote_zh_hant,
      orig: r.quote_original,
      lang: r.original_language === 'English' ? 'en' : 'zh-classical',
      author: r.author_zh_hant,
      authorEn: r.author_en,
      speaker: r.speaker,
      source: r.source_title,
      location: r.source_location,
      url: r.source_url,
      cats: [],
    };
    quotes.set(r.quote_id, q);
  }
  if (!q.cats.includes(r.category_id)) q.cats.push(r.category_id);
}

const out = {
  categories: [...categories.values()].sort((a, b) => a.id.localeCompare(b.id)),
  quotes: [...quotes.values()],
};

mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/quotes.json', JSON.stringify(out));
console.log(`categories: ${out.categories.length}, quotes: ${out.quotes.length}, rows: ${rows.length}`);

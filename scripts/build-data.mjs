// Converts data/quotes.csv into a slim JSON the site ships.
// Quotes are de-duplicated (one quote can belong to several situations).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parse } from 'csv-parse/sync';

// Usage: node scripts/build-data.mjs [input.csv] [output.json]
const [, , input = 'data/quotes.csv', output = 'src/data/quotes.json'] = process.argv;
const csv = readFileSync(input, 'utf8').replace(/^\uFEFF/, '');
const rows = parse(csv, { columns: true, skip_empty_lines: true });

const REQUIRED = [
  'quote_id', 'category_id', 'category_zh_hant', 'psychological_need_zh_hant', 'quote_direction_zh_hant',
  'original_language', 'quote_original', 'quote_zh_hant', 'author_zh_hant', 'source_title',
];
const errors = [];
const categories = new Map();
const quotes = new Map();
const seenPairs = new Set();

rows.forEach((r, i) => {
  const line = i + 2;
  for (const k of REQUIRED) if (!r[k] || !r[k].trim()) errors.push(`line ${line}: empty ${k}`);
  if (!/^C\d{2}$/.test(r.category_id)) errors.push(`line ${line}: bad category_id "${r.category_id}"`);
  const pair = `${r.quote_id}|${r.category_id}`;
  if (seenPairs.has(pair)) errors.push(`line ${line}: duplicate row for ${pair}`);
  seenPairs.add(pair);
});

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
      lang: /^English/i.test(r.original_language) ? 'en' : 'zh-classical',
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
  if (q.zh !== r.quote_zh_hant) errors.push(`quote_id ${r.quote_id} reused with different text`);
  if (categories.get(r.category_id).label !== r.category_zh_hant) {
    errors.push(`${r.category_id} label "${r.category_zh_hant}" differs from "${categories.get(r.category_id).label}"`);
  }
}
if (errors.length) {
  console.error(`${input} has ${errors.length} problem(s):\n  ` + errors.slice(0, 20).join('\n  '));
  process.exit(1);
}

const out = {
  categories: [...categories.values()].sort((a, b) => a.id.localeCompare(b.id)),
  quotes: [...quotes.values()],
};

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(out));
console.log(`${input} -> ${output}: categories ${out.categories.length}, quotes ${out.quotes.length}, rows ${rows.length}`);

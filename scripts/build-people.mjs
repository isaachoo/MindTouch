// Converts data/people.csv (source of truth for the 古人 tab) into the JSON the site and Worker import.
// Rows are sorted by birth year and numbered 1..n; ids are only stable between builds of the same CSV.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parse } from 'csv-parse/sync';

const [, , input = 'data/people.csv', output = 'src/people/people.json'] = process.argv;
const rows = parse(readFileSync(input, 'utf8').replace(/^﻿/, ''), { columns: true, skip_empty_lines: true });

const errors = [];
const seen = new Set();
const people = rows.map((r, i) => {
  const line = i + 2;
  const b = Number(r.birth_year);
  const d = Number(r.death_year);
  if (!r.name_zh?.trim() || !r.name_en?.trim()) errors.push(`line ${line}: missing name`);
  if (!Number.isInteger(b) || !Number.isInteger(d) || d < b) errors.push(`line ${line}: bad years ${r.birth_year}–${r.death_year}`);
  if (seen.has(r.name_zh)) errors.push(`line ${line}: duplicate ${r.name_zh}`);
  seen.add(r.name_zh);
  return { zh: r.name_zh, en: r.name_en, b, d, region: r.region_zh, field: r.field_zh, note: r.note_zh };
});
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
people.sort((a, b) => a.b - b.b || a.d - b.d);
const out = people.map((p, i) => ({ id: i + 1, ...p }));
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(out));
console.log(`people: ${out.length} -> ${output}`);

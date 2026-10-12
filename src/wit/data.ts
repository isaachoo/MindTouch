import raw from './data/quotes.json';
import type { Category, Quote as BaseQuote } from '../data';

export type { Category };
export interface Quote extends BaseQuote {
  note?: string;
}

const data = raw as { categories: Category[]; quotes: Quote[] };

export const situations: Category[] = data.categories;

const byCategory = new Map<string, Quote[]>();
for (const q of data.quotes) {
  for (const c of q.cats) {
    const list = byCategory.get(c) ?? [];
    list.push(q);
    byCategory.set(c, list);
  }
}

export function findSituation(id: string): Category | undefined {
  return situations.find((c) => c.id === id);
}

export function randomQuote(categoryId: string): Quote | undefined {
  const pool = byCategory.get(categoryId);
  if (!pool || pool.length === 0) return undefined;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return pool[buf[0] % pool.length];
}

import raw from './data/quotes.json';

export interface Category {
  id: string;
  label: string;
  need: string;
  direction: string;
}

export interface Quote {
  id: string;
  zh: string;
  orig: string;
  lang: 'en' | 'zh-classical';
  author: string;
  authorEn: string;
  speaker: string;
  source: string;
  location: string;
  url: string;
  cats: string[];
}

const data = raw as { categories: Category[]; quotes: Quote[] };

export const categories: Category[] = data.categories;

const byCategory = new Map<string, Quote[]>();
for (const q of data.quotes) {
  for (const c of q.cats) {
    const list = byCategory.get(c) ?? [];
    list.push(q);
    byCategory.set(c, list);
  }
}

export function findCategory(id: string): Category | undefined {
  return categories.find((c) => c.id === id);
}

export function randomQuote(categoryId: string): Quote | undefined {
  const pool = byCategory.get(categoryId);
  if (!pool || pool.length === 0) return undefined;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return pool[buf[0] % pool.length];
}

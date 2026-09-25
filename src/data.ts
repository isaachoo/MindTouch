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

/** The "點亮今天" pool. It is a category in the data but never shown in the situation list. */
export const DAILY_ID = 'C17';
export const situations: Category[] = categories.filter((c) => c.id !== DAILY_ID);
export const dailyCategory: Category | undefined = categories.find((c) => c.id === DAILY_ID);

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

/**
 * The theme to show as "今天的方向". Prefer forward-looking situations; the heavy ones
 * (loss, illness, money trouble) never label an ordinary day.
 */
const DIRECTION_ORDER = ['C02', 'C03', 'C05', 'C06', 'C07', 'C08', 'C12', 'C14', 'C15', 'C16', 'C01', 'C04', 'C13'];
export function directionFor(q: Quote): string {
  const id = DIRECTION_ORDER.find((c) => q.cats.includes(c));
  const cat = id ? categories.find((c) => c.id === id) : undefined;
  return cat?.need ?? '欣賞日常';
}

export function randomQuote(categoryId: string): Quote | undefined {
  const pool = byCategory.get(categoryId);
  if (!pool || pool.length === 0) return undefined;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return pool[buf[0] % pool.length];
}

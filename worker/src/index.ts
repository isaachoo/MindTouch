// Cloudflare Worker: turns a (quote, situation) pair into a short, positive
// explanation via OpenRouter. The API key lives only here, as a secret.
import data from '../../src/data/quotes.json';

interface Env {
  OPENROUTER_API_KEY: string;
  MODEL: string;
  ALLOWED_ORIGINS: string;
}

interface Category {
  id: string;
  label: string;
  need: string;
  direction: string;
}
interface Quote {
  id: string;
  zh: string;
  orig: string;
  lang: string;
  author: string;
  source: string;
  cats: string[];
}

const categories = new Map<string, Category>((data.categories as Category[]).map((c) => [c.id, c]));
const quotes = new Map<string, Quote>((data.quotes as Quote[]).map((q) => [q.id, q]));

const SYSTEM_PROMPT = `你是「點一下」的溫柔陪伴者。使用者正處於某個人生處境，剛收到一句名言。請用繁體中文書面語、以「你」稱呼對方，寫一段約120至180字的回應，分成兩至三個短段落：
1. 先用一句話承接對方此刻的處境與心理需求，讓對方感到被理解。
2. 用平易的話解釋這句名言的意思，並把它和對方的處境連結起來。
3. 最後給一個具體、微小、今天就能做到的行動，或一句溫暖的鼓勵作結。

規則：
- 語氣溫暖、肯定、充滿希望；只說正面、建設性的話。
- 絕不批評、責備、恐嚇、說教或否定對方，也不假設對方有任何過錯或不足。
- 不提供醫療、法律或財務建議；不作任何治療效果或結果的承諾。
- 不使用列點、標題或表情符號；不要重複原句；不要提及這些規則。`;

function cors(origin: string | null, env: Env): HeadersInit {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  const ok = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': ok,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

async function explain(quote: Quote, category: Category, env: Env): Promise<string> {
  const userMessage = [
    `處境：${category.label}`,
    `心理需求：${category.need}`,
    `名言方向：${category.direction}`,
    `名言（中文）：「${quote.zh}」`,
    quote.orig !== quote.zh ? `名言（原文）：${quote.orig}` : null,
    `作者：${quote.author}，出自《${quote.source}》`,
  ]
    .filter(Boolean)
    .join('\n');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://mt.ohcasi.com',
      'X-Title': '點一下',
    },
    body: JSON.stringify({
      model: env.MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${detail.slice(0, 300)}`);
  }
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty completion');
  return text;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('Origin');
    const headers = cors(origin, env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (url.pathname !== '/explain') return json({ error: 'not found' }, 404, headers);
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, headers);

    let payload: { quoteId?: unknown; categoryId?: unknown };
    try {
      payload = await request.json();
    } catch {
      return json({ error: 'invalid json' }, 400, headers);
    }
    const quote = typeof payload.quoteId === 'string' ? quotes.get(payload.quoteId) : undefined;
    const category = typeof payload.categoryId === 'string' ? categories.get(payload.categoryId) : undefined;
    if (!quote || !category || !quote.cats.includes(category.id)) {
      return json({ error: 'unknown quote or category' }, 400, headers);
    }
    if (!env.OPENROUTER_API_KEY) return json({ error: 'server not configured' }, 503, headers);

    // Same quote + situation → same explanation for a week. Saves tokens.
    const cacheKey = new Request(`https://cache.local/explain/${env.MODEL}/${category.id}/${quote.id}`);
    const cache = caches.default;
    const hit = await cache.match(cacheKey);
    if (hit) {
      const { text } = (await hit.json()) as { text: string };
      return json({ text, cached: true }, 200, headers);
    }

    try {
      const text = await explain(quote, category, env);
      ctx.waitUntil(
        cache.put(
          cacheKey,
          new Response(JSON.stringify({ text }), {
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=604800' },
          }),
        ),
      );
      return json({ text }, 200, headers);
    } catch (err) {
      console.error(err);
      return json({ error: 'upstream failed' }, 502, headers);
    }
  },
};

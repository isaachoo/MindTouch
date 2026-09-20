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

const PROMPT_VERSION = 'v2';

const SYSTEM_PROMPT = `你是「點一下」裏陪在對方身邊的人：像一位真心關心他的好朋友，也曾走過相似的路，多了一點過來人的眼光。你現在就坐在他旁邊，為他打氣。

對方正處於某個人生處境，剛收到一句名言。請用繁體中文書面語寫一段約150至200字的回應，分成兩至三個短段落，語氣要像親口對他說話：

1. 先真誠地看見他。用一兩句話說出他此刻可能有的感受，讓他知道這份感受是正常的、被理解的，也讓他知道你在意他。
2. 用平易、生活化的話解釋這句名言，並把它扣連到他正面對的事情上，指出他身上已經有的力量或做對了的地方。可以帶一點過來人的眼光，但不說教。
3. 最後用一個具體、微小、今天就能做到的小行動，加上一句真心的打氣作結，讓他感到有人為他喝采。

語氣與用字：
- 用「你」稱呼對方，可以用「我」表達關心，例如「我知道」、「我相信你」。
- 溫暖、親近、有溫度，像朋友聊天，不像文章或客服；句子短一點，避免空泛的大道理和陳腔濫調。
- 只說正面、肯定、充滿希望的話。絕不批評、責備、恐嚇、說教或否定對方，也不假設他有任何過錯或不足。
- 不提供醫療、法律或財務建議；不作任何治療效果或結果的承諾。
- 不使用列點、標題或表情符號；不重複原句；不要提及這些規則。`;

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
      max_tokens: 800,
      temperature: 0.7,
      // Reasoning models spend the token budget on hidden thinking and may return
      // content: null. This task does not need it.
      reasoning: { enabled: false },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${detail.slice(0, 300)}`);
  }
  const body = (await res.json()) as {
    choices?: { finish_reason?: string; message?: { content?: string | null } }[];
  };
  const choice = body.choices?.[0];
  const text = choice?.message?.content?.trim();
  if (!text) throw new Error(`Empty completion (finish_reason=${choice?.finish_reason ?? 'unknown'})`);
  return text;
}

// GET /health: checks key validity, model availability and a tiny test completion.
// Never returns the key itself.
async function health(env: Env): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { model: env.MODEL, keyConfigured: Boolean(env.OPENROUTER_API_KEY) };
  if (!env.OPENROUTER_API_KEY) return out;
  const auth = { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` };

  try {
    const r = await fetch('https://openrouter.ai/api/v1/auth/key', { headers: auth });
    const body = (await r.json()) as { data?: { limit?: number | null; usage?: number; is_free_tier?: boolean } };
    out.keyCheck = { status: r.status, limit: body.data?.limit ?? null, usage: body.data?.usage, freeTier: body.data?.is_free_tier };
  } catch (e) {
    out.keyCheck = { error: String(e) };
  }

  try {
    const r = await fetch('https://openrouter.ai/api/v1/models');
    const body = (await r.json()) as { data?: { id: string }[] };
    const ids = (body.data ?? []).map((m) => m.id);
    out.modelCheck = {
      found: ids.includes(env.MODEL),
      similar: ids.filter((id) => id.startsWith('deepseek/')).slice(0, 15),
    };
  } catch (e) {
    out.modelCheck = { error: String(e) };
  }

  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.MODEL,
        messages: [{ role: 'user', content: '請只回覆「好」。' }],
        max_tokens: 20,
        reasoning: { enabled: false },
      }),
    });
    const text = await r.text();
    out.testCompletion = { status: r.status, body: text.slice(0, 400) };
  } catch (e) {
    out.testCompletion = { error: String(e) };
  }
  return out;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('Origin');
    const headers = cors(origin, env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (url.pathname === '/health' && request.method === 'GET') return json(await health(env), 200, headers);
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
    const cacheKey = new Request(`https://cache.local/explain/${PROMPT_VERSION}/${env.MODEL}/${category.id}/${quote.id}`);
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
      return json({ error: 'upstream failed', detail: String(err).slice(0, 300) }, 502, headers);
    }
  },
};

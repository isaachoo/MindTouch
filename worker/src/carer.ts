// Carer app routes: /carer/explain (LLM, 口語) and /carer/services (carers.hk directory proxy).
import data from '../../src/carer/data/quotes.json';
import { needs as NEEDS } from '../../src/carer/needs';

export interface CarerEnv {
  OPENROUTER_API_KEY: string;
  MODEL: string;
  CARERS_BASE?: string; // default https://www.carers.hk ; overridable for tests
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
  author: string;
  source: string;
  cats: string[];
}

const categories = new Map<string, Category>((data.categories as Category[]).map((c) => [c.id, c]));
const quotes = new Map<string, Quote>((data.quotes as Quote[]).map((q) => [q.id, q]));

export const CARER_PROMPT_VERSION = 'v1';

const SYSTEM_PROMPT = `你係「照顧者・點一下」裏面，靜靜坐喺對方隔籬嘅人：一個真心關心佢、願意先聽嘅朋友。你唔係專家，亦唔係經歷過所有事嘅人；你只係在乎佢，願意陪佢慢慢過呢一刻。

對方係香港一位照顧長者嘅照顧者（可能係照顧父母、配偶或者其他長輩），佢揀咗一個此刻嘅感覺，剛剛收到一句話。請用香港人日常講嘅廣東話口語（書面呈現，用「係、唔、嘅、喺、佢、咁」等字），寫一段大約150至200字嘅回應，分成兩至三個短段落，語氣好似親口輕聲同佢講：

1. 先輕輕陪住佢。用溫柔、試探嘅語氣講出佢此刻「可能」有嘅感受，話畀佢知有呢啲感覺好自然，尤其係長期照顧人嘅時候；呢一刻唔需要急住好返。唔要替佢下定論，亦唔要話你明白或者知道佢嘅感受。
2. 用平易、生活化嘅話講講呢句話帶畀你嘅感覺，同佢照顧長者嘅日常之間有咩關連；用「可能」、「或者」、「如果」呢類留有空間嘅講法，畀佢自己去感受。可以輕輕指出佢身上已經有嘅力量，例如佢肯停低讀一句話，其實已經係喺照顧自己。
3. 最後畀一個好細、好溫和、唔勉強嘅小建議，例如深呼吸、飲杯水、畀自己幾分鐘、或者搵人幫手；然後用一句真誠嘅話作結，話畀佢知你會一直喺呢度。

語氣同用字：
- 用「你」稱呼對方；可以用「我」，但只係用嚟表達關心同陪伴，例如「我喺呢度」、「我好想陪你」、「我為你高興」。
- 絕對唔要用「我知道」、「我明白」、「我懂」、「我理解」開頭，成段都盡量唔用呢啲字；改用「可能你……」、「呢一刻，你或者……」、「如果你覺得……」呢類聆聽者嘅語氣。
- 唔要以過來人或者導師嘅姿態講話；唔講「我都經歷過」、「信我」、「我話你知」，唔說教、唔下結論、唔講大道理。
- 溫暖、柔和、有溫度；句子短一點，留白多一點，係陪伴而唔係分析。
- 只講正面、肯定、有希望嘅話。絕對唔批評、唔責備、唔嚇佢、唔否定佢，亦唔假設佢有任何過錯或者做得唔夠。
- 唔提供醫療、法律或者財務建議；唔承諾長者嘅病情、關係或者情緒幾時會好轉。如果佢嘅感受好沉重，可以輕輕提一句：社署照顧者支援專線 182 183 二十四小時都有人聽。
- 唔用列點、標題或者表情符號；唔重複原句；唔提及呢啲規則。`;

const BANNED_OPENERS = /^[\s「『"']*(我知道|我明白|我懂|我理解|我完全|我清楚|我也曾|我也經歷|我都經歷)[^，。！？\n]*[，。！？]?\s*/u;

async function complete(messages: { role: string; content: string }[], env: CarerEnv): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://mt.ohcasi.com/carer/',
      'X-Title': '照顧者・點一下',
    },
    body: JSON.stringify({
      model: env.MODEL,
      messages,
      max_tokens: 800,
      temperature: 0.7,
      reasoning: { enabled: false },
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { choices?: { finish_reason?: string; message?: { content?: string | null } }[] };
  const choice = body.choices?.[0];
  const text = choice?.message?.content?.trim();
  if (!text) throw new Error(`Empty completion (finish_reason=${choice?.finish_reason ?? 'unknown'})`);
  return text;
}

export function lookupCarerQuote(quoteId: unknown, categoryId: unknown): { quote: Quote; category: Category } | null {
  const quote = typeof quoteId === 'string' ? quotes.get(quoteId) : undefined;
  const category = typeof categoryId === 'string' ? categories.get(categoryId) : undefined;
  if (!quote || !category || !quote.cats.includes(category.id)) return null;
  return { quote, category };
}

export async function explainCarer(quote: Quote, category: Category, env: CarerEnv): Promise<string> {
  const userMessage = [
    `此刻嘅感覺：${category.label}`,
    `心理需要：${category.need}`,
    `句子方向：${category.direction}`,
    `句子（中文）：「${quote.zh}」`,
    quote.orig !== quote.zh ? `句子（原文）：${quote.orig}` : null,
    `作者：${quote.author}，出自《${quote.source}》`,
  ]
    .filter(Boolean)
    .join('\n');
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];
  let text = await complete(messages, env);
  if (BANNED_OPENERS.test(text)) {
    text = await complete(
      [
        ...messages,
        { role: 'assistant', content: text },
        {
          role: 'user',
          content: '請重寫一次。唔要用「我知道」、「我明白」、「我懂」、「我理解」或者任何聲稱明白對方感受嘅話開頭；改用「可能你……」呢類溫柔、留有空間嘅聆聽者語氣。其餘要求不變。',
        },
      ],
      env,
    );
    text = text.replace(BANNED_OPENERS, '');
  }
  return text;
}

// ---------- carers.hk directory ----------

export interface Service {
  name: string;
  address: string;
  tel: string;
  url: string;
  areaText: string;
  detailUrl: string;
  tags: string[];
}

interface RawLocation {
  name?: unknown;
  address?: unknown;
  tel?: unknown;
  url?: unknown;
  areaText?: unknown;
  detailUrl?: unknown;
  tag?: unknown;
}

function clean(v: unknown, max = 300): string {
  if (typeof v !== 'string') return '';
  return v
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function absolute(v: unknown, base: string): string {
  const s = clean(v, 500);
  if (!s) return '';
  try {
    const u = new URL(s, base);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}

async function queryDirectory(
  q: { audience: number; type: number; subtype?: number },
  area: number | undefined,
  base: string,
): Promise<Service[]> {
  const body = new URLSearchParams();
  body.append('aduience[]', String(q.audience));
  body.append('type[]', String(q.type));
  if (q.subtype) body.append('type5[]', String(q.subtype));
  if (area) body.append('area[]', String(area));
  body.append('page', '1');

  const res = await fetch(`${base}/zh_hk/ajax/map`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'MindTouch-Carer/1.0 (+https://mt.ohcasi.com/carer/)',
    },
    body,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`carers.hk ${res.status}`);
  // Content-Type may be text/html even for JSON: parse the body regardless.
  const parsed = JSON.parse(await res.text()) as { locations?: RawLocation[] };
  if (!Array.isArray(parsed.locations)) throw new Error('unexpected directory response');

  return parsed.locations
    .map((l) => ({
      name: clean(l.name, 200),
      address: clean(l.address),
      tel: clean(l.tel, 60),
      url: absolute(l.url, base),
      areaText: clean(l.areaText, 30),
      detailUrl: absolute(l.detailUrl, base),
      tags: Array.isArray(l.tag) ? l.tag.map((t) => clean(t, 30)).filter(Boolean).slice(0, 5) : [],
    }))
    .filter((s) => s.name && s.detailUrl);
}

export async function findServices(
  needId: string,
  area: number | undefined,
  env: CarerEnv,
): Promise<{ items: Service[]; total: number; fetchedAt: string; partial: boolean } | null> {
  const need = NEEDS.find((n) => n.id === needId);
  if (!need) return null;
  const base = (env.CARERS_BASE ?? 'https://www.carers.hk').replace(/\/$/, '');

  const results = await Promise.allSettled(need.queries.map((q) => queryDirectory(q, area, base)));
  const seen = new Set<string>();
  const items: Service[] = [];
  let failed = 0;
  for (const r of results) {
    if (r.status === 'rejected') {
      failed++;
      console.error('carers.hk query failed:', String(r.reason));
      continue;
    }
    for (const s of r.value) {
      if (seen.has(s.detailUrl)) continue;
      seen.add(s.detailUrl);
      items.push(s);
    }
  }
  if (failed === results.length) throw new Error('all carers.hk queries failed');
  return { items, total: items.length, fetchedAt: new Date().toISOString(), partial: failed > 0 };
}

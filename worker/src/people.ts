// 古人 routes. POST /people/match: a short description of what the user is facing is summarised into a
// situation, matched to the figure (out of src/people/people.json) with the most similar experience, and
// that figure "speaks" to the user in first person. POST /people/followup: one last question to the same
// figure, answered with an in-character farewell.
import people from '../../src/people/people.json';

export interface PeopleEnv {
  OPENROUTER_API_KEY: string;
  MODEL: string;
}

type Complete<E> = (messages: { role: string; content: string }[], env: E, maxTokens?: number) => Promise<string>;

interface Person {
  id: number;
  zh: string;
  en: string;
  b: number;
  d: number;
  region: string;
  field: string;
  note: string;
}

const PEOPLE_PROMPT_VERSION = 'v5';
export const MAX_CHARS = 30;

const roster = people as Person[];
const byId = new Map(roster.map((p) => [p.id, p]));
const byName = new Map(roster.map((p) => [p.zh, p]));
// Kept compact (id, name, field): the model knows these figures, and a short list keeps latency and cost down.
const rosterText = roster.map((p) => `${p.id} ${p.zh}（${p.field}）`).join('\n');

const SYSTEM_PROMPT = `你是「古人」的配對者與代言人。使用者用一句短話（最多30字）說出自己正面對的事。你要做三件事：

1. 把他說的事濃縮成一個簡短的「處境」（10至20字，繁體中文，以他的處境為主，不加批評）。
2. 從下面名冊中，選出一位經歷或心境與這個處境最相近的古人（只可選名冊內的編號）。選擇要有真實的連結：該古人一生中確實有過相似的困境、失去、壓力或抉擇。一定要選出一位：沒有完全吻合時，選心境或遭遇最接近的（例如怕在人前說話，可以選克服口吃或說話困難的人）。避免每次都選最著名的幾位。
3. 以這位古人的口吻，用第一人稱「我」直接對使用者說話，約180至250字，繁體中文書面語，分兩至三個短段落：
   - 先用自己的話複述、轉寫使用者所說的事，讓他知道你有聽到（不要原句照抄；不要說「我懂」「我明白」「我知道」「我理解」或「我也曾深深體會」這類聲稱明白對方的話）；
   - 再講你自己一生中與此相似的經歷，只可使用你確實可靠知道的史實；沒有把握的細節一律不寫，不編造事件、對白或數字；
   - 最後把這段經歷轉化為一點溫和、具體、不說教的陪伴或小建議，用一句真誠的話作結。
   語氣：像隔着時間坐在旁邊的長者或朋友，溫暖、平實、有畫面。用「你」稱呼使用者。不使用列點、標題或表情符號。不提供醫療、法律或財務建議，不作任何療效承諾。不要用「他」「她」稱呼使用者。

如果使用者的話顯示有傷害自己或輕生的念頭，將 "crisis" 設為 true，並讓「古人」的話以安全、陪伴為先，鼓勵他向身邊的人或專業人員求助；否則 "crisis" 為 false。

只輸出一個 JSON 物件，不要任何其他文字：
{"situation":"…","id":編號整數,"name":"名冊內的名字","message":"…","crisis":false}

名冊（編號 名字（領域））：
${rosterText}`;

export interface MatchResult {
  situation: string;
  id: number;
  message: string;
  crisis: boolean;
}

function parseResult(raw: string): MatchResult | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]) as Partial<MatchResult> & { name?: string };
    // Prefer the id; fall back to the name when the model misnumbers.
    const named = typeof o.name === 'string' ? byName.get(o.name.trim()) : undefined;
    const byNum = byId.get(Number(o.id));
    const person = byNum && (!named || named.id === byNum.id) ? byNum : named ?? byNum;
    if (!person) return null;
    const id = person.id;
    if (typeof o.message !== 'string' || !o.message.trim()) return null;
    return {
      situation: typeof o.situation === 'string' ? o.situation.trim().slice(0, 60) : '',
      id,
      message: o.message.trim(),
      crisis: o.crisis === true,
    };
  } catch {
    return null;
  }
}

const year = (y: number) => (y < 0 ? `公元前${-y}年` : `${y}年`);

function followupPrompt(p: Person, text: string, reply: string): string {
  return `你是${p.zh}（${p.en}，${year(p.b)}至${year(p.d)}，${p.region}，${p.field}：${p.note}）。你隔着時間與一位使用者對話。

使用者先前說：「${text}」
你先前回覆：
${reply}

你借來的時間快用完了，現在使用者問你最後一個問題。請以第一人稱「我」回答，約120至180字，繁體中文書面語，分一至兩段：
- 直接回應這個問題本身，語氣延續先前的溫暖與平實；可引用你確實可靠知道的生平，沒有把握的細節一律不寫，不編造事件、對白或數字。
- 不要說「我懂」「我明白」「我知道」「我理解」這類聲稱明白對方的話；用「你」稱呼使用者，不要用「他」「她」。
- 最後一兩句要有趣、溫暖地道別，說明你要回到自己的時代；用你那個時代、你那一行的具體事物作比喻（例如油燈將盡、墨快乾了、馬車在等、樂譜未寫完、船要起錨），輕鬆而不煽情。
- 問題與先前處境無關也可以友善回答；涉及醫療、法律或財務時，溫和建議找專業人士。不使用列點、標題或表情符號。

如果問題顯示有傷害自己或輕生的念頭，將 "crisis" 設為 true，並以安全、陪伴為先，鼓勵他向身邊的人或專業人員求助；否則為 false。

只輸出一個 JSON 物件，不要任何其他文字：
{"message":"…","crisis":false}`;
}

export interface FollowupResult {
  message: string;
  crisis: boolean;
}

function parseFollowup(raw: string): FollowupResult | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const o = JSON.parse(m[0]) as Partial<FollowupResult>;
      if (typeof o.message === 'string' && o.message.trim()) return { message: o.message.trim(), crisis: o.crisis === true };
    } catch {
      // fall through to plain text
    }
  }
  const text = raw.trim();
  return text && !text.startsWith('{') ? { message: text, crisis: false } : null;
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '').slice(0, max * 4);
const chars = (t: string) => Array.from(t).length;

async function sha(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function handlePeople<E extends PeopleEnv>(
  request: Request,
  url: URL,
  env: E,
  ctx: ExecutionContext,
  headers: HeadersInit,
  complete: Complete<E>,
  json: (body: unknown, status: number, headers: HeadersInit) => Response,
): Promise<Response> {
  // Generating takes 4-8 s, and some networks cut requests that stay open that long. So each POST starts a
  // job and answers at once (202 + key); the page then polls GET /people/result?key=… with short requests.
  // Results, errors and an in-progress marker live in the Cache API under that key.
  const cache = caches.default;
  const slot = (key: string, kind: 'result' | 'error' | 'pending') =>
    new Request(`https://cache.local/people/${PEOPLE_PROMPT_VERSION}/${env.MODEL}/${kind}/${key}`);
  const store = (key: string, kind: 'result' | 'error' | 'pending', body: unknown, maxAge: number) =>
    cache.put(
      slot(key, kind),
      new Response(JSON.stringify(body), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${maxAge}` },
      }),
    );

  // Returns the response for a key that already has a result, an error or a running job; null if none.
  const lookup = async (key: string): Promise<Response | null> => {
    const done = await cache.match(slot(key, 'result'));
    if (done) return json({ ...((await done.json()) as object), cached: true }, 200, headers);
    const failed = await cache.match(slot(key, 'error'));
    if (failed) return json(await failed.json(), 502, headers);
    if (await cache.match(slot(key, 'pending'))) return json({ pending: true, key }, 202, headers);
    return null;
  };

  // Runs the model in the background (one retry on malformed output) and stores the outcome under key.
  const start = async <T>(key: string, messages: { role: string; content: string }[], parse: (raw: string) => T | null) => {
    const existing = await lookup(key);
    // A cached error is retried rather than replayed.
    if (existing && existing.status !== 502) return existing;
    const run = async () => {
      try {
        let raw = await complete(messages, env, 1200);
        let result = parse(raw);
        if (!result) {
          raw = await complete(messages, env, 1200);
          result = parse(raw);
        }
        if (result) await store(key, 'result', result, 604800);
        else await store(key, 'error', { error: 'unusable model output', detail: raw.slice(0, 160) }, 60);
      } catch (err) {
        console.error(err);
        await store(key, 'error', { error: 'upstream failed', detail: String(err).slice(0, 300) }, 60);
      } finally {
        await cache.delete(slot(key, 'pending'));
      }
    };
    await cache.delete(slot(key, 'error'));
    await store(key, 'pending', { started: Date.now() }, 90);
    ctx.waitUntil(run());
    return json({ pending: true, key }, 202, headers);
  };

  if (url.pathname === '/people/result' && request.method === 'GET') {
    const key = url.searchParams.get('key') ?? '';
    if (!/^[0-9a-f]{24}$/.test(key)) return json({ error: 'bad key' }, 400, headers);
    return (await lookup(key)) ?? json({ error: 'unknown key' }, 404, headers);
  }

  if (request.method !== 'POST' || (url.pathname !== '/people/match' && url.pathname !== '/people/followup')) {
    return json({ error: 'not found' }, 404, headers);
  }

  let payload: { text?: unknown; id?: unknown; reply?: unknown; question?: unknown; exclude?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid json' }, 400, headers);
  }
  const text = clean(payload.text, MAX_CHARS);
  if (chars(text) < 2 || chars(text) > MAX_CHARS) return json({ error: `text must be 2-${MAX_CHARS} characters` }, 400, headers);
  if (!env.OPENROUTER_API_KEY) return json({ error: 'server not configured' }, 503, headers);

  if (url.pathname === '/people/match') {
    // exclude: figures already shown for this situation ("talk with another 古人").
    const exclude = (Array.isArray(payload.exclude) ? payload.exclude : [])
      .map(Number)
      .filter((n) => byId.has(n))
      .slice(0, 30)
      .sort((a, b) => a - b);
    const skip = new Set(exclude);
    const avoid = exclude.length
      ? `\n這次不可以選以下已經出現過的古人（編號）：${exclude.join('、')}。請選另一位，角度可以不同。`
      : '';
    return start(
      await sha(exclude.length ? `${text}|x${exclude.join(',')}` : text),
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `使用者說：「${text}」${avoid}` },
      ],
      (raw) => {
        const r = parseResult(raw);
        return r && !skip.has(r.id) ? r : null;
      },
    );
  }

  // /people/followup: one last question to the figure who answered the first one.
  const person = byId.get(Number(payload.id));
  const question = clean(payload.question, MAX_CHARS);
  const reply = typeof payload.reply === 'string' ? payload.reply.trim().slice(0, 1500) : '';
  if (!person) return json({ error: 'unknown person' }, 400, headers);
  if (chars(question) < 1 || chars(question) > MAX_CHARS) return json({ error: `question must be 1-${MAX_CHARS} characters` }, 400, headers);
  if (!reply) return json({ error: 'missing reply' }, 400, headers);
  return start(await sha(`followup|${person.id}|${text}|${question}`), [
    { role: 'system', content: followupPrompt(person, text, reply) },
    { role: 'user', content: `使用者最後的問題：「${question}」` },
  ], parseFollowup);
}

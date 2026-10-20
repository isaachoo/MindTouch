// 古人 route: POST /people/match. A short description of what the user is facing is summarised into a
// situation, matched to the figure (out of src/people/people.json) with the most similar experience, and
// that figure "speaks" to the user in first person.
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

const PEOPLE_PROMPT_VERSION = 'v4';
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
   - 先用自己的話複述、轉寫使用者所說的事，讓他知道你有聽到（不要原句照抄，也不要說「我明白你的感受」「我知道」）；
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
  if (url.pathname !== '/people/match' || request.method !== 'POST') return json({ error: 'not found' }, 404, headers);

  let payload: { text?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid json' }, 400, headers);
  }
  const text = typeof payload.text === 'string' ? payload.text.trim().replace(/\s+/g, ' ') : '';
  const length = Array.from(text).length;
  if (length < 2 || length > MAX_CHARS) return json({ error: `text must be 2-${MAX_CHARS} characters` }, 400, headers);
  if (!env.OPENROUTER_API_KEY) return json({ error: 'server not configured' }, 503, headers);

  const cache = caches.default;
  const cacheKey = new Request(`https://cache.local/people/${PEOPLE_PROMPT_VERSION}/${env.MODEL}/${await sha(text)}`);
  const hit = await cache.match(cacheKey);
  if (hit) return json({ ...((await hit.json()) as MatchResult), cached: true }, 200, headers);

  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `使用者說：「${text}」` },
    ];
    let raw = await complete(messages, env, 1200);
    let result = parseResult(raw);
    if (!result) {
      raw = await complete(messages, env, 1200); // one retry on malformed output
      result = parseResult(raw);
    }
    if (!result) return json({ error: 'unusable model output', detail: raw.slice(0, 160) }, 502, headers);
    ctx.waitUntil(
      cache.put(
        cacheKey,
        new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=604800' },
        }),
      ),
    );
    return json(result, 200, headers);
  } catch (err) {
    console.error(err);
    return json({ error: 'upstream failed', detail: String(err).slice(0, 300) }, 502, headers);
  }
}

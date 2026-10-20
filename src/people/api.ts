const BASE = (import.meta.env.VITE_EXPLAIN_URL ?? 'https://mt-api.ohcasi.com').replace(/\/$/, '');

export const MAX_CHARS = 30;

export interface MatchResult {
  situation: string;
  id: number;
  message: string;
  crisis: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Every request is short: one that stays open while the model writes (4-8 s) gets cut on some networks.
async function call(url: string, init: RequestInit, started: number): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  } catch (err) {
    const secs = Math.round((Date.now() - started) / 1000);
    throw new Error(`${err instanceof Error ? err.message : err} (${secs}s, ${new URL(url).pathname})`);
  }
}

export interface FollowupResult {
  message: string;
  crisis: boolean;
}

async function read(res: Response): Promise<Record<string, unknown> | 'pending'> {
  if (res.status === 202 || res.status === 404) return 'pending'; // 404: job not visible yet
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string; detail?: string };
  if (!res.ok) throw new Error(`${res.status} ${body.error ?? ''} ${body.detail ?? ''}`.trim());
  return body;
}

// POST starts a job and answers at once; then poll for the result.
async function startAndPoll(path: string, payload: unknown): Promise<Record<string, unknown>> {
  const started = Date.now();
  const res = await call(
    `${BASE}${path}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    started,
  );
  const first = await read(res.clone());
  if (first !== 'pending') return first;
  const { key } = (await res.json()) as { key?: string };
  if (!key) throw new Error('no job key');

  while (Date.now() - started < 60000) {
    await sleep(1500);
    const out = await read(await call(`${BASE}/people/result?key=${key}`, {}, started));
    if (out !== 'pending') return out;
  }
  throw new Error('timed out after 60s');
}

export async function fetchMatch(text: string): Promise<MatchResult> {
  const body = await startAndPoll('/people/match', { text });
  if (typeof body.id !== 'number' || typeof body.message !== 'string' || !body.message) throw new Error('empty match');
  return {
    situation: typeof body.situation === 'string' ? body.situation : '',
    id: body.id,
    message: body.message,
    crisis: body.crisis === true,
  };
}

export async function fetchFollowup(id: number, text: string, reply: string, question: string): Promise<FollowupResult> {
  const body = await startAndPoll('/people/followup', { id, text, reply, question });
  if (typeof body.message !== 'string' || !body.message) throw new Error('empty reply');
  return { message: body.message, crisis: body.crisis === true };
}

const BASE = (import.meta.env.VITE_EXPLAIN_URL ?? 'https://mt-api.ohcasi.com').replace(/\/$/, '');

export const MAX_CHARS = 30;

export interface MatchResult {
  situation: string;
  id: number;
  message: string;
  crisis: boolean;
}

export async function fetchMatch(text: string): Promise<MatchResult> {
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(`${BASE}/people/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(90000),
    });
  } catch (err) {
    // No HTTP response at all: say whether the API host is reachable, and after how long it gave up.
    const secs = Math.round((Date.now() - started) / 1000);
    const reachable = await fetch(`${BASE}/people/match`, { signal: AbortSignal.timeout(8000) }).then(() => true, () => false);
    throw new Error(`${err instanceof Error ? err.message : err} (${secs}s, ${BASE}, ${reachable ? 'API reachable' : 'API unreachable'})`);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    throw new Error(`${res.status} ${body.error ?? ''} ${body.detail ?? ''}`.trim());
  }
  const body = (await res.json()) as Partial<MatchResult>;
  if (typeof body.id !== 'number' || !body.message) throw new Error('empty match');
  return { situation: body.situation ?? '', id: body.id, message: body.message, crisis: body.crisis === true };
}

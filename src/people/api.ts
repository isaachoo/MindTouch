const BASE = (import.meta.env.VITE_EXPLAIN_URL ?? 'https://mt-api.ohcasi.com').replace(/\/$/, '');

export const MAX_CHARS = 30;

export interface MatchResult {
  situation: string;
  id: number;
  message: string;
  crisis: boolean;
}

export async function fetchMatch(text: string, signal?: AbortSignal): Promise<MatchResult> {
  const res = await fetch(`${BASE}/people/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    throw new Error(`${res.status} ${body.error ?? ''} ${body.detail ?? ''}`.trim());
  }
  const body = (await res.json()) as Partial<MatchResult>;
  if (typeof body.id !== 'number' || !body.message) throw new Error('empty match');
  return { situation: body.situation ?? '', id: body.id, message: body.message, crisis: body.crisis === true };
}

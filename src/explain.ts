const BASE = (import.meta.env.VITE_EXPLAIN_URL ?? 'https://mt-api.ohcasi.com').replace(/\/$/, '');

export async function fetchExplanation(quoteId: string, categoryId: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`${BASE}/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quoteId, categoryId }),
    signal,
  });
  if (!res.ok) throw new Error(`explain failed: ${res.status}`);
  const body = (await res.json()) as { text?: string };
  if (!body.text) throw new Error('empty explanation');
  return body.text;
}

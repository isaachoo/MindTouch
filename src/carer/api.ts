const BASE = (import.meta.env.VITE_EXPLAIN_URL ?? 'https://mt-api.ohcasi.com').replace(/\/$/, '');

export async function fetchCarerExplanation(quoteId: string, categoryId: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`${BASE}/carer/explain`, {
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

export interface Service {
  name: string;
  address: string;
  tel: string;
  url: string;
  areaText: string;
  detailUrl: string;
  tags: string[];
}

export interface ServicesResult {
  items: Service[];
  total: number;
  fetchedAt: string;
  partial: boolean;
}

export async function fetchServices(needId: string, area: number | undefined, signal?: AbortSignal): Promise<ServicesResult> {
  const u = new URL(`${BASE}/carer/services`);
  u.searchParams.set('need', needId);
  if (area) u.searchParams.set('area', String(area));
  const res = await fetch(u.toString(), { signal });
  if (!res.ok) throw new Error(`services failed: ${res.status}`);
  return (await res.json()) as ServicesResult;
}

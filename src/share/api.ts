import type { Motto } from './mottos';

const BASE = (import.meta.env.VITE_EXPLAIN_URL ?? 'https://mt-api.ohcasi.com').replace(/\/$/, '');

export interface Post {
  id: number;
  createdAt: string;
  name: string;
  rewrite: string;
  original: string;
  mottos: Motto[];
  hidden?: boolean;
}

export type SubmitError = 'unrelated' | 'unsafe' | 'duplicate' | 'rate_limited' | 'too_long' | 'network';

export class SubmitFailure extends Error {
  constructor(public kind: SubmitError, public reason = '') {
    super(kind);
  }
}

export async function listPosts(before?: number, adminToken?: string): Promise<{ posts: Post[]; hasMore: boolean }> {
  const u = new URL(`${BASE}/share/posts`);
  if (before) u.searchParams.set('before', String(before));
  if (adminToken) u.searchParams.set('all', '1');
  const res = await fetch(u.toString(), { headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {} });
  if (!res.ok) throw new Error(`list failed: ${res.status}`);
  return (await res.json()) as { posts: Post[]; hasMore: boolean };
}

export async function submitPost(text: string, name: string): Promise<{ post: Post; deleteToken: string }> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/share/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, name }),
    });
  } catch {
    throw new SubmitFailure('network');
  }
  if (res.ok) return (await res.json()) as { post: Post; deleteToken: string };
  const body = (await res.json().catch(() => ({}))) as { error?: string; reason?: string };
  const kind = (['unrelated', 'unsafe', 'duplicate', 'rate_limited', 'too_long'] as SubmitError[]).find((k) => k === body.error) ?? 'network';
  throw new SubmitFailure(kind, body.reason ?? '');
}

export async function hidePost(id: number, auth: { deleteToken?: string; adminToken?: string }): Promise<void> {
  const headers: Record<string, string> = {};
  if (auth.adminToken) headers.Authorization = `Bearer ${auth.adminToken}`;
  if (auth.deleteToken) headers['X-Delete-Token'] = auth.deleteToken;
  const res = await fetch(`${BASE}/share/posts/${id}`, { method: 'DELETE', headers });
  if (!res.ok) throw new Error(`hide failed: ${res.status}`);
}

export async function restorePost(id: number, adminToken: string): Promise<void> {
  const res = await fetch(`${BASE}/share/posts/${id}/restore`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } });
  if (!res.ok) throw new Error(`restore failed: ${res.status}`);
}

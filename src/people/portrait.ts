import { useEffect, useState } from 'react';

// Portraits come from the lead image of each person's Wikipedia article (REST summary API, CORS-enabled).
// English Wikipedia first (titles match our English names best), then Chinese.
export interface Portrait {
  src: string;
  page: string;
}

const cache = new Map<string, Promise<Portrait | null>>();

async function summary(lang: 'en' | 'zh', title: string): Promise<Portrait | null> {
  const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    type?: string;
    thumbnail?: { source?: string };
    content_urls?: { desktop?: { page?: string } };
  };
  if (body.type === 'disambiguation' || !body.thumbnail?.source) return null;
  return { src: body.thumbnail.source, page: body.content_urls?.desktop?.page ?? '' };
}

export function findPortrait(en: string, zh: string): Promise<Portrait | null> {
  const key = `${en}|${zh}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = summary('en', en)
      .catch(() => null)
      .then((p) => p ?? summary('zh', zh).catch(() => null));
    cache.set(key, hit);
  }
  return hit;
}

export function usePortrait(en?: string, zh?: string): Portrait | null {
  const [portrait, setPortrait] = useState<Portrait | null>(null);
  useEffect(() => {
    setPortrait(null);
    if (!en || !zh) return;
    let live = true;
    void findPortrait(en, zh).then((p) => live && setPortrait(p));
    return () => {
      live = false;
    };
  }, [en, zh]);
  return portrait;
}

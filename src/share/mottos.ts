export type Motto = 'learn' | 'smile' | 'brighten' | 'appreciate';

export const MOTTOS: { key: Motto; label: string }[] = [
  { key: 'learn', label: 'Learn something' },
  { key: 'smile', label: 'Share a smile' },
  { key: 'brighten', label: 'Brighten someone' },
  { key: 'appreciate', label: 'Appreciate anything' },
];

export const MOTTO_LABEL: Record<Motto, string> = Object.fromEntries(MOTTOS.map((m) => [m.key, m.label])) as Record<Motto, string>;

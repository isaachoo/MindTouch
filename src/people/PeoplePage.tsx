import { useEffect, useMemo, useState } from 'react';
import AppTabs from '../AppTabs';
import raw from './people.json';

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

const people = raw as Person[];

const ERAS = [
  { id: 'all', label: '全部', test: () => true },
  { id: 'bc', label: '公元前', test: (p: Person) => p.b < 0 },
  { id: 'ancient', label: '1–999', test: (p: Person) => p.b >= 0 && p.b < 1000 },
  { id: 'medieval', label: '1000–1799', test: (p: Person) => p.b >= 1000 && p.b < 1800 },
  { id: 'modern', label: '1800起', test: (p: Person) => p.b >= 1800 },
];

// The first word of the field ("詩人／畫家" -> "詩人") keeps the filter list short.
const mainField = (p: Person) => p.field.split('／')[0];
const fields = Array.from(new Set(people.map(mainField)))
  .map((f) => [f, people.filter((p) => mainField(p) === f).length] as const)
  .filter(([, n]) => n >= 15)
  .sort((a, b) => b[1] - a[1])
  .map(([f]) => f);

const year = (y: number) => (y < 0 ? `公元前${-y}` : `${y}`);
const lifespan = (p: Person) => `${year(p.b)} – ${year(p.d)}`;

function usePeopleTheme() {
  useEffect(() => {
    document.documentElement.setAttribute('data-app', 'people');
    return () => document.documentElement.removeAttribute('data-app');
  }, []);
}

export default function PeoplePage() {
  usePeopleTheme();
  const [query, setQuery] = useState('');
  const [era, setEra] = useState('all');
  const [field, setField] = useState('all');
  const [openId, setOpenId] = useState<number | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const test = ERAS.find((e) => e.id === era)!.test;
    return people.filter(
      (p) =>
        test(p) &&
        (field === 'all' || mainField(p) === field) &&
        (!q || `${p.zh}${p.en}${p.region}${p.field}${p.note}`.toLowerCase().includes(q)),
    );
  }, [query, era, field]);

  const surprise = () => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const p = people[buf[0] % people.length];
    setQuery('');
    setEra('all');
    setField('all');
    setOpenId(p.id);
    requestAnimationFrame(() => document.getElementById(`person-${p.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  };

  return (
    <main className="screen people">
      <AppTabs active="people" />
      <header className="brand people-brand">
        <h1>古人</h1>
        <p className="tagline">一千位已離世的人物，由公元前三千年到今天。</p>
      </header>

      <div className="people-tools">
        <input
          type="search"
          className="people-search"
          placeholder="搜尋名字、地區、領域…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="搜尋"
        />
        <div className="people-chips" role="group" aria-label="年代">
          {ERAS.map((e) => (
            <button key={e.id} type="button" className={`chip ${era === e.id ? 'on' : ''}`} onClick={() => setEra(e.id)}>
              {e.label}
            </button>
          ))}
        </div>
        <div className="people-row">
          <select className="people-select" value={field} onChange={(e) => setField(e.target.value)} aria-label="領域">
            <option value="all">所有領域</option>
            {fields.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <button type="button" className="chip on" onClick={surprise}>
            隨機一位
          </button>
        </div>
      </div>

      <p className="people-count">{shown.length} 位</p>
      <section className="card list-card" aria-label="人物">
        <ul className="situations">
          {shown.map((p) => {
            const open = openId === p.id;
            return (
              <li key={p.id} id={`person-${p.id}`}>
                <button type="button" className="situation people-item" onClick={() => setOpenId(open ? null : p.id)} aria-expanded={open}>
                  <span className="situation-text">
                    <span className="situation-label">
                      {p.zh} <span className="people-en">{p.en}</span>
                    </span>
                    <span className="situation-need">
                      {lifespan(p)}・{p.region}・{p.field}
                    </span>
                    {open && <span className="people-note">{p.note}</span>}
                  </span>
                </button>
              </li>
            );
          })}
          {shown.length === 0 && <li className="people-empty">搵唔到，試吓其他字眼。</li>}
        </ul>
      </section>
      <p className="footnote">資料由人手整理，未逐項核對；早期年份為約數。</p>
    </main>
  );
}

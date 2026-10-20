import { useEffect, useMemo, useState } from 'react';
import AppTabs from '../AppTabs';
import { fetchMatch, MAX_CHARS, type MatchResult } from './api';
import raw from './people.json';
import { usePortrait } from './portrait';

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

const wikiUrl = (p: Person) => `https://zh.wikipedia.org/w/index.php?search=${encodeURIComponent(p.zh)}`;
const clip = (t: string) => Array.from(t).slice(0, MAX_CHARS).join('');

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
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<MatchResult | null>(null);
  const [errorInfo, setErrorInfo] = useState('');
  const [asked, setAsked] = useState('');
  const length = Array.from(text).length;
  const matched = result ? people.find((p) => p.id === result.id) : undefined;

  const ask = async () => {
    const t = text.trim();
    if (Array.from(t).length < 2 || phase === 'loading') return;
    setAsked(t);
    setResult(null);
    setPhase('loading');
    try {
      setResult(await fetchMatch(t));
      setPhase('done');
    } catch (err) {
      console.error(err);
      setErrorInfo(err instanceof Error ? err.message.slice(0, 240) : String(err));
      setPhase('error');
    }
  };

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
        <p className="tagline">講出你的處境，讓一位經歷相近的古人同你傾兩句。</p>
      </header>

      <section className="card people-ask" aria-label="問古人">
        <label htmlFor="people-input" className="people-ask-label">
          簡單講講你而家面對緊啲咩
        </label>
        <textarea
          id="people-input"
          className="people-input"
          rows={3}
          value={text}
          placeholder="例如：工作壓力好大，好想放棄"
          onChange={(e) => setText(clip(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void ask();
            }
          }}
        />
        <div className="people-ask-foot">
          <span className="people-counter">
            {length} / {MAX_CHARS}
          </span>
          <button type="button" className="people-go" onClick={() => void ask()} disabled={length < 2 || phase === 'loading'}>
            {phase === 'loading' ? '搵緊古人…' : '問古人'}
          </button>
        </div>
      </section>

      {phase !== 'idle' && asked && (
        <section className="card people-chat" aria-label="對話" aria-live="polite">
          <div className="bubble-row me">
            <p className="bubble me">{asked}</p>
          </div>
          {phase === 'loading' && (
            <div className="bubble-row them">
              <Avatar />
              <p className="bubble them typing" aria-label="古人諗緊點回覆">
                <span />
                <span />
                <span />
              </p>
            </div>
          )}
          {phase === 'error' && (
            <p className="people-error">
              暫時搵唔到古人，遲啲再試。
              <small className="people-error-detail">{errorInfo}</small>
            </p>
          )}
          {phase === 'done' && result && matched && <Reply result={result} person={matched} />}
        </section>
      )}

      <details className="people-browse">
        <summary>瀏覽全部 2000 位古人</summary>
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
                    {open && (
                      <span className="people-note">
                        {p.note}
                        <a href={wikiUrl(p)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                          生平 ↗
                        </a>
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
          {shown.length === 0 && <li className="people-empty">搵唔到，試吓其他字眼。</li>}
        </ul>
      </section>
      </details>
      <p className="footnote">古人嘅話由 AI 根據史實撰寫，並非真實言論；人物資料未逐項核對，早期年份為約數。</p>
    </main>
  );
}

function Avatar({ person }: { person?: Person }) {
  const portrait = usePortrait(person?.en, person?.zh);
  const initial = person ? Array.from(person.zh)[0] : '古';
  return (
    <span className="avatar" aria-hidden="true">
      {portrait ? <img src={portrait.src} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span>{initial}</span>}
    </span>
  );
}

function Reply({ result, person }: { result: MatchResult; person: Person }) {
  const paragraphs = result.message.split(/\n+/).filter((p) => p.trim());
  return (
    <>
      {result.situation && <p className="chat-note">你的處境：{result.situation}</p>}
      <div className="bubble-row them">
        <Avatar person={person} />
        <div className="bubble-stack">
          <p className="chat-name">
            {person.zh} <span className="people-en">{person.en}</span>
          </p>
          <p className="chat-meta">
            {lifespan(person)}・{person.region}・{person.field}
          </p>
          {paragraphs.map((para, i) => (
            <p key={i} className="bubble them" style={{ animationDelay: `${i * 0.25}s` }}>
              {para}
            </p>
          ))}
        </div>
      </div>
      {result.crisis && (
        <p className="people-crisis">
          如果你有傷害自己的念頭，請即致電撒瑪利亞防止自殺會 2389 2222，或生命熱線 2382 0000；情況緊急請打 999。
        </p>
      )}
      <a className="people-history" href={wikiUrl(person)} target="_blank" rel="noopener noreferrer">
        睇{person.zh}嘅生平 ↗
      </a>
      <p className="chat-credit">頭像來自維基百科；對話由 AI 撰寫，並非真實言論。</p>
    </>
  );
}

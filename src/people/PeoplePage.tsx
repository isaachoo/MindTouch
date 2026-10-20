import { useEffect, useState } from 'react';
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

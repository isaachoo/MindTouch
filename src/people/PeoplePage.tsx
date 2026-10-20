import { useEffect, useRef, useState } from 'react';
import AppTabs from '../AppTabs';
import { fetchFollowup, fetchMatch, MAX_CHARS, type FollowupResult, type MatchResult } from './api';
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

// "18世紀的德國" — the figure's own time and place, from the middle of their life.
function era(p: Person): string {
  const mid = Math.round((p.b + p.d) / 2);
  const century = Math.floor(Math.abs(mid) / 100) + 1;
  return `${mid < 0 ? '公元前' : ''}${century}世紀的${p.region}`;
}

// The 古人 announces there is time for just one more question. Picked by id so it stays put on re-render.
const LAST_CALL = [
  (when: string) => `時光之門快要關上了。我只能再答你一個問題，之後便要回到${when}。`,
  (when: string) => `${when}在呼喚我了。趁還有片刻，你還想問我甚麼？只可以一題啊。`,
  (when: string) => `燈快滅了，墨也快乾了。在我回到${when}之前，你可以再問我一件事。`,
  (when: string) => `我借來的時間只剩一點點。再問我一句吧，問完我就要趕回${when}了。`,
  (when: string) => `沙漏只剩最後幾粒沙。最後一個問題，留給你；之後我得回${when}去了。`,
];
const lastCall = (p: Person) => LAST_CALL[p.id % LAST_CALL.length](era(p));

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
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const reset = () => {
    setSeen([]);
    setText('');
    setAsked('');
    setResult(null);
    setPhase('idle');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    inputRef.current?.focus();
  };

  // Seen figures for the current situation, so 「同另一位古人傾」 never repeats one.
  const [seen, setSeen] = useState<number[]>([]);

  const run = async (t: string, exclude: number[]) => {
    setAsked(t);
    setResult(null);
    setPhase('loading');
    try {
      const r = await fetchMatch(t, exclude);
      setSeen([...exclude, r.id]);
      setResult(r);
      setPhase('done');
    } catch (err) {
      console.error(err);
      setErrorInfo(err instanceof Error ? err.message.slice(0, 240) : String(err));
      setPhase('error');
    }
  };

  const ask = () => {
    const t = text.trim();
    if (Array.from(t).length < 2 || phase === 'loading') return;
    void run(t, []);
  };

  const another = () => {
    if (phase === 'loading' || !asked) return;
    void run(asked, seen);
    document.querySelector('.people-chat')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
          ref={inputRef}
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
          {phase === 'done' && result && matched && <Reply key={`${result.id}-${asked}`} asked={asked} result={result} person={matched} onReset={reset} onAnother={another} />}
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

function Bubbles({ person, message, showName }: { person: Person; message: string; showName?: boolean }) {
  const paragraphs = message.split(/\n+/).filter((p) => p.trim());
  return (
    <div className="bubble-row them">
      <Avatar person={person} />
      <div className="bubble-stack">
        {showName && (
          <>
            <p className="chat-name">
              {person.zh} <span className="people-en">{person.en}</span>
            </p>
            <p className="chat-meta">
              {lifespan(person)}・{person.region}・{person.field}
            </p>
          </>
        )}
        {paragraphs.map((para, i) => (
          <p key={i} className="bubble them" style={{ animationDelay: `${i * 0.25}s` }}>
            {para}
          </p>
        ))}
      </div>
    </div>
  );
}

function Crisis() {
  return (
    <p className="people-crisis">
      如果你有傷害自己的念頭，請即致電撒瑪利亞防止自殺會 2389 2222，或生命熱線 2382 0000；情況緊急請打 999。
    </p>
  );
}

interface ReplyProps {
  asked: string;
  result: MatchResult;
  person: Person;
  onReset: () => void;
  onAnother: () => void;
}

function Reply({ asked, result, person, onReset, onAnother }: ReplyProps) {
  const [question, setQuestion] = useState('');
  const [sent, setSent] = useState('');
  const [state, setState] = useState<'ask' | 'loading' | 'done' | 'error'>('ask');
  const [answer, setAnswer] = useState<FollowupResult | null>(null);
  const [errorInfo, setErrorInfo] = useState('');
  const qLength = Array.from(question).length;

  const send = async () => {
    const q = question.trim();
    if (!q || state === 'loading') return;
    setSent(q);
    setState('loading');
    try {
      setAnswer(await fetchFollowup(person.id, asked, result.message, q));
      setState('done');
    } catch (err) {
      console.error(err);
      setErrorInfo(err instanceof Error ? err.message.slice(0, 240) : String(err));
      setState('error');
    }
  };

  return (
    <>
      {result.situation && <p className="chat-note">你的處境：{result.situation}</p>}
      <Bubbles person={person} message={result.message} showName />
      {result.crisis && <Crisis />}

      <Bubbles person={person} message={lastCall(person)} />

      {state !== 'ask' && state !== 'error' && (
        <div className="bubble-row me">
          <p className="bubble me">{sent}</p>
        </div>
      )}
      {state === 'loading' && (
        <div className="bubble-row them">
          <Avatar person={person} />
          <p className="bubble them typing" aria-label={`${person.zh}諗緊點回覆`}>
            <span />
            <span />
            <span />
          </p>
        </div>
      )}
      {state === 'done' && answer && (
        <>
          <Bubbles person={person} message={answer.message} />
          {answer.crisis && <Crisis />}
          <p className="chat-note">
            {person.zh}已回到{era(person)}。
          </p>
        </>
      )}
      {(state === 'ask' || state === 'error') && (
        <div className="chat-reply">
          {state === 'error' && (
            <p className="people-error">
              {person.zh}聽唔清楚，再問一次？
              <small className="people-error-detail">{errorInfo}</small>
            </p>
          )}
          <input
            className="chat-input"
            value={question}
            placeholder="最後一個問題…"
            onChange={(e) => setQuestion(clip(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            aria-label={`問${person.zh}最後一個問題`}
          />
          <div className="people-ask-foot">
            <span className="people-counter">
              {qLength} / {MAX_CHARS}
            </span>
            <button type="button" className="people-go" onClick={() => void send()} disabled={!qLength}>
              送出
            </button>
          </div>
        </div>
      )}

      {state !== 'loading' && (
        <div className="chat-actions">
          <button type="button" className="people-go" onClick={onAnother}>
            同另一位古人傾同一件事
          </button>
          {state === 'done' && (
            <button type="button" className="people-go secondary" onClick={onReset}>
              講另一件事
            </button>
          )}
        </div>
      )}

      <a className="people-history" href={wikiUrl(person)} target="_blank" rel="noopener noreferrer">
        睇{person.zh}嘅生平 ↗
      </a>
      <p className="chat-credit">頭像來自維基百科；對話由 AI 撰寫，並非真實言論。</p>
    </>
  );
}

import { useEffect, useRef, useState, type ReactElement } from 'react';
import AppTabs from '../AppTabs';
import { MOTTOS, MOTTO_LABEL } from './mottos';
import { hidePost, listPosts, restorePost, submitPost, SubmitFailure, type Post } from './api';

const TEXT_MAX = 300;
const NAME_MAX = 30;
const NAME_KEY = 'share-name';
const TOKENS_KEY = 'share-tokens';
const ADMIN_KEY = 'share-admin';

const ERRORS: Record<string, string> = {
  unrelated: '這段似乎和四件事無關。試試寫你今天學到、分享、照亮或感恩的事。',
  unsafe: '這段內容未能刊登。請避免冒犯字眼、個人資料或網址。',
  duplicate: '這段剛剛已經分享過了。',
  rate_limited: '今天已經分享了 5 次，明天再來吧。',
  too_long: '內容太長了，請縮短一點。',
  network: '暫時未能連接，請稍後再試。',
};

const MOTTO_ICONS: Record<string, ReactElement> = {
  learn: (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M4 5h7a2 2 0 0 1 2 2v12a1.5 1.5 0 0 0-1.5-1.5H4zM20 5h-7a2 2 0 0 0-2 2v12a1.5 1.5 0 0 1 1.5-1.5H20z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  smile: (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
    </svg>
  ),
  brighten: (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
      </g>
    </svg>
  ),
  appreciate: (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M12 21s-7-4.6-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 11c0 5.4-7 10-7 10z" fill="currentColor" />
    </svg>
  ),
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const hk = new Date(d.getTime() + 8 * 3600000);
  return `${hk.getUTCFullYear()}-${String(hk.getUTCMonth() + 1).padStart(2, '0')}-${String(hk.getUTCDate()).padStart(2, '0')}`;
}

interface Props {
  admin?: boolean;
}

export default function SharePage({ admin = false }: Props) {
  const [text, setText] = useState('');
  const [name, setName] = useState(() => readJson<string>(NAME_KEY, ''));
  const [status, setStatus] = useState<{ kind: 'idle' | 'sending' | 'ok' | 'error'; message?: string }>({ kind: 'idle' });
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [tokens, setTokens] = useState<Record<string, string>>(() => readJson(TOKENS_KEY, {}));
  const [adminToken, setAdminToken] = useState<string>(() => {
    try {
      return sessionStorage.getItem(ADMIN_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const textRef = useRef<HTMLTextAreaElement>(null);

  const load = async (before?: number) => {
    try {
      setLoadError(false);
      const r = await listPosts(before, admin ? adminToken : undefined);
      setPosts((p) => (before ? [...p, ...r.posts] : r.posts));
      setHasMore(r.hasMore);
    } catch (err) {
      console.error(err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (admin && !adminToken) {
      setLoading(false);
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, adminToken]);

  const send = async () => {
    const t = text.trim();
    if (!t || status.kind === 'sending') return;
    setStatus({ kind: 'sending' });
    try {
      const { post, deleteToken } = await submitPost(t, name.trim());
      const next = { ...tokens, [post.id]: deleteToken };
      setTokens(next);
      writeJson(TOKENS_KEY, next);
      writeJson(NAME_KEY, name.trim());
      setPosts((p) => [post, ...p]);
      setText('');
      setStatus({ kind: 'ok', message: '已分享。謝謝你。' });
      window.setTimeout(() => setStatus((s) => (s.kind === 'ok' ? { kind: 'idle' } : s)), 4000);
    } catch (err) {
      const kind = err instanceof SubmitFailure ? err.kind : 'network';
      setStatus({ kind: 'error', message: ERRORS[kind] });
    }
  };

  const hide = async (p: Post) => {
    try {
      await hidePost(p.id, admin ? { adminToken } : { deleteToken: tokens[p.id] });
      if (admin) setPosts((list) => list.map((x) => (x.id === p.id ? { ...x, hidden: true } : x)));
      else setPosts((list) => list.filter((x) => x.id !== p.id));
    } catch (err) {
      console.error(err);
    }
  };

  const restore = async (p: Post) => {
    try {
      await restorePost(p.id, adminToken);
      setPosts((list) => list.map((x) => (x.id === p.id ? { ...x, hidden: false } : x)));
    } catch (err) {
      console.error(err);
    }
  };

  const toggle = (id: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const count = [...text].length;

  return (
    <main className="screen share">
      <AppTabs active="share" />
      <header className="brand share-brand">
        <h1>你也分享</h1>
        <p className="tagline">今天做到了哪一樣？寫下來，也鼓勵別人。</p>
      </header>

      <div className="mottos" aria-label="四件事">
        {MOTTOS.map((m) => (
          <span key={m.key} className="motto">
            <span className="motto-icon">{MOTTO_ICONS[m.key]}</span>
            <span>{m.label}</span>
          </span>
        ))}
      </div>

      {admin && !adminToken && (
        <section className="card compose">
          <p className="compose-label">管理員密碼</p>
          <div className="compose-row">
            <input
              type="password"
              placeholder="輸入密碼"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = (e.target as HTMLInputElement).value;
                  try {
                    sessionStorage.setItem(ADMIN_KEY, v);
                  } catch {
                    /* ignore */
                  }
                  setAdminToken(v);
                }
              }}
            />
          </div>
        </section>
      )}

      {!admin && (
        <section className="card compose">
          <textarea
            ref={textRef}
            value={text}
            maxLength={TEXT_MAX}
            onChange={(e) => setText(e.target.value)}
            placeholder={'今天我……\n例如：教了同事一個快捷鍵；對樓下保安笑了一下；謝謝媽媽煲的湯。'}
            aria-label="今天做到的事"
          />
          <div className="compose-row">
            <input value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="你的名字（可留空）" aria-label="名字" />
            <span className="counter">
              {count} / {TEXT_MAX}
            </span>
            <button type="button" className="send" disabled={!text.trim() || status.kind === 'sending'} onClick={() => void send()}>
              {status.kind === 'sending' ? '分類中……' : '分享'}
            </button>
          </div>
          {status.kind === 'error' && <p className="compose-note error">{status.message}</p>}
          {status.kind === 'ok' && <p className="compose-note ok">{status.message}</p>}
          {status.kind === 'sending' && <p className="compose-note">AI 正在看看這是四件事中的哪一樣……</p>}
        </section>
      )}

      <h2 className="section-title">{admin ? '全部分享（包括已隱藏）' : '大家今天做到的'}</h2>

      {loading && <p className="share-empty">載入中……</p>}
      {loadError && !loading && <p className="share-empty">暫時未能載入，請稍後再試。</p>}
      {!loading && !loadError && posts.length === 0 && <p className="share-empty">還沒有人分享。做第一個吧。</p>}

      <ul className="feed">
        {posts.map((p) => (
          <li key={p.id} className={`card post ${p.hidden ? 'hidden-post' : ''}`}>
            <p className="post-text">{p.rewrite}</p>
            <div className="chips">
              {p.mottos.map((m) => (
                <span key={m} className="chip">
                  {MOTTO_LABEL[m]}
                </span>
              ))}
            </div>
            <div className="post-meta">
              <span>
                {p.name || '匿名'} · {formatDate(p.createdAt)}
                {p.hidden ? ' · 已隱藏' : ''}
              </span>
              <span className="post-actions">
                {admin && !p.hidden && (
                  <button type="button" className="link-btn" onClick={() => void hide(p)}>
                    隱藏
                  </button>
                )}
                {admin && p.hidden && (
                  <button type="button" className="link-btn" onClick={() => void restore(p)}>
                    恢復
                  </button>
                )}
                {!admin && tokens[p.id] && (
                  <button type="button" className="link-btn" onClick={() => void hide(p)}>
                    刪除
                  </button>
                )}
                <button type="button" className="link-btn" onClick={() => toggle(p.id)} aria-expanded={open.has(p.id)}>
                  原文
                </button>
              </span>
            </div>
            {open.has(p.id) && <p className="orig">{p.original}</p>}
          </li>
        ))}
      </ul>

      {hasMore && (
        <button type="button" className="more" onClick={() => void load(posts[posts.length - 1]?.id)}>
          載入更多
        </button>
      )}
    </main>
  );
}

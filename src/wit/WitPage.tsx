import { useEffect, useMemo, useState } from 'react';
import AppTabs from '../AppTabs';
import { shareQuote } from '../shareImage';
import { findSituation, randomQuote, situations, type Category, type Quote } from './data';

interface Props {
  situationId?: string;
  onPick: (id: string) => void;
  onBack: () => void;
}

function useWitTheme() {
  useEffect(() => {
    document.documentElement.setAttribute('data-app', 'wit');
    return () => document.documentElement.removeAttribute('data-app');
  }, []);
}

export default function WitPage({ situationId, onPick, onBack }: Props) {
  useWitTheme();
  const situation = situationId ? findSituation(situationId) : undefined;
  // A new line is drawn each time the user enters a situation.
  const quote = useMemo(() => (situation ? randomQuote(situation.id) : undefined), [situation]);

  if (situation && quote) return <WitCard situation={situation} quote={quote} onBack={onBack} />;

  return (
    <main className="screen wit">
      <AppTabs active="wit" />
      <header className="brand wit-brand">
        <h1>妙語開竅</h1>
        <p className="tagline">被調侃、被刁難、場面尷尬時，可以點樣回應？</p>
      </header>
      <h2 className="section-title">你想學點樣……</h2>
      <section className="card list-card" aria-label="情境">
        <ul className="situations">
          {situations.map((c) => (
            <li key={c.id}>
              <button type="button" className="situation" onClick={() => onPick(c.id)}>
                <span className="situation-text">
                  <span className="situation-label">{c.label}</span>
                  <span className="situation-need">{c.need}</span>
                </span>
                <svg className="chevron" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <p className="footnote">每次一句，連情境同技巧一齊睇。</p>
    </main>
  );
}

function WitCard({ situation, quote, onBack }: { situation: Category; quote: Quote; onBack: () => void }) {
  const [showMore, setShowMore] = useState(false);
  const [shareNote, setShareNote] = useState('');
  const [sharing, setSharing] = useState(false);
  const showOriginal = quote.orig.trim() !== quote.zh.trim();

  const onShare = async () => {
    if (sharing) return;
    setSharing(true);
    setShareNote('');
    try {
      const outcome = await shareQuote(quote);
      if (outcome === 'downloaded') setShareNote('圖片已下載，文字同連結已複製。');
    } catch (err) {
      console.error(err);
      setShareNote('暫時未能分享，遲啲再試。');
    } finally {
      setSharing(false);
    }
  };

  return (
    <main className="screen quote-screen wit">
      <header className="topbar">
        <button type="button" className="back" onClick={onBack} aria-label="返回">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>返回</span>
        </button>
      </header>

      <article className="card quote-card" key={quote.id}>
        <p className="situation-chip">{situation.label}</p>
        {quote.location && (
          <p className="wit-setup">
            <span className="wit-setup-label">情境</span>
            {quote.location}
          </p>
        )}

        <blockquote className="quote">
          <p className="quote-zh" lang="zh-Hant">
            {quote.zh}
          </p>
          {showOriginal && (
            <p className={`quote-orig ${quote.lang === 'en' ? 'en' : 'classical'}`} lang={quote.lang === 'en' ? 'en' : 'zh-Hant'}>
              {quote.orig}
            </p>
          )}
        </blockquote>

        <footer className="attribution">
          <span className="author">— {quote.author}</span>
          <span className="attribution-actions">
            <button type="button" className="share-btn" onClick={() => void onShare()} disabled={sharing} aria-label="分享呢句">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M12 16V4m0 0l-4 4m4-4l4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{sharing ? '準備中' : '分享'}</span>
            </button>
            <button
              type="button"
              className={`more ${showMore ? 'open' : ''}`}
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={showMore}
              aria-label={showMore ? '收起背景' : '顯示背景與技巧'}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </span>
        </footer>
        {shareNote && <p className="share-note">{shareNote}</p>}

        {!showMore && (
          <button type="button" className="tell-more" onClick={() => setShowMore(true)}>
            背景與技巧
          </button>
        )}
        {showMore && (
          <div className="explain wit-note">
            {quote.note && <p>{quote.note}</p>}
            <dl className="details wit-details">
              <div>
                <dt>出處</dt>
                <dd>{quote.source}</dd>
              </div>
              {quote.speaker && quote.speaker !== quote.author && (
                <div>
                  <dt>講者</dt>
                  <dd>{quote.speaker}</dd>
                </div>
              )}
              {quote.url && (
                <div>
                  <dt>原文</dt>
                  <dd>
                    <a href={quote.url} target="_blank" rel="noopener noreferrer">
                      睇原文
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </article>
    </main>
  );
}

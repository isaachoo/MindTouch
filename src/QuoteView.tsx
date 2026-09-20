import { useEffect, useRef, useState } from 'react';
import { fetchExplanation } from './explain';
import Thinking, { estimateMs, recordDuration } from './Thinking';
import type { Category, Quote } from './data';

interface Props {
  category: Category;
  quote: Quote;
  onBack: () => void;
}

export default function QuoteView({ category, quote, onBack }: Props) {
  const [showMore, setShowMore] = useState(false);
  const showOriginal = quote.orig.trim() !== quote.zh.trim();

  const [explain, setExplain] = useState<{ status: 'idle' | 'loading' | 'done' | 'error'; text?: string }>({
    status: 'idle',
  });
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const askMore = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setExplain({ status: 'loading' });
    const started = performance.now();
    try {
      const text = await fetchExplanation(quote.id, category.id, ctrl.signal);
      if (!ctrl.signal.aborted) {
        recordDuration(performance.now() - started);
        setExplain({ status: 'done', text });
      }
    } catch (err) {
      if (!ctrl.signal.aborted) {
        console.error(err);
        setExplain({ status: 'error' });
      }
    }
  };

  return (
    <main className="screen quote-screen">
      <header className="topbar">
        <button type="button" className="back" onClick={onBack} aria-label="返回">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>返回</span>
        </button>
      </header>

      <article className="card quote-card" key={quote.id}>
        <p className="situation-chip">{category.label}</p>
        <h2 className="need">{category.need}</h2>

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
          <button
            type="button"
            className={`more ${showMore ? 'open' : ''}`}
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
            aria-label={showMore ? '收起出處' : '顯示出處'}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </footer>

        {explain.status === 'idle' && (
          <button type="button" className="tell-more" onClick={() => void askMore()}>
            多說一點
          </button>
        )}
        {explain.status === 'loading' && <Thinking estimate={estimateMs()} />}
        {explain.status === 'done' && (
          <div className="explain" aria-live="polite">
            {explain.text!.split(/\n+/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        )}
        {explain.status === 'error' && (
          <div className="explain error">
            <p>暫時未能連接，請稍後再試。</p>
            <button type="button" className="tell-more" onClick={() => void askMore()}>
              再試一次
            </button>
          </div>
        )}

        {showMore && (
          <dl className="details">
            <div>
              <dt>出處</dt>
              <dd>{quote.source}</dd>
            </div>
            {quote.location && (
              <div>
                <dt>篇章</dt>
                <dd>{quote.location}</dd>
              </div>
            )}
            {quote.speaker && quote.speaker !== quote.author && (
              <div>
                <dt>說話者</dt>
                <dd>{quote.speaker}</dd>
              </div>
            )}
            {quote.url && (
              <div>
                <dt>原文</dt>
                <dd>
                  <a href={quote.url} target="_blank" rel="noopener noreferrer">
                    查看原文
                  </a>
                </dd>
              </div>
            )}
          </dl>
        )}
      </article>
    </main>
  );
}

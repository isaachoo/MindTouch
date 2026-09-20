import type { Category } from './data';
import { useInstall } from './useInstall';

interface Props {
  categories: Category[];
  onPick: (id: string) => void;
}

export default function Home({ categories, onPick }: Props) {
  const install = useInstall();

  return (
    <main className="screen home">
      <header className="brand">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="28" height="28">
            <path
              d="M16 28s-10-6.6-10-14a5.6 5.6 0 0 1 10-3.4A5.6 5.6 0 0 1 26 14c0 7.4-10 14-10 14z"
              fill="currentColor"
            />
          </svg>
        </span>
        <h1>點一下</h1>
        <p className="tagline">你現在的處境是……</p>
      </header>

      <section className="card list-card" aria-label="處境">
        <ul className="situations">
          {categories.map((c) => (
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

      <p className="footnote">點一下，收一句鼓勵。</p>

      {install.kind === 'prompt' && (
        <button type="button" className="install" onClick={() => void install.install()}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          加到主畫面
        </button>
      )}
      {install.kind === 'ios-hint' && (
        <p className="install-hint">
          想加到主畫面？在 Safari 按「分享」，再選「加入主畫面」。
        </p>
      )}
    </main>
  );
}

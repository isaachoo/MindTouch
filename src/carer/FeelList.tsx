import type { Category } from './data';
import TopBar from './TopBar';

interface Props {
  feelings: Category[];
  onPick: (id: string) => void;
  onBack: () => void;
}

export default function FeelList({ feelings, onPick, onBack }: Props) {
  return (
    <main className="screen">
      <TopBar onBack={onBack} />
      <h2 className="section-title">你依家嘅感覺係……</h2>
      <section className="card list-card" aria-label="感覺">
        <ul className="situations">
          {feelings.map((c) => (
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
      <p className="footnote">冇對錯，揀最似此刻嘅一個就得。</p>
    </main>
  );
}

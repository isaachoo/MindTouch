import type { Need } from './needs';
import TopBar from './TopBar';
import Hotline from './Hotline';

interface Props {
  needs: Need[];
  onPick: (id: string) => void;
  onBack: () => void;
}

export default function HelpList({ needs, onPick, onBack }: Props) {
  return (
    <main className="screen">
      <TopBar onBack={onBack} />
      <h2 className="section-title">你想處理嘅係……</h2>
      <section className="card list-card" aria-label="需要">
        <ul className="situations">
          {needs.map((n) => (
            <li key={n.id}>
              <button type="button" className="situation" onClick={() => onPick(n.id)}>
                <span className="situation-text">
                  <span className="situation-label">{n.label}</span>
                  <span className="situation-need">{n.hint}</span>
                </span>
                <svg className="chevron" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <Hotline />
    </main>
  );
}

import Hotline from './Hotline';
import InstallButton from '../InstallButton';
import AppTabs from '../AppTabs';

interface Props {
  onFeel: () => void;
  onHelp: () => void;
}

export default function Home({ onFeel, onHelp }: Props) {
  return (
    <main className="screen home carer-home">
      <AppTabs active="carer" />
      <header className="brand">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="30" height="30">
            <path d="M7 21c-1-2.6.4-5 2.8-5.9L13 14v6l-2.9 1.9C9 22.6 7.6 22.4 7 21z" fill="currentColor" opacity="0.6" />
            <path d="M25 21c1-2.6-.4-5-2.8-5.9L19 14v6l2.9 1.9c1.1.7 2.5.5 3.1-.9z" fill="currentColor" opacity="0.6" />
            <path d="M16 19s-5-3.2-5-6.9a2.6 2.6 0 0 1 5-1.6 2.6 2.6 0 0 1 5 1.6c0 3.7-5 6.9-5 6.9z" fill="currentColor" />
          </svg>
        </span>
        <h1>照顧者・點一下</h1>
        <p className="tagline">照顧人之前，都要先照顧自己。</p>
      </header>

      <div className="entry-cards">
        <button type="button" className="card entry" onClick={onFeel}>
          <span className="entry-title">想打打氣</span>
          <span className="entry-sub">揀一個最貼近你此刻嘅感覺，收一句話。</span>
          <span className="entry-arrow" aria-hidden="true">→</span>
        </button>
        <button type="button" className="card entry" onClick={onHelp}>
          <span className="entry-title">想搵資源</span>
          <span className="entry-sub">揀一個你面對嘅問題，搵到合適嘅服務。</span>
          <span className="entry-arrow" aria-hidden="true">→</span>
        </button>
      </div>

      <Hotline />

      <InstallButton colloquial />
    </main>
  );
}

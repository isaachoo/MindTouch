import { useEffect, useMemo, useState } from 'react';
import { feelings, findFeeling, randomQuote } from './data';
import { findNeed, needs } from './needs';
import Home from './Home';
import FeelList from './FeelList';
import FeelQuote from './FeelQuote';
import HelpList from './HelpList';
import HelpResults from './HelpResults';

function readHash(): string[] {
  return decodeURIComponent(window.location.hash.replace(/^#\/?/, ''))
    .split('/')
    .filter(Boolean);
}

export function go(path: string): void {
  window.location.hash = `/${path}`;
}

export function back(fallback: string): void {
  if (window.history.length > 1) window.history.back();
  else go(fallback);
}

export default function App() {
  const [route, setRoute] = useState(readHash);

  useEffect(() => {
    const onChange = () => {
      setRoute(readHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const [section, id] = route;
  const feeling = section === 'feel' && id ? findFeeling(id) : undefined;
  // A new quote is drawn each time the user enters a feeling.
  const quote = useMemo(() => (feeling ? randomQuote(feeling.id) : undefined), [feeling]);
  const need = section === 'help' && id ? findNeed(id) : undefined;

  if (feeling && quote) return <FeelQuote category={feeling} quote={quote} onBack={() => back('feel')} />;
  if (section === 'feel') return <FeelList feelings={feelings} onPick={(fid) => go(`feel/${fid}`)} onBack={() => back('')} />;
  if (need) return <HelpResults need={need} onBack={() => back('help')} />;
  if (section === 'help') return <HelpList needs={needs} onPick={(nid) => go(`help/${nid}`)} onBack={() => back('')} />;
  return <Home onFeel={() => go('feel')} onHelp={() => go('help')} />;
}

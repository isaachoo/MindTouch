import { useEffect, useMemo, useState } from 'react';
import { categories, findCategory, randomQuote } from './data';
import Home from './Home';
import QuoteView from './QuoteView';

function readHash(): string {
  return decodeURIComponent(window.location.hash.replace(/^#\/?/, ''));
}

export default function App() {
  const [route, setRoute] = useState(readHash);

  useEffect(() => {
    const onChange = () => setRoute(readHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const category = findCategory(route);
  // A new quote is drawn each time the user enters a situation.
  const quote = useMemo(() => (category ? randomQuote(category.id) : undefined), [category]);

  if (category && quote) {
    return (
      <QuoteView
        category={category}
        quote={quote}
        onBack={() => {
          if (window.history.length > 1) window.history.back();
          else window.location.hash = '';
        }}
      />
    );
  }

  return <Home categories={categories} onPick={(id) => (window.location.hash = `/${id}`)} />;
}

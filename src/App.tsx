import { useEffect, useMemo, useState } from 'react';
import { DAILY_ID, dailyCategory, findCategory, randomQuote, situations } from './data';
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

  const isDaily = route === 'today';
  const category = isDaily ? dailyCategory : route === DAILY_ID ? undefined : findCategory(route);
  // A new quote is drawn each time the user enters a situation or taps 點亮今天.
  const quote = useMemo(() => (category ? randomQuote(category.id) : undefined), [category, route]);

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.hash = '';
  };

  if (category && quote) {
    return <QuoteView category={category} quote={quote} daily={isDaily} onBack={goBack} />;
  }

  return (
    <Home
      categories={situations}
      onPick={(id) => (window.location.hash = `/${id}`)}
      onDaily={() => (window.location.hash = '/today')}
    />
  );
}

import { useEffect, useState } from 'react';

const KEY = 'explain-durations';
const DEFAULT_MS = 10000;

/** Median of the last few real waits, so the estimate matches this user's network and model speed. */
export function estimateMs(): number {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) ?? '[]') as number[];
    if (arr.length === 0) return DEFAULT_MS;
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  } catch {
    return DEFAULT_MS;
  }
}

export function recordDuration(ms: number): void {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) ?? '[]') as number[];
    arr.push(ms);
    localStorage.setItem(KEY, JSON.stringify(arr.slice(-5)));
  } catch {
    /* storage unavailable: ignore */
  }
}

const MESSAGES = ['正在細讀這句話……', '想想它和你的處境有什麼關連……', '整理一些想對你說的話……', '快好了，再等一下……'];
const SLOW_MESSAGE = '今天回應慢了一點，我仍在努力……';

export interface ThinkingCopy {
  messages: string[];
  slow: string;
  eta: (seconds: number) => string;
}

const DEFAULT_COPY: ThinkingCopy = {
  messages: MESSAGES,
  slow: SLOW_MESSAGE,
  eta: (s) => `通常需時約 ${s} 秒`,
};

interface Props {
  estimate: number;
  copy?: ThinkingCopy;
}

export default function Thinking({ estimate, copy = DEFAULT_COPY }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const id = window.setInterval(() => setElapsed(performance.now() - start), 200);
    return () => window.clearInterval(id);
  }, []);

  // Fill to ~85% at the estimate, then crawl towards 98% so it never looks stuck or finished.
  const ratio = elapsed / estimate;
  const progress = ratio <= 1 ? ratio * 85 : 85 + 13 * (1 - Math.exp(-(ratio - 1)));
  const slow = elapsed > estimate * 2;
  const message = slow ? copy.slow : copy.messages[Math.min(copy.messages.length - 1, Math.floor(elapsed / 3500))];
  const seconds = Math.max(5, Math.round(estimate / 1000 / 5) * 5);

  return (
    <div className="explain thinking" role="status" aria-live="polite">
      <span className="thinking-heart" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="30" height="30">
          <path
            d="M16 28s-10-6.6-10-14a5.6 5.6 0 0 1 10-3.4A5.6 5.6 0 0 1 26 14c0 7.4-10 14-10 14z"
            fill="currentColor"
          />
        </svg>
      </span>
      <p className="thinking-message" key={message}>
        {message}
      </p>
      <div className="thinking-bar">
        <span style={{ width: `${progress.toFixed(1)}%` }} />
      </div>
      <p className="thinking-eta">{copy.eta(seconds)}</p>
    </div>
  );
}

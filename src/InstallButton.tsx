import { useState } from 'react';
import { useInstall } from './useInstall';

interface Props {
  /** Cantonese copy for the carer app, 書面語 otherwise. */
  colloquial?: boolean;
}

/** One 「加到主畫面」 button for both platforms: Android gets the native prompt, iPhone gets a 3-step guide. */
export default function InstallButton({ colloquial = false }: Props) {
  const install = useInstall();
  const [guide, setGuide] = useState(false);
  if (install.kind === 'none') return null;

  const t = colloquial
    ? {
        title: '加到主畫面',
        intro: '喺 iPhone 用 Safari 開呢個網站，然後：',
        steps: ['㩒底部中間嘅「分享」掣', '向下搵「加入主畫面」', '㩒右上角「新增」'],
        done: '之後喺主畫面就會見到個 icon，好似 app 咁開。',
        close: '明白',
      }
    : {
        title: '加到主畫面',
        intro: '在 iPhone 用 Safari 開啟這個網站，然後：',
        steps: ['按底部中間的「分享」按鈕', '向下找到「加入主畫面」', '按右上角「新增」'],
        done: '之後主畫面就會有一個圖示，像 app 一樣開啟。',
        close: '明白',
      };

  const icon = (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  if (install.kind === 'prompt') {
    return (
      <button type="button" className="install" onClick={() => void install.install()}>
        {icon}
        {t.title}
      </button>
    );
  }

  return (
    <>
      <button type="button" className="install" onClick={() => setGuide(true)}>
        {icon}
        {t.title}
      </button>
      {guide && (
        <div className="sheet-backdrop" onClick={() => setGuide(false)} role="presentation">
          <div className="sheet" role="dialog" aria-modal="true" aria-label={t.title} onClick={(e) => e.stopPropagation()}>
            <h2 className="sheet-title">{t.title}</h2>
            <p className="sheet-intro">{t.intro}</p>
            <ol className="sheet-steps">
              <li>
                <span className="sheet-step-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path d="M12 3v12m0-12l-4 4m4-4l4 4M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {t.steps[0]}
              </li>
              <li>
                <span className="sheet-step-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 8v8M8 12h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                {t.steps[1]}
              </li>
              <li>
                <span className="sheet-step-icon">
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path d="M5 12l5 5L20 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {t.steps[2]}
              </li>
            </ol>
            <p className="sheet-done">{t.done}</p>
            <button type="button" className="send sheet-close" onClick={() => setGuide(false)}>
              {t.close}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

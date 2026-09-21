import { useEffect, useState } from 'react';
import type { Need } from './needs';
import { carersLink, districts } from './needs';
import { fetchServices, type ServicesResult } from './api';
import TopBar from './TopBar';
import Hotline from './Hotline';

const AREA_KEY = 'carer-area';

function readArea(): number | undefined {
  try {
    const v = Number(localStorage.getItem(AREA_KEY));
    return v > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}

interface Props {
  need: Need;
  onBack: () => void;
}

type State = { status: 'loading' } | { status: 'done'; data: ServicesResult } | { status: 'error' };

export default function HelpResults({ need, onBack }: Props) {
  const [area, setArea] = useState<number | undefined>(readArea);
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    fetchServices(need.id, area, ctrl.signal)
      .then((data) => setState({ status: 'done', data }))
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        console.error(err);
        setState({ status: 'error' });
      });
    return () => ctrl.abort();
  }, [need.id, area]);

  const onArea = (v: string) => {
    const n = Number(v) || undefined;
    setArea(n);
    try {
      if (n) localStorage.setItem(AREA_KEY, String(n));
      else localStorage.removeItem(AREA_KEY);
    } catch {
      /* ignore */
    }
  };

  const links = need.queries.map((q) => carersLink(q, area));

  return (
    <main className="screen">
      <TopBar onBack={onBack} />
      <h2 className="section-title">{need.label}</h2>
      <p className="caveat">{need.caveat}</p>

      <label className="area-select">
        <span>地區</span>
        <select value={area ?? ''} onChange={(e) => onArea(e.target.value)}>
          <option value="">全港</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      {state.status === 'loading' && (
        <div className="services-loading" role="status" aria-live="polite">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
          <span>搵緊資源……</span>
        </div>
      )}

      {state.status === 'error' && (
        <div className="card notice">
          <p>暫時連接唔到資料庫。你可以直接去照顧者資訊網睇：</p>
          <ExternalLinks links={links} />
        </div>
      )}

      {state.status === 'done' && state.data.items.length === 0 && (
        <div className="card notice">
          <p>{area ? '喺呢區暫時搵唔到相關服務，試試揀「全港」，或者直接去照顧者資訊網睇睇。' : '暫時搵唔到相關服務，可以直接去照顧者資訊網睇睇。'}</p>
          <ExternalLinks links={links} />
        </div>
      )}

      {state.status === 'done' && state.data.items.length > 0 && (
        <>
          <p className="result-count">
            {state.data.total > state.data.items.length
              ? `顯示 ${state.data.items.length} 個服務，照顧者資訊網共有約 ${state.data.total} 個`
              : `搵到 ${state.data.items.length} 個服務`}
            {state.data.partial ? '（部分資料暫時載入唔到）' : ''}
          </p>
          <ul className="services">
            {state.data.items.map((s) => (
              <li key={s.detailUrl} className="card service">
                <h3 className="service-name">{s.name}</h3>
                {s.areaText && <p className="service-area">{s.areaText}</p>}
                {s.address && <p className="service-address">{s.address}</p>}
                <div className="service-actions">
                  {s.tel && (
                    <a className="pill primary" href={`tel:${s.tel.replace(/[^\d+]/g, '')}`}>
                      打電話 {s.tel}
                    </a>
                  )}
                  <a className="pill" href={s.detailUrl} target="_blank" rel="noopener noreferrer">
                    詳細資料
                  </a>
                  {s.url && (
                    <a className="pill" href={s.url} target="_blank" rel="noopener noreferrer">
                      網站
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="card notice">
            <p>想睇全部，或者用更多篩選：</p>
            <ExternalLinks links={links} />
          </div>
          <p className="source-note">
            資料來源：照顧者資訊網 carers.hk（社會福利署）・{new Date(state.data.fetchedAt).toLocaleDateString('zh-HK')} 取得。
            服務詳情、名額同收費以機構公布為準。
          </p>
        </>
      )}

      <Hotline />
    </main>
  );
}

function ExternalLinks({ links }: { links: string[] }) {
  return (
    <div className="service-actions">
      {links.map((href, i) => (
        <a key={href} className="pill" href={href} target="_blank" rel="noopener noreferrer">
          在照顧者資訊網查看{links.length > 1 ? `（${i + 1}）` : ''}
        </a>
      ))}
    </div>
  );
}

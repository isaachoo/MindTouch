// Switch between the two apps. Rendered at the top of both home screens.
interface Props {
  active: 'main' | 'carer';
}

export default function AppTabs({ active }: Props) {
  const base = import.meta.env.BASE_URL;
  return (
    <nav className="app-tabs" aria-label="切換">
      <a className={`app-tab ${active === 'main' ? 'active' : ''}`} href={base} aria-current={active === 'main' ? 'page' : undefined}>
        <svg viewBox="0 0 32 32" width="18" height="18" aria-hidden="true">
          <path d="M16 28s-10-6.6-10-14a5.6 5.6 0 0 1 10-3.4A5.6 5.6 0 0 1 26 14c0 7.4-10 14-10 14z" fill="currentColor" />
        </svg>
        <span>點一下</span>
      </a>
      <a className={`app-tab ${active === 'carer' ? 'active' : ''}`} href={`${base}carer/`} aria-current={active === 'carer' ? 'page' : undefined}>
        <svg viewBox="0 0 32 32" width="18" height="18" aria-hidden="true">
          <path d="M7 21c-1-2.6.4-5 2.8-5.9L13 14v6l-2.9 1.9C9 22.6 7.6 22.4 7 21z" fill="currentColor" opacity="0.6" />
          <path d="M25 21c1-2.6-.4-5-2.8-5.9L19 14v6l2.9 1.9c1.1.7 2.5.5 3.1-.9z" fill="currentColor" opacity="0.6" />
          <path d="M16 19s-5-3.2-5-6.9a2.6 2.6 0 0 1 5-1.6 2.6 2.6 0 0 1 5 1.6c0 3.7-5 6.9-5 6.9z" fill="currentColor" />
        </svg>
        <span>照顧者</span>
      </a>
    </nav>
  );
}

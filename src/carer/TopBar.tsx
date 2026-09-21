interface Props {
  onBack: () => void;
  title?: string;
}

export default function TopBar({ onBack, title }: Props) {
  return (
    <header className="topbar">
      <button type="button" className="back" onClick={onBack} aria-label="返回">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>返回</span>
      </button>
      {title && <span className="topbar-title">{title}</span>}
    </header>
  );
}

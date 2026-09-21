export default function Hotline() {
  return (
    <a className="hotline" href="tel:182183">
      <span className="hotline-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path
            d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1L6.6 10.8z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span className="hotline-text">
        <span className="hotline-title">社署照顧者支援專線 182 183</span>
        <span className="hotline-sub">24 小時・㩒一下即刻打</span>
      </span>
    </a>
  );
}

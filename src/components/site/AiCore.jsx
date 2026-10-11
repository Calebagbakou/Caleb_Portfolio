import { useRef } from 'react';

export default function AiCore() {
  const coreRef = useRef(null);

  function handlePointerMove(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    coreRef.current?.style.setProperty('--core-rotate-x', `${-y * 20}deg`);
    coreRef.current?.style.setProperty('--core-rotate-y', `${x * 24}deg`);
    coreRef.current?.style.setProperty('--core-shift-x', `${x * 8}px`);
    coreRef.current?.style.setProperty('--core-shift-y', `${y * 8}px`);
  }

  function resetPointer() {
    coreRef.current?.style.setProperty('--core-rotate-x', '0deg');
    coreRef.current?.style.setProperty('--core-rotate-y', '0deg');
    coreRef.current?.style.setProperty('--core-shift-x', '0px');
    coreRef.current?.style.setProperty('--core-shift-y', '0px');
  }

  return (
    <div
      ref={coreRef}
      className="ai-core"
      aria-hidden="true"
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
    >
      <svg className="ai-core-art" viewBox="0 0 240 240" fill="none">
        <defs>
          <radialGradient id="ai-core-glow">
            <stop stopColor="var(--teal)" stopOpacity=".68" />
            <stop offset=".42" stopColor="var(--teal)" stopOpacity=".14" />
            <stop offset="1" stopColor="var(--teal)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ai-core-glass" cx="0" cy="0" r="1" gradientTransform="matrix(54 64 -64 54 98 82)" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fff" stopOpacity=".92" />
            <stop offset=".16" stopColor="var(--teal)" stopOpacity=".86" />
            <stop offset=".48" stopColor="#36d9e8" stopOpacity=".4" />
            <stop offset="1" stopColor="#10202a" stopOpacity=".92" />
          </radialGradient>
          <linearGradient id="ai-core-ring" x1="42" x2="202" y1="54" y2="192" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--teal)" />
            <stop offset=".48" stopColor="#36d9e8" />
            <stop offset="1" stopColor="var(--orange)" />
          </linearGradient>
          <filter id="ai-core-blur" x="22" y="22" width="196" height="196" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
            <feGaussianBlur stdDeviation="12" />
          </filter>
        </defs>

        <circle cx="120" cy="120" r="88" fill="url(#ai-core-glow)" filter="url(#ai-core-blur)" />
        <g className="ai-core-orbit ai-core-orbit-back">
          <ellipse cx="120" cy="120" rx="93" ry="34" stroke="url(#ai-core-ring)" strokeOpacity=".42" strokeWidth="1.2" transform="rotate(-35 120 120)" />
          <circle cx="42" cy="70" r="4" fill="var(--teal)" />
          <circle cx="192" cy="170" r="2.5" fill="#36d9e8" />
        </g>
        <ellipse cx="120" cy="120" rx="78" ry="78" stroke="url(#ai-core-ring)" strokeOpacity=".22" strokeWidth="1" />
        <circle cx="120" cy="120" r="65" stroke="url(#ai-core-ring)" strokeOpacity=".68" strokeWidth="1.5" />
        <circle cx="120" cy="120" r="57" fill="#071015" fillOpacity=".78" stroke="white" strokeOpacity=".22" />
        <circle cx="120" cy="120" r="48" fill="url(#ai-core-glass)" />
        <circle cx="120" cy="120" r="32" fill="#081217" fillOpacity=".72" stroke="white" strokeOpacity=".38" />
        <circle cx="120" cy="120" r="21" fill="var(--teal)" fillOpacity=".22" />
        <circle cx="120" cy="120" r="13" fill="url(#ai-core-glass)" />
        <circle cx="120" cy="120" r="5" fill="white" />
        <path d="M84 86c10-11 21-17 36-19" stroke="white" strokeOpacity=".7" strokeWidth="2" strokeLinecap="round" />
        <path d="M73 120a47 47 0 0 0 9 28" stroke="var(--teal)" strokeOpacity=".82" strokeWidth="2" strokeLinecap="round" />
        <g className="ai-core-orbit ai-core-orbit-front">
          <ellipse cx="120" cy="120" rx="93" ry="34" stroke="url(#ai-core-ring)" strokeOpacity=".74" strokeWidth="2" transform="rotate(38 120 120)" />
          <circle cx="53" cy="177" r="4" fill="var(--orange)" />
          <circle cx="185" cy="61" r="3" fill="white" />
        </g>
        <circle cx="120" cy="120" r="91" stroke="white" strokeOpacity=".13" strokeWidth=".8" strokeDasharray="2 8" />
      </svg>
      <span className="ai-core-label">NEURAL CORE <i /></span>
    </div>
  );
}

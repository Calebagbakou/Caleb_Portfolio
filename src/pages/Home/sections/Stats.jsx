import { useEffect, useRef, useState } from 'react';
import { STATS } from '../../../data/stats';

const STAT_ICONS = [
  <path key="projects" d="M4 7.5A2.5 2.5 0 016.5 5h11A2.5 2.5 0 0120 7.5v9a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 16.5zM8 5V3.5M16 5V3.5M8 11h8M8 15h5" />,
  <path key="satisfaction" d="M12 3.5l2.6 5.3 5.9.9-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.9z" />,
  <path key="tools" d="M14.5 5.5a4 4 0 00-5.2 5.2L4 16a2.1 2.1 0 003 3l5.3-5.3a4 4 0 005.2-5.2l-2.4 2.4-2.5-.5-.5-2.5z" />,
  <path key="experience" d="M12 3v9l6 3M12 21a9 9 0 100-18 9 9 0 000 18z" />,
];

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Counter({ count }) {
  const ref = useRef(null);
  const [value, setValue] = useState(prefersReducedMotion ? count : 0);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          const duration = 1200;
          const start = performance.now();
          function tick(now) {
            const progress = Math.min(1, (now - start) / duration);
            setValue(Math.round(progress * count));
            if (progress < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        });
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [count]);

  return (
    <span className="num" ref={ref}>
      {value}
    </span>
  );
}

export default function Stats() {
  return (
    <section className="wrap" style={{ paddingTop: 0 }}>
      <div className="stats">
        {STATS.map((s, index) => (
          <div className="stat" key={s.label}>
            <span className="stat-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                {STAT_ICONS[index]}
              </svg>
            </span>
            <div className="stat-num">
              <Counter count={s.count} />
              {s.suffix && <span>{s.suffix}</span>}
            </div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

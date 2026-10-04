import { useEffect, useRef, useState } from 'react';
import { STATS } from '../../../data/stats';

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
        {STATS.map((s) => (
          <div className="stat" key={s.label}>
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

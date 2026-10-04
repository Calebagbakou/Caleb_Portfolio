import { useMemo, useState } from 'react';
import { PORTFOLIO_FILTERS, PORTFOLIO_ROWS } from '../../../data/portfolio';
import { useReveal } from '../../../hooks/useReveal';
import { useTilt } from '../../../hooks/useTilt';
import { useDragScroll } from '../../../hooks/useDragScroll';
import Lightbox from '../../../components/site/Lightbox';

function PortfolioCard({ item, globalIndex, onOpen }) {
  const [revealRef, visible] = useReveal();
  const tiltRef = useTilt();

  function mergeRefs(el) {
    revealRef.current = el;
    tiltRef.current = el;
  }

  return (
    <div
      className={`p-card reveal${visible ? ' in' : ''}`}
      ref={mergeRefs}
      onClick={() => onOpen(globalIndex)}
    >
      <span className="p-expand">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
        </svg>
      </span>
      <div className="p-thumb" style={{ background: item.gradient }}>
        <span>{item.thumbLabel}</span>
        {item.video && (
          <span className="p-play">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        )}
      </div>
      <div className="p-body">
        <div className="p-cat">{item.catLabel}</div>
        <h3 className="p-title">{item.title}</h3>
      </div>
    </div>
  );
}

function PortfolioRow({ row, indexOffset, onOpen }) {
  const dragRef = useDragScroll();
  return (
    <div className="p-row" id={row.id}>
      <div className="p-row-head">
        <h3>{row.title}</h3>
        <span className="p-row-count">{row.count}</span>
      </div>
      <div className="p-row-scroll" ref={dragRef}>
        {row.items.map((item, i) => (
          <PortfolioCard item={item} globalIndex={indexOffset + i} onOpen={onOpen} key={item.title} />
        ))}
      </div>
    </div>
  );
}

export default function PortfolioSection() {
  const [activeFilter, setActiveFilter] = useState(PORTFOLIO_FILTERS[0].target);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const flatItems = useMemo(() => PORTFOLIO_ROWS.flatMap((row) => row.items), []);

  // Décale chaque rangée pour obtenir un index global cohérent avec flatItems
  const offsets = useMemo(() => {
    const map = {};
    let running = 0;
    PORTFOLIO_ROWS.forEach((row) => {
      map[row.id] = running;
      running += row.items.length;
    });
    return map;
  }, []);

  function handleFilterClick(target) {
    setActiveFilter(target);
    const el = document.getElementById(target);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openLightbox(i) {
    setLightboxIndex((i + flatItems.length) % flatItems.length);
  }
  function navigateLightbox(i) {
    setLightboxIndex((i + flatItems.length) % flatItems.length);
  }

  return (
    <section className="wrap" id="portfolio">
      <div className="sec-head">
        <div className="sec-eyebrow">PORTFOLIO</div>
        <h2 className="sec-title">Quelques réalisations récentes.</h2>
      </div>

      <div className="filters">
        {PORTFOLIO_FILTERS.map((f) => (
          <button
            key={f.target}
            className={`filter-btn${activeFilter === f.target ? ' active' : ''}`}
            onClick={() => handleFilterClick(f.target)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="portfolio-rows" id="grid">
        {PORTFOLIO_ROWS.map((row) => (
          <PortfolioRow row={row} indexOffset={offsets[row.id]} onOpen={openLightbox} key={row.id} />
        ))}
      </div>

      <Lightbox
        items={flatItems}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={navigateLightbox}
      />
    </section>
  );
}

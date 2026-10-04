import { useEffect } from 'react';

/**
 * items: liste à plat de toutes les cartes portfolio (toutes rangées confondues)
 * index: index actuellement ouvert, ou null si fermé
 */
export default function Lightbox({ items, index, onClose, onNavigate }) {
  const open = index !== null && index !== undefined;
  const item = open ? items[index] : null;

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onNavigate(index - 1);
      if (e.key === 'ArrowRight') onNavigate(index + 1);
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open, index, onClose, onNavigate]);

  return (
    <div className={`lightbox${open ? ' open' : ''}`}>
      <button className="lightbox-close" aria-label="Fermer" onClick={onClose}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <button
        className="lightbox-nav lightbox-prev"
        aria-label="Précédent"
        onClick={() => onNavigate(index - 1)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <div className="lightbox-inner">
        <div className="lightbox-thumb" style={item && !item.video ? { background: item.gradient } : { background: '#000' }}>
          {item?.video && (
            <iframe
              src={item.video}
              width="100%"
              height="100%"
              frameBorder="0"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              style={{ position: 'absolute', inset: 0 }}
              title={item.title}
            />
          )}
        </div>
        <div className="lightbox-body">
          <div>
            <div className="lightbox-cat">{item?.catLabel}</div>
            <h3 className="lightbox-title">{item?.title}</h3>
          </div>
        </div>
      </div>
      <button
        className="lightbox-nav lightbox-next"
        aria-label="Suivant"
        onClick={() => onNavigate(index + 1)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}

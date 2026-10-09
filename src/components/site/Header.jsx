import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePresentation } from '../../context/PresentationContext';

const SUN_PATH = (
  <>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8L6 18M18 6l1.8-1.8" />
  </>
);
const MOON_PATH = <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />;

const NAV_LINKS = [
  { href: '#about', label: 'À propos', idx: '01' },
  { href: '#services', label: 'Services', idx: '02' },
  { href: '#portfolio', label: 'Portfolio', idx: '03' },
  { href: '#tools', label: 'Outils', idx: '04' },
  { href: '#faq', label: 'FAQ', idx: '05' },
  { href: '#contact', label: 'Contact', idx: '06' },
];

// La boutique vit dans le même dépôt/app, sous /boutique.
const SHOP_URL = '/boutique';

function PresentationSwitch({ isProfessional, compact, onToggle }) {
  return (
    <button
      className={`presentation-switch${compact ? ' presentation-switch-compact' : ' presentation-switch-creative'}${isProfessional ? ' is-on' : ''}`}
      type="button"
      role="switch"
      aria-label="Bascule rendu"
      aria-checked={isProfessional}
      onClick={onToggle}
    >
      {!compact && <span className="presentation-switch-label">Bascule rendu</span>}
      <span className="presentation-switch-track" aria-hidden="true">
        <span className="presentation-switch-thumb" />
      </span>
    </button>
  );
}

export default function Header() {
  const { isProfessional, togglePresentation } = usePresentation();
  const [theme, setTheme] = useState('dark');
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const timecodeRef = useRef(null);

  function handlePresentationToggle() {
    setMenuOpen(false);
    if (isProfessional) window.scrollTo({ top: 0, behavior: 'smooth' });
    togglePresentation();
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    function updateShadow() {
      setScrolled(window.scrollY > 8);
    }
    document.addEventListener('scroll', updateShadow, { passive: true });
    updateShadow();
    return () => document.removeEventListener('scroll', updateShadow);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
  }, [menuOpen]);

  // Timecode discret dans le header (purement décoratif)
  const framesRef = useRef(24 * 60 + 7);
  useEffect(() => {
    function fmt(n) {
      return String(n).padStart(2, '0');
    }
    const id = setInterval(() => {
      framesRef.current++;
      const f = framesRef.current % 30;
      const totalSec = Math.floor(framesRef.current / 30);
      const s = totalSec % 60;
      const m = Math.floor(totalSec / 60);
      if (timecodeRef.current) {
        timecodeRef.current.textContent = `00:${fmt(m)}:${fmt(s)}:${fmt(f)}`;
      }
    }, 1000 / 30);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
        <div className="top-row">
          <div className="brand">
            <span className="brand-mark">CA</span>
            <span className="brand-name">
              Caleb <span className="brand-accent">AGBAKOU</span>
              <span className="brand-sub">CALEB CREATIVE</span>
            </span>
          </div>
          <div className="top-actions">
            <span className="timecode" ref={timecodeRef}>00:00:24:07</span>
            {isProfessional && (
              <PresentationSwitch
                isProfessional={isProfessional}
                compact
                onToggle={handlePresentationToggle}
              />
            )}
            <Link className="icon-btn" to={SHOP_URL} aria-label="Accéder à la boutique" title="Boutique">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 3h2l2.4 12.4a2 2 0 002 1.6h8.2a2 2 0 002-1.6L21 8H6" />
                <circle cx="9" cy="20" r="1.4" />
                <circle cx="17" cy="20" r="1.4" />
              </svg>
            </Link>
            <button
              className="icon-btn theme-toggle"
              aria-label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
              aria-pressed={theme === 'light'}
              onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                {theme === 'light' ? MOON_PATH : SUN_PATH}
              </svg>
            </button>
            <button
              className={`hamburger${menuOpen ? ' open' : ''}`}
              aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <div className="bars">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </button>
          </div>
        </div>
      </header>

      {!isProfessional && (
        <PresentationSwitch
          isProfessional={isProfessional}
          onToggle={handlePresentationToggle}
        />
      )}

      <nav className={`nav-overlay${menuOpen ? ' open' : ''}`}>
        <div className="nav-links">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
              <span>{link.label}</span>
              <span className="idx">{link.idx}</span>
            </a>
          ))}
          <Link to={SHOP_URL} onClick={() => setMenuOpen(false)}>
            <span>Boutique</span>
            <span className="idx">07</span>
          </Link>
        </div>
        <div className="nav-foot">
          <span className="footer-note">Abomey, Bénin</span>
          <a
            href="#contact"
            onClick={() => setMenuOpen(false)}
            className="btn btn-ghost"
            style={{ maxWidth: 180, padding: '11px 16px', fontSize: 13 }}
          >
            Écrire
          </a>
        </div>
      </nav>
    </>
  );
}

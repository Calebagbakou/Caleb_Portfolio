import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import profileWebp from '../../../assets/profile1.webp';
import { getSettingValue } from '../../../services/settings';
import { usePresentation } from '../../../context/PresentationContext';
import AiCore from '../../../components/site/AiCore';

const BR = '\u0001';
const EM_S = '\u0002';
const EM_E = '\u0003';
const FULL_TEXT = 'DES IDÉES BRUTES, DES RENDUS QUI ' + EM_S + 'CLAQUENT' + EM_E;

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const CHAPTERS = [
  { label: 'IMAGES', target: 'row-images' },
  { label: 'VIDÉO', target: 'row-videos' },
  { label: 'MOTION', target: 'row-motion' },
  { label: 'IA', target: 'tools' },
];
const STOPS = [0, 100 / 3, 200 / 3, 100];

function renderTyped(n) {
  const slice = FULL_TEXT.slice(0, n);
  const emStart = slice.indexOf(EM_S);
  if (emStart === -1) {
    return slice.split(BR).join('\n');
  }
  const before = slice.slice(0, emStart).split(BR).join('\n');
  const emEnd = slice.indexOf(EM_E);
  const emContent = emEnd === -1 ? slice.slice(emStart + 1) : slice.slice(emStart + 1, emEnd);
  const after = emEnd === -1 ? '' : slice.slice(emEnd + 1);
  return (
    <>
      {before}
      <em>{emContent}</em>
      {after}
    </>
  );
}

export default function Hero() {
  const { isProfessional } = usePresentation();
  const [profileImage, setProfileImage] = useState(profileWebp);
  const [availability, setAvailability] = useState('Disponible pour de nouveaux projets');
  const [typedCount, setTypedCount] = useState(prefersReducedMotion ? FULL_TEXT.length : 0);
  const [activeChapter, setActiveChapter] = useState(0);
  const [scrubPct, setScrubPct] = useState(0);
  const scrubTrackRef = useRef(null);
  const draggingRef = useRef(false);

  function handlePortraitPointerMove(event) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    event.currentTarget.style.setProperty('--portrait-pointer-x', `${(x + 0.5) * 100}%`);
    event.currentTarget.style.setProperty('--portrait-pointer-y', `${(y + 0.5) * 100}%`);
    event.currentTarget.style.setProperty('--portrait-rotate-x', `${-y * 7}deg`);
    event.currentTarget.style.setProperty('--portrait-rotate-y', `${x * 9}deg`);
    event.currentTarget.style.setProperty('--portrait-shift-x', `${x * -5}px`);
    event.currentTarget.style.setProperty('--portrait-shift-y', `${y * -5}px`);
  }

  function resetPortraitPointer(event) {
    event.currentTarget.style.setProperty('--portrait-pointer-x', '50%');
    event.currentTarget.style.setProperty('--portrait-pointer-y', '50%');
    event.currentTarget.style.setProperty('--portrait-rotate-x', '0deg');
    event.currentTarget.style.setProperty('--portrait-rotate-y', '0deg');
    event.currentTarget.style.setProperty('--portrait-shift-x', '0px');
    event.currentTarget.style.setProperty('--portrait-shift-y', '0px');
  }

  useEffect(() => {
    let active = true;
    getSettingValue('site_profile_image_url').then(({ data, error }) => {
      if (error) {
        console.error('Impossible de charger la photo principale depuis les paramètres :', error);
        if (active) setProfileImage(profileWebp);
        return;
      }
      if (active) setProfileImage(data || profileWebp);
    }).catch((error) => {
      console.error('Échec du chargement de la photo principale :', error);
      if (active) setProfileImage(profileWebp);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    getSettingValue('availability_banner').then(({ data, error }) => {
      if (error) {
        console.error('Impossible de charger le bandeau de disponibilité :', error);
        return;
      }
      if (data?.trim()) setAvailability(data.trim());
    });
  }, []);

  // Typewriter
  useEffect(() => {
    if (prefersReducedMotion || isProfessional) {
      setTypedCount(FULL_TEXT.length);
      return;
    }
    let n = 0;
    let timeoutId;
    function step() {
      n++;
      setTypedCount(n);
      if (n < FULL_TEXT.length) timeoutId = setTimeout(step, 42);
    }
    step();
    return () => clearTimeout(timeoutId);
  }, [isProfessional]);

  function goToChapter(i, { jump = true } = {}) {
    const pos = STOPS[i];
    setScrubPct(pos);
    setActiveChapter(i);
    const chapter = CHAPTERS[i];
    if (!chapter) return;
    if (jump) {
      setTimeout(() => {
        const target = document.getElementById(chapter.target);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 320);
    }
  }

  function nearestStopIndex(pct) {
    let best = 0;
    let bestDist = Infinity;
    STOPS.forEach((s, i) => {
      const d = Math.abs(s - pct);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }

  function pctFromEvent(e) {
    const rect = scrubTrackRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    return Math.min(100, Math.max(0, x));
  }

  function startDrag(e) {
    draggingRef.current = true;
    setScrubPct(pctFromEvent(e));
  }

  function handleScrubKeyDown(e) {
    const currentChapter = nearestStopIndex(scrubPct);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      goToChapter(Math.max(0, currentChapter - 1));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      goToChapter(Math.min(CHAPTERS.length - 1, currentChapter + 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      goToChapter(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      goToChapter(CHAPTERS.length - 1);
    }
  }

  useEffect(() => {
    function onMove(e) {
      if (!draggingRef.current) return;
      setScrubPct(pctFromEvent(e));
    }
    function onUp(e) {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      goToChapter(nearestStopIndex(pctFromEvent(e)));
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="hero">
      <main className="hero-main">
        <span className="hero-badge">
          <span className="dot"></span>{isProfessional ? 'CRÉATEUR VISUEL · BÉNIN' : 'CALEB CREATIVE'}
        </span>
        {isProfessional && <div className="availability-banner"><span className="availability-dot" />{availability}</div>}
        <div className="hero-title-row">
          <h1>
            <span>{renderTyped(typedCount)}</span>
            <span className="type-cursor">|</span>
          </h1>
          {!isProfessional && <AiCore />}
        </div>
        <p className="sub">
          Vidéo IA, Design, montage vidéo et Visuels IA{' '}
          <strong>au service de vos projets, au Bénin et au-delà.</strong>
        </p>
        <div
          className="hero-photo"
          onPointerMove={handlePortraitPointerMove}
          onPointerLeave={resetPortraitPointer}
        >
          <div className="hero-photo-ring">
            <div className="hero-photo-frame">
              {profileImage && (
                <picture>
                  <source srcSet={profileWebp} type="image/webp" />
                  <img
                  src={profileImage}
                  alt="Photo de profil de Caleb Jesugnon AGBAKOU"
                  width="802"
                  height="900"
                  srcSet={`${profileWebp} 802w`}
                  loading="eager"
                  fetchpriority="high"
                  onError={() => {
                    if (profileImage !== profileWebp) setProfileImage(profileWebp);
                  }}
                  />
                </picture>
              )}
            </div>
          </div>
          <div className="hero-photo-info">
            <span className="hero-photo-title">Caleb Jesugnon AGBAKOU</span>
          </div>
        </div>
        <div className="cta-row">
          <a href="#portfolio" className="btn btn-primary">
            Voir mes réalisations
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
          <Link to="/boutique" className="btn btn-shop">
            Accéder à la boutique
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
          <a className="btn btn-ghost btn-cv" href="/caleb-creative-book.pdf" download>
            Télécharger mon CV / mon book
          </a>
        </div>
        <div className="motion-sequence" aria-label="Le processus créatif : idée, design, mouvement et rendu">
          <div className="motion-step idea-step">
            <span className="motion-step-visual idea-visual" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="motion-step-label">01 · IDÉE</span>
          </div>
          <div className="motion-step design-step">
            <span className="motion-step-visual design-visual" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="motion-step-label">02 · DESIGN</span>
          </div>
          <div className="motion-step movement-step">
            <span className="motion-step-visual movement-visual" aria-hidden="true">
              <i />
              <i />
            </span>
            <span className="motion-step-label">03 · MOUVEMENT</span>
          </div>
          <div className="motion-step result-step">
            <span className="motion-step-visual result-visual" aria-hidden="true">
              <i />
            </span>
            <span className="motion-step-label">04 · RENDU</span>
          </div>
        </div>
      </main>

      <div className="timeline">
        <div
          className="scrub-track"
          ref={scrubTrackRef}
          role="slider"
          tabIndex={0}
          aria-label="Navigation des sections"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(scrubPct)}
          aria-valuetext={CHAPTERS[nearestStopIndex(scrubPct)].label}
          onKeyDown={handleScrubKeyDown}
          onPointerDown={(e) => startDrag(e)}
        >
          <div className="scrub-fill" aria-hidden="true" style={{ width: `${scrubPct}%` }}></div>
          <div
            className="scrub-head"
            aria-hidden="true"
            style={{ left: `${scrubPct}%` }}
            onPointerDown={(e) => {
              e.stopPropagation();
              startDrag(e);
            }}
          ></div>
        </div>
        <div className="chapters">
          {CHAPTERS.map((c, i) => (
            <button
              key={c.target}
              type="button"
              className={`chapter${i === activeChapter ? ' active' : ''}`}
              onClick={() => goToChapter(i)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

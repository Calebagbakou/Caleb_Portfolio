import { useEffect, useRef, useState } from 'react';
import profileJpg from '../../../assets/profile.jpg';
import { getSettingValue } from '../../../services/settings';

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
  const [profileImage, setProfileImage] = useState(profileJpg);
  const [typedCount, setTypedCount] = useState(prefersReducedMotion ? FULL_TEXT.length : 0);
  const [activeChapter, setActiveChapter] = useState(0);
  const [scrubPct, setScrubPct] = useState(0);
  const scrubTrackRef = useRef(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    let active = true;
    getSettingValue('site_profile_image_url').then(({ data, error }) => {
      if (error) {
        console.error('Impossible de charger la photo principale depuis les paramètres :', error);
        return;
      }
      if (active && data) setProfileImage(data);
    }).catch((error) => {
      console.error('Échec du chargement de la photo principale :', error);
    });
    return () => {
      active = false;
    };
  }, []);

  // Typewriter
  useEffect(() => {
    if (prefersReducedMotion) return;
    let n = 0;
    let timeoutId;
    function step() {
      n++;
      setTypedCount(n);
      if (n < FULL_TEXT.length) timeoutId = setTimeout(step, 42);
    }
    step();
    return () => clearTimeout(timeoutId);
  }, []);

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
          <span className="dot"></span>CALEB CREATIVE
        </span>
        <h1>
          <span>{renderTyped(typedCount)}</span>
          <span className="type-cursor">|</span>
        </h1>
        <p className="sub">
          Le visuel fait tout. Ne laisse plus tes idées au brouillon. Laisse l'IA et le design exploser ton
          potentiel.
        </p>
        <div className="hero-photo">
          <div className="hero-photo-ring">
            <div className="hero-photo-frame">
              <img src={profileImage} alt="Photo de profil de Caleb Jesugnon AGBAKOU" loading="lazy" />
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
          <a href="/boutique" className="btn btn-ghost">
            Accéder à la boutique
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
        </div>
      </main>

      <div className="timeline">
        <div className="scrub-track" ref={scrubTrackRef} onPointerDown={(e) => startDrag(e)}>
          <div className="scrub-fill" style={{ width: `${scrubPct}%` }}></div>
          <div
            className="scrub-head"
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

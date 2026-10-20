import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

function getShortLink(value) {
  try {
    const url = new URL(value);
    const path = url.pathname;
    const suffixLength = Math.min(3, Math.floor(path.length / 3));
    if (!suffixLength) return `${url.origin}/…`;
    const prefixLength = Math.max(1, path.length - suffixLength);
    const shortenedPath = path.length > 1
      ? `${path.slice(0, prefixLength)}…${path.slice(-suffixLength)}`
      : '/…';
    return `${url.origin}${shortenedPath}`;
  } catch {
    return 'Lien d’activation';
  }
}

function isSecureLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export default function ProviderLink({ url, productName, linkNumber, actionLabel = `Activer ${productName}` }) {
  const [expanded, setExpanded] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const linkId = useId();
  const inactivityTimer = useRef(null);
  const toggleRef = useRef(null);
  const linkRef = useRef(null);
  const currentUrl = useRef(url);

  useEffect(() => {
    if (!expanded) return undefined;

    function collapse() {
      window.clearTimeout(inactivityTimer.current);
      setExpanded(false);
      setCopyStatus('');
    }

    function resetInactivityTimer() {
      window.clearTimeout(inactivityTimer.current);
      inactivityTimer.current = window.setTimeout(() => {
        if (linkRef.current?.contains(document.activeElement)) toggleRef.current?.focus();
        collapse();
      }, 60_000);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') collapse();
      else resetInactivityTimer();
    }

    resetInactivityTimer();
    document.addEventListener('pointerdown', resetInactivityTimer);
    document.addEventListener('pointermove', resetInactivityTimer, { passive: true });
    document.addEventListener('keydown', resetInactivityTimer);
    document.addEventListener('touchstart', resetInactivityTimer, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearTimeout(inactivityTimer.current);
      document.removeEventListener('pointerdown', resetInactivityTimer);
      document.removeEventListener('pointermove', resetInactivityTimer);
      document.removeEventListener('keydown', resetInactivityTimer);
      document.removeEventListener('touchstart', resetInactivityTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [expanded]);

  useLayoutEffect(() => {
    if (currentUrl.current === url) return;
    currentUrl.current = url;
    setExpanded(false);
    setCopyStatus('');
  }, [url]);

  if (typeof url !== 'string' || !url.trim()) return null;
  if (!isSecureLink(url)) {
    return <p className="account-error">Le lien d’accès n’est pas disponible en toute sécurité.</p>;
  }

  async function copyFullLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus('Copié ✓');
    } catch {
      setExpanded(true);
      setCopyStatus('Copie impossible. Le lien complet est affiché pour une copie manuelle.');
    }
  }

  function openFullLink() {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="provider-link">
      <h4 className="provider-link-heading">
        {productName}{linkNumber ? ` · Lien ${linkNumber}` : ''}
      </h4>
      <p className="provider-link-preview">{getShortLink(url)}</p>
      <div className="provider-link-actions">
        <button type="button" className="btn btn-primary" onClick={openFullLink}>
          {actionLabel}
        </button>
        <button type="button" className="btn btn-outline" onClick={copyFullLink}>
          Copier le lien
        </button>
        <button
          ref={toggleRef}
          type="button"
          className="btn btn-outline"
          aria-expanded={expanded}
          aria-controls={linkId}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? 'Masquer le lien' : 'Afficher le lien complet'}
        </button>
      </div>
      <span className="sr-only" aria-live="polite">{copyStatus}</span>
      <div
        ref={linkRef}
        id={linkId}
        className="provider-link-full"
        tabIndex={0}
        hidden={!expanded}
      >
        {url}
      </div>
    </section>
  );
}

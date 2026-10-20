import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSlowLoading } from '../../hooks/useSlowLoading';

const WHATSAPP_URL = 'https://wa.me/2290148135395';

export function LoadingFeedback({ phase, onRetry }) {
  if (phase === 'normal') return null;
  if (phase === 'slow') {
    return (
      <p className="slow-loading-message" role="status">
        Connexion lente, merci de patienter quelques secondes. Vos données sont en sécurité.
      </p>
    );
  }
  return (
    <div className="slow-loading-error" role="alert">
      <p>La connexion prend trop de temps. Vos données sont en sécurité.</p>
      <div className="slow-loading-actions">
        <button className="btn btn-outline" type="button" onClick={onRetry}>Réessayer</button>
        <a className="btn btn-outline" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">Contacter Caleb sur WhatsApp</a>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 6 }) {
  return (
    <div className="product-grid product-grid-skeleton" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <article className="product-skeleton-card" key={index}>
          <div className="product-skeleton-image" />
          <div className="product-skeleton-copy"><i /><b /><i /><strong /></div>
        </article>
      ))}
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <main className="wrap product-detail-skeleton" aria-hidden="true">
      <div className="skeleton-product-visual" />
      <div className="skeleton-product-info"><i /><b /><i /><i /><b /><i /><i /></div>
    </main>
  );
}

export function ProjectDetailSkeleton() {
  return (
    <main className="wrap project-detail-skeleton" aria-hidden="true">
      <i className="skeleton-project-back" />
      <b className="skeleton-project-title" />
      <div className="skeleton-project-content"><i /><div><b /><i /><i /><i /></div></div>
    </main>
  );
}

export function OrdersSkeleton() {
  return (
    <div className="orders-skeleton" aria-hidden="true">
      {Array.from({ length: 3 }, (_, index) => <article key={index}><b /><i /><i /><i /></article>)}
    </div>
  );
}

export function PageSkeleton({ variant = 'page' }) {
  const { phase, showLoader } = useSlowLoading(true);
  return (
    <>
      <div className="route-progress-bar" aria-hidden="true" />
      {showLoader && (
        <main className={`loading-skeleton loading-skeleton-${variant}`}>
          <LoadingFeedback phase={phase} onRetry={() => window.location.reload()} />
          <div aria-hidden="true">
            {variant === 'product' ? (
              <><div className="skeleton-product-visual" /><div className="skeleton-product-info"><i /><b /><i /><i /><b /><i /><i /></div></>
            ) : variant === 'project' ? (
              <><i className="skeleton-project-back" /><b className="skeleton-project-title" /><div className="skeleton-project-content"><i /><div><b /><i /><i /><i /></div></div></>
            ) : variant === 'orders' ? (
              <><b /><i /><i /><i /></>
            ) : (
              <div className="skeleton-product-grid">{Array.from({ length: 6 }, (_, index) => <article key={index}><i /><b /><i /><i /><strong /></article>)}</div>
            )}
          </div>
        </main>
      )}
    </>
  );
}

export function RouteProgress() {
  const [active, setActive] = useState(false);
  const firstLocation = useRef(true);
  const location = useLocation();

  useEffect(() => {
    if (firstLocation.current) {
      firstLocation.current = false;
      return undefined;
    }
    setActive(true);
    const timer = window.setTimeout(() => setActive(false), 600);
    return () => window.clearTimeout(timer);
  }, [location.key]);

  return active ? <div className="route-progress-bar route-progress-bar-active" aria-hidden="true" /> : null;
}

export function OfflineBanner() {
  const [status, setStatus] = useState(() => (typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline'));
  const reconnectTimer = useRef(null);

  useEffect(() => {
    function goOffline() {
      window.clearTimeout(reconnectTimer.current);
      setStatus('offline');
    }
    function goOnline() {
      setStatus('reconnected');
      reconnectTimer.current = window.setTimeout(() => setStatus('online'), 2000);
    }
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.clearTimeout(reconnectTimer.current);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (status === 'online') return null;
  return (
    <div className={`offline-banner${status === 'reconnected' ? ' is-reconnected' : ''}`} role="status" aria-live="polite">
      {status === 'offline' ? 'Vous êtes hors ligne. Reconnexion automatique…' : 'Connexion rétablie'}
    </div>
  );
}

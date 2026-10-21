import { useEffect, useState } from 'react';
import ProviderLink from './ProviderLink';
import { formatOrderReference } from '../../utils/orderReference';

function getPlatformState() {
  if (typeof navigator === 'undefined') return { android: false, ios: false, desktop: false, embedded: false };
  const userAgent = navigator.userAgent || '';
  const lowerAgent = userAgent.toLowerCase();
  const android = /android/i.test(userAgent);
  const ios = /iphone|ipad|ipod/i.test(userAgent)
    || (/macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1);
  const desktop = !android && !ios && /windows nt|macintosh|x11|linux x86_64/i.test(userAgent);
  const embedded = /whatsapp|fban|fbav|instagram|tiktok|bytedance|line\/|telegram|snapchat|twitter|; wv\)/i.test(userAgent);
  return { android, ios, desktop, embedded };
}

export default function DownloadSupport({ item, orderRef }) {
  const [platformState, setPlatformState] = useState({
    android: false, ios: false, desktop: false, embedded: false,
  });
  const [copyStatus, setCopyStatus] = useState('');
  const filename = item.filename || item.download_filename || '';
  const size = item.size || item.download_size || '';
  const platform = item.platform || item.download_platform || item.product?.download_platform || '';
  const extension = filename.split('.').pop()?.toLowerCase();
  const isAndroidFile = platform.toLowerCase() === 'android' || extension === 'apk';
  const needsAndroidWarning = isAndroidFile && (platformState.ios || platformState.desktop);
  const displayedReference = orderRef ? formatOrderReference(orderRef) : '';
  const supportMessage = encodeURIComponent(`Bonjour, mon téléchargement ${filename || ''} concernant la commande ${displayedReference} ne fonctionne pas. Pouvez-vous m’aider ?`);
  const supportUrl = `https://wa.me/2290148135395?text=${supportMessage}`;

  useEffect(() => {
    setPlatformState(getPlatformState());
  }, []);

  async function copyPageLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyStatus('Lien de la page copié.');
    } catch {
      setCopyStatus('La copie automatique est indisponible sur ce navigateur.');
    }
  }

  return (
    <div className="download-support">
      <dl className="download-support-facts">
        <div><dt>Fichier</dt><dd>{filename}</dd></div>
        {size && <div><dt>Taille</dt><dd>{size}</dd></div>}
        {platform && <div><dt>Plateforme</dt><dd>{platform}</dd></div>}
      </dl>

      {needsAndroidWarning && (
        <p className="download-support-warning" role="status">
          Ce fichier est prévu pour Android. Il ne s’ouvrira pas sur cet appareil.{' '}
          <a href={supportUrl} target="_blank" rel="noopener noreferrer">Contactez-nous pour la version adaptée.</a>
        </p>
      )}

      {platformState.embedded && (
        <div className="download-support-tip">
          <p>Ouvrez ce lien dans Chrome pour télécharger correctement.</p>
          <button type="button" className="btn btn-outline" onClick={copyPageLink}>Copier le lien de la page</button>
          <span className="download-support-copy-status" aria-live="polite">{copyStatus}</span>
        </div>
      )}

      <ProviderLink url={item.url} productName={item.name || filename} actionLabel="Télécharger" />

      <div className="download-support-troubleshooting">
        <strong>Le fichier ne s’ouvre pas ?</strong>
        <a href={supportUrl} target="_blank" rel="noopener noreferrer">Contacter le support avec la référence {displayedReference}</a>
      </div>
    </div>
  );
}

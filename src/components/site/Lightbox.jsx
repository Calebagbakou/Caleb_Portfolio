import { useEffect, useState } from 'react';
import { getYouTubeEmbedUrl } from '../../data/projectMedia';

/**
 * items: liste à plat de toutes les cartes portfolio (toutes rangées confondues)
 * index: index actuellement ouvert, ou null si fermé
 */
export default function Lightbox({ items, index, onClose, onNavigate }) {
  const [youtubeLoaded, setYoutubeLoaded] = useState(false);
  const open = index !== null && index !== undefined;
  const item = open ? items[index] : null;
  const isVideo = item?.media_type === 'youtube' || item?.media_type === 'external_video';

  function externalVideoSource(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      if (url.hostname === 'player.vimeo.com' || url.hostname === 'www.youtube.com') {
        return { kind: 'embed', src: url.href };
      }
      if (url.hostname === 'vimeo.com' || url.hostname === 'www.vimeo.com') {
        const videoId = url.pathname.split('/').filter(Boolean)[0];
        if (/^\d+$/.test(videoId || '')) {
          const playerUrl = new URL(`https://player.vimeo.com/video/${videoId}`);
          const unlistedHash = url.searchParams.get('h');
          if (unlistedHash) playerUrl.searchParams.set('h', unlistedHash);
          return { kind: 'embed', src: playerUrl.href };
        }
      }
      return { kind: 'file', src: url.href };
    } catch {
      return null;
    }
  }

  const youtubeEmbed = item?.media_type === 'youtube' ? getYouTubeEmbedUrl(item.media_url) : null;
  const externalSource = item?.media_type === 'external_video' ? externalVideoSource(item.media_url) : null;

  useEffect(() => {
    setYoutubeLoaded(false);
  }, [youtubeEmbed]);

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
      <div className={`lightbox-inner${isVideo ? ' video' : ''}`}>
        <div className="lightbox-thumb" style={item && !isVideo ? { background: item.gradient } : { background: '#000' }}>
          {item?.media_type === 'image' && item.media_url && (
            <img className="lightbox-image" src={item.media_url} alt={item.title} />
          )}
          {youtubeEmbed && (
            <>
              {!youtubeLoaded && <div className="video-loading" role="status">Chargement du lecteur…</div>}
              <iframe
                src={youtubeEmbed}
                width="100%"
                height="100%"
                frameBorder="0"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={() => setYoutubeLoaded(true)}
                style={{ position: 'absolute', inset: 0 }}
                title={`Lecteur vidéo : ${item.title}`}
              />
            </>
          )}
          {externalSource?.kind === 'embed' && (
            <iframe
              src={externalSource.src}
              width="100%"
              height="100%"
              frameBorder="0"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              style={{ position: 'absolute', inset: 0 }}
              title={item.title}
            />
          )}
          {externalSource?.kind === 'file' && (
            <video
              src={externalSource.src}
              controls
              playsInline
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
            />
          )}
        </div>
        <div className="lightbox-body">
          <div>
            <div className="lightbox-cat">{item?.catLabel}</div>
            <h3 className="lightbox-title">{item?.title}</h3>
            {item?.description && <p className="lightbox-description">{item.description}</p>}
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

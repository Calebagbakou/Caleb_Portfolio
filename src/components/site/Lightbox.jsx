import { useEffect, useState } from 'react';
import { DEFAULT_PROJECT_IMAGE_RATIO, getYouTubeEmbedUrl } from '../../data/projectMedia';
import { resolveExternalVideoSource } from '../../data/externalVideo';

/**
 * items: liste à plat de toutes les cartes portfolio (toutes rangées confondues)
 * index: index actuellement ouvert, ou null si fermé
 */
export default function Lightbox({ items, index, onClose, onNavigate }) {
  const [youtubeLoaded, setYoutubeLoaded] = useState(false);
  const [externalSource, setExternalSource] = useState(null);
  const [externalLoading, setExternalLoading] = useState(false);
  const [externalError, setExternalError] = useState('');
  const open = index !== null && index !== undefined;
  const item = open ? items[index] : null;
  const isVideo = item?.media_type === 'youtube' || item?.media_type === 'external_video';
  const isImage = item?.media_type === 'image';
  const imageRatio = item?.image_ratio || DEFAULT_PROJECT_IMAGE_RATIO;
  const imageRatioClass = imageRatio.replace('/', '-');

  const youtubeEmbed = item?.media_type === 'youtube' ? getYouTubeEmbedUrl(item.media_url) : null;

  useEffect(() => {
    let active = true;
    setExternalSource(null);
    setExternalError('');

    if (item?.media_type !== 'external_video' || !item.media_url) {
      setExternalLoading(false);
      return () => {
        active = false;
      };
    }

    setExternalLoading(true);
    resolveExternalVideoSource(item.media_url)
      .then((source) => {
        if (!source) throw new Error('Ce lien vidéo externe n’est pas pris en charge.');
        if (active) setExternalSource(source);
      })
      .catch((error) => {
        console.error('Impossible de charger le lecteur vidéo externe :', error);
        if (active) setExternalError(error.message || 'Impossible de résoudre le lien vidéo externe.');
      })
      .finally(() => {
        if (active) setExternalLoading(false);
      });

    return () => {
      active = false;
    };
  }, [item?.media_type, item?.media_url]);

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
      <div className={`lightbox-inner${isVideo ? ' video' : ''}${isImage ? ` image ratio-${imageRatioClass}` : ''}`}>
        <div
          className="lightbox-thumb"
          style={{
            background: item && !isVideo ? item.gradient : '#000',
            ...(isImage ? { aspectRatio: imageRatio } : {}),
            ...(externalSource?.aspectRatio ? { aspectRatio: externalSource.aspectRatio } : {}),
          }}
        >
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
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
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
          {item?.media_type === 'external_video' && externalLoading && (
            <div className="video-loading" role="status">Chargement du lecteur…</div>
          )}
          {item?.media_type === 'external_video' && externalError && (
            <div className="video-loading" role="alert">{externalError}</div>
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

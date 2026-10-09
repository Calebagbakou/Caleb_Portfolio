import { useEffect, useRef, useState } from 'react';
import { resolveExternalVideoSource } from '../../data/externalVideo';

let wistiaApiPromise;
let vimeoApiPromise;

function loadPlayerApi(src, globalName, currentPromise) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  if (currentPromise) return currentPromise;

  return new Promise((resolve, reject) => {
    let script = document.querySelector(`script[src="${src}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', () => resolve(window[globalName]), { once: true });
    script.addEventListener('error', () => reject(new Error(`Impossible de charger le lecteur ${globalName}.`)), { once: true });
  });
}

function loadWistiaApi() {
  wistiaApiPromise = loadPlayerApi(
    'https://fast.wistia.net/assets/external/E-v1.js',
    'Wistia',
    wistiaApiPromise,
  ).catch((error) => {
    wistiaApiPromise = null;
    throw error;
  });
  return wistiaApiPromise;
}

function loadVimeoApi() {
  vimeoApiPromise = loadPlayerApi(
    'https://player.vimeo.com/api/player.js',
    'Vimeo',
    vimeoApiPromise,
  ).catch((error) => {
    vimeoApiPromise = null;
    throw error;
  });
  return vimeoApiPromise;
}

function addAutoplayOptions(value, provider) {
  const url = new URL(value);
  if (provider === 'wistia') {
    url.searchParams.set('autoPlay', 'true');
    url.searchParams.set('muted', 'true');
    url.searchParams.set('silentAutoPlay', 'true');
    url.searchParams.set('endVideoBehavior', 'loop');
    url.searchParams.set('playbar', 'false');
    url.searchParams.set('fullscreenButton', 'false');
  } else {
    url.searchParams.set('autoplay', '1');
    url.searchParams.set('muted', '1');
    url.searchParams.set('loop', '1');
    url.searchParams.set('controls', '0');
    if (provider === 'vimeo') url.searchParams.set('background', '1');
  }
  return url.href;
}

function SoundButton({ muted, onToggle }) {
  return (
    <button
      className="p-preview-sound"
      type="button"
      aria-label={muted ? 'Activer le son' : 'Couper le son'}
      title={muted ? 'Activer le son' : 'Couper le son'}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
        {muted
          ? <path d="m17 9 5 6m0-6-5 6" />
          : <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M19 5a10 10 0 0 1 0 14" /></>}
      </svg>
    </button>
  );
}

export default function ExternalVideoPreview({ src, title, onFinished }) {
  const iframeRef = useRef(null);
  const playerRef = useRef(null);
  const stopTimerRef = useRef(null);
  const mutedRef = useRef(true);
  const [source, setSource] = useState(null);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    resolveExternalVideoSource(src)
      .then((resolved) => {
        if (!resolved) throw new Error('Ce lien vidéo externe n’est pas pris en charge pour l’aperçu.');
        if (active) setSource(resolved);
      })
      .catch((loadError) => {
        console.error('Échec du chargement de l’aperçu vidéo externe :', loadError);
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [src]);

  useEffect(() => {
    if (!source) return undefined;
    let active = true;
    let player;
    let vimeoPlayHandler;

    const finishAfterPreview = () => {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = window.setTimeout(() => {
        player?.pause?.();
        onFinished();
      }, 8000);
    };

    async function initializePlayer() {
      try {
        if (source.kind === 'file') return;
        const url = new URL(source.src);
        if (url.hostname === 'fast.wistia.net') {
          const mediaId = url.pathname.split('/').filter(Boolean).at(-1);
          await loadWistiaApi();
          if (!active || !mediaId) return;
          window._wq = window._wq || [];
          window._wq.push({
            id: mediaId,
            onReady: (wistiaPlayer) => {
              if (!active) return;
              player = wistiaPlayer;
              playerRef.current = wistiaPlayer;
              if (mutedRef.current) wistiaPlayer.mute();
              else wistiaPlayer.unmute();
              wistiaPlayer.bind('play', finishAfterPreview);
              wistiaPlayer.play().catch((playError) => {
                console.error('Échec de lecture de l’aperçu Wistia :', playError);
              });
            },
          });
        } else if (url.hostname === 'player.vimeo.com') {
          const vimeo = await loadVimeoApi();
          if (!active || !iframeRef.current) return;
          player = new vimeo.Player(iframeRef.current);
          playerRef.current = player;
          await player.setVolume(mutedRef.current ? 0 : 1);
          player.on('play', () => finishAfterPreview());
          vimeoPlayHandler = () => finishAfterPreview();
          await player.play();
        }
      } catch (playerError) {
        if (!active) return;
        console.error('Échec de l’initialisation de l’aperçu vidéo externe :', playerError);
        setError(true);
      }
    }

    initializePlayer();
    return () => {
      active = false;
      window.clearTimeout(stopTimerRef.current);
      if (player && source.kind !== 'file') {
        if (vimeoPlayHandler) player.off?.('play', vimeoPlayHandler);
        player.destroy?.();
      }
      playerRef.current = null;
    };
  }, [source, onFinished]);

  function toggleSound() {
    const nextMuted = !muted;
    try {
      if (source?.kind === 'file') {
        const video = iframeRef.current;
        if (video) video.muted = nextMuted;
      } else if (playerRef.current) {
        if (nextMuted) playerRef.current.mute();
        else playerRef.current.unmute();
      }
      mutedRef.current = nextMuted;
      setMuted(nextMuted);
    } catch (playerError) {
      console.error('Impossible de modifier le son de l’aperçu vidéo :', playerError);
    }
  }

  if (error) return <span className="p-preview-error">APERÇU INDISPONIBLE</span>;

  if (source?.kind === 'file') {
    return (
      <div className="p-video-preview">
        <video
          ref={iframeRef}
          src={source.src}
          autoPlay
          muted
          loop
          playsInline
          onPlay={() => {
            window.clearTimeout(stopTimerRef.current);
            stopTimerRef.current = window.setTimeout(() => {
              iframeRef.current?.pause();
              onFinished();
            }, 8000);
          }}
          onError={() => setError(true)}
        />
        <SoundButton muted={muted} onToggle={toggleSound} />
      </div>
    );
  }

  if (!source?.src) return null;
  const playerUrl = new URL(source.src);
  const provider = playerUrl.hostname === 'fast.wistia.net' ? 'wistia' : 'vimeo';

  return (
    <div className="p-video-preview">
      <iframe
        ref={iframeRef}
        src={addAutoplayOptions(source.src, provider)}
        title={`Aperçu silencieux : ${title}`}
        allow="autoplay; fullscreen; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        tabIndex="-1"
      />
      <SoundButton muted={muted} onToggle={toggleSound} />
    </div>
  );
}

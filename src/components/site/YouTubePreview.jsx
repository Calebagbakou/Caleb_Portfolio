import { useEffect, useRef, useState } from 'react';

let youtubeApiPromise;

function loadYouTubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve(window.YT);
    };

    let script = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('error', () => reject(new Error('Impossible de charger l’API officielle du lecteur YouTube.')), { once: true });
  }).catch((error) => {
    youtubeApiPromise = null;
    throw error;
  });

  return youtubeApiPromise;
}

export default function YouTubePreview({ src, title, onFinished }) {
  const iframeRef = useRef(null);
  const playerRef = useRef(null);
  const stopTimerRef = useRef(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    loadYouTubeIframeApi()
      .then((youtube) => {
        if (!active || !iframeRef.current) return;
        playerRef.current = new youtube.Player(iframeRef.current, {
          events: {
            onReady: ({ target }) => {
              target.mute();
              target.playVideo();
            },
            onStateChange: (event) => {
              if (event.data !== youtube.PlayerState.PLAYING) return;
              window.clearTimeout(stopTimerRef.current);
              stopTimerRef.current = window.setTimeout(() => {
                event.target.pauseVideo();
                onFinished();
              }, 8000);
            },
            onError: (event) => {
              setError(true);
              console.error(`L’aperçu YouTube n’a pas pu être lu (erreur ${event.data}).`);
            },
          },
        });
      })
      .catch((loadError) => {
        if (!active) return;
        setError(true);
        console.error('Échec du chargement de l’aperçu YouTube :', loadError);
      });

    return () => {
      active = false;
      window.clearTimeout(stopTimerRef.current);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [onFinished]);

  return (
    <div className="p-video-preview">
      <iframe
        ref={iframeRef}
        src={src}
        title={`Aperçu silencieux : ${title}`}
        loading="lazy"
        allow="autoplay; encrypted-media"
        referrerPolicy="strict-origin-when-cross-origin"
        tabIndex="-1"
      />
      {error && <span className="p-preview-error">APERÇU INDISPONIBLE</span>}
    </div>
  );
}

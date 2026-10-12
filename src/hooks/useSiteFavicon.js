import { useEffect } from 'react';
import { getSettingValue } from '../services/settings';

export default function useSiteFavicon() {
  useEffect(() => {
    const favicon = document.getElementById('site-favicon');
    if (!favicon) return undefined;

    const fallbackUrl = favicon.href;
    function restoreFallback() {
      favicon.href = fallbackUrl;
    }
    favicon.addEventListener('error', restoreFallback);

    let active = true;
    getSettingValue('favicon_url')
      .then(({ data, error }) => {
        if (error) {
          console.error('Impossible de charger le favicon depuis les paramètres :', error);
          return;
        }
        if (active && typeof data === 'string' && data.trim()) {
          favicon.href = data.trim();
        }
      })
      .catch((error) => {
        console.error('Échec du chargement du favicon :', error);
      });

    return () => {
      active = false;
      favicon.removeEventListener('error', restoreFallback);
    };
  }, []);
}

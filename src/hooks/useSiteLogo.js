import { useEffect, useState } from 'react';
import { getSettingValue } from '../services/settings';

export default function useSiteLogo() {
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    let active = true;
    getSettingValue('logo_url')
      .then(({ data, error }) => {
        if (error) {
          console.error('Impossible de charger le logo depuis les paramètres :', error);
          return;
        }
        if (active) setLogoUrl(typeof data === 'string' ? data : '');
      })
      .catch((error) => {
        console.error('Échec du chargement du logo :', error);
      });

    return () => {
      active = false;
    };
  }, []);

  return [logoUrl, () => setLogoUrl('')];
}

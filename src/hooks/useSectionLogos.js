import { useEffect, useState } from 'react';
import { parseSectionLogoSettings, SECTION_LOGOS_SETTING } from '../data/sectionLogos';
import { getSettingValue } from '../services/settings';

export function useSectionLogos() {
  const [logos, setLogos] = useState({});

  useEffect(() => {
    let active = true;
    getSettingValue(SECTION_LOGOS_SETTING)
      .then(({ data, error }) => {
        if (error) {
          console.error('Impossible de charger les logos personnalisés des sections :', error);
          return;
        }
        if (active) setLogos(parseSectionLogoSettings(data));
      })
      .catch((error) => {
        console.error('Impossible de lire les logos personnalisés des sections :', error);
      });
    return () => {
      active = false;
    };
  }, []);

  return logos;
}

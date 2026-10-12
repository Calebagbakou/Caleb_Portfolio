import { useEffect, useState } from 'react';
import { DEFAULT_COMPETENCIES, COMPETENCIES_SETTING_KEY, parseCompetencies } from '../../../data/competencies';
import { getSettingValue } from '../../../services/settings';
import RevealHeading from '../../../components/site/RevealHeading';
import { useReveal } from '../../../hooks/useReveal';

export default function CompetenciesSection() {
  const [competencies, setCompetencies] = useState(DEFAULT_COMPETENCIES);
  const [listRef, visible] = useReveal();

  useEffect(() => {
    let active = true;
    getSettingValue(COMPETENCIES_SETTING_KEY).then(({ data, error }) => {
      if (error) {
        console.error('Impossible de charger les compétences du portfolio :', error);
        return;
      }
      if (data == null) return;
      try {
        const nextCompetencies = parseCompetencies(data);
        if (active) setCompetencies(nextCompetencies);
      } catch (parseError) {
        console.error('La liste des compétences du portfolio est invalide :', parseError);
      }
    }).catch((error) => {
      console.error('Échec du chargement des compétences du portfolio :', error);
    });

    return () => {
      active = false;
    };
  }, []);

  if (competencies.length === 0) return null;

  return (
    <section className="competencies-section" id="competences">
      <div className="wrap">
        <RevealHeading eyebrow="COMPÉTENCES">Des compétences créatives au service de vos projets.</RevealHeading>
        <div className={`competencies-grid reveal${visible ? ' in' : ''}`} ref={listRef}>
          {competencies.map((competency, index) => (
            <div className="competency-card" key={`${competency}-${index}`}>
              <span className="competency-card-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="competency-card-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 3l1.8 5.3L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.7L12 3z" />
                  <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" />
                </svg>
              </span>
              <h3>{competency}</h3>
              <span className="competency-card-line" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import { TOOL_GROUPS } from '../../../data/tools';
import { useTilt } from '../../../hooks/useTilt';
import { useReveal } from '../../../hooks/useReveal';
import RevealHeading from '../../../components/site/RevealHeading';
import ParticleField from '../../../components/site/ParticleField';
import { usePresentation } from '../../../context/PresentationContext';
import { getSettingValue } from '../../../services/settings';

function ToolChip({ tool, logoUrl, index }) {
  const ref = useTilt();
  return (
    <div className="tool-chip" ref={ref}>
      <span className="tool-mark">
        {logoUrl
          ? <img className="tool-avatar tool-logo" src={logoUrl} alt="" loading="lazy" />
          : <span className="tool-avatar">{tool.avatar}</span>}
        <svg className="tool-mark-outline" viewBox="0 0 36 36" aria-hidden="true">
          <circle className="tool-mark-trace" cx="18" cy="18" r="16" style={{ animationDelay: `${index * 55}ms` }} />
        </svg>
      </span>
      {tool.name}
    </div>
  );
}

function ToolGroup({ group, index, toolLogos }) {
  const [ref, visible] = useReveal();
  return (
    <div className={`tool-group reveal${visible ? ' in' : ''}`} ref={ref}
      style={{ transitionDelay: `${Math.min(index * 100, 300)}ms` }}>
      <span className="tool-group-label">{group.label}</span>
      <div className="tool-grid">
        {group.tools.map((tool, toolIndex) => (
          <ToolChip tool={tool} logoUrl={toolLogos[tool.name]} index={toolIndex} key={tool.name} />
        ))}
      </div>
    </div>
  );
}

export default function ToolsSection() {
  const [toolLogos, setToolLogos] = useState({});
  const sectionRef = useRef(null);
  const { isProfessional } = usePresentation();

  useEffect(() => {
    let active = true;
    getSettingValue('site_tool_logos').then(({ data, error }) => {
      if (error) {
        console.error('Impossible de charger les logos des outils depuis les paramètres :', error);
        return;
      }
      if (!data) return;
      try {
        const parsed = JSON.parse(data);
        if (
          !parsed
          || typeof parsed !== 'object'
          || Array.isArray(parsed)
          || Object.values(parsed).some((url) => typeof url !== 'string')
        ) {
          throw new Error('Le paramètre des logos des outils doit contenir un objet JSON avec des URLs textuelles.');
        }
        if (active) setToolLogos(parsed);
      } catch (parseError) {
        console.error('Impossible de lire les logos des outils enregistrés :', parseError);
      }
    }).catch((error) => {
      console.error('Échec du chargement des logos des outils :', error);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="alt tools-section" id="tools" ref={sectionRef}>
      {!isProfessional && <ParticleField scopeRef={sectionRef} className="tools-particle-field" />}
      <div className="wrap">
        <RevealHeading eyebrow="OUTILS">Un savoir-faire technique, augmenté par l'IA.</RevealHeading>
        {TOOL_GROUPS.map((group, index) => (
          <ToolGroup group={group} index={index} toolLogos={toolLogos} key={group.label} />
        ))}
      </div>
    </section>
  );
}

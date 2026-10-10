import { useReveal } from '../../../hooks/useReveal';
import { useTilt } from '../../../hooks/useTilt';
import RevealHeading from '../../../components/site/RevealHeading';
import SectionIcon from '../../../components/site/SectionIcon';
import { useSectionLogos } from '../../../hooks/useSectionLogos';

const AUDIENCE = [
  {
    id: 'about-individuals',
    icon: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0114 0" />
      </>
    ),
    name: 'Particuliers',
    desc: 'Portraits, réseaux sociaux, projets personnels',
  },
  {
    id: 'about-businesses',
    icon: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="1.5" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </>
    ),
    name: 'Entreprises',
    desc: 'Identité visuelle, contenus marketing, publicités',
  },
  {
    id: 'about-organizations',
    icon: (
      <>
        <path d="M12 2l8 4.5v9L12 20l-8-4.5v-9z" />
        <path d="M12 11v9M4 6.5l8 4.5 8-4.5" />
      </>
    ),
    name: 'Organisations',
    desc: 'Communication institutionnelle et événementielle',
  },
];

export default function About() {
  const logos = useSectionLogos();
  const [ref, visible] = useReveal();
  const tilt1 = useTilt();
  const tilt2 = useTilt();

  return (
    <section className="wrap" id="about">
      <RevealHeading eyebrow="À PROPOS">
        Passionné par la création visuelle, augmenté par l'intelligence artificielle.
      </RevealHeading>
      <p className="about-body">
        Depuis près de deux ans, <strong>Caleb Jesugnon AGBAKOU</strong> met la puissance de
        l'intelligence artificielle au service de la créativité, transformant des idées en
        réalisations concrètes : images, vidéos, designs, identités visuelles. Attentif au détail,
        il accompagne particuliers, entreprises et organisations dans la conception de contenus
        visuels qui marquent.
      </p>
      <div className="about-cards" ref={ref}>
        <div className={`card mission-card reveal${visible ? ' in' : ''}`} ref={tilt1}>
          <div className="tag-row">
            <span className="tag-ic">
              <SectionIcon id="about-mission" logos={logos} className="section-icon-svg">
                <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z" />
              </SectionIcon>
            </span>
            <span className="tag">NOTRE MISSION</span>
          </div>
          <p>Transformer vos idées en réalisations d'exception grâce à l'intelligence artificielle.</p>
        </div>
        <div className={`card accompagne reveal${visible ? ' in' : ''}`} style={{ transitionDelay: '80ms' }} ref={tilt2}>
          <div className="tag-row">
            <span className="tag-ic">
              <SectionIcon id="about-audience" logos={logos} className="section-icon-svg">
                <path d="M17 20v-1.5a3.5 3.5 0 00-3.5-3.5h-5A3.5 3.5 0 005 18.5V20" />
                <circle cx="9.5" cy="7.5" r="3.5" />
                <path d="M19 20v-1.5a3.3 3.3 0 00-2.2-3.1M14.5 4.2a3.5 3.5 0 010 6.6" />
              </SectionIcon>
            </span>
            <span className="tag">QUI J'ACCOMPAGNE</span>
          </div>
          <div className="audience-list">
            {AUDIENCE.map((a) => (
              <div className="audience-item" key={a.name}>
                <span className="audience-ic">
                  <SectionIcon id={a.id} logos={logos} className="section-icon-svg">
                    {a.icon}
                  </SectionIcon>
                </span>
                <div>
                  <div className="name">{a.name}</div>
                  <div className="desc">{a.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

import { useReveal } from '../../../hooks/useReveal';
import RevealHeading from '../../../components/site/RevealHeading';

const SERVICES = [
  {
    title: 'Création de contenu IA',
    desc: 'Concepts visuels générés et affinés pour vos campagnes, du brief au rendu final.',
    icon: <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z" />,
  },
  {
    title: 'Création d\u2019images IA',
    desc: "Visuels originaux générés par IA, dirigés et retravaillés pour un rendu fidèle à votre marque.",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="1.5" />
        <path d="M21 16l-5.5-5.5L4 21" />
      </>
    ),
  },
  {
    title: 'Création de vidéos IA',
    desc: 'Séquences vidéo générées par IA pour des teasers, publicités et contenus courts.',
    icon: (
      <>
        <rect x="3" y="5" width="14" height="14" rx="2" />
        <path d="M17 9l4-2v10l-4-2" />
      </>
    ),
  },
  {
    title: 'Motion Design',
    desc: 'Animations et transitions qui donnent du mouvement à vos logos, titres et interfaces.',
    icon: (
      <>
        <path d="M4 17l5-9 4 6 2-3 5 6" />
        <circle cx="18" cy="6" r="2" />
      </>
    ),
  },
  {
    title: 'Montage vidéo professionnel',
    desc: 'Montage, étalonnage et rythme pour transformer vos rushes en récit clair.',
    icon: <path d="M4 6h16M4 12h10M4 18h13" />,
  },
  {
    title: "Création d'affiches",
    desc: "Affiches et supports imprimés pensés pour capter l'attention en un coup d'œil.",
    icon: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="1.5" />
        <path d="M9 7h6M9 11h6M9 15h3" />
      </>
    ),
  },
  {
    title: 'Création de logos',
    desc: 'Identités visuelles simples et mémorables, pensées pour durer.',
    icon: (
      <>
        <path d="M12 2l8 4.5v9L12 20l-8-4.5v-9z" />
        <path d="M12 11v9M4 6.5l8 4.5 8-4.5" />
      </>
    ),
  },
  {
    title: 'Retouche photo IA',
    desc: 'Correction, nettoyage et sublimation de portraits et photos produit.',
    icon: <path d="M4 20l6-6M14 4l6 6-9 9H5v-6z" />,
  },
  {
    title: 'Prompt Engineering',
    desc: "Conception de prompts optimisés pour exploiter tout le potentiel des IA créatives.",
    icon: <path d="M4 4l4 8-4 8M12 20h8" />,
  },
];

function ServiceCard({ service, index }) {
  const [ref, visible] = useReveal();
  return (
    <div
      className={`service reveal${visible ? ' in' : ''}`}
      ref={ref}
      style={{ transitionDelay: `${Math.min(index * 60, 360)}ms` }}
    >
      <div className="service-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          {service.icon}
        </svg>
      </div>
      <div>
        <h3>{service.title}</h3>
        <p>{service.desc}</p>
      </div>
    </div>
  );
}

export default function ServicesSection() {
  return (
    <section className="alt" id="services">
      <div className="wrap">
        <RevealHeading eyebrow="SERVICES">
          Des solutions créatives complètes, propulsées par l'IA.
        </RevealHeading>
        <div className="services-grid">
          {SERVICES.map((s, i) => (
            <ServiceCard service={s} index={i} key={s.title} />
          ))}
        </div>
        <p className="services-note">+ Conseil en solutions créatives IA, sur mesure selon votre projet.</p>
      </div>
    </section>
  );
}

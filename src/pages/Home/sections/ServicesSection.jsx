import { useEffect, useState } from 'react';
import { DEFAULT_SERVICES, parseServices, SERVICES_SETTING_KEY } from '../../../data/services';
import { getSettingValue } from '../../../services/settings';
import { useReveal } from '../../../hooks/useReveal';
import RevealHeading from '../../../components/site/RevealHeading';
import SectionIcon from '../../../components/site/SectionIcon';
import { useSectionLogos } from '../../../hooks/useSectionLogos';

const SERVICE_MARKS = {
  sparkles: <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z" />,
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M21 16l-5.5-5.5L4 21" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="5" width="14" height="14" rx="2" />
      <path d="M17 9l4-2v10l-4-2" />
    </>
  ),
  motion: (
    <>
      <path d="M4 17l5-9 4 6 2-3 5 6" />
      <circle cx="18" cy="6" r="2" />
    </>
  ),
  edit: <path d="M4 20l6-6M14 4l6 6-9 9H5v-6z" />,
  poster: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M9 7h6M9 11h6M9 15h3" />
    </>
  ),
  logo: (
    <>
      <path d="M12 2l8 4.5v9L12 20l-8-4.5v-9z" />
      <path d="M12 11v9M4 6.5l8 4.5 8-4.5" />
    </>
  ),
  prompt: <path d="M4 4l4 8-4 8M12 20h8" />,
};

function ServiceCard({ service, index, logos }) {
  const [ref, visible] = useReveal();
  return (
    <div
      className={`service reveal${visible ? ' in' : ''}`}
      ref={ref}
      style={{ transitionDelay: `${Math.min(index * 60, 360)}ms` }}
    >
      <div className="service-icon">
        <SectionIcon id={service.id} logos={logos}>{SERVICE_MARKS[service.icon]}</SectionIcon>
      </div>
      <div>
        <h3>{service.title}</h3>
        <p>{service.desc}</p>
      </div>
    </div>
  );
}

export default function ServicesSection() {
  const logos = useSectionLogos();
  const [services, setServices] = useState(DEFAULT_SERVICES);

  useEffect(() => {
    let active = true;
    getSettingValue(SERVICES_SETTING_KEY).then(({ data, error }) => {
      if (error) {
        console.error('Impossible de charger les services du portfolio :', error);
        return;
      }
      if (data == null) return;
      try {
        const nextServices = parseServices(data);
        if (active) setServices(nextServices);
      } catch (parseError) {
        console.error('La liste des services du portfolio est invalide :', parseError);
      }
    }).catch((error) => {
      console.error('Échec du chargement des services du portfolio :', error);
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="alt" id="services">
      <div className="wrap">
        <RevealHeading eyebrow="SERVICES">
          Des solutions créatives complètes, propulsées par l'IA.
        </RevealHeading>
        <div className="services-grid">
          {services.map((service, index) => (
            <ServiceCard service={service} index={index} logos={logos} key={service.id} />
          ))}
        </div>
      </div>
    </section>
  );
}

import Hero from './sections/Hero';
import ParticleField from '../../components/site/ParticleField';
import Stats from './sections/Stats';
import About from './sections/About';
import ServicesSection from './sections/ServicesSection';
import PortfolioSection from './sections/PortfolioSection';
import ToolsSection from './sections/ToolsSection';
import FaqSection from './sections/FaqSection';
import ContactSection from './sections/ContactSection';
import TestimonialsSection from './sections/TestimonialsSection';
import CompetenciesSection from './sections/CompetenciesSection';
import { usePresentation } from '../../context/PresentationContext';

export default function Home() {
  const { isProfessional } = usePresentation();

  return (
    <>
      {!isProfessional && <ParticleField />}
      <Hero />
      <Stats />
      <About />
      <CompetenciesSection />
      <ServicesSection />
      <PortfolioSection />
      <ToolsSection />
      <FaqSection />
      <ContactSection />
      <TestimonialsSection />
    </>
  );
}

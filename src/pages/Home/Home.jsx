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
import Seo from '../../components/site/Seo';
import WhatsAppButton from '../../components/site/WhatsAppButton';
import BackToTop from '../../components/site/BackToTop';

export default function Home() {
  const { isProfessional } = usePresentation();

  return (
    <>
      <Seo />
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
      <WhatsAppButton />
      <BackToTop />
    </>
  );
}

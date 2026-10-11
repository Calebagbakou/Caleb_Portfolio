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

export default function Home() {
  return (
    <>
      <ParticleField />
      <Hero />
      <Stats />
      <About />
      <ServicesSection />
      <PortfolioSection />
      <ToolsSection />
      <FaqSection />
      <ContactSection />
      <TestimonialsSection />
    </>
  );
}

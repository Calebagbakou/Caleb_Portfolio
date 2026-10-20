import { Link } from 'react-router-dom';
import ShopArrow from './ShopArrow';
import { legalFacts } from '../../data/legalFacts';

export default function ShopFooter() {
  const whatsappMessage = encodeURIComponent(`Bonjour, j’ai besoin d’aide concernant la boutique ${legalFacts.business.commercialName}.`);

  return (
    <footer className="shop-footer">
      <div className="wrap shop-footer-row">
        <span>© {legalFacts.business.copyrightYear} {legalFacts.business.commercialName} — Boutique</span>
        <div className="shop-footer-links">
          <Link to={legalFacts.legalRoutes.privacy}>Confidentialité</Link>
          <Link to={legalFacts.legalRoutes.terms}>Conditions</Link>
          <Link to={legalFacts.legalRoutes.notices}>Mentions légales</Link>
          <a href={`${legalFacts.contact.whatsappHref}?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer">
            Besoin d’aide ? Écrivez-nous sur WhatsApp <ShopArrow />
          </a>
        </div>
      </div>
    </footer>
  );
}

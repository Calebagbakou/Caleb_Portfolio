import { Link } from 'react-router-dom';
import { legalFacts } from '../../data/legalFacts';

export default function Footer() {
  return (
    <footer>
      <div className="wrap footer-row">
        <span className="footer-brand">{legalFacts.business.commercialName.toUpperCase()}</span>
        <span className="footer-note">© {legalFacts.business.copyrightYear} — {legalFacts.business.location}</span>
        <nav className="footer-legal-links" aria-label="Informations légales">
          <Link to={legalFacts.legalRoutes.privacy}>Confidentialité</Link>
          <Link to={legalFacts.legalRoutes.terms}>Conditions</Link>
          <Link to={legalFacts.legalRoutes.notices}>Mentions légales</Link>
        </nav>
      </div>
    </footer>
  );
}

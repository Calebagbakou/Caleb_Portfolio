import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer>
      <div className="wrap footer-row">
        <span className="footer-brand">CALEB CREATIVE</span>
        <span className="footer-note">© 2026 — Abomey, Bénin</span>
        <nav className="footer-legal-links" aria-label="Informations légales">
          <Link to="/confidentialite">Confidentialité</Link>
          <Link to="/conditions">Conditions</Link>
        </nav>
      </div>
    </footer>
  );
}

import { Link } from 'react-router-dom';
import ShopArrow from './ShopArrow';

export default function ShopFooter() {
  const whatsappMessage = encodeURIComponent('Bonjour, j’ai besoin d’aide concernant la boutique Caleb Creative.');

  return (
    <footer className="shop-footer">
      <div className="wrap shop-footer-row">
        <span>© 2026 Caleb Creative — Boutique</span>
        <div className="shop-footer-links">
          <Link to="/confidentialite">Confidentialité</Link>
          <Link to="/conditions">Conditions</Link>
          <a href={`https://wa.me/2290148135395?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer">
            Besoin d’aide ? Écrivez-nous sur WhatsApp <ShopArrow />
          </a>
        </div>
      </div>
    </footer>
  );
}

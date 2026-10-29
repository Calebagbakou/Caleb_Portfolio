import { Link } from 'react-router-dom';
import { legalFacts } from '../../data/legalFacts';

export default function ShopFooter() {
  const { business, contact, legalRoutes, warranty } = legalFacts;
  const whatsappMessage = encodeURIComponent(`Bonjour, j’ai besoin d’aide concernant la boutique ${business.commercialName}.`);

  return (
    <footer className="shop-footer">
      <div className="wrap">
        <div className="shop-footer-grid">
          <div className="shop-footer-brand">
            <strong>{business.commercialName}</strong>
            <p>{business.status} · {business.location}</p>
            <p>Abonnements et outils créatifs, livrés numériquement après validation du paiement.</p>
          </div>

          <nav aria-label="Boutique">
            <h2>Boutique</h2>
            <ul>
              <li><Link to="/boutique">Accueil</Link></li>
              <li><Link to="/boutique/catalogue">Catalogue</Link></li>
              <li><Link to="/boutique/compte">Mon compte</Link></li>
              <li><Link to="/">Portfolio</Link></li>
            </ul>
          </nav>

          <nav aria-label="Informations légales">
            <h2>Informations</h2>
            <ul>
              <li><Link to={legalRoutes.terms}>Conditions de vente</Link></li>
              <li><Link to={legalRoutes.privacy}>Confidentialité</Link></li>
              <li><Link to={legalRoutes.notices}>Mentions légales</Link></li>
            </ul>
          </nav>

          <div>
            <h2>Contact &amp; paiement</h2>
            <ul>
              <li>
                <a href={`${contact.whatsappHref}?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer">
                  WhatsApp {contact.whatsapp}
                </a>
              </li>
              <li><a href={contact.emailHref}>{contact.email}</a></li>
            </ul>
            <p>Garantie {warranty.refundWindowDays} jours · Réponse sous {contact.responseTime}</p>
            <div className="shop-footer-pay" aria-label="Moyens de paiement">
              <span>Mobile Money</span>
              <span>Cartes</span>
              <span>Crypto</span>
            </div>
          </div>
        </div>

        <div className="shop-footer-bottom">
          <span>© {business.copyrightYear} {business.commercialName}. Tous droits réservés.</span>
          <span>Montants en {legalFacts.payment.currency}</span>
        </div>
      </div>
    </footer>
  );
}

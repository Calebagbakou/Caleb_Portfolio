import { Link } from 'react-router-dom';
import { legalFacts } from '../../data/legalFacts';

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5L20 7" />
  </svg>
);

export default function GuaranteeBox() {
  return (
    <aside className="guarantee-box" aria-label="Garanties d’achat">
      <h2>Acheter en confiance</h2>
      <ul className="guarantee-list">
        <li>
          <Check />
          <span>
            Garantie de {legalFacts.warranty.refundWindowDays} jours
            <small>{legalFacts.warranty.refundForFailure}</small>
          </span>
        </li>
        <li>
          <Check />
          <span>
            Paiement sécurisé
            <small>{legalFacts.payment.redirect}</small>
          </span>
        </li>
        <li>
          <Check />
          <span>
            Support WhatsApp {legalFacts.contact.whatsappAvailability}
            <small>En cas de problème d’accès, le support examine votre demande.</small>
          </span>
        </li>
      </ul>
      <Link className="guarantee-more" to={legalFacts.legalRoutes.terms}>Lire les conditions complètes</Link>
    </aside>
  );
}

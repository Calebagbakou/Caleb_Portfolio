import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LAST_ORDER_KEY } from '../../context/CartContext';
import { formatPrice } from '../../data/products';

export default function Confirmation() {
  const location = useLocation();
  const [order, setOrder] = useState(undefined); // undefined = pas encore lu, null = absent

  useEffect(() => {
    if (location.state?.order) {
      setOrder(location.state.order);
      return;
    }
    try {
      const raw = localStorage.getItem(LAST_ORDER_KEY);
      setOrder(raw ? JSON.parse(raw) : null);
    } catch (error) {
      console.error('Impossible de lire le reçu local :', error);
      setOrder(null);
    }
  }, [location.state]);

  if (order === undefined) return null;

  if (!order || !order.ref) {
    return (
      <main>
        <div className="confirm-wrap">
          <h1 style={{ fontSize: '1.6rem' }}>Aucune commande récente</h1>
          <p style={{ color: 'var(--ink-dim)', marginBottom: 22 }}>
            Nous n'avons pas trouvé de commande à afficher.
          </p>
          <Link to="/boutique/catalogue" className="btn btn-dark">
            Découvrir le catalogue
          </Link>
        </div>
      </main>
    );
  }

  if (order.payment_status !== 'confirme') {
    return (
      <main>
        <div className="confirm-wrap">
          <h1 style={{ fontSize: '1.6rem' }}>Paiement en attente</h1>
          <p style={{ color: 'var(--ink-dim)', marginBottom: 22 }}>
            La commande {order.ref} n’a pas encore été confirmée par KKiaPay. Si tu viens de payer, actualise la
            page dans quelques instants ou contacte Caleb avec cette référence.
          </p>
          <Link to="/boutique/catalogue" className="btn btn-dark">Retour à la boutique</Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="confirm-wrap">
        <div className="confirm-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M5 12l5 5L20 7" />
          </svg>
        </div>
        <h1 style={{ fontSize: 'clamp(1.6rem,4vw,2.1rem)', margin: '0 0 8px' }}>Paiement confirmé</h1>
        <p style={{ color: 'var(--ink-dim)' }}>Merci {order.customer?.name} ! Ton paiement KKiaPay a été vérifié.</p>
        <div className="confirm-ref">
          Référence : <strong>{order.ref}</strong>
        </div>

        <div className="confirm-summary">
          <div>
            {(order.items || []).map((line) => (
              <div className="summary-row" key={`${line.productId}-${line.planId}`}>
                <span>
                  {line.name} ({line.planLabel}) ×{line.qty}
                </span>
                <span>{formatPrice(line.lineTotal)}</span>
              </div>
            ))}
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>{formatPrice(order.total)}</span>
          </div>
          <div className="summary-row"><span>Paiement</span><span>KKiaPay · confirmé</span></div>
        </div>

        <p style={{ color: 'var(--ink-dim)', fontSize: 14, marginBottom: 22 }}>
          Ta commande est enregistrée. Caleb préparera l’activation du produit et pourra te contacter si une
          information complémentaire est nécessaire.
        </p>

        <div className="shop-hero-cta">
          <Link to="/boutique/catalogue" className="btn btn-primary">
            Retour à la boutique
          </Link>
          <Link to="/" className="btn btn-outline">
            Retour au portfolio
          </Link>
        </div>
      </div>
    </main>
  );
}

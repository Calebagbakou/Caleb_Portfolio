import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LAST_ORDER_KEY } from '../../context/CartContext';
import { formatPrice } from '../../data/products';

const WHATSAPP_NUMBER = '2290148135395'; // même numéro que le portfolio

export default function Confirmation() {
  const [order, setOrder] = useState(undefined); // undefined = pas encore lu, null = absent

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_ORDER_KEY);
      setOrder(raw ? JSON.parse(raw) : null);
    } catch {
      setOrder(null);
    }
  }, []);

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

  const itemsText = order.items
    .map((line) => `- ${line.name} (${line.planLabel}) x${line.qty} — ${formatPrice(line.lineTotal)}`)
    .join('%0A');
  const message =
    `Bonjour Caleb, je viens de passer une commande sur la boutique (réf. ${order.ref}).%0A%0A` +
    `${itemsText}%0A%0A` +
    `Total : ${formatPrice(order.total)}%0A` +
    `Paiement souhaité : ${order.payMethod}%0A` +
    `Nom : ${order.customer.name}`;
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;

  return (
    <main>
      <div className="confirm-wrap">
        <div className="confirm-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M5 12l5 5L20 7" />
          </svg>
        </div>
        <h1 style={{ fontSize: 'clamp(1.6rem,4vw,2.1rem)', margin: '0 0 8px' }}>Commande enregistrée</h1>
        <p style={{ color: 'var(--ink-dim)' }}>Merci {order.customer.name} ! Voici le récapitulatif de ta commande.</p>
        <div className="confirm-ref">
          Référence : <strong>{order.ref}</strong>
        </div>

        <div className="confirm-summary">
          <div>
            {order.items.map((line) => (
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
          <div className="summary-row">
            <span>Méthode de paiement</span>
            <span>{order.payMethod}</span>
          </div>
        </div>

        <p style={{ color: 'var(--ink-dim)', fontSize: 14, marginBottom: 22 }}>
          Dernière étape : écris à Caleb sur WhatsApp en mentionnant ta référence de commande pour recevoir les
          coordonnées de paiement et activer ton produit.
        </p>

        <div className="shop-hero-cta">
          <a className="btn btn-primary" target="_blank" rel="noopener" href={whatsappHref}>
            Finaliser sur WhatsApp
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
          <Link to="/" className="btn btn-outline">
            Retour au portfolio
          </Link>
        </div>
      </div>
    </main>
  );
}

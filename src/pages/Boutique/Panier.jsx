import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { formatPrice } from '../../data/products';

export default function Panier() {
  const { details, total, updateQty, remove } = useCart();

  if (!details.length) {
    return (
      <main className="wrap">
        <div className="section" style={{ paddingTop: 32 }}>
          <div className="eyebrow">PANIER</div>
          <h1 style={{ fontSize: 'clamp(1.7rem,4vw,2.2rem)', margin: '0 0 20px' }}>Ton panier</h1>
          <div className="empty-cart">
            <div className="ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 3h2l2.4 12.4a2 2 0 002 1.6h8.2a2 2 0 002-1.6L21 8H6" />
                <circle cx="9" cy="20" r="1.4" />
                <circle cx="17" cy="20" r="1.4" />
              </svg>
            </div>
            <p>Ton panier est vide pour le moment.</p>
            <Link to="/boutique/catalogue" className="btn btn-dark">
              Découvrir le catalogue
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap">
      <div className="section" style={{ paddingTop: 32 }}>
        <div className="eyebrow">PANIER</div>
        <h1 style={{ fontSize: 'clamp(1.7rem,4vw,2.2rem)', margin: '0 0 20px' }}>Ton panier</h1>

        <div className="cart-layout">
          <div>
            {details.map((line) => (
              <div className="cart-line" key={`${line.productId}-${line.planId}`}>
                <div className="cart-line-avatar" style={{ background: line.gradient }}>
                  <span>{line.avatar}</span>
                </div>
                <div className="cart-line-info">
                  <div className="cart-line-name">{line.name}</div>
                  <div className="cart-line-plan">
                    {line.planLabel} · {formatPrice(line.unitPrice)}
                  </div>
                </div>
                <div className="cart-line-qty">
                  <button type="button" onClick={() => updateQty(line.productId, line.planId, line.qty - 1)}>
                    −
                  </button>
                  <span>{line.qty}</span>
                  <button type="button" onClick={() => updateQty(line.productId, line.planId, line.qty + 1)}>
                    +
                  </button>
                </div>
                <div className="cart-line-price">{formatPrice(line.lineTotal)}</div>
                <button
                  className="cart-line-remove"
                  aria-label="Retirer"
                  onClick={() => remove(line.productId, line.planId)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <aside className="summary-card">
            <div className="summary-row">
              <span>Sous-total</span>
              <span>{formatPrice(total)}</span>
            </div>
            <div className="summary-row">
              <span>Livraison</span>
              <span>Numérique — gratuite</span>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>
            <Link to="/boutique/commande" className="btn btn-primary btn-full" style={{ marginTop: 18 }}>
              Passer commande
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            <Link to="/boutique/catalogue" className="btn btn-outline btn-full" style={{ marginTop: 10 }}>
              Continuer mes achats
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}

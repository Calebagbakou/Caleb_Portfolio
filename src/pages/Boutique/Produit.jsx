import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { findProduct, formatPrice } from '../../data/products';
import { useCart } from '../../context/CartContext';
import { useShop } from '../../context/ShopContext';

export default function Produit() {
  const { id } = useParams();
  const { products, loading, error } = useShop();
  const product = findProduct(id, products);
  const { add } = useCart();

  const [selectedPlanId, setSelectedPlanId] = useState(
    product?.plans.find((plan) => plan.active)?.id ?? null
  );
  const [qty, setQty] = useState(1);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!product) return;
    document.title = product.name + ' — Boutique Caleb Creative';
    setSelectedPlanId((current) => product.plans.some((plan) => plan.id === current && plan.active)
      ? current
      : product.plans.find((plan) => plan.active)?.id ?? null);
  }, [product]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  if (!product) {
    if (loading) return <main className="wrap"><div className="shop-state">Chargement du produit…</div></main>;
    return (
      <div className="wrap" style={{ textAlign: 'center', padding: '80px 24px' }}>
        <h1 style={{ fontSize: '1.6rem' }}>{error ? 'Boutique indisponible' : 'Produit introuvable'}</h1>
        <p style={{ color: 'var(--ink-dim)', marginBottom: 22 }}>
          {error || "Ce produit n'existe pas ou a été retiré du catalogue."}
        </p>
        <Link to="/boutique/catalogue" className="btn btn-dark">
          Retour au catalogue
        </Link>
      </div>
    );
  }

  function handleAddToCart() {
    const selectedPlan = product.plans.find((plan) => plan.id === selectedPlanId);
    if (!selectedPlan?.active) return;
    add(product.id, selectedPlanId, qty);
    setToast(product.name + ' ajouté au panier');
  }

  return (
    <main className="wrap" style={{ position: 'relative' }}>
      <div className="product-detail">
        <div className="product-visual reveal in" style={{ background: product.gradient }}>
          {product.image_url
            ? <img src={product.image_url} alt={product.name} />
            : <span className="product-visual-avatar">{product.avatar}</span>}
        </div>
        <div className="product-info reveal in">
          <div className="eyebrow">{product.categoryLabel}</div>
          <h1>{product.name}</h1>
          <p className="desc">{product.description}</p>

          <ul className="highlight-list">
            {product.highlights.map((h) => (
              <li key={h}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12l5 5L20 7" />
                </svg>
                {h}
              </li>
            ))}
          </ul>

          <div className="plan-group">
            <span className="plan-group-label">Formule</span>
            <div className="plan-options">
              {product.plans.map((pl) => (
                <label
                  className={`plan-option${pl.id === selectedPlanId ? ' selected' : ''}${pl.active ? '' : ' unavailable'}`}
                  key={pl.id}
                  onClick={() => pl.active && setSelectedPlanId(pl.id)}
                >
                  <span className="label-wrap">
                    <input
                      type="radio"
                      name="plan"
                      value={pl.id}
                      checked={pl.id === selectedPlanId}
                      disabled={!pl.active}
                      readOnly
                    />
                    <span>{pl.label}{!pl.active && <small className="plan-unavailable-label">Indisponible pour le moment</small>}</span>
                  </span>
                  <span className="price">
                    {formatPrice(pl.price)}
                    {pl.priceEur && (
                      <small style={{ display: 'block', fontWeight: 500, color: 'var(--ink-faint)', fontSize: 11 }}>
                        {pl.priceEur}
                      </small>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="qty-row">
            <span className="plan-group-label" style={{ margin: 0 }}>
              Quantité
            </span>
            <div className="qty-stepper">
              <button type="button" aria-label="Diminuer" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                −
              </button>
              <span>{qty}</span>
              <button type="button" aria-label="Augmenter" onClick={() => setQty((q) => Math.min(20, q + 1))}>
                +
              </button>
            </div>
          </div>

          <div className="product-cta-row">
            <button
              className="btn btn-primary"
              onClick={handleAddToCart}
              disabled={!product.plans.some((plan) => plan.id === selectedPlanId && plan.active)}
            >
              Ajouter au panier
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3h2l2.4 12.4a2 2 0 002 1.6h8.2a2 2 0 002-1.6L21 8H6" />
                <circle cx="9" cy="20" r="1.4" />
                <circle cx="17" cy="20" r="1.4" />
              </svg>
            </button>
            <Link to="/boutique/panier" className="btn btn-outline">
              Voir le panier
            </Link>
          </div>
          <p className="product-note">
            {product.slug === 'gemini-pro'
              ? 'Les formules 4 et 12 mois sont affichées mais momentanément indisponibles. La formule 18 mois est disponible ; après confirmation du paiement, ton lien d’activation est généré automatiquement par PixVerify.'
              : 'Livraison numérique : les identifiants ou instructions d’activation te sont envoyés directement par Caleb après validation de la commande.'}
          </p>
        </div>
      </div>

      {toast && (
        <div className="toast show">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M5 12l5 5L20 7" />
          </svg>
          <span>{toast}</span>
        </div>
      )}
    </main>
  );
}

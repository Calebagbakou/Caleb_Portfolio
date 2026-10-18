import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { findProduct, formatPrice } from '../../data/products';
import { useCart } from '../../context/CartContext';
import { useShop } from '../../context/ShopContext';
import { useAuth } from '../../context/AuthContext';
import Seo from '../../components/site/Seo';
import ShopArrow from '../../components/shop/ShopArrow';
import RichContent from '../../components/shop/RichContent';

export default function Produit() {
  const { id } = useParams();
  const { products, loading, error } = useShop();
  const product = findProduct(id, products);
  const { buyNow } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [selectedPlanId, setSelectedPlanId] = useState(
    product?.plans.find((plan) => plan.active)?.id ?? null
  );
  const [qty, setQty] = useState(1);
  const allowMultipleQty = product?.allow_multiple_qty === true;

  useEffect(() => {
    if (!product) return;
    document.title = product.name + ' — Boutique Caleb Creative';
    setSelectedPlanId((current) => product.plans.some((plan) => plan.id === current && plan.active)
      ? current
      : product.plans.find((plan) => plan.active)?.id ?? null);
    setQty(1);
  }, [product]);

  if (!product) {
    if (loading) return <main className="wrap"><div className="shop-state">Chargement du produit…</div></main>;
    return (
      <div className="wrap" style={{ textAlign: 'center', padding: '80px 24px' }}>
        <h1 style={{ fontSize: '1.6rem' }}>{error ? 'Boutique indisponible' : 'Produit introuvable'}</h1>
        <p style={{ color: 'var(--ink-dim)', marginBottom: 22 }}>
          {error || "Ce produit n'existe pas ou a été retiré du catalogue."}
        </p>
        <Link to="/boutique/catalogue" className="btn btn-primary">
          Voir le catalogue
        </Link>
      </div>
    );
  }

  function handleBuyNow() {
    const selectedPlan = product.plans.find((plan) => plan.id === selectedPlanId);
    if (!selectedPlan?.active) return;
    buyNow(product.id, selectedPlanId, allowMultipleQty ? qty : 1);
    const next = '/boutique/commande';
    navigate(user ? next : `/boutique/connexion?next=${encodeURIComponent(next)}`);
  }

  return (
    <main className="wrap" style={{ position: 'relative' }}>
      <Seo
        title={`${product.name} — Caleb Creative`}
        description={product.description}
        path={`/boutique/produit/${product.slug}`}
        product={product}
      />
      <nav className="product-breadcrumb" aria-label="Fil d’Ariane">
        <Link className="product-breadcrumb-home" to="/boutique">Boutique</Link>
        <span aria-hidden="true">/</span>
        <Link to="/boutique/catalogue">Catalogue</Link>
        <span aria-hidden="true">/</span>
        <span className="product-breadcrumb-current" aria-current="page">{product.name}</span>
      </nav>
      <Link to="/boutique/catalogue" className="product-mobile-back"><ShopArrow direction="left" /> Catalogue</Link>
      <div className="product-detail">
        <div
          className="product-visual reveal in"
          style={{ background: product.gradient, aspectRatio: product.poster_ratio || '4/3' }}
        >
          {product.image_url && (
            <img className="product-visual-artwork" src={product.image_url} alt={product.name} />
          )}
          {product.logo_url && (
            <img className="product-visual-logo" src={product.logo_url} alt={`${product.name} logo`} />
          )}
          {!product.image_url && !product.logo_url && (
            <span className="product-visual-avatar">{product.avatar}</span>
          )}
        </div>
        <div className="product-info reveal in">
          <div className="eyebrow">{product.categoryLabel}</div>
          <h1>{product.name}</h1>
          <RichContent doc={product.description_rich} fallbackText={product.description} />

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
                    {formatPrice(product.promo_price ?? pl.price)}
                    {product.promo_price == null && pl.priceEur && (
                      <small style={{ display: 'block', fontWeight: 500, color: 'var(--ink-faint)', fontSize: 11 }}>
                        {pl.priceEur}
                      </small>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {allowMultipleQty && (
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
          )}

          <div className="product-cta-row">
            <button
              className="btn btn-primary"
              onClick={handleBuyNow}
              disabled={!product.plans.some((plan) => plan.id === selectedPlanId && plan.active)}
            >
              Acheter maintenant
              <ShopArrow />
            </button>
          </div>
          <p className="product-note">
            {product.slug === 'gemini-pro'
              ? 'Les formules 4 et 12 mois sont affichées mais momentanément indisponibles. La formule 18 mois est disponible ; après confirmation du paiement, votre lien d’activation est généré automatiquement.'
              : 'Livraison numérique : les identifiants ou instructions d’activation te sont envoyés directement par Caleb après validation de la commande.'}
          </p>
        </div>
      </div>
    </main>
  );
}

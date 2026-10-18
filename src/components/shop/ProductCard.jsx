import { Link, useNavigate } from 'react-router-dom';
import { formatPrice } from '../../data/products';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const { add, buyNow } = useCart();
  const { user } = useAuth();
  const availablePlans = product.plans.filter((plan) => plan.active !== false);
  const pricedPlan = availablePlans
    .filter((plan) => plan.price > 0)
    .sort((left, right) => left.price - right.price)[0] || availablePlans[0];
  const hasProductPrices = Number.isFinite(product.regular_price)
    && Number.isFinite(product.promo_price);
  const priceLabel = hasProductPrices
    ? formatPrice(product.promo_price)
    : !pricedPlan
      ? 'Indisponible'
      : availablePlans.length > 1
        ? `Dès ${formatPrice(pricedPlan.price)}`
        : formatPrice(pricedPlan.price);
  const crossedPrice = hasProductPrices ? formatPrice(product.regular_price) : null;
  const defaultPlan = pricedPlan || availablePlans[0];
  const isCapCut = product.slug === 'capcut-pro' || product.id === 'capcut-pro';

  function goToCheckout() {
    if (!defaultPlan) return;
    buyNow(product.id, defaultPlan.id);
    const next = '/boutique/commande';
    navigate(user ? next : `/boutique/connexion?next=${encodeURIComponent(next)}`);
  }

  function addToCart(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!defaultPlan) return;
    add(product.id, defaultPlan.id);
  }

  return (
    <article className="product-card">
      <div className="product-card-heading">
        <Link to={`/boutique/produit/${product.slug}`} className="product-card-title-link">
          <h3 className="product-name">{product.name}</h3>
        </Link>
        <span className="product-cat">{product.categoryLabel}</span>
      </div>
      <Link
        to={`/boutique/produit/${product.slug}`}
        className="product-thumb"
        style={{ background: product.gradient, aspectRatio: product.poster_ratio || '4/3' }}
        aria-label={`Voir ${product.name}`}
      >
        {product.badge && <span className="product-badge">{product.badge}</span>}
        {product.image_url && (
          <img className="product-thumb-artwork" src={product.image_url} alt="" loading="lazy" />
        )}
        {product.logo_url && (
          <img className="product-thumb-logo" src={product.logo_url} alt={`${product.name} logo`} loading="lazy" />
        )}
        {!product.image_url && !product.logo_url && (
          <span className="product-thumb-avatar">{product.avatar}</span>
        )}
      </Link>
      <div className="product-body">
        <p className="product-tagline">{product.tagline}</p>
        <div className="product-price-row">
          {crossedPrice && <span className="product-old-price">{crossedPrice}</span>}
          <span className="product-price">{priceLabel}</span>
        </div>
        <div className="product-card-actions">
          <button
            type="button"
            className="product-thumb-cta"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              goToCheckout();
            }}
            disabled={!defaultPlan}
          >
            {product.cta_label || 'Acheter maintenant'}
          </button>
          {!isCapCut && (
            <button
              type="button"
              className="product-cart-add"
              onClick={addToCart}
              disabled={!defaultPlan}
              aria-label={`Ajouter ${product.name} au panier`}
              title="Ajouter au panier"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                <path d="M3 3h2l2.4 12.4a2 2 0 002 1.6h8.2a2 2 0 002-1.6L21 8H6" />
                <circle cx="9" cy="20" r="1.4" />
                <circle cx="17" cy="20" r="1.4" />
                <path d="M17 3v5M14.5 5.5h5" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

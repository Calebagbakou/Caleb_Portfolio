import { Link, useNavigate } from 'react-router-dom';
import { formatPrice } from '../../data/products';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import SmartImage from '../site/SmartImage';

export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const { buyNow } = useCart();
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
  function goToCheckout() {
    if (!defaultPlan) return;
    buyNow(product.id, defaultPlan.id);
    const next = '/boutique/commande';
    navigate(user ? next : `/boutique/connexion?next=${encodeURIComponent(next)}`);
  }

  return (
    <article className="product-card">
      <Link
        to={`/boutique/produit/${product.slug}`}
        className="product-card-main-link"
        aria-label={`Voir la fiche de ${product.name}`}
      >
        <div className="product-card-heading">
          <h3 className="product-name product-card-title-link">{product.name}</h3>
          <span className="product-cat">{product.categoryLabel}</span>
        </div>
        <div
          className="product-thumb"
          style={{ background: product.gradient, aspectRatio: product.poster_ratio || '4/3' }}
        >
          {product.badge && <span className="product-badge">{product.badge}</span>}
          {product.image_url && (
            <SmartImage className="product-thumb-artwork" src={product.image_url} alt="" />
          )}
          {product.logo_url && (
            <SmartImage className="product-thumb-logo" src={product.logo_url} alt={`${product.name} logo`} placeholder={false} />
          )}
          {!product.image_url && !product.logo_url && (
            <span className="product-thumb-avatar">{product.avatar}</span>
          )}
        </div>
        <div className="product-body">
          <p className="product-tagline">{product.tagline}</p>
          <div className="product-price-row">
            {crossedPrice && <span className="product-old-price">{crossedPrice}</span>}
            <span className="product-price">{priceLabel}</span>
          </div>
        </div>
      </Link>
      <div className="product-card-actions">
        <button
          type="button"
          className="product-thumb-cta"
          onClick={goToCheckout}
          disabled={!defaultPlan}
        >
          {product.cta_label || 'Acheter maintenant'}
        </button>
      </div>
    </article>
  );
}

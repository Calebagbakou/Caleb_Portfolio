import { Link } from 'react-router-dom';
import { formatPrice } from '../../data/products';

export default function ProductCard({ product }) {
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

  return (
    <Link className="product-card product-card-link" to={`/boutique/produit/${product.slug}`}>
      <div className="product-card-heading">
        <h3 className="product-name">{product.name}</h3>
        <span className="product-cat">{product.categoryLabel}</span>
      </div>
      <div className="product-thumb" style={{ background: product.gradient, aspectRatio: product.poster_ratio || '4/3' }}>
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
      </div>
      <div className="product-body">
        <p className="product-tagline">{product.tagline}</p>
        <div className="product-price-row">
          {crossedPrice && <span className="product-old-price">{crossedPrice}</span>}
          <span className="product-price">{priceLabel}</span>
        </div>
        <span className="product-thumb-cta">
          {product.cta_label || 'Acheter maintenant'}
        </span>
      </div>
    </Link>
  );
}

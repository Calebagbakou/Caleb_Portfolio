import { Link } from 'react-router-dom';
import { formatPrice } from '../../data/products';

export default function ProductCard({ product }) {
  const availablePlans = product.plans.filter((plan) => plan.active !== false);
  const firstPlan = availablePlans[0];
  const paidPlans = availablePlans.filter((plan) => plan.price > 0);
  const priceLabel =
    availablePlans.length > 1
      ? paidPlans.length
        ? (
            <>
              <small>dès&nbsp;</small>
              {formatPrice(Math.min(...paidPlans.map((p) => p.price)))}
            </>
          )
        : formatPrice(0)
      : firstPlan
        ? formatPrice(firstPlan.price)
        : 'Indisponible';

  return (
    <Link className="product-card product-card-link" to={`/boutique/produit/${product.slug}`}>
      <div className="product-thumb" style={{ background: product.gradient }}>
        {product.badge && <span className="product-badge">{product.badge}</span>}
        {product.image_url
          ? <img className="product-thumb-artwork" src={product.image_url} alt="" loading="lazy" />
          : product.logo_url
            ? <img className="product-thumb-logo standalone" src={product.logo_url} alt="" loading="lazy" />
            : <span className="product-thumb-avatar">{product.avatar}</span>}
        {product.image_url && product.logo_url && (
          <img className="product-thumb-logo" src={product.logo_url} alt={`${product.name} logo`} loading="lazy" />
        )}
      </div>
      <div className="product-body">
        <span className="product-cat">{product.categoryLabel}</span>
        <h3 className="product-name">{product.name}</h3>
        <p className="product-tagline">{product.tagline}</p>
        <div className="product-price-row">
          <span className="product-price">{priceLabel}</span>
        </div>
      </div>
    </Link>
  );
}

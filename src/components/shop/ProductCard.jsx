import { Link } from 'react-router-dom';
import { formatPrice } from '../../data/products';

export default function ProductCard({ product }) {
  const firstPlan = product.plans[0];
  const paidPlans = product.plans.filter((p) => p.price > 0);
  const priceLabel =
    product.plans.length > 1
      ? paidPlans.length
        ? (
            <>
              <small>dès&nbsp;</small>
              {formatPrice(Math.min(...paidPlans.map((p) => p.price)))}
            </>
          )
        : formatPrice(0)
      : formatPrice(firstPlan.price);

  return (
    <Link className="product-card reveal product-card-link" to={`/boutique/produit/${product.slug}`}>
      <div className="product-thumb" style={{ background: product.gradient }}>
        {product.badge && <span className="product-badge">{product.badge}</span>}
        {product.image_url
          ? <img src={product.image_url} alt="" loading="lazy" />
          : <span className="product-thumb-avatar">{product.avatar}</span>}
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

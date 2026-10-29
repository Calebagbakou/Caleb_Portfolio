import { Link } from 'react-router-dom';
import ProductCard from '../../components/shop/ProductCard';
import ShopAlert from '../../components/shop/ShopAlert';
import { useReveal } from '../../hooks/useReveal';
import { useShop } from '../../context/ShopContext';
import Seo from '../../components/site/Seo';
import ShopArrow from '../../components/shop/ShopArrow';
import AssuranceBar from '../../components/shop/AssuranceBar';
import { LoadingFeedback, ProductGridSkeleton } from '../../components/site/LoadingStates';
import { useSlowLoading } from '../../hooks/useSlowLoading';

function TrustItem({ icon, title, desc }) {
  const [ref, visible] = useReveal();
  return (
    <div className={`trust-item reveal${visible ? ' in' : ''}`} ref={ref}>
      <div className="ic">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          {icon}
        </svg>
      </div>
      <div>
        <div className="t">{title}</div>
        <div className="d">{desc}</div>
      </div>
    </div>
  );
}

export default function ShopHome() {
  const [heroRef, heroVisible] = useReveal();
  const { categories, products, content, loading, error, retryLoad } = useShop();
  const slowLoading = useSlowLoading(loading);
  const featured = products.filter((product) => product.featured);

  return (
    <>
      <Seo
        title="Boutique Caleb Creative — Outils créatifs et abonnements"
        description="Découvre les abonnements et outils créatifs sélectionnés par Caleb Creative : CapCut Pro, Canva Pro, Gemini Pro et plus."
        path="/boutique"
      />
      <section className="shop-hero" ref={heroRef}>
        <div className="eyebrow">Caleb Creative · Boutique officielle</div>
        <h1 className={`reveal${heroVisible ? ' in' : ''}`}>{content.shop_hero_title}</h1>
        <p className={`reveal${heroVisible ? ' in' : ''}`}>{content.shop_hero_description}</p>
        <div className={`shop-hero-cta reveal${heroVisible ? ' in' : ''}`}>
          <Link to="/boutique/catalogue" className="btn btn-primary">
            Voir le catalogue
            <ShopArrow />
          </Link>
        </div>
        <Link to="/" className="shop-portfolio-text">Voir le portfolio <ShopArrow /></Link>
      </section>

      <main className="wrap">
        <AssuranceBar />
        <div className="chip-row">
          <Link to="/boutique/catalogue" className="chip active">
            Tous les produits
          </Link>
          {categories.map((category) => (
            <Link to={`/boutique/catalogue?cat=${category.slug}`} className="chip" key={category.id}>
              {category.label}
            </Link>
          ))}
        </div>

        <section className="section">
          <div className="sec-head">
            <h2>Produits phares</h2>
            <Link to="/boutique/catalogue" className="see-all">
              Voir le catalogue <ShopArrow />
            </Link>
          </div>
          {loading && slowLoading.phase === 'error' && <LoadingFeedback phase="error" onRetry={retryLoad} />}
          {loading && slowLoading.phase !== 'error' && slowLoading.showLoader && (
            <>
              <LoadingFeedback phase={slowLoading.phase} onRetry={retryLoad} />
              <ProductGridSkeleton count={3} />
            </>
          )}
          {!loading && error && slowLoading.phase === 'error' && <LoadingFeedback phase="error" onRetry={retryLoad} />}
          {!loading && error && slowLoading.phase !== 'error' && <ShopAlert message={error} action="Réessayer" onAction={retryLoad} />}
          {!loading && !error && featured.length === 0 && (
            <div className="shop-state">Les produits phares seront bientôt disponibles.</div>
          )}
          {!loading && !error && featured.length > 0 && (
            <div className="product-grid">
              {featured.map((product) => <ProductCard product={product} key={product.id} />)}
            </div>
          )}
        </section>

        <div className="trust-row">
          <TrustItem
            title={content.shop_activation_title}
            desc={content.shop_activation_description}
            icon={
              <>
                <path d="M12 2l8 4.5v9L12 20l-8-4.5v-9z" />
                <path d="M9 12l2 2 4-4" />
              </>
            }
          />
          <TrustItem
            title={content.shop_contact_title}
            desc={content.shop_contact_description}
            icon={<path d="M4 20l1.3-4A8 8 0 1112 20a8 8 0 01-4-1z" />}
          />
          <TrustItem
            title={content.shop_payment_title}
            desc={content.shop_payment_description}
            icon={
              <>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 10h18" />
              </>
            }
          />
        </div>
      </main>
    </>
  );
}

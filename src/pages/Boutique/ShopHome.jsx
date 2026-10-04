import { Link } from 'react-router-dom';
import { PRODUCTS } from '../../data/products';
import ProductCard from '../../components/shop/ProductCard';
import { useReveal } from '../../hooks/useReveal';

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
  const featured = PRODUCTS.slice(0, 3);

  return (
    <>
      <section className="shop-hero" ref={heroRef}>
        <div className="eyebrow">CALEB CREATIVE — BOUTIQUE</div>
        <h1 className={`reveal${heroVisible ? ' in' : ''}`}>
          Des outils IA et créatifs premium, activés rapidement.
        </h1>
        <p className={`reveal${heroVisible ? ' in' : ''}`}>
          Abonnements Gemini Pro, CapCut Pro, Canva Pro et plus — sélectionnés par Caleb Creative, activés
          après commande, avec un accompagnement direct.
        </p>
        <div className={`shop-hero-cta reveal${heroVisible ? ' in' : ''}`}>
          <Link to="/boutique/catalogue" className="btn btn-dark">
            Voir le catalogue
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
          <Link to="/" className="btn btn-outline">
            ← Retour au portfolio
          </Link>
        </div>
      </section>

      <main className="wrap">
        <div className="chip-row">
          <Link to="/boutique/catalogue" className="chip active">
            Tous les produits
          </Link>
          <Link to="/boutique/catalogue?cat=ia" className="chip">
            Intelligence artificielle
          </Link>
          <Link to="/boutique/catalogue?cat=logiciels" className="chip">
            Logiciels créatifs
          </Link>
        </div>

        <section className="section">
          <div className="sec-head">
            <h2>Produits phares</h2>
            <Link to="/boutique/catalogue" className="see-all">
              Voir tout le catalogue →
            </Link>
          </div>
          <div className="product-grid">
            {featured.map((p) => (
              <ProductCard product={p} key={p.id} />
            ))}
          </div>
        </section>

        <div className="trust-row">
          <TrustItem
            title="Activation rapide"
            desc="Sous 24 à 48h après commande"
            icon={
              <>
                <path d="M12 2l8 4.5v9L12 20l-8-4.5v-9z" />
                <path d="M9 12l2 2 4-4" />
              </>
            }
          />
          <TrustItem
            title="Suivi par WhatsApp"
            desc="Un échange direct, sans robot"
            icon={<path d="M4 20l1.3-4A8 8 0 1112 20a8 8 0 01-4-1z" />}
          />
          <TrustItem
            title="Paiement local"
            desc="Mobile Money ou virement bancaire"
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

import { useSearchParams } from 'react-router-dom';
import ProductCard from '../../components/shop/ProductCard';
import { useShop } from '../../context/ShopContext';

export default function Catalogue() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories, products, loading, error } = useShop();
  const requested = searchParams.get('cat') || 'tous';
  const activeCat = categories.some((category) => category.slug === requested) ? requested : 'tous';

  const list = activeCat === 'tous' ? products : products.filter((product) => product.category === activeCat);

  function selectCategory(id) {
    if (id === 'tous') {
      searchParams.delete('cat');
    } else {
      searchParams.set('cat', id);
    }
    setSearchParams(searchParams, { replace: true });
  }

  return (
    <main className="wrap">
      <div className="section" style={{ paddingTop: 32 }}>
        <div className="eyebrow">CATALOGUE</div>
        <h1 style={{ fontSize: 'clamp(1.7rem,4vw,2.4rem)', margin: '0 0 6px' }}>Tous les produits</h1>
        <p style={{ color: 'var(--ink-dim)', margin: '0 0 8px', maxWidth: '56ch' }}>
          Abonnements IA et logiciels créatifs, activés après commande. Choisis une catégorie pour affiner ta
          recherche.
        </p>

        <div className="chip-row">
          {[{ id: 'tous', slug: 'tous', label: 'Tous les produits' }, ...categories].map((c) => (
            <button
              key={c.id}
              className={`chip${activeCat === c.slug ? ' active' : ''}`}
              onClick={() => selectCategory(c.slug)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loading && <div className="shop-state">Chargement des produits…</div>}
        {error && <div className="shop-state error">Impossible de charger la boutique : {error}</div>}
        {!loading && !error && list.length > 0 && (
          <div className="product-grid" style={{ marginTop: 22 }}>
            {list.map((product) => <ProductCard product={product} key={product.id} />)}
          </div>
        )}
        {!loading && !error && !list.length && (
          <p style={{ color: 'var(--ink-dim)', padding: '40px 0', textAlign: 'center' }}>
            Aucun produit dans cette catégorie pour le moment.
          </p>
        )}
      </div>
    </main>
  );
}

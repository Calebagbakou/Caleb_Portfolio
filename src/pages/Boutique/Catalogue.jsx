import { useSearchParams } from 'react-router-dom';
import { CATEGORIES, PRODUCTS } from '../../data/products';
import ProductCard from '../../components/shop/ProductCard';

export default function Catalogue() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('cat') || 'tous';
  const activeCat = CATEGORIES.some((c) => c.id === requested) ? requested : 'tous';

  const list = activeCat === 'tous' ? PRODUCTS : PRODUCTS.filter((p) => p.category === activeCat);

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
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`chip${activeCat === c.id ? ' active' : ''}`}
              onClick={() => selectCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="product-grid" style={{ marginTop: 22 }}>
          {list.map((p) => (
            <ProductCard product={p} key={p.id} />
          ))}
        </div>
        {!list.length && (
          <p style={{ color: 'var(--ink-dim)', padding: '40px 0', textAlign: 'center' }}>
            Aucun produit dans cette catégorie pour le moment.
          </p>
        )}
      </div>
    </main>
  );
}

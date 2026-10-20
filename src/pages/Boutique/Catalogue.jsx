import { useSearchParams } from 'react-router-dom';
import ProductCard from '../../components/shop/ProductCard';
import ShopAlert from '../../components/shop/ShopAlert';
import { useShop } from '../../context/ShopContext';
import Seo from '../../components/site/Seo';
import { LoadingFeedback, ProductGridSkeleton } from '../../components/site/LoadingStates';
import { useSlowLoading } from '../../hooks/useSlowLoading';

export default function Catalogue() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories, products, loading, error, retryLoad } = useShop();
  const slowLoading = useSlowLoading(loading);
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
      <Seo
        title="Catalogue — Abonnements et outils créatifs | Caleb Creative"
        description="Parcours le catalogue Caleb Creative : CapCut Pro, Canva Pro, Gemini Pro et d'autres outils créatifs disponibles au Bénin."
        path="/boutique/catalogue"
      />
      <div className="section" style={{ paddingTop: 32 }}>
        <div className="eyebrow">CATALOGUE</div>
        <h1 style={{ fontSize: 'clamp(1.7rem,4vw,2.4rem)', margin: '0 0 6px' }}>Tous les produits</h1>
        <p style={{ color: 'var(--ink-dim)', margin: '0 0 8px', maxWidth: '56ch' }}>
          Abonnements IA et logiciels créatifs, activés après commande. Choisissez une catégorie pour affiner votre
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

        {loading && slowLoading.phase === 'error' && <LoadingFeedback phase="error" onRetry={retryLoad} />}
        {loading && slowLoading.phase !== 'error' && slowLoading.showLoader && (
          <>
            <LoadingFeedback phase={slowLoading.phase} onRetry={retryLoad} />
            <ProductGridSkeleton />
          </>
        )}
        {!loading && error && slowLoading.phase === 'error' && <LoadingFeedback phase="error" onRetry={retryLoad} />}
        {!loading && error && slowLoading.phase !== 'error' && <ShopAlert message={error} action="Réessayer" onAction={retryLoad} />}
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

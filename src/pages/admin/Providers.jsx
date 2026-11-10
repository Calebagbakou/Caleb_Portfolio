import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../services/supabase';

const PROVIDER_LABELS = {
  prodseller: 'ProdSeller',
  zfourstore: 'Z FOUR STORE',
  aihub: 'AiHUB',
  pixverify: 'Ancien fournisseur (historique)',
};

function formatDate(value) {
  if (!value) return 'Date inconnue';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatSupplierPrice(availability) {
  if (availability?.price === null || availability?.price === undefined) return 'Non communiqué';
  const currency = availability.currency || 'USDT';
  return `${Number(availability.price).toLocaleString('fr-FR')} ${currency}`;
}

async function getFunctionErrorMessage(error) {
  if (error?.context instanceof Response) {
    try {
      const responseData = await error.context.clone().json();
      if (typeof responseData?.error === 'string') return responseData.error;
    } catch {
      console.warn('La réponse d’erreur du contrôle fournisseur n’est pas un JSON lisible.');
    }
  }
  if (error?.name === 'FunctionsFetchError' || /failed to send a request/i.test(error?.message || '')) {
    return 'La fonction de contrôle fournisseur est injoignable. Vérifie son déploiement et ses journaux Supabase, puis réessaie.';
  }
  return error?.message || 'Le contrôle fournisseur a échoué.';
}

function describeEvent(event, products = []) {
  const target = products.find((product) =>
    product.id === event.target_key || product.slug === event.target_key,
  )?.name || event.target_key;
  if (event.event_type === 'out_of_stock') {
    return `${target} : rupture chez ${PROVIDER_LABELS[event.provider] || event.provider}; pensez à basculer ou à recharger.`;
  }
  return `${target} : solde insuffisant chez ${PROVIDER_LABELS[event.provider] || event.provider}; pensez à recharger.`;
}

export default function Providers() {
  const [overview, setOverview] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [availabilityProductId, setAvailabilityProductId] = useState('');
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: invokeError } = await supabase.functions.invoke('shop-provider-admin', {
      body: { action: 'overview' },
    });
    if (invokeError) {
      console.error('Impossible de charger la configuration des fournisseurs :', invokeError);
      setError('Impossible de charger les fournisseurs. Vérifiez la migration locale et réessayez.');
    } else {
      setOverview(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function checkAvailability(productId) {
    setAvailabilityProductId(productId);
    setChecking(true);
    setError('');
    setAvailability(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('shop-provider-admin', {
        body: { action: 'availability', productId },
      });
      if (invokeError) {
        console.error('Vérification fournisseur impossible :', invokeError);
        setError(await getFunctionErrorMessage(invokeError));
      } else if (data?.error) {
        setError(data.error);
      } else {
        setAvailability(data);
      }
    } catch (invokeError) {
      console.error('Vérification fournisseur impossible :', invokeError);
      setError('La requête de disponibilité a échoué. Vérifie la connexion puis réessaie.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="provider-admin-page">
      {error && <div className="provider-admin-message is-error" role="alert">{error}</div>}

      <section className="panel provider-admin-panel">
        <div className="provider-admin-heading">
          <div>
            <h2>Fournisseurs par formule API</h2>
            <p>Le fournisseur et son ID se règlent pour chaque formule dans la fiche produit. Les commandes déjà commencées restent épinglées à leur fournisseur d’origine.</p>
            <p><Link to="/admin/shop">Ouvrir les produits de la boutique</Link> et modifier un produit pour régler ses formules.</p>
          </div>
        </div>

        {loading && !overview ? (
          <div className="provider-admin-skeleton" aria-label="Chargement des fournisseurs">
            <span /><span /><span />
          </div>
        ) : (
          <>
            <div className="provider-admin-products">
              {overview?.products?.map((product) => {
                const prodSellerAvailable = Boolean(overview.providers?.prodseller && product.prodseller_mapping_saved);
                const zFourStoreAvailable = Boolean(overview.providers?.zfourstore && product.zfourstore_mapping_saved);
                const aiHubAvailable = Boolean(overview.providers?.aihub && product.aihub_mapping_saved);
                const productAvailability = availabilityProductId === product.id ? availability?.providers : null;
                return (
                  <article className="provider-admin-product" key={product.id}>
                    <div>
                      <h3>{product.name}</h3>
                      {product.plans?.map((plan) => (
                        <small key={plan.id}>
                          {plan.label} · {PROVIDER_LABELS[plan.active_api_provider] || 'Fournisseur non défini'} · ID : {plan.provider_product_id || 'non renseigné'}
                          {plan.active === false ? ' · formule inactive' : ''}
                        </small>
                      ))}
                    </div>
                    <button
                      className="btn btn-secondary provider-admin-action"
                      type="button"
                      onClick={() => checkAvailability(product.id)}
                      disabled={checking || loading || !(
                        (overview.providers?.prodseller && product.prodseller_product_id)
                        || (overview.providers?.zfourstore && product.zfourstore_product_id)
                        || aiHubAvailable
                      )}
                    >
                      {checking && availabilityProductId === product.id ? 'Vérification…' : 'Vérifier la disponibilité fournisseur'}
                    </button>
                    {productAvailability && (
                      <div className="provider-admin-check-results" role="status">
                        {['prodseller', 'zfourstore', 'aihub'].map((provider) => {
                          const result = productAvailability[provider];
                          const configured = provider === 'prodseller'
                            ? prodSellerAvailable
                            : provider === 'zfourstore' ? zFourStoreAvailable : aiHubAvailable;
                          return (
                            <div
                              className={`provider-admin-availability${result?.available ? ' is-available' : ' is-unavailable'}`}
                              key={provider}
                            >
                              <strong>{PROVIDER_LABELS[provider]} · {result?.available ? 'En stock' : 'Non confirmé'}</strong>
                              <span>Prix fournisseur : {formatSupplierPrice(result)}</span>
                              {result?.stock !== null && result?.stock !== undefined && <span>Stock : {result.stock}</span>}
                              {(provider === 'zfourstore' || provider === 'aihub') && (
                                <span>
                                  Solde : {result?.balanceOk === null || result?.balanceOk === undefined
                                    ? 'non vérifié'
                                    : result.balanceOk ? 'suffisant' : 'insuffisant'}
                                </span>
                              )}
                              {!configured && <span>ID ou clé fournisseur non configuré pour ce produit.</span>}
                              {result?.message && <span>{result.message}</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </article>
                );
              })}
              {!overview?.products?.length && <p>Aucun produit livré par API. Ajoute les produits et leurs IDs dans la boutique.</p>}
            </div>
          </>
        )}
      </section>

      <section className="panel provider-admin-panel">
        <div className="provider-admin-heading">
          <div>
            <h2>Configuration des fournisseurs</h2>
            <p>
              ProdSeller : {overview?.providers?.prodseller ? 'API configurée' : 'clé API manquante'} ·{' '}
              Z FOUR STORE : {overview?.providers?.zfourstore ? 'API configurée' : 'clé API manquante'} ·{' '}
              AiHUB : {overview?.providers?.aihub ? 'API configurée' : 'clé API manquante'}.
              {' '}Les IDs produit se consultent dans les catalogues fournisseurs.
            </p>
            <p>
              <Link to="/admin/shop/prodseller">Catalogue ProdSeller</Link>
              {' · '}
              <Link to="/admin/shop/zfourstore">Catalogue Z FOUR STORE</Link>
              {' · '}
              <Link to="/admin/shop/aihub">Catalogue AiHUB</Link>
            </p>
          </div>
        </div>
      </section>

      <section className="panel provider-admin-panel">
        <div className="provider-admin-heading">
          <div>
            <h2>Alertes de disponibilité</h2>
            <p>Ruptures et soldes insuffisants détectés pendant une vérification ou une livraison. Le contrôle ci-dessus utilise les anciens IDs au niveau produit.</p>
          </div>
        </div>
        {loading && !overview ? <div className="state-box">Chargement…</div> : null}
        {!loading && !overview?.alerts?.length && <div className="state-box">Aucune alerte enregistrée.</div>}
        {overview?.alerts?.length > 0 && (
          <ul className="provider-admin-alert-list">
            {overview.alerts.map((alert) => (
              <li key={alert.id}>
                <strong>{describeEvent(alert, overview?.products)}</strong>
                <time dateTime={alert.created_at}>{formatDate(alert.created_at)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel provider-admin-panel">
        <div className="provider-admin-heading">
          <div>
            <h2>Historique des 20 derniers changements</h2>
            <p>Chaque bascule est enregistrée avec son auteur et sa raison éventuelle.</p>
          </div>
        </div>
        {loading && !overview ? <div className="state-box">Chargement…</div> : null}
        {!loading && !overview?.history?.length && <div className="state-box">Aucun changement enregistré.</div>}
        {overview?.history?.length > 0 && (
          <ol className="provider-admin-history">
            {overview.history.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>{PROVIDER_LABELS[entry.from_provider]} → {PROVIDER_LABELS[entry.to_provider]}</strong>
                  <span>Administrateur {entry.changed_by || 'inconnu'} · {formatDate(entry.changed_at)}</span>
                  {entry.reason && <p>{entry.reason}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="provider-admin-product-link">
        Gérer les IDs fournisseurs : <Link to="/admin/shop/products">ouvrir les produits de la boutique</Link>.
      </p>
    </div>
  );
}

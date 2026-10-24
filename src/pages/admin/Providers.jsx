import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../services/supabase';

const PROVIDER_LABELS = {
  prodseller: 'ProdSeller',
  zfourstore: 'Z FOUR STORE',
  pixverify: 'Ancien fournisseur (historique)',
};

function formatDate(value) {
  if (!value) return 'Date inconnue';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
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
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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
    const { data, error: invokeError } = await supabase.functions.invoke('shop-provider-admin', {
      body: { action: 'availability', productId },
    });
    if (invokeError) {
      console.error('Vérification fournisseur impossible :', invokeError);
      setError('La vérification du stock et du solde a échoué. Réessayez.');
    } else {
      setAvailability(data);
      if (data?.error) setError(data.error);
      await load();
    }
    setChecking(false);
  }

  async function changeProvider(product, nextProvider) {
    const activeProvider = product.active_api_provider || 'prodseller';
    if (nextProvider === activeProvider) return;
    const productId = nextProvider === 'zfourstore'
      ? product.zfourstore_product_id
      : product.prodseller_product_id;
    if (!overview?.providers?.[nextProvider] || !productId) {
      setError(`Le fournisseur ${PROVIDER_LABELS[nextProvider]} ou son identifiant produit n’est pas configuré.`);
      return;
    }
    const confirmation = `Les nouvelles commandes de « ${product.name} » utiliseront ${PROVIDER_LABELS[nextProvider]}. Les commandes déjà commencées restent chez leur fournisseur d’origine.`;
    if (!window.confirm(confirmation)) return;

    setSaving(true);
    setError('');
    setNotice('');
    const { error: rpcError } = await supabase.rpc('set_shop_product_provider', {
      p_product_id: product.id,
      p_provider: nextProvider,
      p_reason: reason.trim() || null,
    });
    if (rpcError) {
      console.error('Bascule du fournisseur impossible :', rpcError);
      setError(rpcError.message?.includes('n’est pas configuré')
        ? 'Le fournisseur sélectionné n’est pas configuré côté serveur.'
        : 'Le changement de fournisseur a échoué. Vérifiez vos droits et réessayez.');
    } else {
      setNotice(`${product.name} utilisera maintenant ${PROVIDER_LABELS[nextProvider]}.`);
      setReason('');
      setAvailability(null);
      await load();
    }
    setSaving(false);
  }

  return (
    <div className="provider-admin-page">
      {error && <div className="provider-admin-message is-error" role="alert">{error}</div>}
      {notice && <div className="provider-admin-message is-success" role="status">{notice}</div>}

      <section className="panel provider-admin-panel">
        <div className="provider-admin-heading">
          <div>
            <h2>Fournisseurs par produit API</h2>
            <p>Choisis le fournisseur de chaque produit. Seuls les fournisseurs configurés avec un identifiant pour ce produit peuvent être sélectionnés. Les commandes déjà commencées restent chez leur fournisseur d’origine.</p>
          </div>
        </div>

        {loading && !overview ? (
          <div className="provider-admin-skeleton" aria-label="Chargement des fournisseurs">
            <span /><span /><span />
          </div>
        ) : (
          <>
            <label className="provider-admin-field" htmlFor="provider-switch-reason">
              Raison du changement (facultatif)
              <input
                id="provider-switch-reason"
                type="text"
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ex. indisponibilité du fournisseur"
              />
            </label>
            <div className="provider-admin-products">
              {overview?.products?.map((product) => {
                const active = product.active_api_provider || 'prodseller';
                const prodSellerAvailable = Boolean(overview.providers?.prodseller && product.prodseller_mapping_saved);
                const zFourStoreAvailable = Boolean(overview.providers?.zfourstore && product.zfourstore_mapping_saved);
                const productAvailability = availabilityProductId === product.id ? availability : null;
                return (
                  <article className="provider-admin-product" key={product.id}>
                    <div>
                      <h3>{product.name}</h3>
                      <small>
                        ProdSeller : {product.prodseller_product_id || 'ID non renseigné'}
                        {product.prodseller_product_id && !product.prodseller_mapping_saved ? ' · ID historique à enregistrer dans la fiche produit' : ''}
                      </small>
                      <small>
                        Z FOUR STORE : {product.zfourstore_product_id || 'ID non renseigné'}
                        {product.zfourstore_product_id && !product.zfourstore_mapping_saved ? ' · ID historique à enregistrer dans la fiche produit' : ''}
                      </small>
                    </div>
                    <label className="provider-admin-field" htmlFor={`provider-${product.id}`}>
                      Fournisseur actif
                      <select
                        id={`provider-${product.id}`}
                        value={active}
                        onChange={(event) => changeProvider(product, event.target.value)}
                        disabled={loading || saving}
                      >
                        <option value="prodseller" disabled={!prodSellerAvailable}>
                          ProdSeller{prodSellerAvailable ? '' : ' — indisponible pour ce produit'}
                        </option>
                        <option value="zfourstore" disabled={!zFourStoreAvailable}>
                          Z FOUR STORE{zFourStoreAvailable ? '' : ' — indisponible pour ce produit'}
                        </option>
                      </select>
                    </label>
                    <button
                      className="btn btn-secondary provider-admin-action"
                      type="button"
                      onClick={() => checkAvailability(product.id)}
                      disabled={checking || loading || !overview.providers?.[active] || !(active === 'zfourstore' ? product.zfourstore_product_id : product.prodseller_product_id)}
                    >
                      {checking && availabilityProductId === product.id ? 'Vérification…' : 'Vérifier la disponibilité'}
                    </button>
                    {productAvailability && (
                      <div className={`provider-admin-availability${productAvailability.available ? ' is-available' : ' is-unavailable'}`} role="status">
                        <strong>{productAvailability.available ? 'Produit en stock' : 'Disponibilité non confirmée'}</strong>
                        {productAvailability.stock !== null && productAvailability.stock !== undefined && <span>Stock : {productAvailability.stock}</span>}
                        <span>
                          Solde : {productAvailability.balanceOk === null || productAvailability.balanceOk === undefined
                            ? 'non vérifié'
                            : productAvailability.balanceOk ? 'suffisant' : 'insuffisant'}
                        </span>
                        {productAvailability.message && <span>{productAvailability.message}</span>}
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
            <p>ProdSeller : {overview?.providers?.prodseller ? 'API configurée' : 'clé API manquante'} · Z FOUR STORE : {overview?.providers?.zfourstore ? 'API configurée' : 'clé API manquante'}.</p>
          </div>
        </div>
      </section>

      <section className="panel provider-admin-panel">
        <div className="provider-admin-heading">
          <div>
            <h2>Alertes de disponibilité</h2>
            <p>Ruptures et soldes insuffisants détectés pendant une vérification ou une livraison.</p>
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

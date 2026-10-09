import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LAST_ORDER_KEY } from '../../context/CartContext';
import { formatPrice } from '../../data/products';
import { listShopCatalog } from '../../services/shop';
import { supabase } from '../../services/supabase';

async function readDeliveryResponse(error, data) {
  if (data) return data;
  if (error?.context && typeof error.context.clone === 'function') {
    try {
      return await error.context.clone().json();
    } catch {
      return { error: error.message };
    }
  }
  return { error: error?.message || 'Le lien PixVerify n’a pas pu être généré.' };
}

export default function Confirmation() {
  const location = useLocation();
  const [order, setOrder] = useState(undefined); // undefined = pas encore lu, null = absent
  const [products, setProducts] = useState(null);
  const [deliveryStatus, setDeliveryStatus] = useState('idle');
  const [deliveryLinks, setDeliveryLinks] = useState([]);
  const [deliveryError, setDeliveryError] = useState('');
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (location.state?.order) {
      setOrder(location.state.order);
      return;
    }
    try {
      const raw = localStorage.getItem(LAST_ORDER_KEY);
      setOrder(raw ? JSON.parse(raw) : null);
    } catch (error) {
      console.error('Impossible de lire le reçu local :', error);
      setOrder(null);
    }
  }, [location.state]);

  useEffect(() => {
    if (!order?.items?.length) return;

    let cancelled = false;
    async function loadProducts() {
      const { data, error } = await listShopCatalog({ includeInactive: true });
      if (cancelled) return;
      if (!error && data?.products) {
        setProducts(data.products);
      } else if (error) {
        console.error('Impossible de charger les produits de la commande :', error);
        setProducts([]);
      }
    }

    loadProducts();
    return () => {
      cancelled = true;
    };
  }, [order]);

  const geminiQuantity = useMemo(() => {
    if (!products) return 0;
    const eligibleProductIds = new Set(
      products.filter((product) => product.slug === 'gemini-pro').map((product) => product.id),
    );
    return (order?.items || [])
      .filter((line) => eligibleProductIds.has(line.productId) && line.planLabel === '18 mois')
      .reduce((sum, line) => sum + Number(line.qty || 0), 0);
  }, [order, products]);

  async function requestPixverifyLink(action = 'deliver') {
    if (!order?.id || !order?.ref || !geminiQuantity) return;
    setDeliveryError('');
    if (action === 'retry') setRetrying(true);
    else setDeliveryStatus('loading');

    const { data, error } = await supabase.functions.invoke('gemini-pro-activate', {
      body: { action, order_id: order.id, order_ref: order.ref },
    });

    if (error || data?.error) {
      const response = await readDeliveryResponse(error, data);
      const message = typeof response.error === 'string'
        ? response.error
        : 'Le lien PixVerify n’a pas pu être généré.';
      console.error('La livraison PixVerify a échoué :', error || message);
      setDeliveryError(message);
      setDeliveryLinks(Array.isArray(response.links) ? response.links : []);
      const status = response.status
        || (error?.context?.status === 402 ? 'insufficient_balance' : '');
      setDeliveryStatus(
        status === 'insufficient_balance' || status === 'retryable'
          ? status
          : 'failed',
      );
    } else {
      setDeliveryLinks(Array.isArray(data?.links) ? data.links : []);
      setDeliveryError('');
      setDeliveryStatus(data?.status || 'failed');
    }
    setRetrying(false);
  }

  useEffect(() => {
    if (order?.payment_status !== 'confirme' || !products || !geminiQuantity) return;
    if (deliveryStatus !== 'idle') return;
    requestPixverifyLink();
  }, [order?.payment_status, products, geminiQuantity, deliveryStatus]);

  if (order === undefined) return null;

  if (!order || !order.ref) {
    return (
      <main>
        <div className="confirm-wrap">
          <h1 style={{ fontSize: '1.6rem' }}>Aucune commande récente</h1>
          <p style={{ color: 'var(--ink-dim)', marginBottom: 22 }}>
            Nous n'avons pas trouvé de commande à afficher.
          </p>
          <Link to="/boutique/catalogue" className="btn btn-dark">
            Découvrir le catalogue
          </Link>
        </div>
      </main>
    );
  }

  if (order.payment_status !== 'confirme') {
    return (
      <main>
        <div className="confirm-wrap">
          <h1 style={{ fontSize: '1.6rem' }}>Paiement en attente</h1>
          <p style={{ color: 'var(--ink-dim)', marginBottom: 22 }}>
            La commande {order.ref} n’a pas encore été confirmée par KKiaPay. Si tu viens de payer, actualise la
            page dans quelques instants ou contacte Caleb avec cette référence.
          </p>
          <Link to="/boutique/catalogue" className="btn btn-dark">Retour à la boutique</Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="confirm-wrap">
        <div className="confirm-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M5 12l5 5L20 7" />
          </svg>
        </div>
        <h1 style={{ fontSize: 'clamp(1.6rem,4vw,2.1rem)', margin: '0 0 8px' }}>Paiement confirmé</h1>
        <p style={{ color: 'var(--ink-dim)' }}>
          Merci {order.customer?.name} ! Ton paiement KKiaPay a été vérifié.
        </p>
        <div className="confirm-ref">
          Référence : <strong>{order.ref}</strong>
        </div>

        <div className="confirm-summary">
          <div>
            {(order.items || []).map((line) => {
              const product = products?.find((entry) => entry.id === line.productId);
              const accessUrl = product?.slug === 'gemini-pro' && line.planLabel === '18 mois'
                ? null
                : product?.access_url || null;
              return (
                <div key={`${line.productId}-${line.planId}`}>
                  <div className="summary-row">
                    <span>
                      {line.name} ({line.planLabel}) ×{line.qty}
                    </span>
                    <span>{formatPrice(line.lineTotal)}</span>
                  </div>
                  {accessUrl && (
                    <div className="summary-row access-link">
                      <span style={{ color: 'var(--ink-dim)', fontSize: '0.9rem' }}>Accès :</span>
                      <a href={accessUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary">
                        Ouvrir
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>{formatPrice(order.total)}</span>
          </div>
          <div className="summary-row">
            <span>Paiement</span>
            <span>KKiaPay · confirmé</span>
          </div>
        </div>

        {geminiQuantity > 0 && (
          <section className="confirm-summary" aria-live="polite" style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: '1.1rem', marginTop: 0 }}>Lien d’activation Gemini AI Pro · 18 mois</h2>
            {['idle', 'loading'].includes(deliveryStatus) && (
              <p>Génération automatique du lien par PixVerify en cours…</p>
            )}
            {deliveryStatus === 'starting' && (
              <p>La demande est en cours de traitement par PixVerify. Actualise cette page dans quelques instants.</p>
            )}
            {deliveryStatus === 'success' && deliveryLinks.length > 0 && (
              <div>
                <p>Ton lien d’activation est prêt :</p>
                {deliveryLinks.map((link, index) => (
                  <p key={link}>
                    <a href={link} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                      Ouvrir le lien d’activation{deliveryLinks.length > 1 ? ` ${index + 1}` : ''}
                    </a>
                  </p>
                ))}
              </div>
            )}
            {['insufficient_balance', 'retryable'].includes(deliveryStatus) && (
              <>
                <div className="shop-admin-alert error" role="alert">
                  {deliveryError || (deliveryStatus === 'insufficient_balance'
                    ? 'Le solde PixVerify est insuffisant. Recharge le compte API pour générer le lien.'
                    : 'La vérification du catalogue PixVerify peut être retentée sans relancer un achat.')}
                </div>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => requestPixverifyLink('retry')}
                  disabled={retrying}
                >
                  {retrying
                    ? 'Nouvelle tentative…'
                    : deliveryStatus === 'insufficient_balance'
                      ? 'Réessayer après recharge PixVerify'
                      : 'Réessayer'}
                </button>
              </>
            )}
            {deliveryStatus === 'failed' && (
              <div className="shop-admin-alert error" role="alert">
                {deliveryError || 'PixVerify n’a pas pu générer le lien. Contacte Caleb avec la référence de commande.'}
              </div>
            )}
          </section>
        )}

        <p style={{ color: 'var(--ink-dim)', fontSize: 14, marginBottom: 22 }}>
          {geminiQuantity > 0
            ? 'La génération du lien est lancée automatiquement après confirmation du paiement.'
            : 'Ta commande est enregistrée. Caleb préparera l’activation du produit et pourra te contacter si une information complémentaire est nécessaire.'}
        </p>

        <div className="shop-hero-cta">
          <Link to="/boutique/catalogue" className="btn btn-primary">
            Retour à la boutique
          </Link>
          <Link to="/" className="btn btn-outline">
            Retour au portfolio
          </Link>
        </div>
      </div>
    </main>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LAST_ORDER_KEY, useCart } from '../../context/CartContext';
import { formatPrice } from '../../data/products';
import { getShopOrderDeliveries, listShopCatalog, verifySasPayPayment } from '../../services/shop';
import { supabase } from '../../services/supabase';
import ShopAlert from '../../components/shop/ShopAlert';
import { getShopErrorMessage } from '../../utils/shopErrors';

async function readDeliveryResponse(error, data) {
  if (data) return data;
  if (error?.context && typeof error.context.clone === 'function') {
    try {
      return await error.context.clone().json();
    } catch {
      return { error: error.message };
    }
  }
  return { error: error?.message || 'Le lien d’activation n’a pas pu être généré.' };
}

export default function Confirmation() {
  const location = useLocation();
  const { clear } = useCart();
  const [order, setOrder] = useState(undefined); // undefined = pas encore lu, null = absent
  const [products, setProducts] = useState(null);
  const [deliveryStatus, setDeliveryStatus] = useState('idle');
  const [deliveryLinks, setDeliveryLinks] = useState([]);
  const [deliveryError, setDeliveryError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [shopDeliveries, setShopDeliveries] = useState([]);
  const [shopDeliveryStatus, setShopDeliveryStatus] = useState('idle');
  const [shopDeliveryError, setShopDeliveryError] = useState('');
  const [downloadEmail, setDownloadEmail] = useState(null);
  const requestedShopDelivery = useRef('');
  const paymentVerificationStarted = useRef(false);

  useEffect(() => {
    const orderId = new URLSearchParams(location.search).get('order_id');
    const sessionId = new URLSearchParams(location.search).get('saspay_session_id') || undefined;
    if (!orderId || paymentVerificationStarted.current) return;
    paymentVerificationStarted.current = true;
    let cancelled = false;
    async function verifyPayment() {
      let lastData = null;
      let lastError = null;
      for (let attempt = 0; attempt < 6 && !cancelled; attempt += 1) {
        const result = await verifySasPayPayment({ orderId, sessionId });
        lastData = result.data;
        lastError = result.error;
        if (result.data?.verified && result.data.order) break;
        if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      if (cancelled) return;
      if (lastError || !lastData?.verified || !lastData.order) {
        console.error('La vérification SasPay a échoué :', lastError || lastData?.message);
        if (lastData?.order) setOrder(lastData.order);
        return;
      }
      try {
        localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(lastData.order));
      } catch (storageError) {
        console.error('Le reçu ne peut pas être conservé sur cet appareil :', storageError);
      }
      clear();
      setOrder(lastData.order);
    }
    verifyPayment();
    return () => {
      cancelled = true;
    };
  }, [location.search]);

  useEffect(() => {
    if (location.state?.order) {
      setOrder(location.state.order);
      return;
    }
    const hasOrderInUrl = Boolean(new URLSearchParams(location.search).get('order_id'));
    try {
      const raw = localStorage.getItem(LAST_ORDER_KEY);
      if (raw) setOrder(JSON.parse(raw));
      else if (!hasOrderInUrl) setOrder(null);
    } catch (error) {
      console.error('Impossible de lire le reçu local :', error);
      if (!hasOrderInUrl) setOrder(null);
    }
  }, [location.search, location.state]);

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

  async function requestShopDeliveries() {
    if (!order?.id || !order?.ref || order.payment_status !== 'confirme') return;
    setShopDeliveryStatus('loading');
    setShopDeliveryError('');
    const { data, error } = await getShopOrderDeliveries({ orderId: order.id, orderRef: order.ref });
    if (error || data?.error) {
      const response = await readDeliveryResponse(error, data);
      setShopDeliveryError(getShopErrorMessage(response.error, 'La livraison n’a pas pu être préparée.'));
      setShopDeliveryStatus('failed');
      return;
    }
    setShopDeliveries(Array.isArray(data?.deliveries) ? data.deliveries : []);
    setDownloadEmail(data?.email || null);
    setShopDeliveryStatus('ready');
  }

  useEffect(() => {
    if (order?.payment_status !== 'confirme' || !products || requestedShopDelivery.current === order.id) return;
    requestedShopDelivery.current = order.id;
    requestShopDeliveries();
  }, [order?.id, order?.payment_status, products]);

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
      console.error('La livraison Gemini a échoué :', error || response.error);
      setDeliveryLinks(Array.isArray(response.links) ? response.links : []);
      const status = response.status
        || (error?.context?.status === 402 ? 'insufficient_balance' : '');
      const message = status === 'insufficient_balance'
        ? 'La génération de ton lien d’activation est temporairement indisponible. Réessaie plus tard ou contacte Caleb avec ta référence de commande.'
        : status === 'retryable'
          ? 'La génération de ton lien a rencontré un problème temporaire. Tu peux réessayer sans risque de relancer le paiement.'
          : 'Le lien d’activation n’a pas pu être généré. Contacte Caleb avec ta référence de commande.';
      setDeliveryError(message);
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
          <h1 style={{ fontSize: '1.6rem' }}>Confirmation de ton paiement</h1>
          <p style={{ color: 'var(--ink-dim)', marginBottom: 22 }}>
            Nous vérifions encore la confirmation SasPay de la commande {order.ref || order.id}. Cette vérification
            se fait automatiquement ; tu peux rester sur cette page sans repayer.
          </p>
          <div className="shop-alert info" role="status">
            <span className="shop-alert-icon" aria-hidden="true">i</span>
            <div className="shop-alert-content">
              <strong>Paiement en cours de vérification</strong>
              <span>La commande sera actualisée automatiquement dès que SasPay aura confirmé le paiement.</span>
            </div>
          </div>
          <Link to="/boutique/compte" className="btn btn-outline">Voir mes commandes</Link>
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
          Merci {order.customer?.name} ! Ton paiement SasPay a été vérifié.
        </p>
        <div className="confirm-ref">
          Référence : <strong>{order.ref}</strong>
        </div>

        {(() => {
          const downloads = shopDeliveries.filter((delivery) => delivery.type === 'download');
          if (!downloads.length && shopDeliveryStatus !== 'loading' && shopDeliveryStatus !== 'failed') return null;
          return (
            <section className="download-delivery" aria-live="polite">
              <div className="eyebrow">TES FICHIERS SONT PRÊTS</div>
              <h2>Téléchargement sécurisé</h2>
              {shopDeliveryStatus === 'loading' && <p>Préparation de tes liens temporaires…</p>}
              {shopDeliveryStatus === 'failed' && (
                <>
                  <ShopAlert message={shopDeliveryError} action="Réessayer" onAction={requestShopDeliveries} />
                  <button type="button" className="btn btn-primary download-button" onClick={requestShopDeliveries}>
                    Réessayer
                  </button>
                </>
              )}
              {downloads.map((file) => (
                <div className="download-file" key={file.productId}>
                  <div className="download-file-name">{file.filename}</div>
                  {file.error || !file.url ? (
                    <>
                      <div className="shop-admin-alert error" role="alert">
                        {file.error || 'Le lien temporaire est indisponible. Contacte Caleb avec la référence de commande.'}
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline download-button"
                        onClick={requestShopDeliveries}
                        disabled={shopDeliveryStatus === 'loading'}
                      >
                        {shopDeliveryStatus === 'loading' ? 'Vérification…' : 'Réessayer'}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="download-file-meta">
                        {file.size} · {file.name} · payé {formatPrice(file.lineTotal)}
                      </div>
                      <a className="btn btn-primary download-button" href={file.url}>
                        Télécharger
                      </a>
                      <p className="download-expiry">Lien temporaire valable 24 heures. Le lien source reste privé.</p>
                    </>
                  )}
                </div>
              ))}
              {downloadEmail && (
                <p className={downloadEmail.sent ? 'download-email-sent' : 'download-email-warning'}>
                  {downloadEmail.message}
                </p>
              )}
            </section>
          );
        })()}

        <div className="confirm-summary">
          <div>
            {(order.items || []).map((line) => {
              const product = products?.find((entry) => entry.id === line.productId);
              const activation = shopDeliveries.find((entry) =>
                entry.productId === line.productId && entry.type === 'activate',
              );
              return (
                <div key={`${line.productId}-${line.planId}`}>
                  <div className="summary-row">
                    <span>
                      {line.name} ({line.planLabel}) ×{line.qty}
                    </span>
                    <span>{formatPrice(line.lineTotal)}</span>
                  </div>
                  {activation?.url && (
                    <div className="summary-row access-link">
                      <span style={{ color: 'var(--ink-dim)', fontSize: '0.9rem' }}>Activation :</span>
                      <a href={activation.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary">
                        Activer {line.name}
                      </a>
                    </div>
                  )}
                  {activation?.error && (
                    <div className="summary-row">
                      <span style={{ color: 'var(--ink-dim)', fontSize: '0.9rem' }}>{activation.error}</span>
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
            <span>SasPay · confirmé</span>
          </div>
        </div>

        {geminiQuantity > 0 && (
          <section className="confirm-summary" aria-live="polite" style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: '1.1rem', marginTop: 0 }}>Lien d’activation Gemini AI Pro · 18 mois</h2>
            {['idle', 'loading'].includes(deliveryStatus) && (
              <p>Génération automatique de ton lien d’activation en cours…</p>
            )}
            {deliveryStatus === 'starting' && (
              <p>Ta demande est en cours de traitement. Actualise cette page dans quelques instants.</p>
            )}
            {deliveryStatus === 'success' && deliveryLinks.length > 0 && (
              <div>
                <p>Ton lien d’activation est prêt :</p>
                {deliveryLinks.map((link, index) => (
                  <p key={link}>
                    <a href={link} target="_blank" rel="noopener noreferrer" className="gemini-activation-url">
                      {link}
                    </a>
                    <br />
                    <a href={link} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                      Activer Gemini Pro{deliveryLinks.length > 1 ? ` ${index + 1}` : ''}
                    </a>
                  </p>
                ))}
              </div>
            )}
            {['insufficient_balance', 'retryable'].includes(deliveryStatus) && (
              <>
                <ShopAlert
                  message={getShopErrorMessage(deliveryError, 'La génération de ton lien a rencontré un problème temporaire. Tu peux réessayer sans risque de relancer le paiement.')}
                  action="Réessayer"
                  onAction={() => requestPixverifyLink('retry')}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => requestPixverifyLink('retry')}
                  disabled={retrying}
                >
                  {retrying
                    ? 'Nouvelle tentative…'
                    : 'Réessayer'}
                </button>
              </>
            )}
            {deliveryStatus === 'failed' && (
              <ShopAlert
                message={getShopErrorMessage(deliveryError, 'Le lien d’activation n’a pas pu être généré. Contacte Caleb avec ta référence de commande.')}
                action="Réessayer"
                onAction={() => requestPixverifyLink('retry')}
              />
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

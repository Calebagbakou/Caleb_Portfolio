import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LAST_ORDER_KEY, useCart } from '../../context/CartContext';
import { formatPrice } from '../../data/products';
import { getBuyerAccount, getShopOrderDeliveries, listShopCatalog, verifySasPayPayment } from '../../services/shop';
import { supabase } from '../../services/supabase';
import ShopAlert from '../../components/shop/ShopAlert';
import { getShopErrorMessage } from '../../utils/shopErrors';
import { formatOrderReference } from '../../utils/orderReference';

const DELIVERY_ESTIMATE_TEXT = 'dès que possible';

function formatPaymentDate(value) {
  if (!value) return 'Date du paiement indisponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date du paiement indisponible';
  return date.toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function getOrderItems(order) {
  if (Array.isArray(order?.items)) return order.items;
  return (order?.order_items || []).map((item) => {
    const product = Array.isArray(item.products) ? item.products[0] : item.products;
    return {
      productId: item.product_id,
      planId: item.plan_id,
      name: item.product_name,
      planLabel: item.plan_label,
      qty: item.qty,
      lineTotal: item.line_total,
      product,
    };
  });
}

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
  const [providerProducts, setProviderProducts] = useState([]);
  const [deliveryError, setDeliveryError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [copiedAccessKey, setCopiedAccessKey] = useState('');
  const [shopDeliveries, setShopDeliveries] = useState([]);
  const [shopDeliveryStatus, setShopDeliveryStatus] = useState('idle');
  const [shopDeliveryError, setShopDeliveryError] = useState('');
  const [downloadEmail, setDownloadEmail] = useState(null);
  const [referenceCopied, setReferenceCopied] = useState(false);
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
      for (let attempt = 0; attempt < 30 && !cancelled; attempt += 1) {
        const result = await verifySasPayPayment({ orderId, sessionId });
        lastData = result.data;
        lastError = result.error;
        if (result.data?.verified && result.data.order) break;
        if (result.data?.order?.payment_status === 'confirme') {
          lastData = { ...result.data, verified: true };
          break;
        }
        const accountResult = await getBuyerAccount();
        const accountOrder = accountResult.data?.orders?.find((entry) => entry.id === orderId);
        if (accountOrder?.payment_status === 'confirme') {
          lastData = { order: accountOrder, verified: true };
          lastError = null;
          break;
        }
        if (attempt < 29) await new Promise((resolve) => setTimeout(resolve, 2000));
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
    if (!getOrderItems(order).length) return;

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

  const prodSellerTargets = useMemo(() => {
    if (!products) return [];
    const targets = new Map();
    for (const line of getOrderItems(order)) {
      const product = line.product || products.find((entry) => entry.id === line.productId);
      const targetKey = product?.slug === 'canva-pro'
        ? 'canva_pro'
        : product?.slug === 'gemini-pro' && line.planLabel === '18 mois'
          ? 'gemini_18m'
          : '';
      if (!targetKey) continue;
      const current = targets.get(targetKey) || { key: targetKey, name: product.name, quantity: 0 };
      current.quantity += Number(line.qty || 0);
      targets.set(targetKey, current);
    }
    return [...targets.values()];
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

  async function requestProdSellerDelivery(action = 'deliver') {
    if (!order?.id || !order?.ref || !prodSellerTargets.length) return;
    setDeliveryError('');
    if (action === 'retry') setRetrying(true);
    else if (action === 'deliver') setDeliveryStatus('loading');

    const { data, error } = await supabase.functions.invoke('gemini-prodseller-activate', {
      body: { action, order_id: order.id, order_ref: order.ref },
    });

    if (error || data?.error) {
      const response = await readDeliveryResponse(error, data);
      console.error('La livraison ProdSeller a échoué :', error || response.error);
      setDeliveryLinks(Array.isArray(response.links) ? response.links : []);
      setProviderProducts(Array.isArray(response.products) ? response.products : []);
      const status = response.status
        || (error?.context?.status === 402 ? 'insufficient_balance' : '');
      const message = status === 'insufficient_balance'
        ? 'La génération de votre lien d’activation est temporairement indisponible. Réessayez plus tard ou contactez Caleb avec votre référence de commande.'
        : status === 'retryable'
          ? 'La génération de votre lien a rencontré un problème temporaire. Vous pouvez réessayer sans relancer le paiement.'
          : 'Le lien d’activation n’a pas pu être généré. Contactez Caleb avec votre référence de commande.';
      setDeliveryError(message);
      setDeliveryStatus(
        status === 'insufficient_balance' || status === 'retryable'
          ? status
          : 'failed',
      );
    } else {
      setDeliveryLinks(Array.isArray(data?.links) ? data.links : []);
      setProviderProducts(Array.isArray(data?.products) ? data.products : []);
      setDeliveryError('');
      setDeliveryStatus(data?.status || 'failed');
    }
    setRetrying(false);
  }

  async function copyActivationKey(key) {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedAccessKey(key);
      window.setTimeout(() => setCopiedAccessKey(''), 1800);
    } catch (copyError) {
      console.error('Impossible de copier l’accès fournisseur :', copyError);
      setDeliveryError('L’accès n’a pas pu être copié. Sélectionnez-le pour le copier manuellement.');
    }
  }

  async function copyOrderReference() {
    try {
      await navigator.clipboard.writeText(formatOrderReference(order.ref));
      setReferenceCopied(true);
      window.setTimeout(() => setReferenceCopied(false), 1800);
    } catch (copyError) {
      console.error('Impossible de copier la référence de commande :', copyError);
    }
  }

  useEffect(() => {
    if (order?.payment_status !== 'confirme' || !products || !prodSellerTargets.length) return;
    if (deliveryStatus !== 'idle') return;
    requestProdSellerDelivery();
  }, [order?.payment_status, products, prodSellerTargets, deliveryStatus]);

  if (order === undefined) return null;
  const paymentDetails = [
    order?.payment_method && !['saspay', 'kkiapay'].includes(String(order.payment_method).toLowerCase())
      ? order.payment_method
      : '',
    order?.payment_country || '',
  ].filter(Boolean);
  const paidByPromo = order?.payment_method === 'promo';
  const orderDiscount = Number(order?.discountAmount ?? order?.promo_discount ?? 0);
  const orderSubtotal = Number(order?.subtotal ?? (Number(order?.total || 0) + orderDiscount));
  const orderPromoCode = order?.promoCode || order?.promo_code || '';
  const providerProductsForDisplay = providerProducts.length
    ? providerProducts
    : prodSellerTargets.map((target) => ({
      ...target,
      status: deliveryStatus,
      accessKeys: [],
      error: deliveryError,
    }));
  const needsProviderStatusCheck = providerProductsForDisplay.some((product) => product.status === 'starting');

  if (!order || !order.ref) {
    return (
      <main>
        <div className="confirm-wrap">
          <h1 style={{ fontSize: '1.6rem' }}>Aucune commande récente</h1>
          <p style={{ color: 'var(--ink-dim)', marginBottom: 22 }}>
            Nous n'avons pas trouvé de commande à afficher.
          </p>
          <Link to="/boutique/catalogue" className="btn btn-primary">
            Voir le catalogue
          </Link>
        </div>
      </main>
    );
  }

  if (order.payment_status !== 'confirme') {
    return (
      <main>
        <nav className="buyer-journey" aria-label="Étapes de la commande">
          {['Produit', 'Compte', 'Paiement', 'Livraison'].map((step, index) => (
            <div className={`buyer-journey-step${index < 2 ? ' completed' : ''}${index === 2 ? ' active' : ''}`} aria-current={index === 2 ? 'step' : undefined} key={step}>
              <span>{index < 2 ? '✓' : index + 1}</span><span className="buyer-journey-label">{step}</span>
            </div>
          ))}
        </nav>
        <div className="confirm-wrap">
          <h1 style={{ fontSize: '1.6rem' }}>Confirmation de votre paiement</h1>
          <p style={{ color: 'var(--ink-dim)', marginBottom: 22 }}>
            Nous vérifions la confirmation du paiement pour la commande {formatOrderReference(order.ref || order.id)}. Cette vérification
            se fait automatiquement ; vous pouvez rester sur cette page sans repayer.
          </p>
          <div className="shop-alert info" role="status">
            <span className="shop-alert-icon" aria-hidden="true">i</span>
            <div className="shop-alert-content">
              <strong>Paiement en cours de vérification</strong>
              <span>La commande sera actualisée automatiquement dès que le prestataire aura confirmé le paiement.</span>
            </div>
          </div>
          <Link to="/boutique/compte" className="btn btn-outline">Voir vos commandes</Link>
          <Link to="/boutique" className="btn btn-primary">Retour à la boutique</Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <nav className="buyer-journey" aria-label="Étapes de la commande">
        {['Produit', 'Compte', 'Paiement', 'Livraison'].map((step, index) => (
          <div className={`buyer-journey-step${index < 3 ? ' completed' : ''}${index === 3 ? ' active' : ''}`} aria-current={index === 3 ? 'step' : undefined} key={step}>
            <span>{index < 3 ? '✓' : index + 1}</span><span className="buyer-journey-label">{step}</span>
          </div>
        ))}
      </nav>
      <div className="confirm-wrap">
        <div className="confirm-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M5 12l5 5L20 7" />
          </svg>
        </div>
        <h1 className="confirm-title">{paidByPromo ? 'Commande confirmée' : 'Paiement confirmé'}</h1>
        <p style={{ color: 'var(--ink-dim)' }}>
          {paidByPromo
            ? `Merci ${order.customer?.name} ! Votre code promo a couvert le total de la commande.`
            : `Merci ${order.customer?.name} ! Votre paiement a été vérifié.`}
        </p>
        {(() => {
          const downloads = shopDeliveries.filter((delivery) => delivery.type === 'download');
          if (!downloads.length && shopDeliveryStatus !== 'loading' && shopDeliveryStatus !== 'failed') return null;
          return (
            <section className="download-delivery" aria-live="polite">
              <div className="eyebrow">
                {downloads.length
                  ? 'VOS FICHIERS SONT PRÊTS'
                  : shopDeliveryStatus === 'failed'
                    ? 'PRÉPARATION IMPOSSIBLE'
                    : 'PRÉPARATION EN COURS'}
              </div>
              <h2>Téléchargement sécurisé</h2>
              {shopDeliveryStatus === 'loading' && <p>Préparation de vos liens temporaires…</p>}
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
          <div className="confirm-products">
            {getOrderItems(order).map((line) => {
              const product = line.product || products?.find((entry) => entry.id === line.productId);
              const activation = shopDeliveries.find((entry) =>
                entry.productId === line.productId && entry.type === 'activate',
              );
              return (
                <div className="confirm-product" key={`${line.productId}-${line.planId}`}>
                  <span className="confirm-product-image" style={{ background: product?.gradient || 'var(--surface-alt)' }}>
                    {product?.image_url || product?.logo_url
                      ? <img src={product.image_url || product.logo_url} alt="" />
                      : product?.avatar || line.name?.slice(0, 2)?.toUpperCase() || 'CC'}
                  </span>
                  <div className="confirm-product-info">
                    <strong>{line.name}</strong>
                    <span>{line.planLabel} · Quantité : {line.qty}</span>
                  </div>
                  <strong className="confirm-product-price">{formatPrice(line.lineTotal)}</strong>
                  {activation?.url && (
                    <div className="confirm-product-access">
                      <span>Activation</span>
                      <a href={activation.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary">
                        Activer {line.name}
                      </a>
                    </div>
                  )}
                  {activation?.error && (
                    <div className="confirm-product-access">
                      <span>{activation.error}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {orderDiscount > 0 && (
            <>
              <div className="summary-row">
                <span>Sous-total</span>
                <span>{formatPrice(orderSubtotal)}</span>
              </div>
              <div className="summary-row checkout-discount">
                <span>Code {orderPromoCode}</span>
                <span>−{formatPrice(orderDiscount)}</span>
              </div>
            </>
          )}
          <div className="summary-row total">
            <span>Total</span>
            <span>{formatPrice(order.total)}</span>
          </div>
          <div className="summary-row">
            <span>Paiement</span>
            <span>{paidByPromo ? 'Code promo appliqué' : `${paymentDetails.length ? paymentDetails.join(' · ') : 'Paiement en ligne sécurisé'} · confirmé`}</span>
          </div>
          <div className="summary-row">
            <span>Date et heure</span>
            <span>{formatPaymentDate(order.payment_verified_at)}</span>
          </div>
          <div className="summary-row confirm-reference-row">
            <span>Référence</span>
            <strong>{formatOrderReference(order.ref)}</strong>
            <button type="button" className="confirm-copy-button" onClick={copyOrderReference}>
              {referenceCopied ? 'Copié ✓' : 'Copier'}
            </button>
            <span className="sr-only" aria-live="polite">{referenceCopied ? 'Copié ✓' : ''}</span>
          </div>
        </div>

        {prodSellerTargets.length > 0 && (
          <section className="confirm-summary" aria-live="polite" style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: '1.1rem', marginTop: 0 }}>Accès numériques</h2>
            {['idle', 'loading'].includes(deliveryStatus) && (
              <p>Préparation automatique de vos accès en cours…</p>
            )}
            {needsProviderStatusCheck && (
              <>
                <p>Une activation est en cours chez le fournisseur.</p>
                <button type="button" className="btn btn-outline" onClick={() => requestProdSellerDelivery('status')}>
                  Vérifier les accès
                </button>
              </>
            )}
            {deliveryStatus === 'success' && deliveryLinks.length > 0 && (
              <div>
                <p>Votre lien d’activation est prêt :</p>
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
                  message={getShopErrorMessage(deliveryError, 'La génération de votre lien a rencontré un problème temporaire. Vous pouvez réessayer sans relancer le paiement.')}
                  action="Réessayer"
                  onAction={() => requestProdSellerDelivery('retry')}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => requestProdSellerDelivery('retry')}
                  disabled={retrying}
                >
                  {retrying
                    ? 'Nouvelle tentative…'
                    : 'Réessayer'}
                </button>
              </>
            )}
            {providerProductsForDisplay.map((product) => (
              <section className="provider-access-product" key={product.key}>
                <h3>{product.name}{product.quantity > 1 ? ` · ${product.quantity} accès` : ''}</h3>
                {product.status === 'success' && product.accessKeys?.length > 0 && (
                  <div className="gemini-access-keys">
                    <p>Votre accès est prêt :</p>
                    {product.accessKeys.map((key, index) => (
                      <div className="gemini-access-key" key={`${product.key}-${index}-${key.slice(0, 12)}`}>
                        <code>{key}</code>
                        <button type="button" className="btn btn-outline" onClick={() => copyActivationKey(key)}>
                          {copiedAccessKey === key ? 'Copié ✓' : 'Copier l’accès'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {product.error && <ShopAlert message={product.error} />}
              </section>
            ))}
            {deliveryStatus === 'failed' && (
              <ShopAlert
                message={getShopErrorMessage(deliveryError, 'Le lien d’activation n’a pas pu être généré. Contactez Caleb avec votre référence de commande.')}
              />
            )}
          </section>
        )}

        <section className="confirm-next-steps">
          <h2>Et maintenant ?</h2>
          <ol>
            <li><span className="confirm-next-check">✓</span><span>Paiement reçu</span></li>
            <li><span className="confirm-next-number">2</span><span>Activation en cours <small>{DELIVERY_ESTIMATE_TEXT}</small></span></li>
            <li><span className="confirm-next-number">3</span><span>Accès disponible dans Mon compte</span></li>
          </ol>
          {prodSellerTargets.length > 0 && <p>La préparation des accès est lancée automatiquement après confirmation du paiement.</p>}
        </section>

        <div className="confirm-actions">
          <Link to="/boutique/compte" className="btn btn-primary">
            Voir mes accès
          </Link>
          <a className="btn btn-outline" href={`https://wa.me/2290148135395?text=${encodeURIComponent(`Bonjour, j’ai une question au sujet de la commande ${formatOrderReference(order.ref)}.`)}`} target="_blank" rel="noopener noreferrer">
            Écrire sur WhatsApp
          </a>
          <Link to="/boutique/catalogue" className="confirm-continue-link">
            Continuer mes achats
          </Link>
        </div>
        <footer className="confirm-footer-link">
          <Link to="/">Voir le portfolio</Link>
        </footer>
      </div>
    </main>
  );
}

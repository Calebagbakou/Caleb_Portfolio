import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LAST_ORDER_KEY, useCart } from '../../context/CartContext';
import { formatPrice } from '../../data/products';
import { getBuyerAccount, getShopOrderDeliveries, listShopCatalog, verifySasPayPayment } from '../../services/shop';
import { supabase } from '../../services/supabase';
import ShopAlert from '../../components/shop/ShopAlert';
import ProviderLink from '../../components/shop/ProviderLink';
import DownloadSupport from '../../components/shop/DownloadSupport';
import { LoadingFeedback } from '../../components/site/LoadingStates';
import { useSlowLoading } from '../../hooks/useSlowLoading';
import { formatOrderReference } from '../../utils/orderReference';
import { isApiDelivery } from '../../utils/delivery';

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

export default function Confirmation() {
  const location = useLocation();
  const { clear } = useCart();
  const [order, setOrder] = useState(undefined); // undefined = pas encore lu, null = absent
  const [products, setProducts] = useState(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState('');
  const [productsRetry, setProductsRetry] = useState(0);
  const productsSlowLoading = useSlowLoading(productsLoading);
  const [deliveryStatus, setDeliveryStatus] = useState('idle');
  const [providerProducts, setProviderProducts] = useState([]);
  const [deliveryError, setDeliveryError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [shopDeliveries, setShopDeliveries] = useState([]);
  const [shopDeliveryStatus, setShopDeliveryStatus] = useState('idle');
  const [shopDeliveryError, setShopDeliveryError] = useState('');
  const [downloadEmail, setDownloadEmail] = useState(null);
  const [referenceCopied, setReferenceCopied] = useState(false);
  const [paymentVerifying, setPaymentVerifying] = useState(false);
  const [paymentVerificationError, setPaymentVerificationError] = useState('');
  const [paymentRetry, setPaymentRetry] = useState(0);
  const paymentSlowLoading = useSlowLoading(paymentVerifying);
  const requestedShopDelivery = useRef('');
  const paymentVerificationStarted = useRef(false);

  useEffect(() => {
    const orderId = new URLSearchParams(location.search).get('order_id');
    const sessionId = new URLSearchParams(location.search).get('saspay_session_id') || undefined;
    if (!orderId || paymentVerificationStarted.current) return;
    paymentVerificationStarted.current = true;
    let cancelled = false;
    setPaymentVerifying(true);
    setPaymentVerificationError('');
    async function verifyPayment() {
      try {
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
          const verificationError = lastError || lastData?.message || new Error('La confirmation du paiement est toujours en attente.');
          console.error('La vérification SasPay a échoué :', verificationError);
          if (lastData?.order) setOrder(lastData.order);
          setPaymentVerificationError('La confirmation du paiement est toujours en attente. Réessayez dans quelques instants.');
          return;
        }
        try {
          localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(lastData.order));
        } catch (storageError) {
          console.error('Le reçu ne peut pas être conservé sur cet appareil :', storageError);
        }
        clear();
        setOrder(lastData.order);
      } catch (verificationError) {
        if (cancelled) return;
        console.error('Une erreur inattendue est survenue pendant la vérification du paiement :', verificationError);
        setPaymentVerificationError('La vérification du paiement a échoué. Réessayez ou contactez Caleb.');
      } finally {
        if (!cancelled) setPaymentVerifying(false);
      }
    }
    verifyPayment();
    return () => {
      cancelled = true;
      paymentVerificationStarted.current = false;
    };
  }, [location.search, paymentRetry]);

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
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 21000);
    setProductsLoading(true);
    setProductsError('');
    async function loadProducts() {
      try {
        const { data, error } = await listShopCatalog({ includeInactive: true, signal: controller.signal });
        if (cancelled) return;
        if (error) throw error;
        if (data?.products) {
        setProducts(data.products);
        } else {
        throw new Error('Le catalogue n’a pas renvoyé les produits de cette commande.');
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Impossible de charger les produits de la commande :', error);
        setProductsError(controller.signal.aborted
        ? 'Le chargement des produits prend trop de temps. Réessayez.'
        : 'Les produits de votre commande ne peuvent pas être chargés pour le moment.');
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    }

    loadProducts();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [order, productsRetry]);

  const apiProducts = useMemo(() => {
    if (!products) return [];
    const targets = new Map();
    for (const line of getOrderItems(order)) {
      const product = line.product || products.find((entry) => entry.id === line.productId);
      if (!isApiDelivery(product)) continue;
      const targetKey = product.id;
      const current = targets.get(targetKey) || { key: targetKey, productId: targetKey, name: line.name || product.name, quantity: 0 };
      current.quantity += Number(line.qty || 0);
      targets.set(targetKey, current);
    }
    return [...targets.values()];
  }, [order, products]);

  function getProviderProducts(response) {
    if (Array.isArray(response?.products) && response.products.length) return response.products;
    const links = Array.isArray(response?.links) ? response.links : [];
    if (!links.length || !apiProducts.length) return [];
    const firstApiProduct = apiProducts[0];
    return [{
      ...firstApiProduct,
      status: 'success',
      accessKeys: links,
      error: '',
    }];
  }

  async function requestShopDeliveries() {
    if (!order?.id || !order?.ref || order.payment_status !== 'confirme') return;
    setShopDeliveryStatus('loading');
    setShopDeliveryError('');
    const { data, error } = await getShopOrderDeliveries({ orderId: order.id, orderRef: order.ref });
    if (error || data?.error) {
      setShopDeliveryError('La livraison n’a pas pu être préparée. Réessayez ou contactez le support.');
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
    if (!order?.id || !order?.ref || !apiProducts.length) return;
    setDeliveryError('');
    if (action === 'retry') setRetrying(true);
    else if (action === 'deliver') setDeliveryStatus('loading');

    const { data, error } = await supabase.functions.invoke('gemini-prodseller-activate', {
      body: { action, order_id: order.id, order_ref: order.ref },
    });

    if (error || data?.error) {
      const response = await readDeliveryResponse(error, data);
      setProviderProducts(getProviderProducts(response));
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
      setProviderProducts(getProviderProducts(data));
      setDeliveryError('');
      setDeliveryStatus(data?.status || 'failed');
    }
    setRetrying(false);
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
    if (order?.payment_status !== 'confirme' || !products || !apiProducts.length) return;
    if (deliveryStatus !== 'idle') return;
    requestProdSellerDelivery();
  }, [order?.payment_status, products, apiProducts, deliveryStatus]);

  if (order === undefined) {
    if (!paymentVerifying && !paymentVerificationError) return null;
    if (paymentSlowLoading.showLoader || paymentVerificationError) {
      return (
        <main className="confirm-wrap" aria-live="polite">
          <h1>Vérification de votre paiement…</h1>
          {paymentVerifying && <p>Merci de patienter ; ne relancez pas votre paiement.</p>}
          {paymentVerificationError && <p className="shop-state" role="status">{paymentVerificationError}</p>}
          <LoadingFeedback
            phase={paymentVerificationError ? 'error' : paymentSlowLoading.phase}
            onRetry={() => {
              paymentVerificationStarted.current = false;
              setPaymentRetry((current) => current + 1);
            }}
          />
        </main>
      );
    }
    return null;
  }
  const paymentDetails = [
    order?.payment_method && String(order.payment_method).toLowerCase() !== 'saspay'
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
    : apiProducts.map((target) => ({
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
        {productsLoading && productsSlowLoading.showLoader && (
          <LoadingFeedback phase={productsSlowLoading.phase} onRetry={() => setProductsRetry((current) => current + 1)} />
        )}
        {productsError && (
          <ShopAlert
            message={productsError}
            action="Réessayer"
            onAction={() => setProductsRetry((current) => current + 1)}
          />
        )}
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
                  {file.error || !file.url ? (
                    <>
                      <div className="shop-admin-alert error" role="alert">
                        Le lien temporaire est indisponible. Contactez le support avec votre référence de commande.
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
                        {file.name} · payé {formatPrice(file.lineTotal)}
                      </div>
                      <DownloadSupport item={file} orderRef={order.ref} />
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
                    <ProviderLink url={activation.url} productName={line.name} />
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

        {apiProducts.length > 0 && (
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
            {['insufficient_balance', 'retryable'].includes(deliveryStatus) && (
              <>
                <ShopAlert
                  message={deliveryError || 'La génération de votre lien a rencontré un problème temporaire. Vous pouvez réessayer sans relancer le paiement.'}
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
                      <ProviderLink
                        key={`${product.key}-${index}`}
                        url={key}
                        productName={product.name}
                        linkNumber={product.accessKeys.length > 1 ? index + 1 : undefined}
                      />
                    ))}
                  </div>
                )}
                {['starting', 'not_started'].includes(product.status) && (
                  <p>Activation en cours</p>
                )}
                {product.error && (
                  <ShopAlert message="Le lien d’activation n’a pas pu être généré. Contactez le support avec votre référence de commande." />
                )}
              </section>
            ))}
            {deliveryStatus === 'failed' && (
              <ShopAlert
                message={deliveryError || 'Le lien d’activation n’a pas pu être généré. Contactez Caleb avec votre référence de commande.'}
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
          {apiProducts.length > 0 && <p>La préparation des accès est lancée automatiquement après confirmation du paiement.</p>}
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  SiFacebook,
  SiInstagram,
  SiSpotify,
  SiTelegram,
  SiTiktok,
  SiWhatsapp,
  SiX,
  SiYoutube,
} from 'react-icons/si';
import Seo from '../components/site/Seo';
import { supabase } from '../services/supabase';
import { getSupabaseFunctionError } from '../utils/supabaseFunctionErrors';
import './SmmPanel.css';

const money = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const NETWORKS = [
  { id: 'Instagram', match: ['instagram'], icon: SiInstagram, color: '#E4405F' },
  { id: 'Facebook', match: ['facebook'], icon: SiFacebook, color: '#0866FF' },
  { id: 'TikTok', match: ['tiktok'], icon: SiTiktok, color: '#111111' },
  { id: 'YouTube', match: ['youtube'], icon: SiYoutube, color: '#FF0000' },
  { id: 'Telegram', match: ['telegram'], icon: SiTelegram, color: '#24A1DE' },
  { id: 'WhatsApp', match: ['whatsapp'], icon: SiWhatsapp, color: '#25D366' },
  { id: 'Twitter', match: ['twitter', 'x (twitter)'], icon: SiX, color: '#111111' },
  { id: 'Spotify', match: ['spotify'], icon: SiSpotify, color: '#1DB954' },
];
const QUICK_AMOUNTS = [1000, 2000, 5000, 10000];
const ACTIVE_STATUSES = ['submitting', 'submission_check', 'pending', 'processing'];
const DONE_STATUSES = ['completed', 'partial'];
const ORDER_FILTERS = [
  { id: 'all', label: 'Toutes' },
  { id: 'active', label: 'En cours' },
  { id: 'done', label: 'Terminées' },
  { id: 'issues', label: 'Problèmes' },
];
const PANEL_SCREENS = [
  { id: 'home', path: '/smm', label: 'Accueil', title: 'Votre espace social', description: 'Un aperçu clair de votre portefeuille et de vos commandes.', icon: 'home' },
  { id: 'order', path: '/smm/commande', label: 'Commander', title: 'Nouvelle commande', description: 'Choisissez un service et vérifiez le montant avant de confirmer.', icon: 'plus' },
  { id: 'orders', path: '/smm/commandes', label: 'Commandes', title: 'Mes commandes', description: 'Consultez l’avancement et l’historique de vos demandes.', icon: 'orders' },
  { id: 'wallet', path: '/smm/portefeuille', label: 'Portefeuille', title: 'Mon portefeuille', description: 'Consultez votre solde et l’historique de vos opérations.', icon: 'wallet' },
  { id: 'referral', path: '/smm/parrainage', label: 'Parrainage', title: 'Programme de parrainage', description: 'Invitez vos proches et suivez les récompenses gagnées.', icon: 'social' },
];

function formatXof(value) {
  return `${money.format(Number(value) || 0)} FCFA`;
}

function statusLabel(status) {
  return ({
    submitting: 'Envoi en cours',
    submission_check: 'Vérification requise',
    pending: 'En attente',
    processing: 'En cours',
    completed: 'Terminée',
    partial: 'Partielle',
    canceled: 'Annulée',
    failed: 'Échouée — remboursée',
  })[status] || status;
}

function matchesFilter(status, filter) {
  if (filter === 'all') return true;
  if (filter === 'active') return ACTIVE_STATUSES.includes(status);
  if (filter === 'done') return DONE_STATUSES.includes(status);
  return !ACTIVE_STATUSES.includes(status) && !DONE_STATUSES.includes(status);
}

function networkForText(text = '') {
  const value = text.toLowerCase();
  return NETWORKS.find((network) => network.match.some((term) => value.includes(term))) || null;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function Icon({ name }) {
  const paths = {
    home: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4v-5.5H9V20H5a1 1 0 0 1-1-1z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    orders: <path d="M7 4h10a1 1 0 0 1 1 1v15l-3-2-3 2-3-2-3 2V5a1 1 0 0 1 1-1zM9 9h6M9 13h4" />,
    wallet: <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3M4 7.5V17a2 2 0 0 0 2 2h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5zM15.5 13.5h.01" />,
    more: <path d="M6 12h.01M12 12h.01M18 12h.01" />,
    refresh: <path d="M20 11a8 8 0 0 0-14.5-4M4 5v4h4M4 13a8 8 0 0 0 14.5 4M20 19v-4h-4" />,
    inbox: <path d="M4 13l2-7h12l2 7M4 13v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5M4 13h4l1 2h6l1-2h4" />,
    social: <path d="M16 8a3 3 0 1 0-2.8-4M8 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM10.6 16.8l4.8-7.5M10.8 7.2l4.4 1.6" />,
  };
  return (
    <svg className="smm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function SmmNavigation({ activeScreen, moreMenuRef, balance, navigate }) {
  const menuItems = [
    { label: 'Accueil', to: '/smm', icon: 'home' },
    { label: 'Commande', to: '/smm/commande', icon: 'plus' },
    { label: 'Compte', to: '/boutique/compte', icon: 'social' },
    { label: 'Nouvel ordre', to: '/smm/commande', icon: 'plus' },
    { label: 'Commandes', to: '/smm/commandes', icon: 'orders' },
    { label: 'Parrainage', to: '/smm/parrainage', icon: 'social' },
    { label: 'Ajouter des fonds', to: '/smm/portefeuille', icon: 'wallet' },
    { label: 'Contactez-nous', to: '/portfolio/#contact', icon: 'social' },
  ];

  return (
    <nav className="smm-user-nav" aria-label="Navigation du panel social">
      <details className="smm-user-more" ref={moreMenuRef}>
        <summary aria-label="Ouvrir le menu">
          <span className="smm-hamburger" aria-hidden="true"><span /><span /><span /></span>
          <span>Menu</span>
        </summary>
        <div className="smm-user-more-menu">
          {menuItems.map((item) => (
            <Link
              to={item.to}
              key={`${item.label}-${item.to}`}
              aria-current={item.to === currentScreenPath(activeScreen) ? 'page' : undefined}
              onClick={() => moreMenuRef.current?.removeAttribute('open')}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </details>
      <div className="smm-wallet-toolbar">
        <button
          className="smm-add-funds-button"
          type="button"
          onClick={() => navigate('/smm/portefeuille')}
          aria-label="Ajouter des fonds"
          title="Ajouter des fonds"
        >
          +
        </button>
        <Link className="smm-wallet-toolbar-balance" to="/smm/portefeuille">
          <span>Solde</span>
          <strong>{formatXof(balance)}</strong>
        </Link>
      </div>
    </nav>
  );
}

function currentScreenPath(activeScreen) {
  return PANEL_SCREENS.find((item) => item.id === activeScreen)?.path || '/smm';
}

async function invokePanel(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('smm-panel', {
    body: { action, ...payload },
  });
  if (error) throw await getSupabaseFunctionError(error, 'La fonction du panel social a échoué.');
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function SmmPanel() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const moreMenuRef = useRef(null);
  const [services, setServices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [referralSummary, setReferralSummary] = useState(null);
  const [balance, setBalance] = useState(0);
  const [orderApiConfirmed, setOrderApiConfirmed] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState('Tous');
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [link, setLink] = useState('');
  const [topupAmount, setTopupAmount] = useState('');
  const [orderFilter, setOrderFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [paymentRetry, setPaymentRetry] = useState(0);
  const pendingTopupId = searchParams.get('topup_id');
  const currentScreen = PANEL_SCREENS.find((screen) => screen.path === pathname) || PANEL_SCREENS[0];

  const networkServices = useMemo(() => {
    if (selectedNetwork === 'Tous') return services;
    const network = selectedNetwork.toLowerCase();
    return services.filter((service) => {
      const description = `${service.category} ${service.name} ${service.type}`.toLowerCase();
      return description.includes(network)
        || (network === 'twitter' && description.includes('x (twitter)'));
    });
  }, [selectedNetwork, services]);
  const visibleServices = useMemo(() => {
    const search = serviceSearch.trim().toLowerCase();
    if (!search) return networkServices;
    return networkServices.filter((service) => (
      `${service.id} ${service.name} ${service.category} ${service.type}`.toLowerCase().includes(search)
    ));
  }, [networkServices, serviceSearch]);
  const selectedService = visibleServices.find((service) => service.id === selectedId);
  const estimatedCharge = selectedService && Number(quantity) > 0
    ? Math.ceil((Number(selectedService.sell_rate_xof) * Number(quantity)) / 1000)
    : 0;
  const insufficientBalance = estimatedCharge > 0 && estimatedCharge > balance;
  const categories = useMemo(
    () => [...new Set(visibleServices.map((service) => service.category || 'Autres'))],
    [visibleServices],
  );
  const availableNetworks = useMemo(() => NETWORKS.map((network) => ({
    ...network,
    count: services.filter((service) => (
      network.match.some((term) => (
        `${service.category} ${service.name} ${service.type}`.toLowerCase().includes(term)
      ))
    )).length,
  })).filter((network) => network.count > 0), [services]);
  const activeOrdersCount = useMemo(
    () => orders.filter((order) => ACTIVE_STATUSES.includes(order.status)).length,
    [orders],
  );
  const filteredOrders = useMemo(
    () => orders.filter((order) => matchesFilter(order.status, orderFilter)),
    [orders, orderFilter],
  );

  const loadData = useCallback(async () => {
    setError('');
    try {
      const [catalog, wallet, orderResult, referralResult] = await Promise.all([
        invokePanel('catalog'),
        invokePanel('wallet'),
        invokePanel('orders'),
        invokePanel('referral_summary'),
      ]);
      setServices(catalog.services || []);
      setOrderApiConfirmed(Boolean(catalog.orderApiConfirmed));
      setBalance(Number(wallet.balanceXof) || 0);
      setTransactions(wallet.transactions || []);
      setReferralSummary(referralResult.summary || null);
      setOrders(orderResult.orders || []);
      setSelectedId((current) => current || catalog.services?.[0]?.id || '');
      if (catalog.services?.[0]) {
        setQuantity((current) => current || String(catalog.services[0].min_quantity));
      }
      setLastUpdated(new Date().toISOString());
    } catch (loadError) {
      console.error('Impossible de charger le panel social :', loadError);
      setError(loadError.message || 'Le panel social ne peut pas être chargé pour le moment.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    function closeMoreMenu(event) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        moreMenuRef.current.removeAttribute('open');
      }
    }
    document.addEventListener('click', closeMoreMenu);
    return () => document.removeEventListener('click', closeMoreMenu);
  }, []);

  useEffect(() => {
    const topupId = pendingTopupId;
    if (!topupId) return undefined;
    let cancelled = false;
    let verified = false;
    async function verifyTopup() {
      setWorking(true);
      setNotice('Vérification du paiement en cours…');
      try {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const { data, error: verifyError } = await supabase.functions.invoke('smm-wallet-verify', {
            body: { topupId },
          });
          if (verifyError) throw await getSupabaseFunctionError(verifyError, 'La vérification du paiement a échoué.');
          if (data?.error) throw new Error(data.error);
          if (data?.verified) {
            verified = true;
            break;
          }
          if (attempt < 4) await new Promise((resolve) => window.setTimeout(resolve, 2000));
        }
        if (cancelled) return;
        if (!verified) {
          setNotice('Le paiement est encore en attente de confirmation. Actualisez le portefeuille dans quelques instants.');
        } else {
          setNotice('Portefeuille rechargé avec succès.');
          await loadData();
        }
      } catch (verifyError) {
        if (!cancelled) {
          console.error('Impossible de vérifier le paiement SasPay :', verifyError);
          setError(verifyError.message || 'Le paiement n’a pas pu être vérifié.');
        }
      } finally {
        if (!cancelled) {
          setWorking(false);
          if (verified) navigate('/smm', { replace: true });
        }
      }
    }
    verifyTopup();
    return () => { cancelled = true; };
  }, [loadData, navigate, paymentRetry, pendingTopupId]);

  function handleServiceChange(event) {
    const service = visibleServices.find((item) => item.id === event.target.value);
    setSelectedId(event.target.value);
    setQuantity(service ? String(service.min_quantity) : '');
  }

  function chooseNetwork(network) {
    setSelectedNetwork(network);
    setServiceSearch('');
    const matchingServices = network === 'Tous'
      ? services
      : services.filter((service) => (
        `${service.category} ${service.name} ${service.type}`.toLowerCase().includes(network.toLowerCase())
      ));
    setSelectedId(matchingServices[0]?.id || '');
    setQuantity(matchingServices[0] ? String(matchingServices[0].min_quantity) : '');
  }

  async function submitOrder(event) {
    event.preventDefault();
    setWorking(true);
    setError('');
    setNotice('');
    try {
      const result = await invokePanel('place_order', {
        serviceId: selectedId,
        link: link.trim(),
        quantity: Number(quantity),
      });
      setNotice(`Commande enregistrée (${result.orderId}). Vous pouvez suivre son statut ici.`);
      setLink('');
      await loadData();
      navigate('/smm/commandes');
    } catch (orderError) {
      console.error('Impossible de créer la commande sociale :', orderError);
      await loadData();
      setError(orderError.message || 'La commande n’a pas pu être créée.');
    } finally {
      setWorking(false);
    }
  }

  async function submitTopup(event) {
    event.preventDefault();
    if (!Number.isSafeInteger(Number(topupAmount)) || Number(topupAmount) < 500) {
      setError('Le montant minimum de recharge est de 500 FCFA.');
      return;
    }
    setWorking(true);
    setError('');
    setNotice('');
    try {
      const { data, error: checkoutError } = await supabase.functions.invoke('smm-wallet-checkout', {
        body: { amountXof: Number(topupAmount) },
      });
      if (checkoutError) throw await getSupabaseFunctionError(checkoutError, 'La création du paiement a échoué.');
      if (data?.error) throw new Error(data.error);
      if (!data?.checkoutUrl) throw new Error('SasPay n’a pas renvoyé le lien de paiement.');
      window.location.assign(data.checkoutUrl);
    } catch (checkoutError) {
      console.error('Impossible de créer la recharge du portefeuille :', checkoutError);
      setError(checkoutError.message || 'Le paiement ne peut pas être lancé.');
      setWorking(false);
    }
  }

  async function copyReferralLink() {
    if (!referralSummary?.code) return;
    const referralUrl = new URL('/smm/connexion', window.location.origin);
    referralUrl.searchParams.set('mode', 'signup');
    referralUrl.searchParams.set('ref', referralSummary.code);
    referralUrl.searchParams.set('next', '/smm');
    try {
      await navigator.clipboard.writeText(referralUrl.href);
      setError('');
      setNotice('Lien de parrainage copié. Vous recevrez 50 FCFA après le premier dépôt confirmé de votre filleul.');
    } catch (copyError) {
      console.error('Copie du lien de parrainage impossible :', copyError);
      const input = document.createElement('textarea');
      input.value = referralUrl.href;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
      setNotice('Lien de parrainage copié.');
    }
  }

  async function refreshOrder(orderId) {
    setWorking(true);
    setError('');
    try {
      await invokePanel('refresh_order', { orderId });
      await loadData();
    } catch (refreshError) {
      console.error('Impossible d’actualiser le statut de la commande :', refreshError);
      setError(refreshError.message || 'Le statut de cette commande ne peut pas être actualisé.');
    } finally {
      setWorking(false);
    }
  }

  const submitLabel = !orderApiConfirmed
    ? 'Commandes bientôt disponibles'
    : working ? 'Traitement…' : `Commander · ${formatXof(estimatedCharge)}`;

  return (
    <main className="smm-page">
      <Seo title={`${currentScreen.title} — Caleb Creative`} description={currentScreen.description} path={currentScreen.path} />
      <section className="smm-shell">
        <header className={`smm-hero${currentScreen.id === 'home' ? ' smm-template-home-heading' : ''}`}>
          <div className="smm-hero-copy">
            <p className="smm-eyebrow">Caleb Creative · Services sociaux</p>
            <h1>{currentScreen.title}</h1>
            <p>{currentScreen.description}</p>
          </div>
          <div className="smm-hero-actions">
            <button type="button" className="smm-refresh" onClick={loadData} disabled={loading || working}>
              <Icon name="refresh" />
              <span>{loading ? 'Actualisation…' : 'Actualiser'}</span>
            </button>
          </div>
        </header>

        {currentScreen.id === 'home' && (
          <section className="smm-template-home-hero">
            <span className="smm-template-status"><i aria-hidden="true" /> Services opérationnels</span>
            <h1>Bonjour 👋</h1>
            <p>Boostez votre présence sur les réseaux sociaux dès <strong>150 FCFA</strong> les 1000. Livraison rapide, paiement par Mobile Money.</p>
            <div className="smm-template-home-buttons">
              <Link className="smm-template-primary-action" to="/smm/commande">
                Passer une commande <span aria-hidden="true">→</span>
              </Link>
              <Link className="smm-template-secondary-action" to="/smm/portefeuille">
                Recharger mon compte
              </Link>
            </div>
          </section>
        )}
        {currentScreen.id === 'home' && (
          <div className="smm-overview">
            <Link className="smm-balance-card" to="/smm/portefeuille">
              <span className="smm-balance-label">Solde disponible</span>
              <strong className="smm-balance-value">{formatXof(balance)}</strong>
              <span className="smm-balance-cta">Gérer mon portefeuille →</span>
            </Link>
            <Link className="smm-stat" to="/smm/commande">
              <span>Services disponibles</span>
              <strong>{loading ? '—' : services.length}</strong>
              <small>Voir le catalogue</small>
            </Link>
            <Link className="smm-stat" to="/smm/commandes">
              <span>Commandes en cours</span>
              <strong>{loading ? '—' : activeOrdersCount}</strong>
              <small>{orders.length} commande{orders.length > 1 ? 's' : ''} au total</small>
            </Link>
          </div>
        )}

        {error && <p className="smm-alert smm-alert-error" role="alert">{error}</p>}
        {notice && <p className="smm-alert smm-alert-success" role="status">{notice}</p>}
        {lastUpdated && (
          <p className="smm-data-updated">
            Données actualisées : {formatDate(lastUpdated)}
          </p>
        )}
        {!orderApiConfirmed && !loading && (
          <p className="smm-alert smm-alert-pending">
            Le catalogue est prêt. Les commandes et recharges seront activées dès que la configuration du service sera finalisée.
          </p>
        )}
        {pendingTopupId && !working && (
          <button type="button" className="smm-secondary-button smm-retry-payment" onClick={() => setPaymentRetry((attempt) => attempt + 1)}>
            Réessayer la vérification du paiement
          </button>
        )}

        {currentScreen.id === 'order' && <div className="smm-columns">
          <section className="smm-card smm-order-card" aria-labelledby="smm-order-title">
            <div className="smm-card-heading">
              <p className="smm-eyebrow">Nouvelle commande</p>
              <h2 id="smm-order-title">Que souhaitez-vous booster ?</h2>
              <p className="smm-trust-note">Aucun mot de passe de réseau social ne vous sera demandé. Un lien public suffit ; le prix total est affiché avant confirmation.</p>
            </div>

            {loading ? (
              <div className="smm-skeleton" aria-busy="true" aria-label="Chargement du catalogue">
                <span /><span /><span /><span />
              </div>
            ) : services.length === 0 ? (
              <div className="smm-empty">
                <Icon name="inbox" />
                <strong>Catalogue en préparation</strong>
                <p>Les services arrivent bientôt. Réessayez un peu plus tard.</p>
              </div>
            ) : (
              <form className="smm-form" id="smm-order-form" onSubmit={submitOrder}>
                <fieldset className="smm-step">
                  <legend><span>1</span> Réseau social</legend>
                  <div className="smm-network-picker" role="group" aria-label="Filtrer par réseau social">
                    <button
                      type="button"
                      className={`smm-network-option${selectedNetwork === 'Tous' ? ' is-selected' : ''}`}
                      onClick={() => chooseNetwork('Tous')}
                      aria-pressed={selectedNetwork === 'Tous'}
                    >
                      <span className="smm-network-icon">★</span>
                      <span>Tous</span>
                      <small>{services.length}</small>
                    </button>
                    {availableNetworks.map((network) => (
                      <button
                        type="button"
                        className={`smm-network-option${selectedNetwork === network.id ? ' is-selected' : ''}`}
                        onClick={() => chooseNetwork(network.id)}
                        aria-pressed={selectedNetwork === network.id}
                        key={network.id}
                      >
                        <span className="smm-network-icon" style={{ '--network-color': network.color }}>
                          <network.icon aria-hidden="true" />
                        </span>
                        <span>{network.id}</span>
                        <small>{network.count}</small>
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="smm-step">
                  <legend><span>2</span> Service</legend>
                  <label>
                    <span className="smm-label">Rechercher</span>
                    <input
                      value={serviceSearch}
                      onChange={(event) => setServiceSearch(event.target.value)}
                      type="search"
                      placeholder="Nom, réseau ou numéro…"
                    />
                  </label>
                  <label>
                    <span className="smm-label">Catégorie et service</span>
                    <select value={selectedId} onChange={handleServiceChange} required disabled={!visibleServices.length}>
                      {categories.map((category) => (
                        <optgroup label={category} key={category}>
                          {visibleServices.filter((service) => (service.category || 'Autres') === category).map((service) => (
                            <option value={service.id} key={service.id}>
                              #{service.id} — {service.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  {!visibleServices.length && <p className="smm-muted">Aucun service ne correspond à cette recherche ou à ce réseau.</p>}
                  {selectedService && (
                    <ul className="smm-service-facts" aria-label="Détails du service">
                      <li><span>Prix</span><strong>{formatXof(selectedService.sell_rate_xof)} / 1 000</strong></li>
                      <li><span>Minimum</span><strong>{money.format(selectedService.min_quantity)}</strong></li>
                      <li><span>Maximum</span><strong>{money.format(selectedService.max_quantity)}</strong></li>
                      <li><span>Recharge</span><strong className={selectedService.refill ? 'is-yes' : ''}>{selectedService.refill ? 'Disponible' : 'Non'}</strong></li>
                    </ul>
                  )}
                </fieldset>

                <fieldset className="smm-step">
                  <legend><span>3</span> Détails de la commande</legend>
                  <label>
                    <span className="smm-label">Lien de la publication ou du profil</span>
                    <input value={link} onChange={(event) => setLink(event.target.value)} type="url" required placeholder="https://…" />
                  </label>
                  <label>
                    <span className="smm-label">Quantité</span>
                    <input
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      type="number"
                      inputMode="numeric"
                      min={selectedService?.min_quantity || 1}
                      max={selectedService?.max_quantity || undefined}
                      step="1"
                      required
                    />
                    {selectedService && (
                      <small className="smm-hint">
                        Entre {money.format(selectedService.min_quantity)} et {money.format(selectedService.max_quantity)}
                      </small>
                    )}
                  </label>
                </fieldset>
              </form>
            )}
          </section>

          <aside className="smm-summary-card" aria-labelledby="smm-summary-title">
            <h2 id="smm-summary-title">Récapitulatif</h2>
            <dl className="smm-summary-list">
              <div>
                <dt>Service</dt>
                <dd>{selectedService ? `#${selectedService.id} · ${selectedService.name}` : '—'}</dd>
              </div>
              <div>
                <dt>Quantité</dt>
                <dd>{money.format(Number(quantity) || 0)}</dd>
              </div>
              <div>
                <dt>Solde</dt>
                <dd>{formatXof(balance)}</dd>
              </div>
            </dl>
            <div className="smm-total">
              <span>Total à payer</span>
              <strong>{formatXof(estimatedCharge)}</strong>
            </div>
            {insufficientBalance && (
              <p className="smm-warning">
                Solde insuffisant. <Link to="/smm/portefeuille">Recharger mon portefeuille</Link>
              </p>
            )}
            <button
              className="smm-primary-button"
              type="submit"
              form="smm-order-form"
              disabled={working || loading || !selectedService || !orderApiConfirmed}
            >
              {submitLabel}
            </button>
            <p className="smm-fineprint">Le montant est calculé automatiquement et débité de votre portefeuille.</p>
          </aside>
        </div>}

        {currentScreen.id === 'referral' && (
          <section className="smm-card smm-referral-page" aria-labelledby="smm-referral-page-title">
            <div className="smm-card-heading">
              <p className="smm-eyebrow">Parrainage</p>
              <h2 id="smm-referral-page-title">Invitez vos amis et gagnez 50 FCFA</h2>
              <p className="smm-muted">Votre récompense est ajoutée une seule fois lorsque le filleul confirme son premier dépôt de 500 FCFA ou plus.</p>
            </div>
            <div className="smm-referral-stats">
              <div><strong>{referralSummary?.referrals ?? '—'}</strong><span>inscriptions</span></div>
              <div><strong>{referralSummary ? formatXof(referralSummary.earnedXof) : '—'}</strong><span>gagnés</span></div>
              <div><strong>{referralSummary?.pendingReferrals ?? '—'}</strong><span>en attente du premier dépôt</span></div>
            </div>
            <label className="smm-referral-link-field">
              <span className="smm-label">Votre lien personnel</span>
              <input
                readOnly
                value={referralSummary?.code
                  ? (() => {
                      const referralUrl = new URL('/smm/connexion', window.location.origin);
                      referralUrl.searchParams.set('mode', 'signup');
                      referralUrl.searchParams.set('ref', referralSummary.code);
                      referralUrl.searchParams.set('next', '/smm');
                      return referralUrl.href;
                    })()
                  : 'Génération du lien…'}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
            <button type="button" className="smm-primary-button" onClick={copyReferralLink} disabled={!referralSummary?.code}>
              Copier mon lien
            </button>
          </section>
        )}

        {currentScreen.id === 'wallet' && <>
          <div className="smm-wallet-current">
            <span>Solde disponible</span>
            <strong>{formatXof(balance)}</strong>
            <small>Mis à jour avec les dernières opérations du compte.</small>
          </div>
          <div className="smm-wallet-grid">
          <section className="smm-card" aria-labelledby="smm-wallet-title">
            <div className="smm-card-heading">
              <p className="smm-eyebrow">Portefeuille</p>
              <h2 id="smm-wallet-title">Ajouter des fonds</h2>
              <p className="smm-muted">Rechargez au minimum 500 FCFA via SasPay. Le solde est crédité après confirmation du paiement.</p>
            </div>
            <form className="smm-form" onSubmit={submitTopup}>
              <div className="smm-quick-amounts" role="group" aria-label="Montants rapides">
                {QUICK_AMOUNTS.map((amount) => (
                  <button
                    type="button"
                    key={amount}
                    className={`smm-chip${Number(topupAmount) === amount ? ' is-selected' : ''}`}
                    onClick={() => setTopupAmount(String(amount))}
                  >
                    {money.format(amount)}
                  </button>
                ))}
              </div>
              <label>
                <span className="smm-label">Montant en FCFA</span>
                <input value={topupAmount} onChange={(event) => setTopupAmount(event.target.value)} type="number" inputMode="numeric" min="500" step="1" required placeholder="Ex. 2 000" />
              </label>
              <button className="smm-primary-button" disabled={working || !orderApiConfirmed}>
                {orderApiConfirmed ? 'Recharger via SasPay' : 'Recharges bientôt disponibles'}
              </button>
            </form>
          </section>

          <section className="smm-card" aria-labelledby="smm-ledger-title">
            <div className="smm-card-heading">
              <p className="smm-eyebrow">Historique</p>
              <h2 id="smm-ledger-title">Activité récente</h2>
            </div>
            {transactions.length === 0 ? (
              <div className="smm-empty smm-empty-compact">
                <Icon name="wallet" />
                <p>Aucune opération pour le moment.</p>
              </div>
            ) : (
              <div className="smm-ledger">
                {transactions.slice(0, 6).map((item) => (
                  <div className="smm-ledger-row" key={item.id}>
                    <span className="smm-ledger-icon" aria-hidden="true">{Number(item.amount_xof) > 0 ? '↓' : '↑'}</span>
                    <span className="smm-ledger-label">
                      {item.type === 'topup' ? 'Recharge' : item.type === 'refund' ? 'Remboursement' : item.type === 'admin_credit' ? 'Crédit administrateur' : item.type === 'referral' ? 'Récompense parrainage' : 'Commande'}
                      {item.description && <small>{item.description}</small>}
                      {formatDate(item.created_at) && <small>{formatDate(item.created_at)}</small>}
                    </span>
                    <strong className={Number(item.amount_xof) > 0 ? 'is-credit' : ''}>
                      {Number(item.amount_xof) > 0 ? '+' : ''}{formatXof(item.amount_xof)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </section>
          </div>
        </>}

        {currentScreen.id === 'orders' && <section className="smm-card smm-orders" aria-labelledby="smm-orders-title">
          <div className="smm-card-heading smm-orders-heading">
            <div>
              <p className="smm-eyebrow">Suivi</p>
              <h2 id="smm-orders-title">Mes commandes</h2>
            </div>
            {orders.length > 0 && (
              <div className="smm-filters" role="group" aria-label="Filtrer les commandes">
                {ORDER_FILTERS.map((filter) => (
                  <button
                    type="button"
                    key={filter.id}
                    className={`smm-chip${orderFilter === filter.id ? ' is-selected' : ''}`}
                    onClick={() => setOrderFilter(filter.id)}
                    aria-pressed={orderFilter === filter.id}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {orders.length === 0 ? (
            <div className="smm-empty">
              <Icon name="inbox" />
              <strong>Aucune commande pour l’instant</strong>
              <p>Vos commandes apparaîtront ici dès que vous en passerez une.</p>
              <Link className="smm-secondary-button" to="/smm/commande">Passer ma première commande</Link>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="smm-empty smm-empty-compact"><p>Aucune commande dans cette catégorie.</p></div>
          ) : (
            <div className="smm-order-list">
              {filteredOrders.map((order) => {
                const network = networkForText(`${order.service_name} ${order.link}`);
                return (
                  <article className="smm-order-row" key={order.id}>
                    <span
                      className="smm-order-network"
                      aria-label={network?.id || 'Réseau social'}
                      style={network ? { '--network-color': network.color } : undefined}
                    >
                      {network ? <network.icon aria-hidden="true" /> : <Icon name="social" />}
                    </span>
                    <div className="smm-order-main">
                      <strong>#{order.service_id} · {order.service_name}</strong>
                      <span>
                        {money.format(order.quantity)} unités · {formatXof(order.charge_xof)}
                        {formatDate(order.created_at) && ` · ${formatDate(order.created_at)}`}
                      </span>
                      <a href={order.link} target="_blank" rel="noreferrer">{order.link}</a>
                    </div>
                    <div className="smm-order-status">
                      <span className={`smm-status smm-status-${order.status}`}>{statusLabel(order.status)}</span>
                      <button type="button" className="smm-text-button" onClick={() => refreshOrder(order.id)} disabled={working}>
                        <Icon name="refresh" /> Actualiser le statut
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>}

        <p className="smm-footer-note">Un compte client avec adresse e-mail confirmée est requis. <Link to="/smm/connexion?next=%2Fsmm">Gérer mon accès au panel</Link></p>
      </section>
    </main>
  );
}

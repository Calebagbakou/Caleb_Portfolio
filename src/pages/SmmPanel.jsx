import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Seo from '../components/site/Seo';
import { supabase } from '../services/supabase';
import { getSupabaseFunctionError } from '../utils/supabaseFunctionErrors';
import './SmmPanel.css';

const money = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const NETWORKS = [
  { id: 'Instagram', short: 'IG' },
  { id: 'Facebook', short: 'f' },
  { id: 'TikTok', short: 'TK' },
  { id: 'YouTube', short: 'YT' },
  { id: 'Telegram', short: 'TG' },
  { id: 'WhatsApp', short: 'WA' },
  { id: 'Twitter', short: 'X' },
  { id: 'Spotify', short: 'SP' },
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

async function invokePanel(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('smm-panel', {
    body: { action, ...payload },
  });
  if (error) throw await getSupabaseFunctionError(error, 'La fonction du panel social a échoué.');
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function SmmPanel() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [balance, setBalance] = useState(0);
  const [orderApiConfirmed, setOrderApiConfirmed] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState('Tous');
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [link, setLink] = useState('');
  const [topupAmount, setTopupAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [paymentRetry, setPaymentRetry] = useState(0);
  const pendingTopupId = searchParams.get('topup_id');

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
  const categories = useMemo(
    () => [...new Set(visibleServices.map((service) => service.category || 'Autres'))],
    [visibleServices],
  );
  const availableNetworks = useMemo(() => NETWORKS.map((network) => ({
    ...network,
    count: services.filter((service) => (
      `${service.category} ${service.name} ${service.type}`.toLowerCase().includes(network.id.toLowerCase())
    )).length,
  })).filter((network) => network.count > 0), [services]);

  const loadData = useCallback(async () => {
    setError('');
    try {
      const [catalog, wallet, orderResult] = await Promise.all([
        invokePanel('catalog'),
        invokePanel('wallet'),
        invokePanel('orders'),
      ]);
      setServices(catalog.services || []);
      setOrderApiConfirmed(Boolean(catalog.orderApiConfirmed));
      setBalance(Number(wallet.balanceXof) || 0);
      setTransactions(wallet.transactions || []);
      setOrders(orderResult.orders || []);
      setSelectedId((current) => current || catalog.services?.[0]?.id || '');
      if (catalog.services?.[0]) {
        setQuantity((current) => current || String(catalog.services[0].min_quantity));
      }
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
          if (verified) navigate('/smm/panel', { replace: true });
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
      setNotice(`Commande enregistrée : ${result.orderId}`);
      setLink('');
      await loadData();
    } catch (orderError) {
      console.error('Impossible de créer la commande sociale :', orderError);
      setError(orderError.message || 'La commande n’a pas pu être créée.');
      await loadData();
    } finally {
      setWorking(false);
    }
  }

  async function submitTopup(event) {
    event.preventDefault();
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

  return (
    <main className="smm-page">
      <Seo title="Panel social — Caleb Creative" description="Choisissez un service social, rechargez votre portefeuille et suivez vos commandes." path="/smm" />
      <section className="smm-shell">
        <header className="smm-heading">
          <div>
            <p className="smm-eyebrow">CALEB CREATIVE · SERVICES SOCIAUX</p>
            <h1>Panel social</h1>
            <p>Choisissez un service, saisissez le lien de votre publication et suivez votre commande.</p>
          </div>
          <Link className="smm-back-link" to="/">Accueil Caleb Creative</Link>
        </header>

        <div className="smm-summary">
          <div><span>Solde disponible</span><strong>{formatXof(balance)}</strong></div>
          <div><span>Services actifs</span><strong>{services.length}</strong></div>
          <button type="button" className="smm-secondary-button" onClick={loadData} disabled={loading || working}>
            Actualiser
          </button>
        </div>

        {error && <p className="smm-alert smm-alert-error" role="alert">{error}</p>}
        {notice && <p className="smm-alert smm-alert-success" role="status">{notice}</p>}
        {!orderApiConfirmed && (
          <p className="smm-alert smm-alert-pending">
            Le catalogue est prêt. Les commandes et recharges seront activées après validation du format « Add order » par SMMTurk.
          </p>
        )}
        {pendingTopupId && !working && (
          <button type="button" className="smm-secondary-button smm-retry-payment" onClick={() => setPaymentRetry((attempt) => attempt + 1)}>
            Réessayer la vérification du paiement
          </button>
        )}

        <div className="smm-columns">
          <section className="smm-card">
            <div className="smm-card-heading">
              <div><p className="smm-eyebrow">NOUVELLE COMMANDE</p><h2>Choisir un service</h2></div>
            </div>
            {loading ? <p className="smm-muted">Chargement du catalogue…</p> : services.length === 0 ? (
              <p className="smm-muted">Le catalogue est en cours de préparation. Réessayez un peu plus tard.</p>
            ) : (
              <form className="smm-form" onSubmit={submitOrder}>
                <div className="smm-network-picker" aria-label="Filtrer par réseau social">
                  <button
                    type="button"
                    className={`smm-network-option${selectedNetwork === 'Tous' ? ' is-selected' : ''}`}
                    onClick={() => chooseNetwork('Tous')}
                  >
                    <span className="smm-network-icon">+</span>
                    <span>Tous</span>
                    <small>{services.length}</small>
                  </button>
                  {availableNetworks.map((network) => (
                    <button
                      type="button"
                      className={`smm-network-option${selectedNetwork === network.id ? ' is-selected' : ''}`}
                      onClick={() => chooseNetwork(network.id)}
                      key={network.id}
                    >
                      <span className="smm-network-icon">{network.short}</span>
                      <span>{network.id}</span>
                      <small>{network.count}</small>
                    </button>
                  ))}
                </div>
                <label>
                  Rechercher un service
                  <input
                    value={serviceSearch}
                    onChange={(event) => setServiceSearch(event.target.value)}
                    type="search"
                    placeholder="Nom, réseau ou numéro…"
                  />
                </label>
                <label>
                  Catégorie et service
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
                  <p className="smm-service-details">
                    {selectedService.type || selectedService.category} · {formatXof(selectedService.sell_rate_xof)} / 1 000
                    · min. {money.format(selectedService.min_quantity)} · max. {money.format(selectedService.max_quantity)}
                    · {selectedService.refill ? 'recharge disponible' : 'sans recharge'}
                  </p>
                )}
                <label>
                  Lien de la publication ou du profil
                  <input value={link} onChange={(event) => setLink(event.target.value)} type="url" required placeholder="https://…" />
                </label>
                <label>
                  Quantité
                  <input
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    type="number"
                    min={selectedService?.min_quantity || 1}
                    max={selectedService?.max_quantity || undefined}
                    step="1"
                    required
                  />
                </label>
                <div className="smm-estimate">
                  <span>Charge calculée automatiquement</span>
                  <strong>{formatXof(estimatedCharge)}</strong>
                </div>
                <div className="smm-order-summary">
                  <h3>Récapitulatif</h3>
                  <div><span>Service</span><strong>{selectedService ? `#${selectedService.id} · ${selectedService.name}` : '—'}</strong></div>
                  <div><span>Quantité</span><strong>{money.format(Number(quantity) || 0)}</strong></div>
                  <div><span>Portefeuille</span><strong>FCFA (XOF)</strong></div>
                  <div className="smm-order-total"><span>Total</span><strong>{formatXof(estimatedCharge)}</strong></div>
                </div>
                <button className="smm-primary-button" disabled={working || loading || !selectedService || !orderApiConfirmed}>
                  {working ? 'Traitement…' : `Commander · ${formatXof(estimatedCharge)}`}
                </button>
              </form>
            )}
          </section>

          <section className="smm-card">
            <p className="smm-eyebrow">PORTEFEUILLE</p>
            <h2>Ajouter des fonds</h2>
            <p className="smm-muted">Rechargez le montant de votre choix via SasPay. Le solde est crédité après confirmation du paiement.</p>
            <form className="smm-form" onSubmit={submitTopup}>
              <label>
                Montant en FCFA
                <input value={topupAmount} onChange={(event) => setTopupAmount(event.target.value)} type="number" min="1" step="1" required placeholder="Ex. 2 000" />
              </label>
              <button className="smm-primary-button" disabled={working || !orderApiConfirmed}>Recharger via SasPay</button>
            </form>
            <div className="smm-ledger">
              <h3>Activité récente</h3>
              {transactions.length === 0 ? <p className="smm-muted">Aucune opération pour le moment.</p> : transactions.slice(0, 5).map((item) => (
                <div className="smm-ledger-row" key={item.id}>
                  <span>{item.type === 'topup' ? 'Recharge' : item.type === 'refund' ? 'Remboursement' : 'Commande'}</span>
                  <strong className={Number(item.amount_xof) > 0 ? 'is-credit' : ''}>
                    {Number(item.amount_xof) > 0 ? '+' : ''}{formatXof(item.amount_xof)}
                  </strong>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="smm-card smm-orders">
          <div className="smm-card-heading"><div><p className="smm-eyebrow">SUIVI</p><h2>Mes commandes</h2></div></div>
          {orders.length === 0 ? <p className="smm-muted">Vos commandes apparaîtront ici.</p> : (
            <div className="smm-order-list">
              {orders.map((order) => (
                <article className="smm-order-row" key={order.id}>
                  <div className="smm-order-main">
                    <strong>#{order.service_id} · {order.service_name}</strong>
                    <span>{money.format(order.quantity)} unités · {formatXof(order.charge_xof)}</span>
                    <a href={order.link} target="_blank" rel="noreferrer">{order.link}</a>
                  </div>
                  <div className="smm-order-status">
                    <span className={`smm-status smm-status-${order.status}`}>{statusLabel(order.status)}</span>
                    <button type="button" className="smm-text-button" onClick={() => refreshOrder(order.id)} disabled={working}>
                      Actualiser le statut
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <p className="smm-footer-note"><Link to="/smm">Découvrir le parcours SMM</Link> · Un compte client avec adresse e-mail confirmée est requis. <Link to="/smm/connexion?next=%2Fsmm%2Fpanel">Gérer mon accès au panel</Link></p>
      </section>
    </main>
  );
}

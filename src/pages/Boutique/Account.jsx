import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { deleteBuyerAccount, getBuyerAccount, getShopOrderDeliveries } from '../../services/shop';
import { formatPrice } from '../../data/products';
import ShopAlert from '../../components/shop/ShopAlert';
import { getShopErrorMessage } from '../../utils/shopErrors';

export default function Account() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deliveryState, setDeliveryState] = useState({});

  useEffect(() => {
    let active = true;
    getBuyerAccount().then(({ data, error: accountError }) => {
      if (!active) return;
      if (accountError) setError(getShopErrorMessage(accountError, 'Ton espace client est momentanément indisponible.'));
      else setAccount(data);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function handleLogout() {
    if (!window.confirm('Es-tu sûr de vouloir te déconnecter ?')) return;
    await logout();
    navigate('/boutique', { replace: true });
  }

  async function handleDeleteAccount() {
    const confirmed = window.confirm(
      'Es-tu sûr de vouloir supprimer ton compte ? Cette action supprimera ta connexion et anonymisera les informations personnelles liées à tes commandes.',
    );
    if (!confirmed) return;
    setError('');
    const { error: deleteError } = await deleteBuyerAccount();
    if (deleteError) {
      console.error('Suppression du compte client impossible :', deleteError);
      setError(getShopErrorMessage(deleteError, 'Le compte n’a pas pu être supprimé. Tu peux réessayer ou nous contacter.'));
      return;
    }
    try {
      localStorage.removeItem('caleb_boutique_cart_v1');
    } catch (storageError) {
      console.error('Impossible de vider le panier local après suppression du compte :', storageError);
    }
    navigate('/boutique', { replace: true });
  }

  async function loadDeliveries(order) {
    setDeliveryState((current) => ({ ...current, [order.id]: { loading: true } }));
    const { data, error: deliveryError } = await getShopOrderDeliveries({ orderId: order.id, orderRef: order.ref });
    setDeliveryState((current) => ({
      ...current,
      [order.id]: deliveryError
        ? { error: getShopErrorMessage(deliveryError, 'Tes accès sont momentanément indisponibles.') }
        : { data },
    }));
  }

  const orders = account?.orders || [];
  const paidOrders = orders.filter((order) => order.payment_status === 'confirme');
  const itemCount = orders.reduce(
    (total, order) => total + (order.order_items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0),
    0,
  );
  const displayName = account?.profile?.name || 'Client Caleb Creative';
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  function getPaymentLabel(status) {
    return status === 'confirme' ? 'Payée' : 'En attente';
  }

  if (loading) return <main className="wrap"><div className="shop-state">Chargement de ton espace client…</div></main>;
  if (error) return (
    <main className="wrap">
      <div className="shop-state-error-wrap">
        <ShopAlert message={error} action="Retour à la boutique" actionTo="/boutique" />
      </div>
    </main>
  );

  return (
    <main className="wrap account-page">
      <div className="account-hero">
        <div>
          <div className="account-kicker">TABLEAU DE BORD CLIENT</div>
          <h1>Bonjour, {displayName.split(' ')[0]}.</h1>
          <p>Gère tes commandes, retrouve tes accès et garde le contrôle de ton compte.</p>
        </div>
        <button type="button" className="btn btn-outline account-logout" onClick={handleLogout}>
          Se déconnecter
        </button>
      </div>

      <div className="account-stat-grid">
        <div className="account-stat-card"><span>Commandes</span><strong>{orders.length}</strong><small>Historique total</small></div>
        <div className="account-stat-card"><span>Commandes payées</span><strong>{paidOrders.length}</strong><small>Transactions confirmées</small></div>
        <div className="account-stat-card"><span>Articles achetés</span><strong>{itemCount}</strong><small>Produits dans tes commandes</small></div>
      </div>

      <div className="account-grid">
        <section className="account-card account-profile-card">
          <div className="account-card-label">MON PROFIL</div>
          <div className="account-profile-head">
            <div className="account-avatar">{initials}</div>
            <div><h2>{displayName}</h2><p>{user?.email}</p></div>
          </div>
          <div className="account-status"><span className="account-status-dot" /> Adresse e-mail confirmée</div>
          <button
            type="button"
            className="btn btn-outline account-small-action"
            onClick={() => navigate('/boutique/connexion?mode=reset')}
          >
            Modifier mon mot de passe
          </button>
          <button type="button" className="account-danger-action" onClick={handleDeleteAccount}>
            Supprimer mon compte
          </button>
        </section>

        <section className="account-card account-support-card">
          <div className="account-card-label">ASSISTANCE</div>
          <h2>Besoin d’aide ?</h2>
          <p>Une question sur une activation ou un téléchargement ? Notre équipe est disponible pour t’accompagner.</p>
          <a className="btn btn-primary" href="https://wa.me/2290148135395">Contacter sur WhatsApp</a>
        </section>
      </div>

      <section className="account-orders">
        <div className="account-section-head">
          <div><div className="account-card-label">ACTIVITÉ RÉCENTE</div><h2>Mes commandes</h2></div>
          <Link to="/boutique/catalogue" className="btn btn-outline account-catalogue-link">Voir le catalogue</Link>
        </div>
        {!orders.length ? (
          <div className="account-empty">Aucune commande pour le moment. <Link to="/boutique/catalogue">Découvrir le catalogue</Link></div>
        ) : orders.map((order) => {
          const delivery = deliveryState[order.id];
          return (
            <article className="account-order" key={order.id}>
              <div className="account-order-top">
                <div className="account-order-reference">
                  <span className="account-order-icon">#</span>
                  <div><strong>{order.ref}</strong><span>{new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
                </div>
                <div className="account-order-total">
                  <strong>{formatPrice(order.total)}</strong>
                  <span className={`account-pill ${order.payment_status === 'confirme' ? 'success' : ''}`}>{getPaymentLabel(order.payment_status)}</span>
                </div>
              </div>
              <ul className="account-items">
                {(order.order_items || []).map((item) => (
                  <li key={item.id}>{item.product_name} · {item.plan_label} × {item.qty}</li>
                ))}
              </ul>
              {order.payment_status === 'confirme' && (
                <button type="button" className="btn btn-outline account-small-action" onClick={() => loadDeliveries(order)} disabled={delivery?.loading}>
                  {delivery?.loading ? 'Préparation…' : 'Voir mes accès et téléchargements'}
                </button>
              )}
              {delivery?.error && <ShopAlert message={delivery.error} action="Retour à la boutique" actionTo="/boutique" />}
              {delivery?.data?.deliveries?.length > 0 && (
                <div className="account-deliveries">
                  {delivery.data.deliveries.map((item) => (
                    <div key={item.productId}>
                      <strong>{item.name}</strong>
                      {item.url ? <a href={item.url} target="_blank" rel="noreferrer">Ouvrir l’accès</a> : <span>{item.error}</span>}
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}

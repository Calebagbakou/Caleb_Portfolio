import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getBuyerAccount, getShopOrderDeliveries } from '../../services/shop';
import { formatPrice } from '../../data/products';

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
      if (accountError) setError(accountError.message);
      else setAccount(data);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/boutique', { replace: true });
  }

  async function loadDeliveries(order) {
    setDeliveryState((current) => ({ ...current, [order.id]: { loading: true } }));
    const { data, error: deliveryError } = await getShopOrderDeliveries({ orderId: order.id, orderRef: order.ref });
    setDeliveryState((current) => ({
      ...current,
      [order.id]: deliveryError ? { error: deliveryError.message } : { data },
    }));
  }

  if (loading) return <main className="wrap"><div className="shop-state">Chargement de ton espace client…</div></main>;
  if (error) return <main className="wrap"><div className="shop-state error">{error}</div></main>;

  return (
    <main className="wrap account-page">
      <div className="section account-heading">
        <div>
          <div className="eyebrow">ESPACE CLIENT</div>
          <h1>Mon compte</h1>
          <p>Retrouve tes commandes, tes accès et les informations de ton compte.</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={handleLogout}>Se déconnecter</button>
      </div>

      <div className="account-grid">
        <section className="account-card">
          <div className="eyebrow">PROFIL</div>
          <h2>{account?.profile?.name || 'Client Caleb Creative'}</h2>
          <p>{user?.email}</p>
          <span className="account-status">Adresse e-mail confirmée</span>
          <button
            type="button"
            className="btn btn-outline account-small-action"
            onClick={() => navigate('/boutique/connexion?mode=reset')}
          >
            Modifier mon mot de passe
          </button>
        </section>

        <section className="account-card account-support-card">
          <div className="eyebrow">BESOIN D’AIDE ?</div>
          <h2>On reste disponible</h2>
          <p>Une question sur une activation ou un téléchargement ? Écris directement à Caleb.</p>
          <a className="btn btn-primary" href="https://wa.me/2290148135395">Contacter sur WhatsApp</a>
        </section>
      </div>

      <section className="account-orders">
        <div className="eyebrow">HISTORIQUE</div>
        <h2>Mes commandes</h2>
        {!account?.orders?.length ? (
          <div className="account-empty">Aucune commande pour le moment. <Link to="/boutique/catalogue">Découvrir le catalogue</Link></div>
        ) : account.orders.map((order) => {
          const delivery = deliveryState[order.id];
          return (
            <article className="account-order" key={order.id}>
              <div className="account-order-top">
                <div>
                  <strong>{order.ref}</strong>
                  <span>{new Date(order.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="account-order-total">
                  <strong>{formatPrice(order.total)}</strong>
                  <span className={`account-pill ${order.payment_status === 'confirme' ? 'success' : ''}`}>{order.payment_status}</span>
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
              {delivery?.error && <p className="account-error">{delivery.error}</p>}
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

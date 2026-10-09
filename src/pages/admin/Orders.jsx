import { useEffect, useState } from 'react';
import { formatPrice } from '../../data/products';
import { listShopOrders, updateShopOrderFulfillment } from '../../services/shop';

const ORDER_STATUSES = [
  ['en_attente', 'En attente'],
  ['traitement', 'En traitement'],
  ['terminee', 'Terminée / activée'],
  ['annulee', 'Annulée'],
];

function formatDate(value) {
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function paymentLabel(value) {
  return value === 'confirme' ? 'Confirmé' : 'Non confirmé';
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);

  async function loadOrders() {
    setLoading(true);
    const { data, error: loadError } = await listShopOrders();
    if (loadError) {
      console.error('Impossible de charger les commandes :', loadError);
      setError(`Chargement impossible : ${loadError.message}. Vérifie les règles RLS des commandes.`);
    } else {
      setOrders(data || []);
      setError('');
    }
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function changeStatus(order, status) {
    setSavingId(order.id);
    const { error: updateError } = await updateShopOrderFulfillment(order.id, status);
    if (updateError) {
      console.error('Impossible de mettre à jour le statut de la commande :', updateError);
      setError(`Mise à jour impossible : ${updateError.message}`);
    } else {
      setOrders((current) => current.map((item) => item.id === order.id
        ? { ...item, status, fulfillment_status: status }
        : item));
    }
    setSavingId(null);
  }

  return (
    <section className="panel">
      <div className="shop-admin-list-heading">
        <div>
          <h2>Commandes boutique</h2>
          <p>Les paiements sont confirmés uniquement après vérification côté serveur auprès de KKiaPay.</p>
        </div>
        <button className="btn btn-secondary btn-sm" type="button" onClick={loadOrders} disabled={loading}>Actualiser</button>
      </div>

      {error && <div className="shop-admin-alert error" role="alert">{error}</div>}
      {loading && <div className="state-box">Chargement des commandes…</div>}
      {!loading && !error && orders.length === 0 && <div className="state-box">Aucune commande pour le moment.</div>}

      {!loading && orders.length > 0 && (
        <div className="shop-admin-orders">
          {orders.map((order) => {
            const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
            const items = order.order_items || [];
            const fulfillment = order.fulfillment_status || order.status || 'en_attente';
            return (
              <article className="shop-admin-order" key={order.id}>
                <div className="shop-admin-order-heading">
                  <div>
                    <span className="badge badge-read">{order.ref}</span>
                    <h3>{customer?.name || 'Client sans nom'}</h3>
                    <p>{customer?.contact || 'Téléphone non renseigné'}{customer?.email ? ` · ${customer.email}` : ''}</p>
                  </div>
                  <div className="shop-admin-order-total">
                    <span>{paymentLabel(order.payment_status)}</span>
                    <strong>{formatPrice(Number(order.total))}</strong>
                  </div>
                </div>

                <div className="shop-admin-order-items">
                  {items.map((item) => (
                    <div className="shop-admin-order-item" key={item.id}>
                      <span>{item.product_name} — {item.plan_label} × {item.qty}</span>
                      <strong>{formatPrice(Number(item.line_total))}</strong>
                    </div>
                  ))}
                </div>

                <div className="shop-admin-order-footer">
                  <span>{formatDate(order.created_at)}</span>
                  <span>{order.payment_transaction_id ? `Transaction KKiaPay : ${order.payment_transaction_id}` : 'Pas de transaction confirmée'}</span>
                  <label>
                    <span>Suivi / activation</span>
                    <select
                      value={fulfillment}
                      disabled={savingId === order.id}
                      onChange={(event) => changeStatus(order, event.target.value)}
                    >
                      {ORDER_STATUSES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                    </select>
                  </label>
                </div>
                {order.note && <p className="shop-admin-order-note">Note client : {order.note}</p>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

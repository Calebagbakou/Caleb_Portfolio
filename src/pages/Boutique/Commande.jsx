import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LAST_ORDER_KEY, useCart } from '../../context/CartContext';
import { formatPrice } from '../../data/products';
import { createShopCheckout, verifyShopPayment } from '../../services/shop';
import { isKkiaPayConfigured, startKkiaPayPayment } from '../../services/kkiapay';

export default function Commande() {
  const { details, total, clear } = useCart();
  const navigate = useNavigate();

  const [fname, setFname] = useState('');
  const [fcontact, setFcontact] = useState('');
  const [femail, setFemail] = useState('');
  const [fnote, setFnote] = useState('');
  const [pendingOrder, setPendingOrder] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!details.length) {
    return (
      <main className="wrap">
        <div className="section" style={{ paddingTop: 32 }}>
          <div className="eyebrow">COMMANDE</div>
          <h1 style={{ fontSize: 'clamp(1.7rem,4vw,2.2rem)', margin: '0 0 8px' }}>Finaliser ma commande</h1>
        </div>
        <div className="empty-cart">
          <div className="ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 3h2l2.4 12.4a2 2 0 002 1.6h8.2a2 2 0 002-1.6L21 8H6" />
              <circle cx="9" cy="20" r="1.4" />
              <circle cx="17" cy="20" r="1.4" />
            </svg>
          </div>
          <p>Ton panier est vide — ajoute un produit avant de passer commande.</p>
          <Link to="/boutique/catalogue" className="btn btn-dark">
            Découvrir le catalogue
          </Link>
        </div>
      </main>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!isKkiaPayConfigured()) {
      setError('Le paiement n’est pas encore configuré. Réessaie plus tard ou contacte Caleb.');
      return;
    }
    setSaving(true);
    try {
      let order = pendingOrder;
      if (!order) {
        const { data, error: createError } = await createShopCheckout({
          customer: { name: fname.trim(), contact: fcontact.trim(), email: femail.trim() },
          items: details.map((line) => ({ product_id: line.productId, plan_id: line.planId, qty: line.qty })),
          note: fnote.trim(),
        });
        if (createError) throw createError;
        order = data?.order;
        if (!order?.id || !order?.ref || !Number.isFinite(Number(order.total))) {
          throw new Error('Le serveur n’a pas renvoyé une commande valide.');
        }
        setPendingOrder(order);
      }

      const paymentResponse = await startKkiaPayPayment({
        order,
        customer: order.customer || { name: fname.trim(), contact: fcontact.trim(), email: femail.trim() },
      });
      const transactionId = paymentResponse?.transactionId;
      if (!transactionId) throw new Error('KKiaPay n’a pas renvoyé de référence de transaction.');

      const { data: verification, error: verificationError } = await verifyShopPayment({
        orderId: order.id,
        transactionId,
      });
      if (verificationError) throw verificationError;
      if (!verification?.verified || !verification.order) {
        throw new Error(verification?.message || 'Le paiement n’a pas pu être confirmé. La commande reste en attente.');
      }

      try {
        localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(verification.order));
      } catch (storageError) {
        console.error('Le reçu ne peut pas être conservé sur cet appareil :', storageError);
      }
      clear();
      navigate('/boutique/confirmation', { state: { order: verification.order } });
    } catch (checkoutError) {
      console.error('Le checkout KKiaPay a échoué :', checkoutError);
      setError(checkoutError.message || 'Le paiement a échoué ou a été annulé. Ta commande reste en attente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="wrap">
      <div className="section" style={{ paddingTop: 32 }}>
        <div className="eyebrow">COMMANDE</div>
        <h1 style={{ fontSize: 'clamp(1.7rem,4vw,2.2rem)', margin: '0 0 8px' }}>Finaliser ma commande</h1>
        <p style={{ color: 'var(--ink-dim)', maxWidth: '56ch', margin: '0 0 6px' }}>
          Renseigne tes coordonnées. Le prix est recalculé à partir du catalogue enregistré, puis le paiement est
          sécurisé par le widget officiel KKiaPay.
        </p>
      </div>

      <form className="checkout-layout" onSubmit={handleSubmit}>
        <div className="form-card">
          {error && <div className="shop-admin-alert error" role="alert">{error}</div>}
          <h2 style={{ fontSize: 16, margin: '0 0 16px' }}>Tes informations</h2>
          <div className="form-row-2">
            <div className="form-group">
              <label htmlFor="fname">Nom complet</label>
              <input
                type="text"
                id="fname"
                placeholder="Ton nom"
                required
                value={fname}
                onChange={(e) => setFname(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="fcontact">WhatsApp ou téléphone</label>
              <input
                type="tel"
                id="fcontact"
                placeholder="+229 ..."
                required
                value={fcontact}
                onChange={(e) => setFcontact(e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="femail">Email (optionnel)</label>
            <input
              type="email"
              id="femail"
              placeholder="vous@exemple.com"
              value={femail}
              onChange={(e) => setFemail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="fnote">Note pour la commande (optionnel)</label>
            <textarea
              id="fnote"
              rows={3}
              placeholder="Précisions utiles pour l'activation…"
              value={fnote}
              onChange={(e) => setFnote(e.target.value)}
            />
          </div>

          <p className="pay-note">
            Le paiement ne sera marqué comme confirmé qu’après validation serveur de la transaction KKiaPay.
            Les moyens proposés par le widget dépendent des options activées sur ton compte marchand.
          </p>

          <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: 22 }} disabled={saving}>
            {saving ? 'Connexion sécurisée à KKiaPay…' : pendingOrder ? `Reprendre le paiement · ${pendingOrder.ref}` : 'Commander et payer avec KKiaPay'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>

        <aside className="summary-card">
          <h2 style={{ fontSize: 15, margin: '0 0 14px' }}>Récapitulatif</h2>
          <div>
            {details.map((line) => (
              <div className="summary-row" key={`${line.productId}-${line.planId}`}>
                <span>
                  {line.name} ({line.planLabel}) ×{line.qty}
                </span>
                <span>{formatPrice(line.lineTotal)}</span>
              </div>
            ))}
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>{formatPrice(pendingOrder ? Number(pendingOrder.total) : total)}</span>
          </div>
        </aside>
      </form>
    </main>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { formatPrice } from '../../data/products';
import { createSasPayCheckout, createShopCheckout } from '../../services/shop';
import { useAuth } from '../../context/AuthContext';
import ShopAlert from '../../components/shop/ShopAlert';
import { getShopErrorMessage } from '../../utils/shopErrors';

export default function Commande() {
  const { details, total } = useCart();
  const { user } = useAuth();

  const [fname, setFname] = useState('');
  const [fcontact, setFcontact] = useState('');
  const [femail, setFemail] = useState(user?.email || '');
  const [fnote, setFnote] = useState('');
  const [pendingOrder, setPendingOrder] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const needsEmail = details.some((line) => line.deliveryType === 'download');

  useEffect(() => {
    setFemail(user?.email || '');
  }, [user?.email]);

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
    if (!user?.email || !user.email_confirmed_at) {
      setError('Connecte-toi avec une adresse e-mail confirmée avant de commander.');
      return;
    }
    if (needsEmail && !femail.trim()) {
      setError('Une adresse e-mail est obligatoire pour recevoir le lien de téléchargement sécurisé.');
      return;
    }
    setSaving(true);
    try {
      let order = pendingOrder;
      if (!order) {
        const { data, error: createError } = await createShopCheckout({
          customer: { name: fname.trim(), contact: fcontact.trim(), email: user.email },
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

      const { data: payment, error: paymentError } = await createSasPayCheckout({ orderId: order.id });
      if (paymentError) throw paymentError;
      if (!payment?.checkoutUrl) {
        throw new Error('SasPay n’a pas renvoyé de lien de paiement.');
      }
      window.location.assign(payment.checkoutUrl);
    } catch (checkoutError) {
      console.error('Le checkout SasPay a échoué :', checkoutError);
      setError(getShopErrorMessage(checkoutError, 'Le paiement n’a pas pu être lancé. Tu peux réessayer sans risque de double débit.'));
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
          sécurisé par SasPay.
        </p>
      </div>

      <form className="checkout-layout" onSubmit={handleSubmit}>
        <div className="form-card">
          <ShopAlert message={error} action="Retour au panier" actionTo="/boutique/panier" />
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
            <label htmlFor="femail">Adresse e-mail confirmée</label>
            <input
              type="email"
              id="femail"
              required
              readOnly
              value={femail}
            />
            <small>Utilisée pour associer la commande à ton compte et envoyer les fichiers si nécessaire.</small>
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
            Le paiement ne sera marqué comme confirmé qu’après validation serveur de la transaction SasPay.
            Les moyens proposés dépendent du pays et des réseaux disponibles sur ton compte.
            </p>

            <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: 22 }} disabled={saving}>
              {saving ? 'Ouverture du paiement SasPay…' : pendingOrder ? `Reprendre le paiement · ${pendingOrder.ref}` : 'Commander et payer avec SasPay'}
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

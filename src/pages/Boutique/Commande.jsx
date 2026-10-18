import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { formatPrice } from '../../data/products';
import { createSasPayCheckout, createShopCheckout } from '../../services/shop';
import { useAuth } from '../../context/AuthContext';
import ShopAlert from '../../components/shop/ShopAlert';
import { getShopErrorMessage } from '../../utils/shopErrors';
import ShopArrow from '../../components/shop/ShopArrow';

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
          <p>Votre panier est vide — ajoutez un produit avant de passer commande.</p>
          <Link to="/boutique/catalogue" className="btn btn-primary">
            Voir le catalogue
          </Link>
        </div>
      </main>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!user?.email || !user.email_confirmed_at) {
      setError('Connectez-vous avec une adresse e-mail confirmée avant de commander.');
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
      setError(getShopErrorMessage(checkoutError, 'Le paiement n’a pas pu être lancé. Vous pouvez réessayer.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="wrap">
      <div className="section" style={{ paddingTop: 32 }}>
        <div className="eyebrow">COMMANDE</div>
        <h1 style={{ fontSize: 'clamp(1.7rem,4vw,2.2rem)', margin: '0 0 8px' }}>Finaliser votre commande</h1>
        <p style={{ color: 'var(--ink-dim)', maxWidth: '56ch', margin: '0 0 6px' }}>
          Vérifiez vos coordonnées et le montant. Vous choisirez les moyens de paiement disponibles pour votre pays sur la page SasPay.
        </p>
      </div>

      <nav className="buyer-journey" aria-label="Étapes de la commande">
        {['Panier', 'Compte', 'Paiement', 'Livraison'].map((step, index) => (
          <div className={`buyer-journey-step${index === 2 ? ' active' : ''}`} aria-current={index === 2 ? 'step' : undefined} key={step}>
            <span>{index + 1}</span>{step}
          </div>
        ))}
      </nav>

      <form className="checkout-layout" onSubmit={handleSubmit}>
        <div className="form-card">
          <ShopAlert message={error} action="Retour au panier" actionTo="/boutique/panier" />
          <h2 style={{ fontSize: 16, margin: '0 0 16px' }}>Vos informations</h2>
          <div className="form-row-2">
            <div className="form-group">
              <label htmlFor="fname">Nom complet</label>
              <input
                type="text"
                id="fname"
                autoComplete="name"
                placeholder="Votre nom"
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
                autoComplete="tel"
                inputMode="tel"
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
              autoComplete="email"
              required
              readOnly
              value={femail}
            />
            <small>Utilisée pour associer la commande à votre compte et envoyer les fichiers si nécessaire.</small>
          </div>
          <div className="form-group">
            <label htmlFor="fnote">Note pour la commande (optionnel)</label>
            <textarea
              id="fnote"
              rows={3}
              placeholder="Précisions utiles pour l’activation…"
              value={fnote}
              onChange={(e) => setFnote(e.target.value)}
            />
          </div>

          <p className="pay-note">
            Votre commande sera confirmée après validation du paiement par le prestataire. Les moyens disponibles s’affichent sur la page de paiement selon votre pays.
          </p>

          <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: 22 }} disabled={saving}>
            <span aria-hidden="true">🔒</span>
            {saving
              ? 'Ouverture du paiement…'
              : `Payer ${formatPrice(pendingOrder ? Number(pendingOrder.total) : total)}`}
            <ShopArrow />
          </button>
          <p className="pay-redirect-note">Vous serez redirigé vers la page de paiement sécurisée de notre prestataire.</p>
        </div>

        <aside className="summary-card">
          <h2 style={{ fontSize: 15, margin: '0 0 14px' }}>Récapitulatif</h2>
          <div>
            {details.map((line) => (
              <div className="summary-row" key={`${line.productId}-${line.planId}`}>
                <span className="checkout-summary-product">
                  <span className="checkout-summary-image" style={{ background: line.gradient || 'var(--surface-alt)' }}>
                    {line.imageUrl || line.logoUrl
                      ? <img src={line.imageUrl || line.logoUrl} alt="" />
                      : line.avatar}
                  </span>
                  <span>
                  {line.name} ({line.planLabel}) ×{line.qty}
                  </span>
                </span>
                <span>{formatPrice(line.lineTotal)}</span>
              </div>
            ))}
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>{formatPrice(pendingOrder ? Number(pendingOrder.total) : total)}</span>
          </div>
          <Link className="checkout-edit-cart" to="/boutique/panier">Modifier le panier</Link>
        </aside>
      </form>
    </main>
  );
}

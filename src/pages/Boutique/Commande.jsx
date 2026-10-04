import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart, LAST_ORDER_KEY } from '../../context/CartContext';
import { formatPrice } from '../../data/products';

const PAY_OPTIONS = [
  { id: 'mtn', label: 'Mobile Money — MTN' },
  { id: 'moov', label: 'Mobile Money — Moov' },
  { id: 'virement', label: 'Virement bancaire' },
];

export default function Commande() {
  const { details, total, clear } = useCart();
  const navigate = useNavigate();

  const [fname, setFname] = useState('');
  const [fcontact, setFcontact] = useState('');
  const [femail, setFemail] = useState('');
  const [fnote, setFnote] = useState('');
  const [pay, setPay] = useState('mtn');

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

  function handleSubmit(e) {
    e.preventDefault();
    const payLabel = PAY_OPTIONS.find((p) => p.id === pay)?.label || '';

    const ref = 'CC-' + Date.now().toString(36).toUpperCase();
    const order = {
      ref,
      date: new Date().toISOString(),
      customer: { name: fname.trim(), contact: fcontact.trim(), email: femail.trim(), note: fnote.trim() },
      payMethod: payLabel,
      items: details,
      total,
    };

    try {
      localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
    } catch {
      /* stockage indisponible : on continue quand même, la confirmation gérera l'absence de commande */
    }
    clear();
    navigate('/boutique/confirmation');
  }

  return (
    <main className="wrap">
      <div className="section" style={{ paddingTop: 32 }}>
        <div className="eyebrow">COMMANDE</div>
        <h1 style={{ fontSize: 'clamp(1.7rem,4vw,2.2rem)', margin: '0 0 8px' }}>Finaliser ma commande</h1>
        <p style={{ color: 'var(--ink-dim)', maxWidth: '56ch', margin: '0 0 6px' }}>
          Renseigne tes informations : tu recevras un récapitulatif avec une référence de commande, à confirmer
          ensuite sur WhatsApp pour le paiement et l'activation.
        </p>
      </div>

      <form className="checkout-layout" onSubmit={handleSubmit}>
        <div className="form-card">
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

          <h2 style={{ fontSize: 16, margin: '22px 0 14px' }}>Méthode de paiement</h2>
          <div className="pay-method">
            {PAY_OPTIONS.map((opt) => (
              <label
                className={`pay-option${pay === opt.id ? ' selected' : ''}`}
                key={opt.id}
                onClick={() => setPay(opt.id)}
              >
                <input type="radio" name="pay" value={opt.id} checked={pay === opt.id} readOnly /> {opt.label}
              </label>
            ))}
          </div>
          <p className="pay-note">
            Aucun paiement n'est prélevé automatiquement ici. Après validation, tu recevras les coordonnées de
            paiement par WhatsApp — un acompte est demandé au démarrage, le solde à la livraison, comme précisé
            dans la FAQ du portfolio.
          </p>

          <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: 22 }}>
            Confirmer la commande
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
            <span>{formatPrice(total)}</span>
          </div>
        </aside>
      </form>
    </main>
  );
}

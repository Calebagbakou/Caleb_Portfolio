import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { deleteBuyerAccount, getBuyerAccount, getShopOrderDeliveries } from '../../services/shop';
import { formatPrice } from '../../data/products';
import ShopAlert from '../../components/shop/ShopAlert';
import { getShopErrorMessage } from '../../utils/shopErrors';

const ACCOUNT_SECTIONS = [
  { id: 'orders', label: 'Mes commandes' },
  { id: 'profile', label: 'Profil et sécurité' },
  { id: 'support', label: 'Assistance' },
];

function getOrderStatus(order) {
  if (order.payment_status !== 'confirme') return { label: 'En attente de paiement', paid: false };
  const fulfillment = String(order.fulfillment_status || order.status || '').toLowerCase();
  if (['livre', 'livree', 'livré', 'livrée', 'delivered'].includes(fulfillment)) {
    return { label: 'Payée · Livrée', paid: true };
  }
  if (['en_cours', 'en_preparation', 'en préparation', 'preparation', 'processing'].includes(fulfillment)) {
    return { label: 'Payée · En préparation', paid: true };
  }
  return { label: 'Payée', paid: true };
}

function getInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function Account() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deliveryState, setDeliveryState] = useState({});
  const [activeSection, setActiveSection] = useState(() => {
    const requestedSection = new URLSearchParams(window.location.search).get('section');
    return ACCOUNT_SECTIONS.some((section) => section.id === requestedSection) ? requestedSection : 'orders';
  });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [copiedOrder, setCopiedOrder] = useState('');

  useEffect(() => {
    let active = true;
    getBuyerAccount()
      .then(({ data, error: accountError }) => {
        if (!active) return;
        if (accountError) setError(getShopErrorMessage(accountError, 'Votre espace client est momentanément indisponible.'));
        else setAccount(data);
      })
      .catch((accountError) => {
        console.error('Impossible de charger le compte client :', accountError);
        if (active) setError(getShopErrorMessage(accountError, 'Votre espace client est momentanément indisponible.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const requestedSection = searchParams.get('section');
    if (ACCOUNT_SECTIONS.some((section) => section.id === requestedSection)) {
      setActiveSection(requestedSection);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!deleteModalOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key === 'Escape' && !deleting) setDeleteModalOpen(false);
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [deleteModalOpen, deleting]);

  const orders = account?.orders || [];
  const mostRecentPaidOrder = useMemo(
    () => orders.find((order) => order.payment_status === 'confirme'),
    [orders],
  );

  async function loadDeliveries(order) {
    setDeliveryState((current) => ({ ...current, [order.id]: { loading: true } }));
    try {
      const { data, error: deliveryError } = await getShopOrderDeliveries({ orderId: order.id, orderRef: order.ref });
      setDeliveryState((current) => ({
        ...current,
        [order.id]: deliveryError
          ? { error: getShopErrorMessage(deliveryError, 'Vos accès sont momentanément indisponibles.') }
          : { data },
      }));
    } catch (deliveryError) {
      console.error('Impossible de charger les accès de la commande :', deliveryError);
      setDeliveryState((current) => ({
        ...current,
        [order.id]: { error: getShopErrorMessage(deliveryError, 'Vos accès sont momentanément indisponibles.') },
      }));
    }
  }

  useEffect(() => {
    if (mostRecentPaidOrder && !deliveryState[mostRecentPaidOrder.id]) {
      loadDeliveries(mostRecentPaidOrder);
    }
  }, [mostRecentPaidOrder, deliveryState]);

  async function handleLogout() {
    setLogoutError('');
    try {
      await logout();
      navigate('/boutique', { replace: true });
    } catch (logoutFailure) {
      console.error('Déconnexion du compte client impossible :', logoutFailure);
      setLogoutError('La déconnexion a échoué. Réessayez.');
    }
  }

  async function handleDeleteAccount(event) {
    event.preventDefault();
    if (deleteConfirmation !== 'SUPPRIMER') return;
    setDeleting(true);
    setError('');
    try {
      const { error: deleteError } = await deleteBuyerAccount();
      if (deleteError) throw deleteError;
      localStorage.removeItem('caleb_boutique_cart_v1');
      navigate('/boutique', { replace: true });
    } catch (deleteError) {
      console.error('Suppression du compte client impossible :', deleteError);
      setError(getShopErrorMessage(deleteError, 'Le compte n’a pas pu être supprimé. Vous pouvez réessayer ou nous contacter.'));
      setDeleting(false);
    }
  }

  async function copyOrderReference(order) {
    try {
      await navigator.clipboard.writeText(order.ref);
      setCopiedOrder(order.id);
      window.setTimeout(() => setCopiedOrder(''), 1800);
    } catch (copyError) {
      console.error('Impossible de copier la référence de commande :', copyError);
      setError('La référence n’a pas pu être copiée. Sélectionnez-la pour la copier manuellement.');
    }
  }

  function selectSection(section) {
    setActiveSection(section);
    setSearchParams(section === 'orders' ? {} : { section }, { replace: true });
  }

  const displayName = account?.profile?.name || user?.user_metadata?.full_name || user?.user_metadata?.name || 'Client Caleb Creative';
  const initials = getInitials(displayName);

  if (loading) {
    return (
      <main className="wrap account-page">
        <div className="account-skeleton account-skeleton-profile" />
        <div className="account-skeleton account-skeleton-nav" />
        <div className="account-skeleton account-skeleton-order" />
        <div className="account-skeleton account-skeleton-order" />
      </main>
    );
  }

  if (error && !account) {
    return (
      <main className="wrap">
        <div className="shop-state-error-wrap">
          <ShopAlert message={error} action="Retour à la boutique" actionTo="/boutique" />
        </div>
      </main>
    );
  }

  return (
    <main className="wrap account-page">
      <header className="account-hero">
        <div className="account-avatar" aria-hidden="true">{initials}</div>
        <div className="account-identity">
          <strong>{displayName}</strong>
          <span>{user?.email}</span>
        </div>
        <span className="account-status"><span className="account-status-dot" /> E-mail confirmé</span>
      </header>

      {error && <ShopAlert message={error} action="Fermer" onAction={() => setError('')} />}
      {logoutError && <ShopAlert message={logoutError} action="Fermer" onAction={() => setLogoutError('')} />}

      <div className="account-shell">
        <nav className="account-sidebar" aria-label="Sections de votre compte">
          <div className="account-sidebar-links">
            {ACCOUNT_SECTIONS.map((section) => (
              <button
                type="button"
                className={`account-sidebar-link${activeSection === section.id ? ' active' : ''}`}
                aria-current={activeSection === section.id ? 'page' : undefined}
                onClick={() => selectSection(section.id)}
                key={section.id}
              >
                {section.label}
              </button>
            ))}
          </div>
          <button type="button" className="account-logout" onClick={handleLogout}>Se déconnecter</button>
        </nav>

        <div className="account-content">
          {activeSection === 'orders' && (
            <section className="account-orders">
              <div className="account-section-head">
                <div><div className="account-card-label">VOTRE ACTIVITÉ</div><h1>Mes commandes</h1></div>
                <Link to="/boutique/catalogue" className="btn btn-outline account-catalogue-link">Voir le catalogue</Link>
              </div>
              {!orders.length ? (
                <div className="account-empty">
                  <span className="account-empty-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M3 3h2l2.4 12.4a2 2 0 002 1.6h8.2a2 2 0 002-1.6L21 8H6" />
                      <circle cx="9" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" />
                    </svg>
                  </span>
                  <h2>Aucune commande pour le moment</h2>
                  <p>Vos commandes, reçus et accès apparaîtront ici.</p>
                  <Link to="/boutique/catalogue" className="btn btn-primary">Voir le catalogue</Link>
                </div>
              ) : orders.map((order) => {
                const delivery = deliveryState[order.id];
                const status = getOrderStatus(order);
                const helpMessage = encodeURIComponent(`Bonjour, j’ai besoin d’aide pour la commande ${order.ref}.`);
                return (
                  <article className="account-order" key={order.id}>
                    <div className="account-order-top">
                      <div className="account-order-reference">
                        <span className="account-order-icon" aria-hidden="true">CC</span>
                        <div>
                          <strong>{order.ref}</strong>
                          <span>{new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        </div>
                      </div>
                      <div className="account-order-total">
                        <strong>{formatPrice(order.total)}</strong>
                        <span className={`account-pill ${status.paid ? 'success' : ''}`}>{status.label}</span>
                      </div>
                    </div>
                    <div className="account-items">
                      {(order.order_items || []).map((item) => {
                        const product = Array.isArray(item.products) ? item.products[0] : item.products;
                        const image = product?.image_url || product?.logo_url;
                        return (
                          <div className="account-item" key={item.id}>
                            <span className="account-item-image" style={{ background: product?.gradient || 'var(--surface-alt)' }}>
                              {image ? <img src={image} alt="" loading="lazy" /> : product?.avatar || 'CC'}
                            </span>
                            <span>{item.product_name} · {item.plan_label} × {item.qty}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="account-order-actions">
                      {status.paid && order.id === mostRecentPaidOrder?.id && delivery?.loading && (
                        <span className="account-delivery-pending">Chargement de vos accès…</span>
                      )}
                      {delivery?.error && <span className="account-error">{delivery.error}</span>}
                      {status.paid && delivery?.error && (
                        <button type="button" className="btn btn-outline account-order-button" onClick={() => loadDeliveries(order)}>Réessayer les accès</button>
                      )}
                      {delivery?.data?.deliveries?.map((item) => (
                        item.url
                          ? <a className="btn btn-primary account-order-button" href={item.url} target="_blank" rel="noopener noreferrer" key={`${item.productId}-${item.type}`}>{item.type === 'download' ? 'Télécharger' : `Accéder à ${item.name}`}</a>
                          : <span className="account-error" key={`${item.productId}-${item.type}`}>{item.error}</span>
                      ))}
                      <button type="button" className="btn btn-outline account-order-button" onClick={() => copyOrderReference(order)}>
                        {copiedOrder === order.id ? 'Référence copiée' : 'Copier la référence'}
                      </button>
                      {status.paid && (
                        <Link className="btn btn-outline account-order-button" to={`/boutique/confirmation?order_id=${encodeURIComponent(order.id)}`}>Reçu</Link>
                      )}
                      <a className="btn btn-outline account-order-button" href={`https://wa.me/2290148135395?text=${helpMessage}`} target="_blank" rel="noopener noreferrer">Besoin d’aide ?</a>
                    </div>
                  </article>
                );
              })}
            </section>
          )}

          {activeSection === 'profile' && (
            <section className="account-settings">
              <div className="account-section-head">
                <div><div className="account-card-label">VOS INFORMATIONS</div><h1>Profil et sécurité</h1></div>
              </div>
              <section className="account-card">
                <div className="account-profile-head">
                  <div className="account-avatar">{initials}</div>
                  <div><h2>{displayName}</h2><p>{user?.email}</p></div>
                </div>
                <div className="account-status"><span className="account-status-dot" /> Adresse e-mail confirmée</div>
                <button type="button" className="btn btn-outline account-small-action" onClick={() => navigate('/boutique/connexion?mode=reset')}>
                  Modifier mon mot de passe
                </button>
              </section>
              <section className="account-danger-zone">
                <div>
                  <h2>Zone sensible</h2>
                  <p>La suppression est définitive. Votre connexion sera supprimée et vos commandes conservées de façon anonyme.</p>
                </div>
                <button type="button" className="btn account-danger-action" onClick={() => setDeleteModalOpen(true)}>
                  Supprimer mon compte
                </button>
              </section>
            </section>
          )}

          {activeSection === 'support' && (
            <section className="account-support">
              <div className="account-section-head">
                <div><div className="account-card-label">NOUS SOMMES À VOTRE ÉCOUTE</div><h1>Assistance</h1></div>
              </div>
              <section className="account-card account-support-card">
                <h2>Une question sur une commande ?</h2>
                <p>Contactez-nous sur WhatsApp en indiquant la référence de votre commande pour faciliter le suivi.</p>
                <a className="btn btn-primary" href={`https://wa.me/2290148135395?text=${encodeURIComponent('Bonjour, j’ai besoin d’aide concernant ma boutique Caleb Creative.')}`} target="_blank" rel="noopener noreferrer">
                  Contacter l’assistance
                </a>
              </section>
            </section>
          )}
        </div>
      </div>

      {deleteModalOpen && (
        <div className="account-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !deleting) setDeleteModalOpen(false);
        }}>
          <section className="account-delete-modal" role="dialog" aria-modal="true" aria-labelledby="account-delete-title">
            <button type="button" className="account-modal-close" aria-label="Fermer" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>×</button>
            <div className="account-card-label">ACTION DÉFINITIVE</div>
            <h2 id="account-delete-title">Supprimer votre compte ?</h2>
            <p>Votre accès à ce compte sera supprimé. Les informations personnelles associées aux commandes seront anonymisées ; les commandes resteront conservées pour le suivi et la comptabilité.</p>
            <p>Cette action est définitive et ne peut pas être annulée.</p>
            <form onSubmit={handleDeleteAccount}>
              <label htmlFor="account-delete-confirmation">Pour confirmer, saisissez <strong>SUPPRIMER</strong>.</label>
              <input
                autoFocus
                autoComplete="off"
                id="account-delete-confirmation"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
              />
              <div className="account-modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>Annuler</button>
                <button type="submit" className="btn account-danger-action" disabled={deleting || deleteConfirmation !== 'SUPPRIMER'}>
                  {deleting ? 'Suppression…' : 'Supprimer mon compte'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardStats } from '../../services/dashboard';

const CARD_LABELS = [
  { key: 'projects', label: 'Projets' },
  { key: 'services', label: 'Services' },
  { key: 'products', label: 'Produits' },
  { key: 'orders', label: 'Commandes' },
  { key: 'customers', label: 'Clients' },
  { key: 'unreadMessages', label: 'Messages non lus' },
];

export default function Dashboard() {
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { counts: result, error: err } = await getDashboardStats();
      if (!mounted) return;
      setCounts(result);
      setError(err);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <section className="dashboard-intro">
        <div className="dashboard-intro-copy">
          <span className="dashboard-eyebrow">Votre espace de pilotage</span>
          <h2>Tout votre site, au même endroit.</h2>
          <p>Suivez votre activité et gérez votre portfolio et votre boutique en quelques clics.</p>
        </div>
        <div className="dashboard-intro-actions">
          <Link className="btn btn-primary" to="/admin/portfolio/projects">Ajouter un projet</Link>
          <Link className="dashboard-text-link" to="/boutique" target="_blank" rel="noreferrer">
            Voir la boutique <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>

      <div className="dashboard-section-heading">
        <div>
          <span className="dashboard-eyebrow">En un coup d’œil</span>
          <h2>Activité du site</h2>
        </div>
        <span className="dashboard-live"><span /> Données en direct</span>
      </div>

      <div className="stat-grid">
        {CARD_LABELS.map(({ key, label }) => (
          <div className="stat-card" key={key}>
            <div className="stat-card-top">
              <span className="stat-card-icon" aria-hidden="true" />
              <span className="stat-card-dot" aria-hidden="true" />
            </div>
            <div className="n">{counts ? counts[key] ?? '—' : '—'}</div>
            <div className="l">{label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="panel dashboard-error">
          <h2>Erreur de chargement</h2>
          <p>Impossible de charger les statistiques depuis Supabase : {error.message}</p>
        </div>
      )}

      <section className="dashboard-quick-panel">
        <div>
          <span className="dashboard-eyebrow">Accès rapide</span>
          <h2>Que souhaitez-vous faire ?</h2>
          <p>Les outils essentiels pour garder votre site à jour.</p>
        </div>
        <div className="dashboard-quick-links">
          <Link to="/admin/portfolio/projects"><span className="dashboard-quick-icon">↗</span><span><strong>Gérer les projets</strong><small>Portfolio et réalisations</small></span><span className="dashboard-quick-arrow">→</span></Link>
          <Link to="/admin/shop/products"><span className="dashboard-quick-icon">◆</span><span><strong>Gérer la boutique</strong><small>Produits et tarifs</small></span><span className="dashboard-quick-arrow">→</span></Link>
          <Link to="/admin/orders"><span className="dashboard-quick-icon">↳</span><span><strong>Suivre les commandes</strong><small>Paiements et activations</small></span><span className="dashboard-quick-arrow">→</span></Link>
        </div>
      </section>
    </>
  );
}

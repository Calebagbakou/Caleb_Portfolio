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
      <div className="stat-grid">
        {CARD_LABELS.map(({ key, label }) => (
          <div className="stat-card" key={key}>
            <div className="n">{counts ? counts[key] ?? '—' : '—'}</div>
            <div className="l">{label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="panel" style={{ borderColor: 'var(--danger)' }}>
          <h2>Erreur de chargement</h2>
          <p>Impossible de charger les statistiques depuis Supabase : {error.message}</p>
        </div>
      )}

      <div className="panel">
        <h2>Gère ton contenu sans modifier le code</h2>
        <p>Administre ton portfolio, les textes et produits de la boutique ainsi que le suivi des commandes.</p>
        <div className="row-actions" style={{ marginTop: 16 }}>
          <Link className="btn btn-primary" to="/admin/projects">Gérer les projets</Link>
          <Link className="btn btn-secondary" to="/admin/shop">Gérer la boutique</Link>
          <Link className="btn btn-secondary" to="/admin/orders">Voir les commandes</Link>
        </div>
      </div>
    </>
  );
}

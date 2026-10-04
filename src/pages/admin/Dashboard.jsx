import { useEffect, useState } from 'react';
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
        <h2>Connexion et base de données opérationnelles ✅</h2>
        <p>
          L'authentification admin et le schéma de base de données (Supabase) sont en place. Les
          compteurs ci-dessus sont lus en direct depuis tes tables.
        </p>
        <div className="placeholder-note">
          Écrans déjà construits : <strong>Messages</strong> et <strong>Paramètres</strong>. Le reste
          (Projets, Compétences, Services, Médias, Produits, Commandes, Clients) reste marqué
          « bientôt » — dis-moi par lequel continuer.
        </div>
      </div>
    </>
  );
}

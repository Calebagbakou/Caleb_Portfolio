import { NavLink } from 'react-router-dom';

/**
 * Port direct de la sidebar admin (identique sur index.html, messages.html,
 * parametres.html dans l'ancien projet). Les sections Compétences,
 * La gestion du portfolio et de la boutique est regroupée dans les routes
 * protégées de l'espace admin.
 */
export default function AdminSidebar({ onLogout }) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-brand">
        <span className="admin-brand-mark">CA</span>
        <span className="admin-brand-text">Admin</span>
      </div>

      <nav className="admin-nav">
        <NavLink to="/admin" end>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="3" width="7" height="9" rx="1.5" />
            <rect x="14" y="3" width="7" height="5" rx="1.5" />
            <rect x="14" y="12" width="7" height="9" rx="1.5" />
            <rect x="3" y="16" width="7" height="5" rx="1.5" />
          </svg>
          Dashboard
        </NavLink>

        <div className="admin-nav-label">Portfolio</div>
        <NavLink to="/admin/projects">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="3" width="18" height="14" rx="2" />
            <path d="M3 13l5-4 4 3 5-5 4 3" />
          </svg>
          Projets
        </NavLink>
        <a href="#soon-competences" onClick={(e) => e.preventDefault()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 2l2.5 6.5H21l-5.3 4 2 6.5-5.7-4-5.7 4 2-6.5L3 8.5h6.5z" />
          </svg>
          Compétences<span className="soon">bientôt</span>
        </a>
        <a href="#soon-services" onClick={(e) => e.preventDefault()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          Services<span className="soon">bientôt</span>
        </a>

        <div className="admin-nav-label">Médias</div>
        <NavLink to="/admin/media">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          Images
        </NavLink>
        <a href="#soon-videos" onClick={(e) => e.preventDefault()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="5" width="14" height="14" rx="2" />
            <path d="M17 9l4-2v10l-4-2" />
          </svg>
          Vidéos<span className="soon">bientôt</span>
        </a>

        <div className="admin-nav-label">Boutique</div>
        <NavLink to="/admin/shop">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 3h2l2.4 12.4a2 2 0 002 1.6h8.2a2 2 0 002-1.6L21 8H6" />
            <circle cx="9" cy="20" r="1.4" />
            <circle cx="17" cy="20" r="1.4" />
          </svg>
          Produits
        </NavLink>
        <NavLink to="/admin/orders">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 10h18" />
          </svg>
          Commandes
        </NavLink>
        <a href="#soon-clients" onClick={(e) => e.preventDefault()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
          </svg>
          Clients<span className="soon">bientôt</span>
        </a>

        <div className="admin-nav-label">Général</div>
        <NavLink to="/admin/messages">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 20l1.3-4A8 8 0 1112 20a8 8 0 01-4-1z" />
          </svg>
          Messages
        </NavLink>
        <NavLink to="/admin/parametres">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009.6 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 8.6a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          Paramètres
        </NavLink>
      </nav>

      <button className="admin-logout" onClick={onLogout}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
        Déconnexion
      </button>
    </aside>
  );
}

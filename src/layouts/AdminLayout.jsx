import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useState } from 'react';
import AdminSidebar from '../components/admin/AdminSidebar';
import { useAuth } from '../context/AuthContext';
import '../styles/admin.css';

const PAGES = {
  '/admin': { title: 'Vue d’ensemble', section: 'Espace de gestion' },
  '/admin/portfolio/projects': { title: 'Projets', section: 'Portfolio' },
  '/admin/portfolio/competences': { title: 'Compétences', section: 'Portfolio' },
  '/admin/portfolio/services': { title: 'Services', section: 'Portfolio' },
  '/admin/portfolio/temoignages': { title: 'Témoignages', section: 'Portfolio' },
  '/admin/media/images': { title: 'Images', section: 'Médias' },
  '/admin/shop/products': { title: 'Produits', section: 'Boutique' },
  '/admin/shop/fournisseurs': { title: 'Fournisseurs', section: 'Boutique' },
  '/admin/shop/categories': { title: 'Catégories', section: 'Boutique' },
  '/admin/shop/promos': { title: 'Codes promo', section: 'Boutique' },
  '/admin/shop/content': { title: 'Contenu de la boutique', section: 'Boutique' },
  '/admin/shop/prodseller': { title: 'Catalogue ProdSeller', section: 'Boutique' },
  '/admin/orders': { title: 'Commandes', section: 'Commerce' },
  '/admin/clients': { title: 'Clients', section: 'Commerce' },
  '/admin/messages': { title: 'Messages', section: 'Communication' },
  '/admin/parametres': { title: 'Paramètres', section: 'Configuration' },
};

const SETTINGS_TITLES = {
  'settings-general': 'Général',
  'settings-contact': 'Contact',
  'settings-shop': 'Boutique',
  'settings-social': 'Réseaux sociaux',
  'admin-security': 'Sécurité',
};

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [logoutError, setLogoutError] = useState('');
  const defaultPage = PAGES[location.pathname] || { title: 'Administration', section: 'Espace de gestion' };
  const settingsTitle = location.pathname === '/admin/parametres'
    ? SETTINGS_TITLES[location.hash.slice(1)]
    : undefined;
  const page = settingsTitle
    ? { ...defaultPage, title: settingsTitle }
    : defaultPage;

  async function handleLogout() {
    setLogoutError('');
    try {
      await logout();
      navigate('/admin/login');
    } catch (error) {
      console.error('Déconnexion administrateur impossible :', error);
      setLogoutError('La déconnexion a échoué. Réessayez.');
    }
  }

  return (
    <div className="admin-shell">
      <AdminSidebar onLogout={handleLogout} />
      <main className="admin-main">
        <div className="admin-topbar">
          <div className="admin-page-title">
            <span className="admin-page-section">{page.section}</span>
            <h1>{page.title}</h1>
          </div>
          <div className="admin-user">
            <span className="admin-user-avatar" aria-hidden="true">
              {(user?.email?.[0] || 'A').toUpperCase()}
            </span>
            <span className="admin-user-details">
              <strong>Administrateur</strong>
              <span className="who">{user?.email}</span>
            </span>
          </div>
        </div>
        {logoutError && <p role="alert">{logoutError}</p>}
        <Outlet />
      </main>
    </div>
  );
}

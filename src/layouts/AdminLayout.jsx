import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import AdminSidebar from '../components/admin/AdminSidebar';
import { useAuth } from '../context/AuthContext';
import '../styles/admin.css';

const PAGES = {
  '/admin': { title: 'Vue d’ensemble', section: 'Espace de gestion' },
  '/admin/projects': { title: 'Projets', section: 'Portfolio' },
  '/admin/media': { title: 'Médias', section: 'Portfolio' },
  '/admin/shop': { title: 'Boutique', section: 'Commerce' },
  '/admin/orders': { title: 'Commandes', section: 'Commerce' },
  '/admin/messages': { title: 'Messages', section: 'Communication' },
  '/admin/parametres': { title: 'Paramètres', section: 'Configuration' },
};

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const page = PAGES[location.pathname] || { title: 'Administration', section: 'Espace de gestion' };

  async function handleLogout() {
    await logout();
    navigate('/admin/login');
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
        <Outlet />
      </main>
    </div>
  );
}

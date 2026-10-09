import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import AdminSidebar from '../components/admin/AdminSidebar';
import { useAuth } from '../context/AuthContext';
import '../styles/admin.css';

const TITLES = {
  '/admin': 'Dashboard',
  '/admin/projects': 'Projets',
  '/admin/shop': 'Boutique',
  '/admin/orders': 'Commandes',
  '/admin/messages': 'Messages',
  '/admin/parametres': 'Paramètres',
};

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const title = TITLES[location.pathname] || 'Admin';

  async function handleLogout() {
    await logout();
    navigate('/admin/login');
  }

  return (
    <div className="admin-shell">
      <AdminSidebar onLogout={handleLogout} />
      <main className="admin-main">
        <div className="admin-topbar">
          <h1>{title}</h1>
          <span className="who">{user?.email}</span>
        </div>
        <Outlet />
      </main>
    </div>
  );
}

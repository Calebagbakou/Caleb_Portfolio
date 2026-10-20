import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { countUnreadMessages } from '../../services/messages';

const GROUPS = [
  {
    id: 'portfolio',
    label: 'Portfolio',
    links: [
      { label: 'Projets', to: '/admin/portfolio/projects' },
      { label: 'Compétences', to: '/admin/portfolio/competences' },
      { label: 'Services', to: '/admin/portfolio/services' },
      { label: 'Témoignages', to: '/admin/portfolio/temoignages' },
    ],
  },
  {
    id: 'media',
    label: 'Médias',
    links: [
      { label: 'Images', to: '/admin/media/images' },
      { label: 'Vidéos', disabled: true },
    ],
  },
  {
    id: 'shop',
    label: 'Boutique',
    links: [
      { label: 'Commandes', to: '/admin/orders' },
      { label: 'Clients', to: '/admin/clients' },
      { label: 'Produits', to: '/admin/shop/products' },
      { label: 'Catégories', to: '/admin/shop/categories' },
      { label: 'Codes promo', to: '/admin/shop/promos' },
      { label: 'Contenu de la boutique', to: '/admin/shop/content' },
      { label: 'ProdSeller', to: '/admin/shop/prodseller' },
    ],
  },
  {
    id: 'settings',
    label: 'Paramètres',
    links: [
      { label: 'Général', to: '/admin/parametres#settings-general' },
      { label: 'Contact', to: '/admin/parametres#settings-contact' },
      { label: 'Réseaux', to: '/admin/parametres#settings-social' },
      { label: 'Boutique', to: '/admin/parametres#settings-shop' },
      { label: 'Sécurité', to: '/admin/parametres#admin-security' },
    ],
  },
];

function activeGroupFor(pathname) {
  if (pathname.startsWith('/admin/portfolio/')) return 'portfolio';
  if (pathname.startsWith('/admin/media/')) return 'media';
  if (pathname.startsWith('/admin/shop/')) return 'shop';
  if (pathname === '/admin/parametres') return 'settings';
  return null;
}

function initialOpenGroup(routeGroup) {
  if (routeGroup) return routeGroup;
  try {
    return window.localStorage.getItem('admin-open-group') || null;
  } catch (error) {
    console.error('Impossible de lire le groupe de navigation mémorisé :', error);
    return null;
  }
}

function Icon({ name }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true };
  if (name === 'dashboard') return <svg {...common}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>;
  if (name === 'messages') return <svg {...common}><path d="M4 20l1.3-4A8 8 0 1112 20a8 8 0 01-4-1z" /></svg>;
  if (name === 'logout') return <svg {...common}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></svg>;
  return <svg {...common}><path d="M4 12h16M12 4v16" /></svg>;
}

export default function AdminSidebar({ onLogout }) {
  const location = useLocation();
  const routeGroup = activeGroupFor(location.pathname);
  const [openGroup, setOpenGroup] = useState(() => initialOpenGroup(routeGroup));
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (routeGroup) setOpenGroup(routeGroup);
  }, [routeGroup]);

  useEffect(() => {
    try {
      if (openGroup) window.localStorage.setItem('admin-open-group', openGroup);
      else window.localStorage.removeItem('admin-open-group');
    } catch (error) {
      console.error('Impossible de mémoriser le groupe de navigation :', error);
    }
  }, [openGroup]);

  useEffect(() => {
    let active = true;
    async function refreshUnreadCount() {
      const { count, error } = await countUnreadMessages();
      if (error) {
        console.error('Impossible de compter les messages non lus :', error);
        return;
      }
      if (active) setUnreadCount(count || 0);
    }
    function handleMessagesUpdated() {
      refreshUnreadCount().catch((error) => {
        console.error('Impossible de compter les messages non lus :', error);
      });
    }
    refreshUnreadCount().catch((error) => {
      console.error('Impossible de compter les messages non lus :', error);
    });
    window.addEventListener('admin-messages-updated', handleMessagesUpdated);
    return () => {
      active = false;
      window.removeEventListener('admin-messages-updated', handleMessagesUpdated);
    };
  }, []);

  return (
    <aside className="admin-sidebar">
      <div className="admin-brand">
        <span className="admin-brand-mark">CA</span>
        <span className="admin-brand-text">Admin</span>
      </div>

      <nav className="admin-nav" aria-label="Navigation d’administration">
        <NavLink to="/admin" end>
          <Icon name="dashboard" />
          Tableau de bord
        </NavLink>

        {GROUPS.map((group) => {
          const expanded = openGroup === group.id;
          return (
            <div className="admin-nav-group" key={group.id}>
              <button
                className={`admin-nav-group-toggle${routeGroup === group.id ? ' active' : ''}`}
                type="button"
                aria-expanded={expanded}
                aria-controls={`admin-nav-${group.id}`}
                onClick={() => setOpenGroup(expanded ? null : group.id)}
              >
                <span>{group.label}</span>
                <span className="admin-nav-chevron" aria-hidden="true">{expanded ? '−' : '+'}</span>
              </button>
              <div className="admin-nav-children" id={`admin-nav-${group.id}`} hidden={!expanded}>
                {group.links.map((link) => link.disabled
                  ? <span className="admin-nav-disabled" key={link.label}>{link.label}<span className="soon">bientôt</span></span>
                  : (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      className={({ isActive }) => {
                        if (group.id === 'settings') {
                          const hash = link.to.split('#')[1];
                          const isDefaultSection = hash === 'settings-general' && !location.hash;
                          return isActive && (location.hash === `#${hash}` || isDefaultSection) ? 'active' : '';
                        }
                        return isActive ? 'active' : '';
                      }}
                    >
                      {link.label}
                    </NavLink>
                  ))}
              </div>
            </div>
          );
        })}

        <NavLink to="/admin/messages">
          <Icon name="messages" />
          Messages
          {unreadCount > 0 && <span className="admin-nav-count" aria-label={`${unreadCount} non lus`}>{unreadCount}</span>}
        </NavLink>
      </nav>

      <button className="admin-logout" onClick={onLogout}>
        <Icon name="logout" />
        Déconnexion
      </button>
    </aside>
  );
}

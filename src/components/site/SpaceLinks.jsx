import { Link, useLocation } from 'react-router-dom';
import './SpaceLinks.css';

const SPACES = [
  { path: '/', label: 'Accueil Caleb Creative' },
  { path: '/portfolio', label: 'Portfolio' },
  { path: '/boutique', label: 'Boutique' },
  { path: '/smm', label: 'Panel social' },
];

export default function SpaceLinks({ className = '', onNavigate }) {
  const { pathname } = useLocation();

  return (
    <div className={`space-links ${className}`.trim()} role="group" aria-label="Nos espaces">
      <span className="space-links-heading">Nos espaces</span>
      {SPACES.map((space) => {
        const isCurrent = space.path === '/'
          ? pathname === '/'
          : pathname === space.path || pathname.startsWith(`${space.path}/`);
        return (
          <Link
            key={space.path}
            to={space.path}
            onClick={onNavigate}
            aria-current={isCurrent ? 'page' : undefined}
          >
            {space.label}
          </Link>
        );
      })}
    </div>
  );
}

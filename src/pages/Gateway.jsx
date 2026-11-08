import { Link } from 'react-router-dom';
import Seo from '../components/site/Seo';
import './Gateway.css';

const STATS = [
  { value: '40+', label: 'projets réalisés' },
  { value: '100%', label: 'clients satisfaits' },
  { value: '50+', label: 'outils maîtrisés' },
];

const SOCIAL_NETWORKS = ['IG', 'f', 'TK', 'YT', 'TG', 'X'];
const SHOP_CHIPS = ['Gemini Pro', 'CapCut Pro', 'Canva Pro'];

function Arrow() {
  return (
    <svg className="gw-arrow" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

export default function Gateway() {
  return (
    <main className="gw">
      <Seo
        title="Caleb Creative — Création visuelle & services numériques"
        description="Bienvenue chez Caleb Creative : découvre mon portfolio, ma boutique et le panel social."
        path="/"
      />

      <div className="gw-bg" aria-hidden="true">
        <span className="gw-orb gw-orb-a" />
        <span className="gw-orb gw-orb-b" />
        <span className="gw-grid-lines" />
      </div>

      <div className="gw-shell">
        <header className="gw-hero" aria-labelledby="gateway-title">
          <p className="gw-kicker">
            <span className="gw-pulse" aria-hidden="true" />
            Caleb Creative · Abomey, Bénin
          </p>
          <h1 id="gateway-title" className="gw-title">
            La créativité
            <em>prend plusieurs formes.</em>
          </h1>
          <p className="gw-lead">
            Créations visuelles, outils numériques et services sociaux :
            choisis par où commencer.
          </p>
          <ul className="gw-stats" aria-label="Caleb Creative en chiffres">
            {STATS.map((stat) => (
              <li key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </li>
            ))}
          </ul>
        </header>

        <nav className="gw-grid" aria-label="Découvrir Caleb Creative">
          {/* 01 — Portfolio */}
          <Link className="gw-card gw-card--portfolio" to="/portfolio">
            <span className="gw-card-top">
              <span className="gw-index">01</span>
              <span className="gw-tag">Création visuelle</span>
            </span>
            <span className="gw-preview gw-preview--portfolio" aria-hidden="true">
              <i /><i /><i />
            </span>
            <span className="gw-card-body">
              <span className="gw-card-title">Le portfolio</span>
              <span className="gw-card-desc">
                Mes projets vidéo et design, mes services et mon univers créatif.
              </span>
            </span>
            <span className="gw-cta">Explorer le portfolio <Arrow /></span>
          </Link>

          {/* 02 — Boutique */}
          <Link className="gw-card gw-card--shop" to="/boutique">
            <span className="gw-card-top">
              <span className="gw-index">02</span>
              <span className="gw-tag">Outils & abonnements</span>
            </span>
            <span className="gw-preview gw-preview--shop" aria-hidden="true">
              {SHOP_CHIPS.map((chip) => <b key={chip}>{chip}</b>)}
            </span>
            <span className="gw-card-body">
              <span className="gw-card-title">La boutique</span>
              <span className="gw-card-desc">
                Une sélection d’outils et d’abonnements numériques, activés rapidement.
              </span>
            </span>
            <span className="gw-cta">Visiter la boutique <Arrow /></span>
          </Link>

          {/* 03 — Panel social */}
          <Link className="gw-card gw-card--social" to="/smm">
            <span className="gw-card-top">
              <span className="gw-index">03</span>
              <span className="gw-tag">Services sociaux</span>
              <span className="gw-new">Nouveau</span>
            </span>
            <span className="gw-preview gw-preview--social" aria-hidden="true">
              {SOCIAL_NETWORKS.map((network) => <b key={network}>{network}</b>)}
            </span>
            <span className="gw-card-body">
              <span className="gw-card-title">Panel social</span>
              <span className="gw-card-desc">
                Commande tes services et suis chaque demande depuis ton espace client.
              </span>
            </span>
            <span className="gw-cta">Ouvrir le panel <Arrow /></span>
          </Link>
        </nav>

        <p className="gw-signoff">
          <span>Caleb Jesugnon Agbakou</span>
          <span>Créateur visuel · Abomey, Bénin</span>
        </p>
      </div>
    </main>
  );
}

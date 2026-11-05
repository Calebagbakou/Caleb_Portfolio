import { Link } from 'react-router-dom';
import Seo from '../components/site/Seo';
import './Gateway.css';

const destinations = [
  {
    number: '01',
    eyebrow: 'Création visuelle',
    title: 'Le portfolio',
    description: 'Découvre mes projets, mes services et mon univers créatif.',
    to: '/portfolio',
    action: 'Explorer le portfolio',
    className: 'gateway-card-portfolio',
  },
  {
    number: '02',
    eyebrow: 'Outils & abonnements',
    title: 'La boutique',
    description: 'Retrouve une sélection d’outils et d’abonnements numériques.',
    to: '/boutique',
    action: 'Visiter la boutique',
    className: 'gateway-card-shop',
  },
];

export default function Gateway() {
  return (
    <main className="gateway-page">
      <Seo
        title="Caleb Creative — Création visuelle & services numériques"
        description="Bienvenue chez Caleb Creative : découvre mon portfolio, ma boutique et le panel social."
        path="/"
      />
      <div className="gateway-glow gateway-glow-one" aria-hidden="true" />
      <div className="gateway-glow gateway-glow-two" aria-hidden="true" />

      <section className="gateway-main" aria-labelledby="gateway-title">
        <p className="gateway-kicker"><span /> Bienvenue dans mon univers</p>
        <h1 id="gateway-title">
          La créativité
          <span>prend plusieurs formes.</span>
        </h1>
        <p className="gateway-intro">
          Explore mes créations visuelles, découvre la boutique et retrouve ici
          les services Caleb Creative.
        </p>

        <div className="gateway-grid" aria-label="Découvrir Caleb Creative">
          {destinations.map((destination) => (
            <Link
              className={`gateway-card ${destination.className}`}
              to={destination.to}
              key={destination.number}
            >
              <span className="gateway-card-number">{destination.number}</span>
              <span className="gateway-card-content">
                <span className="gateway-card-eyebrow">{destination.eyebrow}</span>
                <span className="gateway-card-title">{destination.title}</span>
                <span className="gateway-card-description">{destination.description}</span>
                <span className="gateway-card-action">
                  {destination.action} <span aria-hidden="true">↗</span>
                </span>
              </span>
              <span className="gateway-card-orbit" aria-hidden="true">
                {destination.number === '01' ? '✳' : '＋'}
              </span>
            </Link>
          ))}
          <Link className="gateway-card gateway-card-social" to="/smm">
            <span className="gateway-card-number">03</span>
            <span className="gateway-card-content">
              <span className="gateway-card-eyebrow">Nouveau service</span>
              <span className="gateway-card-title">Panel social</span>
              <span className="gateway-card-description">
                Commande des services sociaux et suis tes demandes depuis ton espace client.
              </span>
              <span className="gateway-card-action">
                Découvrir le panel <span aria-hidden="true">↗</span>
              </span>
            </span>
            <span className="gateway-card-orbit" aria-hidden="true">✦</span>
          </Link>
        </div>

        <p className="gateway-signoff">
          <span>CALEB JESUGNON AGBAKOU</span>
          <span>Créateur visuel · Abomey, Bénin</span>
        </p>
      </section>
    </main>
  );
}

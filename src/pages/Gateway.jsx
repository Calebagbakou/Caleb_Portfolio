import { Link } from 'react-router-dom';
import profileImage from '../assets/profile1.webp';
import Seo from '../components/site/Seo';
import './Gateway.css';

const destinations = [
  {
    number: '01',
    eyebrow: 'Création visuelle',
    title: 'Je veux une création',
    description: 'Design, logo, montage et visuels augmentés par l’IA, pensés pour votre projet.',
    to: '/portfolio#services',
    action: 'Découvrir les services',
    className: 'gateway-card-portfolio',
  },
  {
    number: '02',
    eyebrow: 'Apprentissage social media',
    title: 'Je veux apprendre le SMM',
    description: 'Un parcours progressif, des exemples et des exercices accessibles aux débutants.',
    to: '/smm',
    action: 'Commencer le parcours',
    className: 'gateway-card-social',
  },
  {
    number: '03',
    eyebrow: 'Outils & abonnements',
    title: 'Je cherche un outil',
    description: 'Une sélection d’outils numériques et d’abonnements créatifs dans la boutique.',
    to: '/boutique',
    action: 'Visiter la boutique',
    className: 'gateway-card-shop',
  },
];

const process = [
  ['01', 'Comprendre le besoin', 'On clarifie votre objectif et votre public.'],
  ['02', 'Choisir la bonne approche', 'Une méthode adaptée au projet, au budget et aux outils.'],
  ['03', 'Créer et mettre en place', 'Des contenus utiles, conçus pour être utilisés concrètement.'],
  ['04', 'Observer et améliorer', 'On apprend des retours et on ajuste la suite.'],
];

export default function Gateway() {
  return (
    <main className="gateway-page">
      <Seo
        title="Caleb Creative — Création visuelle, SMM et outils numériques"
        description="Création visuelle, apprentissage du social media management et outils numériques par Caleb Jesugnon AGBAKOU, au Bénin."
        path="/"
      />
      <div className="gateway-shell">
        <section className="gateway-hero" aria-labelledby="gateway-title">
          <div className="gateway-hero-copy">
            <p className="gateway-kicker"><span /> CRÉATION · SOCIAL MEDIA · OUTILS</p>
            <h1 id="gateway-title">Des idées brutes.<br /><em>Des contenus qui marquent.</em></h1>
            <p className="gateway-intro">
              Création visuelle, stratégie social media et outils numériques pour
              transformer vos projets en présence professionnelle.
            </p>
            <div className="gateway-actions">
              <Link className="gateway-button gateway-button-primary" to="/portfolio">
                Découvrir mon portfolio <span aria-hidden="true">↗</span>
              </Link>
              <Link className="gateway-button gateway-button-secondary" to="/smm">
                Commencer le SMM <span aria-hidden="true">→</span>
              </Link>
            </div>
            <Link className="gateway-shop-shortcut" to="/boutique">
              Voir la boutique <span aria-hidden="true">↗</span>
            </Link>
            <p className="gateway-signoff"><span>CALEB JESUGNON AGBAKOU</span> Créateur visuel · Abomey, Bénin</p>
          </div>
          <div className="gateway-portrait-wrap">
            <div className="gateway-portrait-frame">
              <img
                src={profileImage}
                alt="Caleb Jesugnon AGBAKOU, créateur visuel au Bénin"
                width="802"
                height="900"
                fetchPriority="high"
              />
            </div>
            <div className="gateway-portrait-caption">
              <span>CALEB CREATIVE</span>
              <span>CONCEVOIR · CRÉER · TRANSMETTRE</span>
            </div>
            <span className="gateway-portrait-index" aria-hidden="true">CC / 01</span>
          </div>
        </section>

        <section className="gateway-destinations" aria-labelledby="gateway-destinations-title">
          <div className="gateway-section-heading">
            <p className="gateway-section-index">TROUVE TON POINT DE DÉPART</p>
            <h2 id="gateway-destinations-title">Trois façons d’avancer.</h2>
          </div>
          <div className="gateway-grid">
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
                  <span className="gateway-card-action">{destination.action} <span aria-hidden="true">↗</span></span>
                </span>
                <span className="gateway-card-orbit" aria-hidden="true">
                  {destination.number === '01' ? '✳' : destination.number === '02' ? '◎' : '＋'}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="gateway-method" aria-labelledby="gateway-method-title">
          <div className="gateway-section-heading">
            <p className="gateway-section-index">UNE APPROCHE CLAIRE</p>
            <h2 id="gateway-method-title">De l’idée au résultat.</h2>
          </div>
          <ol className="gateway-process">
            {process.map(([number, title, description]) => (
              <li key={number}>
                <span className="gateway-process-number">{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="gateway-smm-callout" aria-labelledby="gateway-smm-title">
          <p className="gateway-section-index">APPRENDRE · PRATIQUER · PROGRESSER</p>
          <div>
            <h2 id="gateway-smm-title">Vous voulez apprendre à gérer une présence professionnelle sur les réseaux sociaux&nbsp;?</h2>
            <p>Un parcours clair pour débuter, pratiquer et progresser sans vous perdre dans les outils.</p>
          </div>
          <Link className="gateway-button gateway-button-primary" to="/smm">
            Découvrir le parcours SMM <span aria-hidden="true">↗</span>
          </Link>
        </section>

        <section className="gateway-faq" aria-labelledby="gateway-faq-title">
          <div className="gateway-section-heading">
            <div>
              <p className="gateway-section-index">QUESTIONS FRÉQUENTES</p>
              <h2 id="gateway-faq-title">Avant de choisir votre parcours.</h2>
            </div>
          </div>
          <div className="gateway-faq-list">
            <details><summary>Le SMM est-il adapté aux débutants ?</summary><p>Oui. Le parcours commence par les bases et avance étape par étape, sans supposer que vous connaissez déjà les outils.</p></details>
            <details><summary>Ai-je besoin d’une grande audience ?</summary><p>Non. La méthode peut s’apprendre sur un projet fictif ou une petite activité. Le parcours ne promet pas de résultats instantanés.</p></details>
            <details><summary>Est-ce une formation ou un accompagnement ?</summary><p>L’espace SMM propose des leçons, des exercices et des ressources à pratiquer à votre rythme. Un accompagnement personnalisé est distinct et se définit selon le projet.</p></details>
            <details><summary>Puis-je suivre le SMM depuis un téléphone ?</summary><p>Oui. Les contenus et ressources sont conçus pour être consultés depuis un téléphone ou un ordinateur.</p></details>
            <details><summary>Les achats de la boutique apparaissent-ils dans mon espace ?</summary><p>La boutique et l’espace SMM utilisent le même compte. Les achats restent accessibles depuis les pages de compte et de commandes de la boutique.</p></details>
            <details><summary>Que se passe-t-il après un paiement ?</summary><p>Les détails d’un achat boutique et sa livraison numérique se retrouvent dans le compte. Les leçons gratuites du parcours SMM ne nécessitent pas de paiement.</p></details>
          </div>
          <p className="gateway-faq-contact">Un projet créatif ou une question&nbsp;? <Link to="/portfolio/#contact">Parlons-en directement <span aria-hidden="true">↗</span></Link></p>
        </section>
      </div>
    </main>
  );
}

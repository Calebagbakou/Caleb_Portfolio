import { Link, useLocation } from 'react-router-dom';
import Seo from '../components/site/Seo';
import { legalFacts } from '../data/legalFacts';
import '../styles/legal.css';

function ContactDetails() {
  return (
    <p>
      E-mail : <a href={legalFacts.contact.emailHref}>{legalFacts.contact.email}</a>. WhatsApp :{' '}
      <a href={legalFacts.contact.whatsappHref}>{legalFacts.contact.whatsapp}</a>. Téléphone :{' '}
      <a href={legalFacts.contact.phoneHref}>{legalFacts.contact.phone}</a>. Réponse par e-mail sous{' '}
      {legalFacts.contact.responseTime} ; support WhatsApp disponible{' '}
      {legalFacts.contact.whatsappAvailability}.
    </p>
  );
}

const PRIVACY_SECTIONS = [
  {
    id: 'responsable',
    title: 'Responsable du site',
    content: (
      <p>
        {legalFacts.business.ownerName} exploite le site sous le nom commercial{' '}
        {legalFacts.business.commercialName}. Son activité est exercée en entreprise individuelle
        à {legalFacts.business.location}.
      </p>
    ),
  },
  {
    id: 'donnees',
    title: 'Données traitées',
    content: (
      <>
        <ul>
          <li><strong>Contact :</strong> {legalFacts.privacy.contactData}</li>
          <li><strong>Compte :</strong> {legalFacts.privacy.accountData}</li>
          <li><strong>Connexion sociale :</strong> {legalFacts.privacy.socialData}</li>
          <li><strong>Commande :</strong> {legalFacts.privacy.orderData}</li>
          <li><strong>Paiement :</strong> {legalFacts.privacy.paymentData}</li>
          <li><strong>Livraison numérique :</strong> {legalFacts.privacy.deliveryData}</li>
          <li><strong>Témoignage :</strong> {legalFacts.privacy.testimonialData}</li>
        </ul>
      </>
    ),
  },
  {
    id: 'utilisation',
    title: 'Utilisation des données',
    content: <p>Les données sont utilisées pour {legalFacts.privacy.purposes}</p>,
  },
  {
    id: 'navigateur',
    title: 'Stockage dans le navigateur',
    content: (
      <div className="legal-table-wrap">
        <table>
          <thead>
            <tr><th scope="col">Clé</th><th scope="col">Utilité</th></tr>
          </thead>
          <tbody>
            {legalFacts.privacy.browserStorage.map((item) => (
              <tr key={item.key}><th scope="row"><code>{item.key}</code></th><td>{item.purpose}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
  {
    id: 'connexion-sociale',
    title: 'Connexion par compte tiers',
    content: <p>{legalFacts.privacy.socialLogin}</p>,
  },
  {
    id: 'mineurs',
    title: 'Mineurs',
    content: <p>{legalFacts.privacy.agePolicy}</p>,
  },
  {
    id: 'suppression-des-donnees',
    title: 'Suppression du compte et des données',
    content: (
      <p>
        {legalFacts.privacy.accountDeletion} {legalFacts.privacy.deletion}
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    content: <ContactDetails />,
  },
];

const TERMS_SECTIONS = [
  {
    id: 'vendeur',
    title: 'Vendeur',
    content: (
      <p>
        {legalFacts.business.ownerName} exploite la boutique sous le nom commercial{' '}
        {legalFacts.business.commercialName}, en entreprise individuelle à{' '}
        {legalFacts.business.location}.
      </p>
    ),
  },
  {
    id: 'offres',
    title: 'Produits et prestations',
    content: (
      <>
        <ul>
          <li>{legalFacts.products.canva}</li>
          <li>{legalFacts.products.capcut}</li>
          <li>{legalFacts.products.gemini}</li>
        </ul>
        <p>{legalFacts.creativeServices.terms}</p>
        <p>{legalFacts.creativeServices.portfolio}</p>
      </>
    ),
  },
  {
    id: 'compte',
    title: 'Compte client',
    content: (
      <p>
        {legalFacts.accountRules.requirement} {legalFacts.accountRules.age}{' '}
        {legalFacts.accountRules.restrictions}{' '}
        {legalFacts.accountRules.suspension}
      </p>
    ),
  },
  {
    id: 'commande-paiement',
    title: 'Prix et paiement des commandes de la boutique',
    content: (
      <p>
        Pour les commandes de la boutique, les prix sont affichés en {legalFacts.payment.currency}.
        Les moyens proposés peuvent
        comprendre {legalFacts.payment.methods} {legalFacts.payment.fees}{' '}
        {legalFacts.payment.confirmation}
      </p>
    ),
  },
  {
    id: 'livraison',
    title: 'Livraison et assistance',
    content: (
      <p>
        {legalFacts.products.delivery} {legalFacts.products.accessIssue} Contactez le support par
        WhatsApp au <a href={legalFacts.contact.whatsappHref}>{legalFacts.contact.whatsapp}</a>.
        Le support WhatsApp est disponible {legalFacts.contact.whatsappAvailability}.
      </p>
    ),
  },
  {
    id: 'garantie-remboursement',
    title: 'Garantie et remboursement',
    content: (
      <p>
        {legalFacts.warranty.period} {legalFacts.warranty.refundForFailure}{' '}
        {legalFacts.warranty.failure} {legalFacts.warranty.review}
      </p>
    ),
  },
  {
    id: 'donnees',
    title: 'Données personnelles',
    content: (
      <p>
        Les données liées au compte et aux commandes sont décrites dans la page{' '}
        <Link to={legalFacts.legalRoutes.privacy}>Confidentialité</Link>. La procédure de
        suppression du compte est disponible dans la section{' '}
        <Link to={`${legalFacts.legalRoutes.privacy}#suppression-des-donnees`}>
          Suppression du compte et des données
        </Link>.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    content: <ContactDetails />,
  },
];

const LEGAL_NOTICES_SECTIONS = [
  {
    id: 'editeur',
    title: 'Éditeur',
    content: (
      <p>
        {legalFacts.business.ownerName} édite le site sous le nom commercial{' '}
        {legalFacts.business.commercialName}. Statut : {legalFacts.business.status}. Localisation :
        {' '}{legalFacts.business.location}.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    content: <ContactDetails />,
  },
];

const PAGE_CONFIG = {
  privacy: {
    title: 'Confidentialité',
    description: 'Données traitées par Caleb Creative, utilisation du navigateur et suppression du compte.',
    sections: PRIVACY_SECTIONS,
    summary: [
      'Les formulaires traitent les données nécessaires au contact, au compte et aux commandes.',
      'Les données de commande servent à valider le paiement et à livrer les produits.',
      'Le navigateur mémorise le panier, le reçu et certaines préférences.',
      'Vous pouvez supprimer votre compte depuis votre espace client.',
      'Le contact du site est disponible par e-mail et WhatsApp.',
    ],
  },
  terms: {
    title: 'Conditions de vente et d’utilisation',
    description: 'Conditions des commandes numériques et des prestations créatives Caleb Creative.',
    sections: TERMS_SECTIONS,
    summary: [
      'Un compte confirmé est requis pour commander.',
      'Les moyens de paiement des commandes de la boutique dépendent du pays.',
      'La livraison annoncée intervient après confirmation de la commande.',
      'La garantie et les demandes de remboursement suivent les modalités indiquées ici.',
      'Les prestations créatives sont convenues directement avec le client.',
    ],
  },
  notices: {
    title: 'Mentions légales',
    description: 'Éditeur et coordonnées de Caleb Creative.',
    sections: LEGAL_NOTICES_SECTIONS,
    summary: [
      'Le site est édité sous le nom commercial Caleb Creative.',
      'L’activité est exercée en entreprise individuelle.',
      'La localisation indiquée est Abomey, Bénin.',
      'Les coordonnées publiques comprennent e-mail, WhatsApp et téléphone.',
      'Les coordonnées sont également disponibles sur le site.',
    ],
  },
};

export default function Legal({ pageKey }) {
  const { pathname } = useLocation();
  const page = PAGE_CONFIG[pageKey];

  return (
    <main className="legal-page" id="top">
      <Seo
        title={`${page.title} — ${legalFacts.business.commercialName}`}
        description={page.description}
        path={pathname}
      />
      <nav className="legal-return-links" aria-label="Navigation principale">
        <Link to="/">← Retour au portfolio</Link>
        <Link to="/boutique">Aller à la boutique</Link>
      </nav>
      <nav className="legal-page-links" aria-label="Pages légales">
        <Link to={legalFacts.legalRoutes.privacy} aria-current={pageKey === 'privacy' ? 'page' : undefined}>
          Confidentialité
        </Link>
        <Link to={legalFacts.legalRoutes.terms} aria-current={pageKey === 'terms' ? 'page' : undefined}>
          Conditions
        </Link>
        <Link to={legalFacts.legalRoutes.notices} aria-current={pageKey === 'notices' ? 'page' : undefined}>
          Mentions légales
        </Link>
      </nav>
      <div className="legal-layout">
        <aside className="legal-toc-wrap">
          <details className="legal-toc" open>
            <summary>Sommaire de la page</summary>
            <nav aria-label={`Sommaire — ${page.title}`}>
              <ol>
                {page.sections.map((section) => (
                  <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>
                ))}
              </ol>
            </nav>
          </details>
          <a className="legal-back-top" href="#top">Retour en haut ↑</a>
        </aside>

        <article className="legal-document">
          <header className="legal-document-header">
            <p className="legal-eyebrow">{legalFacts.business.commercialName} · Informations</p>
            <h1>{page.title}</h1>
            <p className="legal-updated">
              Dernière mise à jour : {legalFacts.legalMetadata.lastUpdated} · Version{' '}
              {legalFacts.legalMetadata.version}
            </p>
            <section className="legal-essential" aria-labelledby="legal-essential-title">
              <h2 id="legal-essential-title">L’essentiel en 5 points</h2>
              <ol>
                {page.summary.map((item) => <li key={item}>{item}</li>)}
              </ol>
            </section>
          </header>

          <div className="legal-content">
            {page.sections.map((section) => (
              <section className="legal-section" id={section.id} key={section.id}>
                <h2>{section.title}</h2>
                {section.content}
              </section>
            ))}
          </div>
        </article>
      </div>
    </main>
  );
}

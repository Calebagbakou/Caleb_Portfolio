import { Link, useLocation } from 'react-router-dom';

const PRIVACY_SECTIONS = [
  {
    title: 'Informations utilisées',
    paragraphs: [
      'Lors d’une commande ou de la création d’un compte, le site peut traiter le nom, le numéro WhatsApp, l’adresse e-mail, les informations de connexion, le contenu de la commande, son montant, sa référence et son état.',
      'La connexion peut être effectuée par e-mail ou avec un fournisseur de connexion, notamment Google ou Facebook. Le site reçoit les informations de compte nécessaires à cette connexion.',
    ],
  },
  {
    title: 'Paiement et commande',
    paragraphs: [
      'Le paiement est réalisé par un prestataire de paiement. Le site conserve des informations de suivi telles que la référence de commande, le statut du paiement et, lorsqu’elle est renvoyée, une référence de transaction. Les informations effectivement traitées par le prestataire relèvent aussi de ses propres conditions.',
      'Le nom du prestataire et les options disponibles dépendent du parcours de paiement proposé au moment de la commande.',
    ],
  },
  {
    title: 'Messages et avis',
    paragraphs: [
      'Le formulaire de contact du portfolio enregistre le nom, l’adresse e-mail et le contenu du message pour permettre une réponse. Si vous déposez un avis, son nom, son texte et la photo fournie peuvent être conservés et affichés lorsqu’il est publié.',
    ],
  },
  {
    title: 'Utilisation et conservation',
    paragraphs: [
      'Ces informations servent au fonctionnement du compte, au suivi des commandes, à la préparation des accès ou fichiers achetés et à la réponse aux demandes d’assistance. Le panier et certaines informations de commande peuvent également être conservés dans le stockage local du navigateur.',
      'Les durées de conservation applicables sont à préciser : ',
    ],
    placeholder: 'Durées de conservation : [À COMPLÉTER].',
  },
  {
    title: 'Responsable et contact',
    paragraphs: [
      'Identité légale du responsable du site : ',
    ],
    placeholder: 'Identité légale : [À COMPLÉTER]. Adresse e-mail de contact : [À COMPLÉTER].',
  },
];

const TERMS_SECTIONS = [
  {
    title: 'Éditeur et contact',
    paragraphs: ['Identité légale de l’éditeur : '],
    placeholder: 'Identité légale : [À COMPLÉTER]. Adresse e-mail de contact : [À COMPLÉTER].',
  },
  {
    title: 'Commandes et paiements',
    paragraphs: [
      'Les produits, formules et prix sont présentés dans la boutique. Le récapitulatif affiché avant paiement indique les articles choisis et le montant de la commande. La commande est suivie à l’aide d’une référence qui apparaît dans l’espace client.',
      'Le règlement est traité par le prestataire proposé au moment du paiement. Une commande n’est indiquée comme payée qu’après confirmation du paiement.',
    ],
  },
  {
    title: 'Accès aux produits et assistance',
    paragraphs: [
      'Après confirmation du paiement, les accès ou fichiers associés à la commande sont préparés selon les informations affichées sur la fiche du produit et dans l’espace client. Pour une question, vous pouvez contacter Caleb Creative sur WhatsApp en indiquant la référence de commande.',
    ],
  },
  {
    title: 'Informations à compléter',
    paragraphs: [
      'Les informations légales et les modalités qui ne sont pas déterminées par le fonctionnement actuel du site doivent être précisées avant publication définitive.',
    ],
    placeholder: 'Conditions de rétractation, d’annulation, de retour ou de remboursement : [À COMPLÉTER]. Droit applicable et modalités de règlement des litiges : [À COMPLÉTER].',
  },
];

export default function Legal() {
  const { pathname } = useLocation();
  const isPrivacy = pathname === '/confidentialite';
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;

  return (
    <main className="legal-page">
      <nav className="legal-return-links" aria-label="Navigation principale">
        <Link to="/">← Retour au portfolio</Link>
        <Link to="/boutique">Aller à la boutique</Link>
      </nav>
      <div className="eyebrow">CALEB CREATIVE</div>
      <h1>{isPrivacy ? 'Confidentialité' : 'Conditions d’utilisation et de vente'}</h1>
      <p className="legal-updated">Informations à compléter avant publication définitive.</p>
      {sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {section.placeholder && <p className="legal-placeholder">{section.placeholder}</p>}
        </section>
      ))}
    </main>
  );
}

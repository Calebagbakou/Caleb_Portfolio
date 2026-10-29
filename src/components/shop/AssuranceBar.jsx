import { legalFacts } from '../../data/legalFacts';

const icon = (paths) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {paths}
  </svg>
);

export default function AssuranceBar() {
  const items = [
    {
      title: 'Paiement sécurisé',
      desc: 'Vous payez sur la page sécurisée du prestataire de paiement.',
      icon: icon(<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>),
    },
    {
      title: `Garantie ${legalFacts.warranty.refundWindowDays} jours`,
      desc: 'Remboursement possible si le produit ne fonctionne pas.',
      icon: icon(<><path d="M12 3l8 3.5v5.5c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6.5z" /><path d="M9 12l2 2 4-4" /></>),
    },
    {
      title: `Support WhatsApp ${legalFacts.contact.whatsappAvailability}`,
      desc: 'Un échange direct avec le vendeur, avant et après l’achat.',
      icon: icon(<path d="M4 20l1.3-4A8 8 0 1112 20a8 8 0 01-4-1z" />),
    },
    {
      title: 'Prix tout compris',
      desc: `Mobile Money, cartes et crypto selon le pays. ${legalFacts.payment.fees}`,
      icon: icon(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></>),
    },
  ];

  return (
    <section className="assurance-bar" aria-label="Nos garanties">
      {items.map((item) => (
        <div className="assurance-item" key={item.title}>
          <span className="ic">{item.icon}</span>
          <div>
            <div className="t">{item.title}</div>
            <div className="d">{item.desc}</div>
          </div>
        </div>
      ))}
    </section>
  );
}

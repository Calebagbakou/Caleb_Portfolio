export default function ShopFooter() {
  const whatsappMessage = encodeURIComponent('Bonjour, j’ai besoin d’aide concernant la boutique Caleb Creative.');

  return (
    <footer className="shop-footer">
      <div className="wrap shop-footer-row">
        <span>© 2026 Caleb Creative — Boutique</span>
        <a href={`https://wa.me/2290148135395?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer">
          Besoin d’aide ? Écrivez-nous sur WhatsApp →
        </a>
      </div>
    </footer>
  );
}

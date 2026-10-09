import RevealHeading from '../../../components/site/RevealHeading';

export default function TestimonialsSection() {
  return (
    <section className="alt" id="testimonials">
      <div className="wrap">
        <RevealHeading eyebrow="COMMENTAIRES">Ce qu'en disent les visiteurs.</RevealHeading>

        {/* Formulaire volontairement inerte (comme dans l'ancienne version : onsubmit="return false;") —
            aucun back-end de commentaires n'existe encore. */}
        <form className="testimonial-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Nom
            <input type="text" name="nom" placeholder="Votre nom" required />
          </label>
          <label>
            Commentaire
            <textarea name="commentaire" rows={3} placeholder="Partagez votre expérience…" required />
          </label>
          <button type="submit" className="btn btn-ghost" style={{ maxWidth: 160 }}>
            Publier
          </button>
        </form>

        <div className="empty-state">
          <div className="ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M21 15a2 2 0 01-2 2H8l-5 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <p>Aucun commentaire pour le moment. Soyez le premier !</p>
        </div>
      </div>
    </section>
  );
}

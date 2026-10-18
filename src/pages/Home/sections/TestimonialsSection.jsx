import { useRef } from 'react';
import RevealHeading from '../../../components/site/RevealHeading';

export default function TestimonialsSection() {
  const formRef = useRef(null);

  function focusCommentForm() {
    const nameInput = formRef.current?.querySelector('input[name="nom"]');
    nameInput?.focus();
  }

  return (
    <section className="alt" id="testimonials">
      <div className="wrap">
        <RevealHeading eyebrow="COMMENTAIRES">Ce qu'en disent les visiteurs.</RevealHeading>

        {/* Formulaire volontairement inerte (comme dans l'ancienne version : onsubmit="return false;") —
            aucun back-end de commentaires n'existe encore. */}
        <form className="testimonial-form" ref={formRef} onSubmit={(e) => e.preventDefault()}>
          <label>
            Nom
            <input id="testimonial-name" type="text" name="nom" placeholder="Votre nom" required />
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
          <button type="button" className="btn btn-primary empty-state-cta" onClick={focusCommentForm}>
            Soyez le premier à commenter !
          </button>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import { createTestimonial, listPublishedTestimonials } from '../../../services/testimonials';
import RevealHeading from '../../../components/site/RevealHeading';

export default function TestimonialsSection() {
  const formRef = useRef(null);
  const [form, setForm] = useState({ name: '', content: '' });
  const [testimonials, setTestimonials] = useState([]);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    listPublishedTestimonials().then(({ data, error }) => {
      if (error) {
        console.error('Impossible de charger les témoignages :', error);
        return;
      }
      setTestimonials(data || []);
    });
  }, []);

  function focusCommentForm() {
    const nameInput = formRef.current?.querySelector('input[name="nom"]');
    nameInput?.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const name = form.name.trim();
    const content = form.content.trim();
    if (!name || !content) {
      setStatus({ kind: 'error', text: 'Merci de remplir votre nom et votre commentaire.' });
      return;
    }
    setStatus({ kind: 'loading', text: 'Envoi en cours…' });
    const { error } = await createTestimonial({ name, content });
    if (error) {
      console.error('Erreur envoi témoignage :', error);
      setStatus({ kind: 'error', text: 'Impossible d’envoyer le commentaire. Réessayez dans un instant.' });
      return;
    }
    setForm({ name: '', content: '' });
    setStatus({ kind: 'success', text: 'Merci ! Votre commentaire sera publié après modération.' });
  }

  return (
    <section className="alt" id="testimonials">
      <div className="wrap">
        <RevealHeading eyebrow="COMMENTAIRES">Ce qu'en disent les visiteurs.</RevealHeading>

        {testimonials.length > 0 && (
          <div className="testimonials-list">
            {testimonials.map((testimonial) => (
              <article className="testimonial-card" key={testimonial.id}>
                {testimonial.photo_url && <img src={testimonial.photo_url} alt="" width="48" height="48" />}
                <div>
                  <strong>{testimonial.name}</strong>
                  <p>{testimonial.content}</p>
                </div>
              </article>
            ))}
          </div>
        )}
        <form className="testimonial-form" ref={formRef} onSubmit={handleSubmit}>
          <label>
            Nom
            <input id="testimonial-name" type="text" name="nom" placeholder="Votre nom" required value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
          </label>
          <label>
            Commentaire
            <textarea name="commentaire" rows={3} placeholder="Partagez votre expérience…" required value={form.content} onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))} />
          </label>
          {status && <div className={`form-status show ${status.kind}`} role="status" aria-live="polite">{status.text}</div>}
          <button type="submit" className="btn btn-ghost" style={{ maxWidth: 160 }}>
            Publier
          </button>
        </form>

        {testimonials.length === 0 && <div className="empty-state">
          <div className="ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M21 15a2 2 0 01-2 2H8l-5 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <p>Aucun commentaire pour le moment. Soyez le premier !</p>
          <button type="button" className="btn btn-primary empty-state-cta" onClick={focusCommentForm}>
            Soyez le premier à commenter !
          </button>
        </div>}
      </div>
    </section>
  );
}

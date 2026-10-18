import { useState } from 'react';
import { sendContactMessage } from '../../../services/messages';
import RevealHeading from '../../../components/site/RevealHeading';
import SectionIcon from '../../../components/site/SectionIcon';
import { useSectionLogos } from '../../../hooks/useSectionLogos';

const CONTACT_ITEMS = [
  {
    id: 'contact-email',
    href: 'mailto:calebagbakou@gmail.com',
    label: 'EMAIL',
    value: 'calebagbakou@gmail.com',
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" />
      </>
    ),
  },
  {
    id: 'contact-whatsapp',
    href: 'https://wa.me/2290148135395',
    external: true,
    label: 'WHATSAPP',
    value: '+229 01 48 13 53 95',
    icon: <path d="M4 20l1.3-4A8 8 0 1112 20a8 8 0 01-4-1z" />,
  },
  {
    id: 'contact-phone',
    href: 'tel:+22901502597092',
    label: 'TÉLÉPHONE',
    value: '+229 01 50 25 97 92',
    icon: (
      <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.7a2 2 0 01-.5 2.1L8 9.9a16 16 0 006 6l1.4-1.2a2 2 0 012.1-.5c.9.3 1.8.5 2.7.6a2 2 0 011.8 2z" />
    ),
  },
  {
    id: 'contact-location',
    href: 'https://www.google.com/maps/search/Abomey+B%C3%A9nin',
    external: true,
    label: 'LOCALISATION',
    value: 'Abomey – Bénin',
    icon: (
      <>
        <path d="M12 21s7-6.3 7-11.5A7 7 0 105 9.5C5 14.7 12 21 12 21z" />
        <circle cx="12" cy="9.5" r="2.3" />
      </>
    ),
  },
];

const SOCIAL_ITEMS = [
  {
    id: 'social-facebook',
    href: 'https://www.facebook.com/profile.php?id=61580115693070',
    label: 'Facebook — Caleb Agk',
    icon: <path d="M13.2 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2v2.3H7.3V13H10v8h3.2Z" fill="currentColor" stroke="none" />,
  },
  {
    id: 'social-tiktok',
    href: 'https://tiktok.com/@calebagk',
    label: 'TikTok — Caleb Agk',
    icon: <path d="M14 3v11.1a3.3 3.3 0 1 1-2.8-3.3V7.9a6.6 6.6 0 1 0 6 6.5V9.1a8.2 8.2 0 0 0 3.8.9V6.8A4.8 4.8 0 0 1 16.2 3H14Z" fill="currentColor" stroke="none" />,
  },
];

export default function ContactSection() {
  const logos = useSectionLogos();
  const [form, setForm] = useState({ nom: '', email: '', message: '', website: '' });
  const [status, setStatus] = useState(null); // { kind: 'loading'|'success'|'error', text }
  const [submitting, setSubmitting] = useState(false);

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const nom = form.nom.trim();
    const email = form.email.trim();
    const message = form.message.trim();

    if (form.website.trim()) return;
    if (!nom || !email || !message) {
      setStatus({ kind: 'error', text: 'Merci de remplir tous les champs.' });
      return;
    }

    setSubmitting(true);
    setStatus({ kind: 'loading', text: 'Envoi en cours…' });

    const { error } = await sendContactMessage({ name: nom, email, message });

    setSubmitting(false);

    if (error) {
      console.error('Erreur envoi message de contact :', error);
      setStatus({
        kind: 'error',
        text: "L'envoi a échoué. Merci de réessayer, ou de me contacter directement par email ou WhatsApp.",
      });
      return;
    }

    setStatus({ kind: 'success', text: '✓ Message envoyé — je vous répondrai rapidement.' });
    setForm({ nom: '', email: '', message: '', website: '' });
  }

  return (
    <section className="wrap" id="contact">
      <RevealHeading eyebrow="CONTACT">Parlons de votre projet.</RevealHeading>

      <div className="contact-grid">
        {CONTACT_ITEMS.map((item) => (
          <a
            className="contact-item"
            key={item.label}
            href={item.href}
            target={item.external ? '_blank' : undefined}
            rel={item.external ? 'noopener' : undefined}
          >
            <div className="ic">
              <SectionIcon id={item.id} logos={logos} className="section-icon-svg">
                {item.icon}
              </SectionIcon>
            </div>
            <div>
              <div className="label">{item.label}</div>
              <div className="value">{item.value}</div>
            </div>
          </a>
        ))}
      </div>

      <div className="social-row">
        {SOCIAL_ITEMS.map((item) => (
          <a
            key={item.id}
            href={item.href}
            target="_blank"
            rel="noopener"
            aria-label={item.label}
            title={item.label}
          >
            <SectionIcon id={item.id} logos={logos} className="social-icon">
              {item.icon}
            </SectionIcon>
          </a>
        ))}
      </div>

      <form className="contact-form" onSubmit={handleSubmit}>
        <label>
          Nom
          <input
            type="text"
            name="nom"
            placeholder="Votre nom"
            required
            value={form.nom}
            onChange={(e) => updateField('nom', e.target.value)}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            name="email"
            placeholder="vous@exemple.com"
            required
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
          />
        </label>
        <label>
          Message
          <textarea
            name="message"
            rows={4}
            maxLength={1000}
            placeholder="Parlez-moi de votre projet…"
            required
            value={form.message}
            onChange={(e) => updateField('message', e.target.value)}
          />
          <span className="field-counter" aria-live="polite">{form.message.length}/1000</span>
        </label>
        <label className="honeypot" aria-hidden="true">
          Site web
          <input
            type="text"
            name="website"
            tabIndex="-1"
            autoComplete="off"
            value={form.website || ''}
            onChange={(e) => updateField('website', e.target.value)}
          />
        </label>
        {status && <div className={`form-status show ${status.kind}`} role="status" aria-live="polite">{status.text}</div>}
        <button type="submit" className="btn btn-primary" style={{ maxWidth: 260 }} disabled={submitting}>
          Envoyer le message
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </section>
  );
}

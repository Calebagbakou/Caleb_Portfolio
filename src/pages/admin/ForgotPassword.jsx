import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import '../../styles/admin.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + '/admin/reset-password',
    });

    setSubmitting(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSuccess('Un lien de réinitialisation a été envoyé à votre adresse e-mail.');
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-brand-mark">CA</span>
          <span className="login-brand-text">
            Caleb Creative<span>Administration</span>
          </span>
        </div>

        <h1>Mot de passe oublié</h1>
        <p>Entrez votre adresse e-mail pour recevoir le lien de réinitialisation.</p>

        {error && <div className="form-error show">{error}</div>}
        {success && <div>{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email administrateur</label>
            <input
              type="email"
              id="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
            {submitting ? 'Envoi...' : success ? 'Lien envoyé' : 'Envoyer le lien'}
          </button>
        </form>

        <p>
          <Link to="/admin/login">← Retour à la connexion</Link>
        </p>
      </div>
    </div>
  );
}

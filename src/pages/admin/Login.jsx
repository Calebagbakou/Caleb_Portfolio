import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../styles/admin.css';

export default function Login() {
  const { session, isAdmin, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(searchParams.get('denied') ? "Ce compte n'a pas les droits d'administration." : '');
  const [submitting, setSubmitting] = useState(false);

  // Si déjà connecté ET admin, on saute directement le login.
  useEffect(() => {
    if (session && isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [session, isAdmin, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const { error: loginError } = await login(email, password);

    setSubmitting(false);
    if (loginError) {
      setError(loginError);
      return;
    }
    navigate('/admin');
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
        <h1>Connexion</h1>
        <p>Accès réservé à l'administrateur du site.</p>

        {error && <div className="form-error show">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Mot de passe</label>
            <input
              type="password"
              id="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Link to="/admin/forgot-password">Mot de passe oublié ?</Link>
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
            {submitting ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

export default function GeminiPro() {
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const email = searchParams.get('email');

    if (!code || !email) {
      setError('Paramètres invalides. Accès refusé.');
      setLoading(false);
      return;
    }

    async function verifyAndActivate() {
      try {
        setLoading(true);
        const response = await fetch(`/api/gemini-pro/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, email }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Activation échouée');
        }

        const data = await response.json();
        setResult(data);
        setError('');
      } catch (err) {
        console.error('Erreur lors de l\'activation :', err);
        setError(err.message || 'Une erreur s\'est produite.');
        setResult(null);
      } finally {
        setLoading(false);
      }
    }

    verifyAndActivate();
  }, [searchParams]);

  if (loading) {
    return (
      <main style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="state-box">Activation en cours…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="state-box error">
          <h2 style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>Erreur d'activation</h2>
          <p style={{ color: 'var(--ink-dim)', marginBottom: '1.5rem' }}>{error}</p>
          <Link to="/boutique/catalogue" className="btn btn-dark">
            Retour à la boutique
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <div className="confirm-wrap">
        <div className="confirm-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M5 12l5 5L20 7" />
          </svg>
        </div>
        <h1 style={{ fontSize: 'clamp(1.6rem,4vw,2.1rem)', margin: '0 0 8px' }}>Accès Gemini Pro activé</h1>
        <p style={{ color: 'var(--ink-dim)', marginBottom: '1.5rem' }}>
          Bienvenue ! Ton accès Gemini Pro est maintenant actif.
        </p>

        {result?.access_info && (
          <div style={{ background: 'var(--bg-dim)', padding: '1.5rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
            <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--ink-dim)' }}>
              Tes informations d'accès :
            </p>
            {result.access_info.username && (
              <div style={{ marginBottom: '0.75rem', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                <strong>Utilisateur :</strong> {result.access_info.username}
              </div>
            )}
            {result.access_info.password && (
              <div style={{ marginBottom: '0.75rem', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                <strong>Mot de passe :</strong>
                <span style={{ userSelect: 'all', marginLeft: '0.5rem' }}>
                  {result.access_info.password}
                </span>
              </div>
            )}
            {result.access_info.gemini_pro_url && (
              <div style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                <strong>Interface :</strong>
                <br />
                <a href={result.access_info.gemini_pro_url} target="_blank" rel="noopener noreferrer">
                  {result.access_info.gemini_pro_url}
                </a>
              </div>
            )}
          </div>
        )}

        {result?.message && (
          <p style={{ color: 'var(--ink-dim)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            {result.message}
          </p>
        )}

        <div className="shop-hero-cta">
          {result?.access_info?.gemini_pro_url && (
            <a href={result.access_info.gemini_pro_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              Accéder à Gemini Pro
            </a>
          )}
          <Link to="/boutique/catalogue" className="btn btn-outline">
            Retour à la boutique
          </Link>
        </div>
      </div>
    </main>
  );
}

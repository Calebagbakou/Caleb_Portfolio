import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div style={{ textAlign: 'center', padding: '120px 24px', fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: 12 }}>404</h1>
      <p style={{ marginBottom: 24, color: '#8a8f98' }}>Cette page n'existe pas.</p>
      <Link to="/" style={{ color: 'inherit', textDecoration: 'underline' }}>
        ← Retour à l'accueil
      </Link>
    </div>
  );
}

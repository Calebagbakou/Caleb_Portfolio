import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="not-found-page">
      <h1>404</h1>
      <p>Cette page n'existe pas.</p>
      <Link to="/">
        ← Retour à l'accueil
      </Link>
    </main>
  );
}

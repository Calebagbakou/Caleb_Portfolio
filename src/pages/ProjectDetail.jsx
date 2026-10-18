import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPublishedProjectBySlug } from '../services/projects';
import { getProjectThumbnailUrl } from '../data/projectMedia';
import Seo from '../components/site/Seo';

export default function ProjectDetail() {
  const { slug } = useParams();
  const [project, setProject] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    getPublishedProjectBySlug(slug).then(({ data, error }) => {
      if (error) {
        console.error('Impossible de charger l’étude de cas :', error);
        setStatus('error');
        return;
      }
      setProject(data);
      setStatus(data ? 'ready' : 'missing');
    });
  }, [slug]);

  if (status === 'loading') return <main className="project-detail wrap">Chargement du projet…</main>;
  if (!project) {
    return (
      <main className="project-detail wrap">
        <h1>Projet introuvable</h1>
        <Link className="btn btn-primary" to="/">Retour au portfolio</Link>
      </main>
    );
  }

  const image = getProjectThumbnailUrl(project);
  return (
    <main className="project-detail wrap">
      <Seo title={`${project.title} — Caleb Creative`} description={project.description || `Étude de cas ${project.title}.`} path={`/projet/${project.slug}`} />
      <Link className="project-back" to="/#portfolio">← Retour au portfolio</Link>
      <span className="sec-eyebrow">{project.category}</span>
      <h1>{project.title}</h1>
      <div className="project-detail-grid">
        <div className="project-detail-media">
          {image && <img src={image} alt={`Réalisation ${project.title}`} />}
        </div>
        <div className="project-detail-copy">
          <h2>Étude de cas</h2>
          <p>{project.description || 'Une réalisation conçue pour répondre à un brief créatif précis.'}</p>
          <dl>
            <dt>Outils / format</dt>
            <dd>{project.media_type === 'image' ? 'Direction artistique, image IA' : 'Production vidéo et post-production'}</dd>
            <dt>Résultat</dt>
            <dd>Un rendu visuel prêt à être partagé et utilisé dans votre communication.</dd>
          </dl>
          <button className="btn btn-primary" type="button" onClick={() => navigator.clipboard?.writeText(window.location.href)}>
            Copier le lien du projet
          </button>
        </div>
      </div>
    </main>
  );
}

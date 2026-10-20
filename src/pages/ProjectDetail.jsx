import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPublishedProjectBySlug } from '../services/projects';
import { getProjectThumbnailUrl } from '../data/projectMedia';
import Seo from '../components/site/Seo';
import { LoadingFeedback, ProjectDetailSkeleton } from '../components/site/LoadingStates';
import { useSlowLoading } from '../hooks/useSlowLoading';
import SmartImage from '../components/site/SmartImage';

export default function ProjectDetail() {
  const { slug } = useParams();
  const [project, setProject] = useState(null);
  const [status, setStatus] = useState('loading');
  const [retryCount, setRetryCount] = useState(0);
  const slowLoading = useSlowLoading(status === 'loading');

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 21000);
    let active = true;
    setProject(null);
    setStatus('loading');
    getPublishedProjectBySlug(slug, { signal: controller.signal }).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error('Impossible de charger l’étude de cas :', error);
        setStatus('error');
        return;
      }
      setProject(data);
      setStatus(data ? 'ready' : 'missing');
    }).catch((error) => {
      if (!active) return;
      console.error('Erreur inattendue pendant le chargement de l’étude de cas :', error);
      setStatus('error');
    });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [slug, retryCount]);

  if (status === 'loading' && slowLoading.phase === 'error') return <main className="wrap"><LoadingFeedback phase="error" onRetry={() => setRetryCount((count) => count + 1)} /></main>;
  if (status === 'loading' && slowLoading.showLoader) return <ProjectDetailSkeleton />;
  if (status === 'loading') return null;
  if (!project) {
    return (
      <main className="project-detail wrap">
        <h1>{status === 'error' ? 'Projet momentanément indisponible' : 'Projet introuvable'}</h1>
        {status === 'error' && <LoadingFeedback phase={slowLoading.phase === 'error' ? 'error' : 'slow'} onRetry={() => setRetryCount((count) => count + 1)} />}
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
          {image && <SmartImage src={image} alt={`Réalisation ${project.title}`} aspectRatio={project.image_ratio || '4/3'} sizes="(max-width: 700px) 90vw, 55vw" />}
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

import { useEffect, useState } from 'react';
import { createProject, deleteProject, listProjects, updateProject } from '../../services/projects';
import {
  extractYouTubeVideoId,
  getBaseProjectCategory,
  getProjectCategoryForVideo,
  getProjectThumbnailUrl,
  getVideoOrientationFromCategory,
  getVideoOrientationFromDimensions,
  getYouTubeShortOrientation,
  isAIVideoCategory,
  normalizeYouTubeUrl,
} from '../../data/projectMedia';

const EMPTY_FORM = {
  title: '',
  description: '',
  category: '',
  media_type: 'youtube',
  video_orientation: '',
  media_url: '',
  thumbnail_url: '',
  published: false,
  autoplay_preview: true,
};

const MEDIA_TYPES = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'image', label: 'Image' },
  { value: 'external_video', label: 'Vidéo externe' },
];

function validHttpUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function mediaFieldLabel(type) {
  if (type === 'youtube') return 'URL YouTube';
  if (type === 'image') return "Lien direct vers l'image";
  return 'Lien vidéo MP4/WebM, Vimeo ou Wistia';
}

function mediaFieldHint(type) {
  if (type === 'youtube') {
    return 'Liens YouTube watch, youtu.be et Shorts. Utilise ce type pour YouTube, pas « Vidéo externe ».';
  }
  if (type === 'image') {
    return 'Colle le lien direct et public du fichier image (par ex. .jpg, .png, .webp). Les pages de partage/galerie ne sont pas des liens image.';
  }
  return 'Colle un lien direct vers un fichier MP4/WebM, une URL de partage Wistia (/s/…) ou une URL Vimeo. Le site convertit les liens de partage Wistia en lecteur officiel. Les pages Google Drive, réseaux sociaux et autres pages web ne sont pas des fichiers vidéo.';
}

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formatCheck, setFormatCheck] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadProjects() {
    setLoading(true);
    try {
      const { data, error: loadError } = await listProjects();
      if (loadError) {
        console.error('Impossible de charger les projets Supabase :', loadError);
        setError(`Chargement impossible : ${loadError.message}. Vérifie que la migration projects a été exécutée et que les politiques RLS sont actives.`);
      } else {
        setProjects(data || []);
        setError('');
      }
    } catch (loadError) {
      console.error('Échec inattendu du chargement des projets :', loadError);
      setError(`Chargement impossible : ${loadError instanceof Error ? loadError.message : String(loadError)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (form.media_type === 'image' || !isAIVideoCategory(form.category) || !form.media_url.trim()) {
      setFormatCheck('');
      return undefined;
    }

    const mediaUrl = form.media_url.trim();
    if (!validHttpUrl(mediaUrl)) {
      setFormatCheck('Saisis une URL valide pour vérifier le format.');
      return undefined;
    }

    if (form.media_type === 'youtube') {
      const orientation = getYouTubeShortOrientation(mediaUrl);
      if (orientation) {
        setForm((current) => ({ ...current, video_orientation: orientation }));
        setFormatCheck('Format vertical détecté automatiquement.');
      } else {
        setFormatCheck('Vérifie la vidéo puis choisis son format ci-dessous.');
      }
      return undefined;
    }

    let mediaPath;
    try {
      mediaPath = new URL(mediaUrl).pathname.toLowerCase();
    } catch (error) {
      console.warn('Impossible de lire le chemin du média pour vérifier son format :', error);
      setFormatCheck('Vérifie la vidéo puis choisis son format ci-dessous.');
      return undefined;
    }

    if (!/\.(mp4|webm|ogv|mov|m4v)$/.test(mediaPath)) {
      setFormatCheck('Ce lecteur ne permet pas de détecter automatiquement le format. Vérifie la vidéo puis choisis son format.');
      return undefined;
    }

    let active = true;
    const video = document.createElement('video');
    const timeoutId = window.setTimeout(() => {
      if (active) setFormatCheck('Détection indisponible. Vérifie la vidéo puis choisis son format.');
    }, 10000);
    const finish = (orientation) => {
      if (!active) return;
      window.clearTimeout(timeoutId);
      if (orientation) {
        setForm((current) => ({ ...current, video_orientation: orientation }));
        setFormatCheck(`Format ${orientation === 'portrait' ? 'vertical' : 'horizontal'} détecté automatiquement.`);
      } else {
        setFormatCheck('Dimensions indisponibles. Vérifie la vidéo puis choisis son format.');
      }
    };
    video.preload = 'metadata';
    video.onloadedmetadata = () => finish(getVideoOrientationFromDimensions(video.videoWidth, video.videoHeight));
    video.onerror = () => finish(null);
    setFormatCheck('Vérification du format de la vidéo…');
    video.src = mediaUrl;

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      video.removeAttribute('src');
      video.load();
    };
  }, [form.category, form.media_type, form.media_url]);

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    setError('');
    setNotice('');
  }

  function beginEdit(project) {
    setEditingId(project.id);
    setForm({
      title: project.title || '',
      description: project.description || '',
      category: isAIVideoCategory(getBaseProjectCategory(project.category)) ? 'Vidéos IA' : getBaseProjectCategory(project.category) || '',
      media_type: project.media_type || 'image',
      video_orientation: getVideoOrientationFromCategory(project.category) || '',
      media_url: project.media_url || '',
      thumbnail_url: project.thumbnail_url || '',
      published: Boolean(project.published),
      autoplay_preview: Boolean(project.autoplay_preview),
    });
    setError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormatCheck('');
    setError('');
    setNotice('');
  }

  function prepareProject() {
    const title = form.title.trim();
    const baseCategory = form.category.trim();
    const category = form.media_type !== 'image' && isAIVideoCategory(baseCategory)
      ? getProjectCategoryForVideo(baseCategory, form.video_orientation)
      : baseCategory;
    const mediaUrl = form.media_url.trim();
    const thumbnailUrl = form.thumbnail_url.trim();

    if (!title || !category || !mediaUrl) {
      return { error: 'Le titre, la catégorie et le média sont obligatoires.' };
    }

    if (form.media_type !== 'image' && isAIVideoCategory(category)
      && !['portrait', 'landscape'].includes(form.video_orientation)) {
      return { error: 'Vérifie le format de la vidéo IA puis sélectionne Portrait ou Paysage.' };
    }

    let normalizedMediaUrl = mediaUrl;
    if (form.media_type === 'youtube') {
      normalizedMediaUrl = normalizeYouTubeUrl(mediaUrl);
      if (!normalizedMediaUrl) {
        return { error: 'Colle une URL YouTube valide (youtube.com, youtu.be ou Shorts).' };
      }
    } else if (!validHttpUrl(mediaUrl)) {
      return { error: 'Le média doit être une URL complète commençant par https:// ou http://.' };
    }

    if (thumbnailUrl && !validHttpUrl(thumbnailUrl)) {
      return { error: 'La miniature doit être une URL complète commençant par https:// ou http://.' };
    }

    if (form.media_type === 'image' && thumbnailUrl && !validHttpUrl(thumbnailUrl)) {
      return { error: "L'URL de miniature n'est pas valide." };
    }

    if (form.media_type === 'youtube' && !extractYouTubeVideoId(normalizedMediaUrl)) {
      return { error: "L'identifiant YouTube n'a pas pu être reconnu." };
    }

    return {
      project: {
        title,
        description: form.description.trim(),
        category,
        media_type: form.media_type,
        media_url: normalizedMediaUrl,
        thumbnail_url: thumbnailUrl || null,
        published: form.published,
        autoplay_preview: form.media_type !== 'image' && form.autoplay_preview,
      },
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const prepared = prepareProject();
    if (prepared.error) {
      setError(prepared.error);
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    let result;
    try {
      result = editingId
        ? await updateProject(editingId, prepared.project)
        : await createProject(prepared.project);
    } catch (saveError) {
      console.error('Échec inattendu de l’enregistrement du projet :', saveError);
      setError(`Enregistrement impossible : ${saveError instanceof Error ? saveError.message : String(saveError)}`);
      setSaving(false);
      return;
    }
    setSaving(false);

    if (result.error) {
      console.error('Impossible d’enregistrer le projet :', result.error);
      setError(`Enregistrement impossible : ${result.error.message}`);
      return;
    }

    resetForm();
    setNotice(editingId ? 'Projet modifié.' : 'Projet ajouté.');
    await loadProjects();
  }

  async function togglePublished(project) {
    setError('');
    setNotice('');
    let updateError;
    try {
      ({ error: updateError } = await updateProject(project.id, { published: !project.published }));
    } catch (updateError) {
      console.error('Échec inattendu de la modification de publication :', updateError);
      setError(`Publication impossible : ${updateError instanceof Error ? updateError.message : String(updateError)}`);
      return;
    }
    if (updateError) {
      console.error('Impossible de modifier la publication :', updateError);
      setError(`Publication impossible : ${updateError.message}`);
      return;
    }
    setProjects((current) => current.map((item) => (
      item.id === project.id ? { ...item, published: !project.published } : item
    )));
  }

  async function removeProject(project) {
    if (!window.confirm(`Supprimer « ${project.title} » ? Cette action est définitive.`)) return;
    setError('');
    setNotice('');
    let deleteError;
    try {
      ({ error: deleteError } = await deleteProject(project.id));
    } catch (deleteError) {
      console.error('Échec inattendu de la suppression du projet :', deleteError);
      setError(`Suppression impossible : ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`);
      return;
    }
    if (deleteError) {
      console.error('Impossible de supprimer le projet :', deleteError);
      setError(`Suppression impossible : ${deleteError.message}`);
      return;
    }
    setProjects((current) => current.filter((item) => item.id !== project.id));
    if (editingId === project.id) resetForm();
    setNotice('Projet supprimé.');
  }

  const mediaLabel = (type) => MEDIA_TYPES.find((item) => item.value === type)?.label || 'Média';
  const projectCategoryLabel = (category) => {
    if (!isAIVideoCategory(getBaseProjectCategory(category))) return category;
    const orientation = getVideoOrientationFromCategory(category);
    if (!orientation) return 'Vidéos IA · À classer';
    return `Vidéos IA · ${orientation === 'portrait' ? 'Portrait' : 'Paysage'}`;
  };

  return (
    <div className="projects-admin">
      <section className="panel">
        <div className="projects-heading">
          <div>
            <h2>{editingId ? 'Modifier le projet' : 'Ajouter un projet'}</h2>
            <p>Les vidéos YouTube sont intégrées directement, sans téléversement de fichier vidéo.</p>
          </div>
          <span className="badge badge-read">{projects.length} projet{projects.length === 1 ? '' : 's'}</span>
        </div>

        {error && <div className="projects-message error" role="alert">{error}</div>}
        {notice && <div className="projects-message" role="status">{notice}</div>}

        <form className="project-form" onSubmit={handleSubmit}>
          <div className="project-form-grid">
            <div className="form-group">
              <label htmlFor="project-title">Titre</label>
              <input id="project-title" name="title" value={form.title} onChange={updateField} required maxLength={160} />
            </div>
            <div className="form-group">
              <label htmlFor="project-category">Catégorie</label>
              <input id="project-category" name="category" value={form.category} onChange={updateField} required maxLength={80} placeholder="Ex. Vidéos IA" />
            </div>
            <div className="form-group">
              <label htmlFor="project-media-type">Type de média</label>
              <select id="project-media-type" name="media_type" value={form.media_type} onChange={updateField}>
                {MEDIA_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="project-media-url">{mediaFieldLabel(form.media_type)}</label>
              <input
                id="project-media-url"
                name="media_url"
                type="url"
                value={form.media_url}
                onChange={updateField}
                required
                placeholder={form.media_type === 'youtube' ? 'https://www.youtube.com/watch?v=…' : 'https://…'}
              />
              {form.media_type === 'youtube' && form.media_url && (
                <small className="project-form-hint">
                  {extractYouTubeVideoId(form.media_url)
                    ? `Identifiant détecté : ${extractYouTubeVideoId(form.media_url)}`
                    : 'Colle une URL YouTube valide pour détecter automatiquement la vidéo.'}
                </small>
              )}
              {form.media_type !== 'youtube' && (
                <small className="project-form-hint">{mediaFieldHint(form.media_type)}</small>
              )}
            </div>
            {form.media_type !== 'image' && isAIVideoCategory(form.category) && (
              <div className="form-group project-form-wide">
                <label htmlFor="project-video-orientation">Format de la vidéo IA</label>
                <select
                  id="project-video-orientation"
                  name="video_orientation"
                  value={form.video_orientation}
                  onChange={updateField}
                  required
                >
                  <option value="" disabled>Vérifier puis choisir le format</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Paysage</option>
                </select>
                {formatCheck && <small className="project-form-hint" role="status">{formatCheck}</small>}
              </div>
            )}
            <div className="form-group project-form-wide">
              <label htmlFor="project-description">Description</label>
              <textarea id="project-description" name="description" value={form.description} onChange={updateField} rows="4" maxLength={2000} />
            </div>
            <div className="form-group project-form-wide">
              <label htmlFor="project-thumbnail">
                URL de la miniature (facultative)
              </label>
              <input
                id="project-thumbnail"
                name="thumbnail_url"
                type="url"
                value={form.thumbnail_url}
                onChange={updateField}
                placeholder="https://…"
              />
              <small className="project-form-hint">
                {form.media_type === 'image'
                  ? "L’image du projet sert de miniature si tu ne fournis pas de lien séparé."
                  : form.media_type === 'youtube'
                    ? 'YouTube fournit automatiquement la miniature si tu ne fournis pas de lien séparé.'
                    : 'Tu peux ajouter un lien direct vers une image si tu veux choisir une miniature. Sinon, le site utilisera l’aperçu vidéo automatique lorsque cette option est activée.'}
                {' '}Aucun fichier vidéo n’est stocké dans Supabase.
              </small>
              {getProjectThumbnailUrl(form) && (
                <div className="project-thumbnail-preview">
                  <img src={getProjectThumbnailUrl(form)} alt="Aperçu de la miniature" />
                  <span>Aperçu de la miniature</span>
                </div>
              )}
            </div>
          </div>

          <label className="project-publish">
            <input type="checkbox" name="published" checked={form.published} onChange={updateField} />
            <span>Publier sur le portfolio</span>
          </label>
          {form.media_type !== 'image' && (
            <label className="project-publish project-preview-setting">
              <input
                type="checkbox"
                name="autoplay_preview"
                checked={form.autoplay_preview}
                onChange={updateField}
              />
              <span>
                Prévisualisation automatique silencieuse
                <small>Lecture muette limitée à 8 secondes quand cette carte apparaît à l’écran. Une seule vidéo à la fois. L’icône de son reste visible.</small>
              </span>
            </label>
          )}
          <div className="row-actions project-form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Enregistrement…' : editingId ? 'Enregistrer les modifications' : 'Ajouter le projet'}
            </button>
            {editingId && <button className="btn btn-secondary" type="button" onClick={resetForm}>Annuler</button>}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="projects-heading">
          <div>
            <h2>Projets existants</h2>
            <p>Les projets non publiés restent visibles ici, mais pas sur le site public.</p>
          </div>
          <button className="btn btn-secondary btn-sm" type="button" onClick={loadProjects} disabled={loading}>
            Actualiser
          </button>
        </div>

        {loading && <div className="state-box">Chargement des projets…</div>}
        {!loading && !error && projects.length === 0 && <div className="state-box">Aucun projet pour le moment.</div>}

        {!loading && projects.length > 0 && (
          <div className="project-admin-list">
            {projects.map((project) => (
              <article className="project-admin-card" key={project.id}>
                <div className={`project-admin-thumb${project.media_type !== 'image' ? ` video video-${getVideoOrientationFromCategory(project.category) || 'landscape'}` : ''}`}>
                  {getProjectThumbnailUrl(project)
                    ? <img src={getProjectThumbnailUrl(project)} alt="" loading="lazy" />
                    : <span>{mediaLabel(project.media_type)} · miniature manquante</span>}
                </div>
                <div className="project-admin-info">
                  <div className="project-admin-meta">
                    <span className={`badge ${project.published ? 'badge-ok' : 'badge-off'}`}>
                      {project.published ? 'Publié' : 'Brouillon'}
                    </span>
                    {project.media_type !== 'image' && project.autoplay_preview && (
                      <span className="badge badge-unread">Aperçu auto activé</span>
                    )}
                    <span className="project-admin-category">{projectCategoryLabel(project.category)}</span>
                    <span className="project-admin-category">{mediaLabel(project.media_type)}</span>
                  </div>
                  <h3>{project.title}</h3>
                  <p>{project.description || 'Aucune description.'}</p>
                </div>
                <div className="row-actions project-admin-actions">
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => beginEdit(project)}>Modifier</button>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => togglePublished(project)}>
                    {project.published ? 'Dépublier' : 'Publier'}
                  </button>
                  <button className="btn btn-danger btn-sm" type="button" onClick={() => removeProject(project)}>Supprimer</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

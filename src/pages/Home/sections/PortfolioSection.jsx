import { useEffect, useMemo, useState } from 'react';
import { PORTFOLIO_ROWS } from '../../../data/portfolio';
import { getYouTubeEmbedUrl, extractYouTubeVideoId } from '../../../data/projectMedia';
import { listPublishedProjects } from '../../../services/projects';
import { useReveal } from '../../../hooks/useReveal';
import { useTilt } from '../../../hooks/useTilt';
import { useDragScroll } from '../../../hooks/useDragScroll';
import Lightbox from '../../../components/site/Lightbox';

const LEGACY_ITEMS = PORTFOLIO_ROWS.flatMap((row) => row.items.map((item) => ({
  id: `legacy-${item.cat}-${item.title}`,
  title: item.title,
  description: '',
  category: item.cat,
  media_type: item.video ? 'external_video' : 'image',
  media_url: item.video || null,
  thumbnail_url: null,
  published: true,
  ...item,
})));
const LEGACY_DECORATIONS = new Map(LEGACY_ITEMS.map((item) => [item.title.trim().toLowerCase(), item]));
const CATEGORY_LABELS = {
  images: 'Images IA',
  videos: 'Vidéos IA',
  motion: 'Motion Design',
  pub: 'Publicités',
  logos: 'Logos',
  affiches: 'Affiches',
  retouches: 'Retouches photo',
};

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

function prepareProject(project) {
  const legacy = LEGACY_DECORATIONS.get((project.title || '').trim().toLowerCase());
  const videoId = project.media_type === 'youtube' ? extractYouTubeVideoId(project.media_url) : null;
  return {
    ...legacy,
    ...project,
    cat: project.category,
    catLabel: categoryLabel(project.category).toUpperCase(),
    gradient: legacy?.gradient || 'linear-gradient(135deg,#1F3350,#4ADE80)',
    thumbLabel: legacy?.thumbLabel || categoryLabel(project.category).toUpperCase(),
    youtubeId: videoId,
    youtubeEmbed: videoId ? getYouTubeEmbedUrl(project.media_url) : null,
    youtubeThumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null,
  };
}

function groupProjects(projects) {
  const categories = new Map();
  projects.forEach((project) => {
    const category = project.category || 'Autres';
    if (!categories.has(category)) categories.set(category, []);
    categories.get(category).push(project);
  });

  return Array.from(categories, ([category, items]) => ({
    id: `row-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title: categoryLabel(category),
    count: `${items.length} réalisation${items.length === 1 ? '' : 's'}`,
    items,
  }));
}

function PortfolioCard({ item, globalIndex, onOpen }) {
  const [revealRef, visible] = useReveal();
  const tiltRef = useTilt();
  const image = item.thumbnail_url || item.youtubeThumbnail || (item.media_type === 'image' ? item.media_url : null);

  function mergeRefs(el) {
    revealRef.current = el;
    tiltRef.current = el;
  }

  return (
    <button
      type="button"
      className={`p-card reveal${visible ? ' in' : ''}`}
      ref={mergeRefs}
      onClick={() => onOpen(globalIndex)}
      aria-label={`Ouvrir le projet ${item.title}`}
    >
      <span className="p-expand" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
        </svg>
      </span>
      <div className="p-thumb" style={{ background: item.gradient }}>
        {image
          ? <img src={image} alt="" loading="lazy" />
          : <span>{item.thumbLabel}</span>}
        {(item.media_type === 'youtube' || item.media_type === 'external_video') && (
          <span className="p-play" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        )}
      </div>
      <div className="p-body">
        <div className="p-cat">{item.catLabel}</div>
        <h3 className="p-title">{item.title}</h3>
      </div>
    </button>
  );
}

function PortfolioRow({ row, indexOffset, onOpen }) {
  const dragRef = useDragScroll();
  return (
    <div className="p-row" id={row.id}>
      <div className="p-row-head">
        <h3>{row.title}</h3>
        <span className="p-row-count">{row.count}</span>
      </div>
      <div className="p-row-scroll" ref={dragRef}>
        {row.items.map((item, i) => (
          <PortfolioCard item={item} globalIndex={indexOffset + i} onOpen={onOpen} key={item.id || item.title} />
        ))}
      </div>
    </div>
  );
}

export default function PortfolioSection() {
  const [projects, setProjects] = useState(LEGACY_ITEMS);
  const [activeFilter, setActiveFilter] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    let active = true;
    async function loadPublishedProjects() {
      try {
        const { data, error } = await listPublishedProjects();
        if (!active) return;
        if (error) {
          console.error('Le portfolio Supabase est indisponible ; affichage des projets historiques :', error);
          setProjects(LEGACY_ITEMS);
          return;
        }
        setProjects((data || []).map(prepareProject));
      } catch (error) {
        if (!active) return;
        console.error('Échec inattendu du chargement Supabase ; affichage des projets historiques :', error);
        setProjects(LEGACY_ITEMS);
      }
    }
    loadPublishedProjects();
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(() => groupProjects(projects), [projects]);
  const flatItems = useMemo(() => rows.flatMap((row) => row.items), [rows]);
  const offsets = useMemo(() => {
    const result = {};
    let running = 0;
    rows.forEach((row) => {
      result[row.id] = running;
      running += row.items.length;
    });
    return result;
  }, [rows]);

  function handleFilterClick(target) {
    setActiveFilter(target);
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openLightbox(index) {
    if (flatItems.length) setLightboxIndex((index + flatItems.length) % flatItems.length);
  }

  function navigateLightbox(index) {
    setLightboxIndex((index + flatItems.length) % flatItems.length);
  }

  return (
    <section className="wrap" id="portfolio">
      <div className="sec-head">
        <div className="sec-eyebrow">PORTFOLIO</div>
        <h2 className="sec-title">Quelques réalisations récentes.</h2>
      </div>

      {rows.length > 0 && (
        <div className="filters">
          {rows.map((row) => (
            <button
              key={row.id}
              className={`filter-btn${activeFilter === row.id ? ' active' : ''}`}
              onClick={() => handleFilterClick(row.id)}
            >
              {row.title}
            </button>
          ))}
        </div>
      )}

      {rows.length > 0
        ? <div className="portfolio-rows" id="grid">
          {rows.map((row) => (
            <PortfolioRow row={row} indexOffset={offsets[row.id]} onOpen={openLightbox} key={row.id} />
          ))}
        </div>
        : <p className="portfolio-empty">Les prochaines réalisations arrivent bientôt.</p>}

      <Lightbox
        items={flatItems}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={navigateLightbox}
      />
    </section>
  );
}

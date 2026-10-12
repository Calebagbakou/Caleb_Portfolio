export const SERVICES_SETTING_KEY = 'site_services';

export const SERVICE_ICONS = [
  { value: 'sparkles', label: 'Créativité' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Vidéo' },
  { value: 'motion', label: 'Mouvement' },
  { value: 'edit', label: 'Montage / retouche' },
  { value: 'poster', label: 'Affiche' },
  { value: 'logo', label: 'Identité visuelle' },
  { value: 'prompt', label: 'Prompt' },
];

export const DEFAULT_SERVICES = [
  {
    id: 'service-content-ai',
    title: 'Création de contenu IA',
    desc: 'Concepts visuels générés et affinés pour vos campagnes, du brief au rendu final.',
    icon: 'sparkles',
  },
  {
    id: 'service-images-ai',
    title: 'Création d’images IA',
    desc: 'Visuels originaux générés par IA, dirigés et retravaillés pour un rendu fidèle à votre marque.',
    icon: 'image',
  },
  {
    id: 'service-videos-ai',
    title: 'Création de vidéos IA',
    desc: 'Séquences vidéo générées par IA pour des teasers, publicités et contenus courts.',
    icon: 'video',
  },
  {
    id: 'service-motion-design',
    title: 'Motion Design',
    desc: 'Animations et transitions qui donnent du mouvement à vos logos, titres et interfaces.',
    icon: 'motion',
  },
  {
    id: 'service-video-editing',
    title: 'Montage vidéo professionnel',
    desc: 'Montage, étalonnage et rythme pour transformer vos rushes en récit clair.',
    icon: 'edit',
  },
  {
    id: 'service-posters',
    title: 'Création d’affiches',
    desc: 'Affiches et supports imprimés pensés pour capter l’attention en un coup d’œil.',
    icon: 'poster',
  },
  {
    id: 'service-logos',
    title: 'Création de logos',
    desc: 'Identités visuelles simples et mémorables, pensées pour durer.',
    icon: 'logo',
  },
  {
    id: 'service-photo-retouch',
    title: 'Retouche photo IA',
    desc: 'Correction, nettoyage et sublimation de portraits et photos produit.',
    icon: 'edit',
  },
  {
    id: 'service-prompt-engineering',
    title: 'Prompt Engineering',
    desc: 'Conception de prompts optimisés pour exploiter tout le potentiel des IA créatives.',
    icon: 'prompt',
  },
  {
    id: 'service-creative-consulting',
    title: 'Conseil en solutions créatives IA',
    desc: 'Accompagnement sur mesure pour choisir et exploiter les bons outils créatifs.',
    icon: 'sparkles',
  },
];

const VALID_ICONS = new Set(SERVICE_ICONS.map(({ value }) => value));

export function parseServices(value) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) {
    throw new Error('La liste des services enregistrée est invalide.');
  }

  return parsed.map((service) => {
    if (
      !service
      || typeof service !== 'object'
      || typeof service.id !== 'string'
      || !service.id
      || typeof service.title !== 'string'
      || !service.title.trim()
      || service.title.trim().length > 80
      || typeof service.desc !== 'string'
      || !service.desc.trim()
      || service.desc.trim().length > 240
      || !VALID_ICONS.has(service.icon)
    ) {
      throw new Error('Chaque service doit avoir un titre, une description et une icône valides.');
    }
    return {
      id: service.id,
      title: service.title.trim(),
      desc: service.desc.trim(),
      icon: service.icon,
    };
  });
}

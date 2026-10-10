export const SECTION_ICON_GROUPS = [
  {
    section: 'Services',
    items: [
      { id: 'service-content-ai', label: 'Création de contenu IA' },
      { id: 'service-images-ai', label: 'Création d’images IA' },
      { id: 'service-videos-ai', label: 'Création de vidéos IA' },
      { id: 'service-motion-design', label: 'Motion Design' },
      { id: 'service-video-editing', label: 'Montage vidéo professionnel' },
      { id: 'service-posters', label: 'Création d’affiches' },
      { id: 'service-logos', label: 'Création de logos' },
      { id: 'service-photo-retouch', label: 'Retouche photo IA' },
      { id: 'service-prompt-engineering', label: 'Prompt Engineering' },
    ],
  },
  {
    section: 'À propos',
    items: [
      { id: 'about-mission', label: 'Notre mission' },
      { id: 'about-audience', label: 'Qui j’accompagne' },
      { id: 'about-individuals', label: 'Particuliers' },
      { id: 'about-businesses', label: 'Entreprises' },
      { id: 'about-organizations', label: 'Organisations' },
    ],
  },
  {
    section: 'Contact',
    items: [
      { id: 'contact-email', label: 'Email' },
      { id: 'contact-whatsapp', label: 'WhatsApp' },
      { id: 'contact-phone', label: 'Téléphone' },
      { id: 'contact-phone-alt', label: 'Téléphone (alt.)' },
      { id: 'contact-location', label: 'Localisation' },
    ],
  },
];

export const SECTION_LOGOS_SETTING = 'site_section_logos';

const SECTION_ICON_IDS = new Set(SECTION_ICON_GROUPS.flatMap((group) => group.items.map((item) => item.id)));

export function parseSectionLogoSettings(value) {
  if (!value) return {};
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Les logos de sections doivent être enregistrés dans un objet JSON.');
  }

  return Object.fromEntries(Object.entries(parsed).flatMap(([id, logo]) => {
    if (!SECTION_ICON_IDS.has(id)) return [];
    if (
      !logo
      || typeof logo !== 'object'
      || Array.isArray(logo)
      || typeof logo.url !== 'string'
      || !['default', 'custom'].includes(logo.mode)
    ) {
      throw new Error(`Le réglage du logo « ${id} » est invalide.`);
    }
    return [[id, { url: logo.url, mode: logo.mode }]];
  }));
}

/* =========================================================================
   PORTFOLIO — CALEB CREATIVE
   -------------------------------------------------------------------------
   Port direct des cartes codées en dur dans l'ancien index.html. Reste
   statique pour l'instant : l'écran admin "Projets" n'existe pas encore
   (identique à avant la migration). Structurer ces données ici (plutôt que
   directement dans le JSX) rend le futur branchement à Supabase plus simple
   le jour où cet écran sera construit.
   ========================================================================= */

export const PORTFOLIO_FILTERS = [
  { target: 'row-images', label: 'Images IA' },
  { target: 'row-videos', label: 'Vidéos IA' },
  { target: 'row-motion', label: 'Motion Design' },
  { target: 'row-pub', label: 'Publicités' },
  { target: 'row-logos', label: 'Logos' },
  { target: 'row-affiches', label: 'Affiches' },
  { target: 'row-retouches', label: 'Retouches photo' },
];

export const PORTFOLIO_ROWS = [
  {
    id: 'row-images',
    title: 'Images IA',
    count: '3 réalisations',
    items: [
      { cat: 'images', catLabel: 'IMAGES IA', title: 'Campagne Aurora', gradient: 'linear-gradient(135deg,#1F3350,#4ADE80)', thumbLabel: 'IMAGES IA' },
      { cat: 'images', catLabel: 'IMAGES IA', title: 'Portraits studio', gradient: 'linear-gradient(135deg,#4ADE80,#16283F)', thumbLabel: 'IMAGES IA' },
      { cat: 'images', catLabel: 'IMAGES IA', title: 'Visuels produit', gradient: 'linear-gradient(135deg,#166534,#24405F)', thumbLabel: 'IMAGES IA' },
    ],
  },
  {
    id: 'row-videos',
    title: 'Vidéos IA',
    count: '3 réalisations',
    items: [
      {
        cat: 'videos',
        catLabel: 'VIDÉOS IA',
        title: 'Teaser produit',
        gradient: 'linear-gradient(135deg,#16283F,#2C4A66)',
        thumbLabel: 'VIDÉO IA',
        video: 'https://player.vimeo.com/video/1223912721?h=7443aab3a0&title=0&byline=0&portrait=0',
      },
      { cat: 'videos', catLabel: 'VIDÉOS IA', title: 'Clip réseaux sociaux', gradient: 'linear-gradient(135deg,#2C4A66,#16283F)', thumbLabel: 'VIDÉO IA' },
      { cat: 'videos', catLabel: 'VIDÉOS IA', title: 'Vidéo évènementielle', gradient: 'linear-gradient(135deg,#0F1E32,#4ADE80)', thumbLabel: 'VIDÉO IA' },
    ],
  },
  {
    id: 'row-motion',
    title: 'Motion Design',
    count: '2 réalisations',
    items: [
      { cat: 'motion', catLabel: 'MOTION DESIGN', title: 'Motion intro', gradient: 'linear-gradient(135deg,#4ADE80,#0F1E32)', thumbLabel: 'MOTION' },
      { cat: 'motion', catLabel: 'MOTION DESIGN', title: 'Habillage logo animé', gradient: 'linear-gradient(135deg,#0F1E32,#166534)', thumbLabel: 'MOTION' },
    ],
  },
  {
    id: 'row-pub',
    title: 'Publicités',
    count: '2 réalisations',
    items: [
      { cat: 'pub', catLabel: 'PUBLICITÉS', title: 'Pub réseaux sociaux', gradient: 'linear-gradient(135deg,#24405F,#3D5A78)', thumbLabel: 'SOCIAL' },
      { cat: 'pub', catLabel: 'PUBLICITÉS', title: 'Campagne display', gradient: 'linear-gradient(135deg,#3D5A78,#22C55E)', thumbLabel: 'SOCIAL' },
    ],
  },
  {
    id: 'row-logos',
    title: 'Logos',
    count: '2 réalisations',
    items: [
      { cat: 'logos', catLabel: 'LOGOS', title: 'Logo Nova Studio', gradient: 'linear-gradient(135deg,#2C3E52,#4ADE80)', thumbLabel: 'LOGO' },
      { cat: 'logos', catLabel: 'LOGOS', title: 'Identité Atlas', gradient: 'linear-gradient(135deg,#4ADE80,#2C3E52)', thumbLabel: 'LOGO' },
    ],
  },
  {
    id: 'row-affiches',
    title: 'Affiches',
    count: '2 réalisations',
    items: [
      { cat: 'affiches', catLabel: 'AFFICHES', title: 'Affiche événement', gradient: 'linear-gradient(135deg,#22C55E,#15803D)', thumbLabel: 'AFFICHE' },
      { cat: 'affiches', catLabel: 'AFFICHES', title: 'Affiche concert', gradient: 'linear-gradient(135deg,#15803D,#1F3350)', thumbLabel: 'AFFICHE' },
    ],
  },
  {
    id: 'row-retouches',
    title: 'Retouches photo',
    count: '2 réalisations',
    items: [
      { cat: 'retouches', catLabel: 'RETOUCHES PHOTO', title: 'Retouche portrait', gradient: 'linear-gradient(135deg,#86EFAC,#22C55E)', thumbLabel: 'RETOUCHE' },
      { cat: 'retouches', catLabel: 'RETOUCHES PHOTO', title: 'Retouche produit', gradient: 'linear-gradient(135deg,#22C55E,#86EFAC)', thumbLabel: 'RETOUCHE' },
    ],
  },
];

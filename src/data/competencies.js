export const COMPETENCIES_SETTING_KEY = 'site_competencies';

export const DEFAULT_COMPETENCIES = [
  'Création d’images IA',
  'Création vidéo IA',
  'Montage vidéo',
  'Design graphique',
  'Motion design',
  'Création de logos',
  'Retouche photo',
];

export function parseCompetencies(value) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) {
    throw new Error('La liste des compétences enregistrée est invalide.');
  }

  return parsed.map((competency) => {
    if (typeof competency !== 'string' || !competency.trim() || competency.trim().length > 80) {
      throw new Error('Chaque compétence doit contenir entre 1 et 80 caractères.');
    }
    return competency.trim();
  });
}

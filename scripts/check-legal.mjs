import { readFileSync } from 'node:fs';

const files = [
  'src/pages/Legal.jsx',
  'src/data/legalFacts.js',
  'src/components/site/LegalNotice.jsx',
];

const forbidden = [
  ['à compléter', /\ba\s+completer\b/],
  ['à vérifier', /\ba\s+verifier\b/],
  ['à relire', /\ba\s+relire\b/],
  ['à confirmer', /\ba\s+confirmer\b/],
  ['à préciser', /\ba\s+preciser\b/],
  ['à définir', /\ba\s+definir\b/],
  ['brouillon', /\bbrouillon\b/],
  ['provisoire', /\bprovisoire\b/],
  ['avant publication', /\bavant\s+publication\b/],
  ['TODO', /\btodo\b/],
  ['TBD', /\btbd\b/],
  ['XXX', /\bxxx\b/],
  ['lorem', /\blorem\b/],
  ['point de suspension', /\.{3,}|…/],
];

function normalize(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

const issues = [];

for (const file of files) {
  const content = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const normalizedLine = normalize(line);

    for (const [label, pattern] of forbidden) {
      if (pattern.test(normalizedLine)) {
        issues.push(`${file}:${index + 1}: marqueur interdit « ${label} »`);
      }
    }

    const textForBracketCheck = line
      .replace(/PAGE_CONFIG\[pathname\]/g, '')
      .replace(/PAGE_CONFIG\[legalFacts\.legalRoutes\.privacy\]/g, '');

    if (/\[[^\]\r\n]+\]/u.test(textForBracketCheck)) {
      issues.push(`${file}:${index + 1}: texte entre crochets`);
    }
  });
}

if (issues.length) {
  console.error('Contrôle des pages légales échoué :');
  console.error(issues.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Contrôle des pages légales réussi.');
}

import { useEffect } from 'react';

const SITE_URL = 'https://calebcreative.online';

function upsertMeta(attribute, value, content) {
  let element = document.head.querySelector(`meta[${attribute}="${value}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, value);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

export default function Seo({
  title = 'Caleb Creative — Créateur visuel au Bénin',
  description = 'Caleb Jesugnon Agbakou crée des vidéos IA, designs, montages vidéo et visuels IA pour vos projets au Bénin et au-delà.',
  path = '/',
  noIndex = false,
}) {
  useEffect(() => {
    const canonicalUrl = new URL(path, SITE_URL).toString();
    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow');
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:locale', 'fr_FR');
    upsertMeta('property', 'og:site_name', 'Caleb Creative');
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);

    let structuredData = document.head.querySelector('script[data-seo-schema="person"]');
    if (!structuredData) {
      structuredData = document.createElement('script');
      structuredData.type = 'application/ld+json';
      structuredData.dataset.seoSchema = 'person';
      document.head.appendChild(structuredData);
    }
    structuredData.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Caleb Jesugnon Agbakou',
      alternateName: 'Caleb Creative',
      url: SITE_URL,
      jobTitle: 'Créateur visuel',
      description,
      address: { '@type': 'PostalAddress', addressCountry: 'BJ' },
      knowsAbout: ['Vidéo IA', 'Design graphique', 'Montage vidéo', 'Visuels IA'],
    });

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);

    return () => {
      document.title = 'Caleb Creative — Portfolio';
    };
  }, [description, noIndex, path, title]);

  return null;
}

export { SITE_URL };

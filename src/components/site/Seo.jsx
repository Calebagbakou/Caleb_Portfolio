import { useEffect } from 'react';

const SITE_URL = 'https://calebcreative.online';
const SOCIAL_IMAGE = `${SITE_URL}/favicon.svg`;

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
  product = null,
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
    upsertMeta('property', 'og:image', SOCIAL_IMAGE);
    upsertMeta('property', 'og:image:alt', 'Logo Caleb Creative');
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:image', SOCIAL_IMAGE);
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);

    const schemaKey = product ? 'product' : 'person';
    let structuredData = document.head.querySelector(`script[data-seo-schema="${schemaKey}"]`);
    if (!structuredData) {
      structuredData = document.createElement('script');
      structuredData.type = 'application/ld+json';
      structuredData.dataset.seoSchema = schemaKey;
      document.head.appendChild(structuredData);
    }
    structuredData.textContent = JSON.stringify(product ? {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description,
      url: canonicalUrl,
      brand: { '@type': 'Brand', name: 'Caleb Creative' },
      category: product.categoryLabel,
      offers: product.plans
        .filter((plan) => plan.active !== false && Number(plan.price) > 0)
        .map((plan) => ({
          '@type': 'Offer',
          name: plan.label,
          price: Number(plan.price).toFixed(2),
          priceCurrency: plan.currency || 'XOF',
          availability: 'https://schema.org/InStock',
          url: canonicalUrl,
        })),
    } : {
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
  }, [description, noIndex, path, product, title]);

  return null;
}

export { SITE_URL };

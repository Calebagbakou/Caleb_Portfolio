export const BUYER_EMAIL_DOMAINS = ['gmail.com', 'outlook.com'];

export function isAllowedBuyerEmail(value) {
  if (typeof value !== 'string') return false;
  const email = value.trim().toLowerCase();
  const atIndex = email.lastIndexOf('@');
  if (atIndex < 1) return false;
  return BUYER_EMAIL_DOMAINS.includes(email.slice(atIndex + 1));
}

export function getBuyerAuthRedirectUrl(nextPath) {
  const baseUrl = import.meta.env.BASE_URL || '/';
  const redirectUrl = new URL(`${baseUrl}boutique/connexion`, window.location.origin);
  redirectUrl.searchParams.set('next', nextPath);
  return redirectUrl.href;
}

export function getBuyerNextPath(value) {
  return ['/boutique/commande', '/boutique/panier', '/boutique/compte'].includes(value)
    ? value
    : '/boutique/commande';
}

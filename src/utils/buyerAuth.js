import { isAllowedBuyerEmail } from '../../supabase/functions/_shared/buyer-email.ts';

export { isAllowedBuyerEmail } from '../../supabase/functions/_shared/buyer-email.ts';

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

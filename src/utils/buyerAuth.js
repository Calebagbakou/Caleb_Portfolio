import { isAllowedBuyerEmail } from '../../supabase/functions/_shared/buyer-email.ts';

export { isAllowedBuyerEmail } from '../../supabase/functions/_shared/buyer-email.ts';

export function getBuyerAuthRedirectUrl(nextPath) {
  const baseUrl = import.meta.env.BASE_URL || '/';
  const redirectUrl = new URL(`${baseUrl}boutique/connexion`, window.location.origin);
  redirectUrl.searchParams.set('next', nextPath);
  return redirectUrl.href;
}

export function getBuyerNextPath(value) {
  if (['/boutique/commande', '/boutique/compte', '/smm'].includes(value)) return value;
  if (typeof value === 'string') {
    try {
      const path = new URL(value, window.location.origin);
      const topupId = path.searchParams.get('topup_id');
      if (path.pathname === '/smm' && topupId && /^[0-9a-f-]{36}$/i.test(topupId)) {
        return `/smm?topup_id=${encodeURIComponent(topupId)}`;
      }
    } catch (error) {
      console.error('Chemin de retour client invalide :', error);
    }
  }
  return '/boutique/commande';
}

export function getSmmNextPath(value) {
  const allowedPaths = ['/smm', '/smm/commande', '/smm/commandes', '/smm/portefeuille', '/smm/parrainage'];
  if (typeof value !== 'string') return '/smm';

  try {
    const path = new URL(value, window.location.origin);
    if (path.origin !== window.location.origin || !allowedPaths.includes(path.pathname)) return '/smm';
    const topupId = path.searchParams.get('topup_id');
    if (path.pathname === '/smm' && topupId && /^[0-9a-f-]{36}$/i.test(topupId)) {
      return `/smm?topup_id=${encodeURIComponent(topupId)}`;
    }
    return path.pathname;
  } catch (error) {
    console.error('Chemin de retour SMM invalide :', error);
    return '/smm';
  }
}

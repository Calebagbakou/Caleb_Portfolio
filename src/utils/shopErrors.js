function readErrorText(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error.message === 'string') return error.message;
  if (typeof error.error === 'string') return error.error;
  if (typeof error.detail === 'string') return error.detail;
  if (typeof error.error === 'object') return readErrorText(error.error);
  try {
    return JSON.stringify(error);
  } catch {
    return '';
  }
}

export function getShopErrorMessage(error, fallback = 'Une erreur temporaire est survenue.') {
  const raw = readErrorText(error);
  const normalized = raw.toLowerCase();

  if (!raw || normalized.includes('non-2xx') || normalized.includes('edge function')) {
    return fallback;
  }
  if (normalized.includes('minimum') && normalized.includes('montant')) {
    return 'Le montant de cette commande est trop faible pour ce moyen de paiement. Choisis un produit d’au moins 200 FCFA.';
  }
  if (normalized.includes('already paid') || normalized.includes('déjà pay')) {
    return 'Cette commande est déjà payée. Consulte ton historique pour retrouver son reçu.';
  }
  if (normalized.includes('session') || normalized.includes('jwt') || normalized.includes('authent')) {
    return 'Ta session a expiré. Reconnecte-toi pour continuer, tes articles resteront dans ton panier.';
  }
  if (normalized.includes('confirm') && normalized.includes('email')) {
    return 'Confirme ton adresse e-mail depuis le message reçu, puis réessaie.';
  }
  if (normalized.includes('payment') || normalized.includes('paiement') || normalized.includes('saspay')) {
    return 'Le paiement n’a pas pu être lancé. Vérifie le montant et réessaie ; aucun débit n’est effectué tant que le paiement n’est pas confirmé.';
  }
  if (normalized.includes('network') || normalized.includes('fetch') || normalized.includes('failed to fetch')) {
    return 'La connexion semble momentanément indisponible. Vérifie Internet et réessaie dans quelques instants.';
  }
  if (normalized.includes('commande') || normalized.includes('order')) {
    return 'Ta commande n’a pas pu être préparée. Vérifie ton panier et réessaie ; tu peux aussi nous contacter.';
  }
  if (normalized.includes('download') || normalized.includes('télécharg')) {
    return 'Ton accès n’est pas encore disponible. Réessaie dans quelques instants ou contacte-nous avec ta référence.';
  }
  return raw
    .replace(/^\s*SasPay a refusé le paiement\s*:\s*/i, '')
    .replace(/\[object Object\]/gi, '')
    .trim() || fallback;
}

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
  const code = typeof error?.code === 'string' ? error.code.toLowerCase() : '';

  if (!raw || normalized.includes('non-2xx') || normalized.includes('edge function')) {
    return fallback;
  }
  if (normalized.includes('minimum') && normalized.includes('montant')) {
    return 'Le montant de cette commande est trop faible pour ce moyen de paiement. Choisissez un produit d’au moins 200 FCFA.';
  }
  if (normalized.includes('already paid') || normalized.includes('déjà pay')) {
    return 'Cette commande est déjà payée. Consultez votre historique pour retrouver son reçu.';
  }
  if (normalized.includes('session') || normalized.includes('jwt') || normalized.includes('authent')) {
    return 'Votre session a expiré. Reconnectez-vous pour continuer votre commande.';
  }
  if (normalized.includes('confirm') && normalized.includes('email')) {
    return 'Confirmez votre adresse e-mail depuis le message reçu, puis réessayez.';
  }
  if (normalized.includes('payment') || normalized.includes('paiement') || normalized.includes('saspay')) {
    return 'Le paiement n’a pas pu être lancé. Vérifiez le montant, puis réessayez ou contactez-nous si le problème persiste.';
  }
  if (normalized.includes('network') || normalized.includes('fetch') || normalized.includes('failed to fetch')) {
    return 'La connexion semble momentanément indisponible. Vérifiez Internet et réessayez dans quelques instants.';
  }
  if (normalized.includes('commande') || normalized.includes('order')) {
    return 'Votre commande n’a pas pu être préparée. Vérifiez votre sélection et réessayez ; vous pouvez aussi nous contacter.';
  }
  if (normalized.includes('download') || normalized.includes('télécharg')) {
    return 'Votre accès n’est pas encore disponible. Réessayez dans quelques instants ou contactez-nous avec votre référence.';
  }
  if (normalized.includes('not accepted') || normalized.includes('workspace') || normalized.includes('non acceptée')) {
    return 'Cette adresse n’est pas acceptée. Utilisez une adresse personnelle d’un fournisseur courant.';
  }
  if (
    code === 'email_not_confirmed'
    || normalized.includes('email not confirmed')
    || normalized.includes('email address not confirmed')
  ) {
    return 'Votre adresse e-mail n’est pas encore confirmée. Saisissez le code reçu ou demandez-en un nouveau.';
  }
  if (
    code === 'invalid_credentials'
    || normalized.includes('invalid login credentials')
    || normalized.includes('invalid email or password')
  ) {
    return 'Adresse e-mail ou mot de passe incorrect. Vérifiez vos identifiants ou réinitialisez votre mot de passe.';
  }
  if (
    code === 'user_already_exists'
    || normalized.includes('already registered')
    || normalized.includes('user already exists')
  ) {
    return 'Cette adresse possède déjà un compte. Connectez-vous ou réinitialisez votre mot de passe.';
  }
  if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return 'Trop de demandes ont été effectuées récemment. Patientez quelques minutes avant de réessayer.';
  }
  if (normalized.includes('password') && (normalized.includes('weak') || normalized.includes('should be'))) {
    return 'Ce mot de passe est trop faible. Utilisez au moins 8 caractères avec des lettres et des chiffres.';
  }
  if (normalized.includes('password') && normalized.includes('short')) {
    return 'Le mot de passe doit contenir au moins 8 caractères.';
  }
  if (normalized.includes('email') && (normalized.includes('invalid') || normalized.includes('valid'))) {
    return 'Vérifiez le format de votre adresse e-mail.';
  }
  if (normalized.includes('otp') || normalized.includes('token')) {
    return 'Ce code est invalide ou expiré. Vérifiez le message reçu ou demandez un nouveau code.';
  }
  if (normalized.includes('provider') && (normalized.includes('disabled') || normalized.includes('not enabled'))) {
    return 'Cette méthode de connexion n’est pas encore activée. Choisissez une autre méthode ou contactez-nous.';
  }
  if (normalized.includes('oauth') || normalized.includes('identity provider')) {
    return 'La connexion avec ce fournisseur a échoué. Réessayez ou choisissez une autre méthode.';
  }
  return fallback;
}

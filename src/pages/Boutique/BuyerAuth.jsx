import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ShopAlert from '../../components/shop/ShopAlert';
import { getShopErrorMessage } from '../../utils/shopErrors';
import { supabase } from '../../services/supabase';
import {
  getBuyerAuthRedirectUrl,
  getBuyerNextPath,
  isAllowedBuyerEmail,
} from '../../utils/buyerAuth';

export default function BuyerAuth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const nextPath = getBuyerNextPath(searchParams.get('next'));
  const [mode, setMode] = useState(searchParams.get('mode') === 'reset' ? 'reset' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(
    () => new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type') === 'recovery',
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    document.title = 'Connexion — Boutique Caleb Creative';
  }, []);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryFlow(true);
        setMode('reset');
        setError('');
        setNotice('');
      }
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    if (authLoading || isRecoveryFlow || !user?.email_confirmed_at) return;
    if (!isAllowedBuyerEmail(user.email)) {
      setError('Seules les adresses @gmail.com et @outlook.com sont autorisées pour commander.');
      supabase.auth.signOut().catch((signOutError) => {
        console.error('Impossible de fermer la session client non autorisée :', signOutError);
      });
      return;
    }
    navigate(nextPath, { replace: true });
  }, [authLoading, isRecoveryFlow, navigate, nextPath, user]);

  function validateEmail() {
    if (!isAllowedBuyerEmail(email)) {
      setError('Seules les adresses @gmail.com et @outlook.com sont acceptées.');
      return false;
    }
    return true;
  }

  function isAlreadyRegisteredError(authError) {
    return authError?.code === 'user_already_exists'
      || /already registered|already exists|user already/i.test(authError?.message || '');
  }

  function getFriendlyAuthError(authError) {
    if (/invalid login credentials/i.test(authError?.message || '')) {
      return 'Adresse ou mot de passe incorrect. Si tu as créé ton compte avec Google, utilise le bouton « Continuer avec Google ».';
    }
    return authError?.message || 'La connexion a échoué. Réessaie.';
  }

  async function handleEmailSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!validateEmail()) return;
    setSubmitting(true);

    try {
      if (mode === 'signup' && !awaitingConfirmation) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { emailRedirectTo: getBuyerAuthRedirectUrl(nextPath) },
        });
        if (signUpError) throw signUpError;
        if (data.session && !data.user?.email_confirmed_at) await supabase.auth.signOut();
        if (data.session && data.user?.email_confirmed_at) {
          navigate(nextPath, { replace: true });
          return;
        }
        setAwaitingConfirmation(true);
        setNotice(`Un code de confirmation a été envoyé à ${email.trim()}.`);
      } else if (mode === 'signup') {
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: confirmationCode.trim(),
          type: 'signup',
        });
        if (verifyError) throw verifyError;
        if (!data.user?.email_confirmed_at) {
          throw new Error('Supabase n’a pas confirmé cette adresse. Vérifie le code reçu.');
        }
        navigate(nextPath, { replace: true });
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (signInError) throw signInError;
        if (!data.user?.email_confirmed_at) {
          await supabase.auth.signOut();
          throw new Error('Confirme ton adresse e-mail avant de passer commande.');
        }
        navigate(nextPath, { replace: true });
      }
    } catch (authError) {
      console.error('Authentification client impossible :', authError);
      if (mode === 'signup' && !awaitingConfirmation && isAlreadyRegisteredError(authError)) {
        setMode('login');
        setNotice('Cette adresse possède déjà un compte. Connecte-toi avec ton mot de passe ou utilise Google.');
        setError('');
      } else {
        setError(getFriendlyAuthError(authError));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function resendConfirmationCode() {
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
      });
      if (resendError) throw resendError;
      setNotice(`Un nouveau code a été envoyé à ${email.trim()}.`);
    } catch (resendError) {
      console.error('Impossible de renvoyer le code de confirmation :', resendError);
      setError(getShopErrorMessage(resendError, 'Le code n’a pas pu être renvoyé.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordReset(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!validateEmail()) return;
    setSubmitting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: getBuyerAuthRedirectUrl('/boutique/compte'),
      });
      if (resetError) throw resetError;
      setNotice('Un lien de réinitialisation a été envoyé à cette adresse.');
    } catch (resetError) {
      console.error('Réinitialisation du mot de passe impossible :', resetError);
      setError(getShopErrorMessage(resetError, 'Le lien de réinitialisation n’a pas pu être envoyé.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNewPassword(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (newPassword.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassword !== passwordConfirmation) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setIsRecoveryFlow(false);
      navigate('/boutique/compte', { replace: true });
    } catch (updateError) {
      console.error('Mise à jour du mot de passe client impossible :', updateError);
      setError(getShopErrorMessage(updateError, 'Le nouveau mot de passe n’a pas pu être enregistré.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getBuyerAuthRedirectUrl(nextPath),
          skipBrowserRedirect: false,
        },
      });
      if (oauthError) throw oauthError;
    } catch (oauthError) {
      console.error('Connexion Google impossible :', oauthError);
      setError(getShopErrorMessage(oauthError, 'La connexion avec Google a échoué.'));
      setSubmitting(false);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setIsRecoveryFlow(false);
    setAwaitingConfirmation(false);
    setConfirmationCode('');
    setNewPassword('');
    setPasswordConfirmation('');
    setError('');
    setNotice('');
  }

  if (authLoading) {
    return <main className="wrap"><div className="shop-state">Vérification de ta connexion…</div></main>;
  }

  return (
    <main className="wrap buyer-auth-wrap">
      <section className="buyer-auth-card">
        <Link className="buyer-auth-back" to="/boutique/panier">← Retour au panier</Link>
        <div className="eyebrow">COMPTE CLIENT</div>
        <h1>{awaitingConfirmation ? 'Confirme ton e-mail' : mode === 'reset' && isRecoveryFlow ? 'Choisis un nouveau mot de passe' : mode === 'reset' ? 'Réinitialiser ton mot de passe' : 'Connecte-toi pour commander'}</h1>
        <p className="buyer-auth-intro">
          {awaitingConfirmation
            ? `Saisis le code reçu à ${email.trim()} pour confirmer ton adresse.`
            : mode === 'reset'
              ? isRecoveryFlow
                ? 'Ton lien est valide. Définis un nouveau mot de passe pour sécuriser ton compte.'
                : 'Renseigne ton adresse et nous t’enverrons un lien sécurisé.'
            : 'Connecte-toi ou crée un compte pour continuer vers le paiement sécurisé.'}
        </p>

        {error && <ShopAlert message={error} action="Réessayer" onAction={() => setError('')} />}
        {notice && <div className="shop-admin-alert success" role="status">{notice}</div>}

        {!awaitingConfirmation && mode !== 'reset' && (
          <>
            <div className="buyer-auth-tabs" role="tablist" aria-label="Type de connexion">
              <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')}>Connexion</button>
              <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => changeMode('signup')}>Créer un compte</button>
            </div>
            <button className="btn btn-outline buyer-google-btn" type="button" onClick={handleGoogleSignIn} disabled={submitting}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M21.35 12.2c0-.72-.06-1.42-.18-2.1H12v3.98h5.23a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.92-4.2 2.92-7.27Z" />
                <path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.35l-3.14-2.45c-.87.58-1.98.93-3.31.93-2.54 0-4.7-1.72-5.47-4.04H3.29v2.53A9.75 9.75 0 0 0 12 21.75Z" />
                <path fill="#FBBC05" d="M6.53 13.84a5.87 5.87 0 0 1 0-3.68V7.63H3.29a9.75 9.75 0 0 0 0 8.74l3.24-2.53Z" />
                <path fill="#EA4335" d="M12 6.12c1.43 0 2.72.49 3.73 1.47l2.8-2.8C16.83 3.18 14.62 2.25 12 2.25a9.75 9.75 0 0 0-8.71 5.38l3.24 2.53C7.3 7.84 9.46 6.12 12 6.12Z" />
              </svg>
              Continuer avec Google
            </button>
            <div className="buyer-auth-divider"><span>ou avec ton adresse e-mail</span></div>
          </>
        )}

        {awaitingConfirmation ? (
          <form className="buyer-auth-form" onSubmit={handleEmailSubmit}>
            <div className="form-group">
              <label htmlFor="buyer-confirmation-code">Code de confirmation</label>
              <input
                autoComplete="one-time-code"
                id="buyer-confirmation-code"
                inputMode="numeric"
                maxLength={8}
                required
                value={confirmationCode}
                onChange={(event) => setConfirmationCode(event.target.value.replace(/\D/g, ''))}
              />
            </div>
            <button className="btn btn-primary btn-full" type="submit" disabled={submitting}>
              {submitting ? 'Vérification…' : 'Confirmer mon adresse'}
            </button>
            <button className="buyer-auth-resend" type="button" onClick={resendConfirmationCode} disabled={submitting}>
              Renvoyer le code
            </button>
          </form>
        ) : mode === 'reset' && isRecoveryFlow ? (
          <form className="buyer-auth-form" onSubmit={handleNewPassword}>
            <div className="form-group">
              <label htmlFor="buyer-new-password">Nouveau mot de passe</label>
              <input
                autoComplete="new-password"
                id="buyer-new-password"
                type="password"
                minLength={8}
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <small>8 caractères minimum.</small>
            </div>
            <div className="form-group">
              <label htmlFor="buyer-password-confirmation">Confirmer le mot de passe</label>
              <input
                autoComplete="new-password"
                id="buyer-password-confirmation"
                type="password"
                minLength={8}
                required
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
              />
            </div>
            <button className="btn btn-primary btn-full" type="submit" disabled={submitting}>
              {submitting ? 'Enregistrement…' : 'Enregistrer le nouveau mot de passe'}
            </button>
          </form>
        ) : mode === 'reset' ? (
          <form className="buyer-auth-form" onSubmit={handlePasswordReset}>
            <div className="form-group">
              <label htmlFor="buyer-email">Adresse e-mail</label>
              <input
                autoComplete="email"
                id="buyer-email"
                type="email"
                placeholder="nom@gmail.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <button className="btn btn-primary btn-full" type="submit" disabled={submitting}>
              {submitting ? 'Envoi…' : 'Envoyer le lien'}
            </button>
            <button className="buyer-auth-resend" type="button" onClick={() => changeMode('login')} disabled={submitting}>
              Retour à la connexion
            </button>
          </form>
        ) : (
          <form className="buyer-auth-form" onSubmit={handleEmailSubmit}>
            <div className="form-group">
              <label htmlFor="buyer-email">Adresse e-mail</label>
              <input
                autoComplete="email"
                id="buyer-email"
                type="email"
                placeholder="nom@gmail.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <small>Adresses acceptées : @gmail.com et @outlook.com.</small>
            </div>
            <div className="form-group">
              <label htmlFor="buyer-password">Mot de passe</label>
              <input
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                id="buyer-password"
                type="password"
                minLength={mode === 'signup' ? 8 : undefined}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              {mode === 'signup' && <small>8 caractères minimum.</small>}
            </div>
            <button className="btn btn-primary btn-full" type="submit" disabled={submitting}>
              {submitting ? 'Un instant…' : mode === 'signup' ? 'Créer mon compte et recevoir un code' : 'Se connecter'}
            </button>
            {mode === 'login' && (
              <button className="buyer-auth-resend" type="button" onClick={() => changeMode('reset')} disabled={submitting}>
                Mot de passe oublié ?
              </button>
            )}
          </form>
        )}
        <p className="buyer-auth-footnote">La connexion Google confirme directement l’adresse du compte.</p>
      </section>
    </main>
  );
}

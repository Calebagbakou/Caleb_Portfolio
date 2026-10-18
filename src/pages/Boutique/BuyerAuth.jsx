import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { formatPrice } from '../../data/products';
import ShopAlert from '../../components/shop/ShopAlert';
import { getShopErrorMessage } from '../../utils/shopErrors';
import ShopArrow from '../../components/shop/ShopArrow';
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
  const { details, total } = useCart();
  const nextPath = getBuyerNextPath(searchParams.get('next'));
  const [mode, setMode] = useState(searchParams.get('mode') === 'reset' ? 'reset' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const confirmationCodeRef = useRef('');
  const confirmationInputs = useRef([]);
  const confirmationForm = useRef(null);
  const firstField = useRef(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(
    () => new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type') === 'recovery',
  );
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    document.title = 'Connexion — Boutique Caleb Creative';
  }, []);

  useEffect(() => {
    if (!authLoading && !awaitingConfirmation) firstField.current?.focus();
  }, [authLoading, awaitingConfirmation, mode]);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = window.setTimeout(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

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
    if (authLoading || isRecoveryFlow || !user) return;
    if (!user.email_confirmed_at) {
      if (['google', 'facebook'].includes(user.app_metadata?.provider)) {
        setError('Ce fournisseur doit communiquer une adresse e-mail vérifiée pour ouvrir un compte boutique.');
        supabase.auth.signOut().catch((signOutError) => {
          console.error('Impossible de fermer la session OAuth client incomplète :', signOutError);
        });
      }
      return;
    }
    if (!isAllowedBuyerEmail(user.email)) {
      setError('Cette adresse n’est pas acceptée. Utilisez une adresse personnelle d’un fournisseur courant ; les adresses Workspace ne sont pas acceptées.');
      supabase.auth.signOut().catch((signOutError) => {
        console.error('Impossible de fermer la session client non autorisée :', signOutError);
      });
      return;
    }
    navigate(nextPath, { replace: true });
  }, [authLoading, isRecoveryFlow, navigate, nextPath, user]);

  function validateEmail() {
    if (!isAllowedBuyerEmail(email)) {
      setError('Utilisez une adresse valide d’un fournisseur courant (Gmail, Outlook, Yahoo, iCloud, Proton…). Les adresses Workspace et temporaires ne sont pas acceptées.');
      return false;
    }
    return true;
  }

  function isAlreadyRegisteredError(authError) {
    return authError?.code === 'user_already_exists'
      || /already registered|already exists|user already/i.test(authError?.message || '');
  }

  async function handleEmailSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!validateEmail()) return;
    if (awaitingConfirmation && !/^\d{6}$/.test(confirmationCodeRef.current)) {
      setError('Saisissez les 6 chiffres du code reçu par e-mail.');
      return;
    }
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
        setResendSeconds(30);
        setNotice(`Un code de confirmation a été envoyé à ${email.trim()}.`);
      } else if (awaitingConfirmation) {
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: confirmationCodeRef.current.trim(),
          type: 'signup',
        });
        if (verifyError) throw verifyError;
        if (!data.user?.email_confirmed_at) {
          throw new Error('Supabase n’a pas confirmé cette adresse. Vérifiez le code reçu.');
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
          setAwaitingConfirmation(true);
          setConfirmationCode('');
          confirmationCodeRef.current = '';
          setResendSeconds(30);
          throw new Error('Confirmez votre adresse e-mail avec le code reçu avant de passer commande.');
        }
        navigate(nextPath, { replace: true });
      }
    } catch (authError) {
      console.error('Authentification client impossible :', authError);
      if (mode === 'signup' && !awaitingConfirmation && isAlreadyRegisteredError(authError)) {
        setMode('login');
        setNotice('Cette adresse possède déjà un compte. Connectez-vous ou choisissez un fournisseur de connexion.');
        setError('');
      } else {
        setError(getShopErrorMessage(authError, 'La connexion a échoué. Vérifiez vos informations et réessayez.'));
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
      setNotice(`Un nouveau code a été envoyé à ${email.trim()}. Vérifiez également vos courriers indésirables.`);
      setResendSeconds(30);
    } catch (resendError) {
      console.error('Impossible de renvoyer le code de confirmation :', resendError);
      setError(getShopErrorMessage(resendError, 'Le code n’a pas pu être renvoyé. Réessayez dans quelques instants.'));
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
      setNotice('Un lien de réinitialisation a été envoyé à cette adresse. Vérifiez également vos courriers indésirables.');
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

  async function handleOAuthSignIn(provider) {
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getBuyerAuthRedirectUrl(nextPath),
          skipBrowserRedirect: false,
          ...(provider === 'facebook' ? { scopes: 'email,public_profile' } : {}),
        },
      });
      if (oauthError) throw oauthError;
    } catch (oauthError) {
      console.error(`Connexion ${provider} impossible :`, oauthError);
      setError(getShopErrorMessage(oauthError, `La connexion avec ${provider === 'google' ? 'Google' : 'Facebook'} a échoué.`));
      setSubmitting(false);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setIsRecoveryFlow(false);
    setAwaitingConfirmation(false);
    setConfirmationCode('');
    confirmationCodeRef.current = '';
    setResendSeconds(0);
    setNewPassword('');
    setPasswordConfirmation('');
    setError('');
    setNotice('');
  }

  function handleConfirmationChange(index, value) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const nextCode = confirmationCodeRef.current.padEnd(6, ' ').split('');
    nextCode[index] = digit || ' ';
    const normalizedCode = nextCode.join('').trimEnd();
    confirmationCodeRef.current = normalizedCode;
    setConfirmationCode(normalizedCode);
    setError('');

    if (digit && index < 5) confirmationInputs.current[index + 1]?.focus();
    if (normalizedCode.length === 6 && !normalizedCode.includes(' ')) confirmationForm.current?.requestSubmit();
  }

  function handleConfirmationKeyDown(index, event) {
    if (event.key === 'Backspace' && !confirmationCodeRef.current[index] && index > 0) {
      confirmationInputs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && index > 0) confirmationInputs.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < 5) confirmationInputs.current[index + 1]?.focus();
  }

  function handleConfirmationPaste(event) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    confirmationCodeRef.current = pasted;
    setConfirmationCode(pasted);
    confirmationInputs.current[Math.min(pasted.length, 5)]?.focus();
    if (pasted.length === 6) confirmationForm.current?.requestSubmit();
  }

  function handleChangeEmail() {
    setAwaitingConfirmation(false);
    setEmail('');
    setConfirmationCode('');
    confirmationCodeRef.current = '';
    setResendSeconds(0);
    setError('');
    setNotice('');
    setMode('signup');
  }

  const passwordStrength = password.length >= 12 && /[A-Z]/.test(password) && /\d/.test(password)
    ? 'fort'
    : password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)
      ? 'moyen'
      : password.length > 0
        ? 'faible'
        : '';

  if (authLoading) {
    return <main className="wrap"><div className="shop-state">Vérification de votre connexion…</div></main>;
  }

  return (
    <main className="wrap buyer-auth-wrap">
      <nav className="buyer-journey" aria-label="Étapes de la commande">
        {['Panier', 'Compte', 'Paiement', 'Livraison'].map((step, index) => (
          <div className={`buyer-journey-step${index === 1 ? ' active' : ''}`} aria-current={index === 1 ? 'step' : undefined} key={step}>
            <span>{index + 1}</span>{step}
          </div>
        ))}
      </nav>
      <section className="buyer-auth-card">
        <Link className="buyer-auth-back" to="/boutique/panier"><ShopArrow direction="left" /> Retour au panier</Link>
        <div className="eyebrow">COMPTE CLIENT</div>
        <h1>
          <span className="buyer-auth-lock" aria-hidden="true">🔒</span>
          {awaitingConfirmation ? 'Confirmez votre e-mail' : mode === 'reset' && isRecoveryFlow ? 'Choisissez un nouveau mot de passe' : mode === 'reset' ? 'Réinitialiser votre mot de passe' : 'Connectez-vous pour commander'}
        </h1>
        <p className="buyer-auth-intro">
          {awaitingConfirmation
            ? `Saisissez le code reçu à ${email.trim()} pour confirmer votre adresse.`
            : mode === 'reset'
              ? isRecoveryFlow
                ? 'Votre lien est valide. Définissez un nouveau mot de passe pour sécuriser votre compte.'
                : 'Renseignez votre adresse et nous vous enverrons un lien sécurisé.'
            : 'Connectez-vous ou créez un compte pour continuer vers le paiement sécurisé.'}
        </p>

        {error && <ShopAlert message={error} action="Réessayer" onAction={() => setError('')} />}
        {notice && <div className="shop-admin-alert success" role="status">{notice}</div>}

        {!awaitingConfirmation && mode !== 'reset' && (
          <>
            <div className="buyer-auth-tabs" role="tablist" aria-label="Type de connexion">
              <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')}>Connexion</button>
              <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => changeMode('signup')}>Créer un compte</button>
            </div>
            <button className="btn btn-outline buyer-google-btn" type="button" onClick={() => handleOAuthSignIn('google')} disabled={submitting}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M21.35 12.2c0-.72-.06-1.42-.18-2.1H12v3.98h5.23a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.92-4.2 2.92-7.27Z" />
                <path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.35l-3.14-2.45c-.87.58-1.98.93-3.31.93-2.54 0-4.7-1.72-5.47-4.04H3.29v2.53A9.75 9.75 0 0 0 12 21.75Z" />
                <path fill="#FBBC05" d="M6.53 13.84a5.87 5.87 0 0 1 0-3.68V7.63H3.29a9.75 9.75 0 0 0 0 8.74l3.24-2.53Z" />
                <path fill="#EA4335" d="M12 6.12c1.43 0 2.72.49 3.73 1.47l2.8-2.8C16.83 3.18 14.62 2.25 12 2.25a9.75 9.75 0 0 0-8.71 5.38l3.24 2.53C7.3 7.84 9.46 6.12 12 6.12Z" />
              </svg>
              Continuer avec Google
            </button>
            <button className="btn btn-outline buyer-google-btn buyer-facebook-btn" type="button" onClick={() => handleOAuthSignIn('facebook')} disabled={submitting}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H7.3V13h2.8v8h3.4Z" /></svg>
              Continuer avec Facebook
            </button>
            <div className="buyer-auth-divider"><span>ou avec votre adresse e-mail</span></div>
          </>
        )}

        {awaitingConfirmation ? (
          <form className="buyer-auth-form" ref={confirmationForm} onSubmit={handleEmailSubmit}>
            <div className="form-group">
              <label htmlFor="buyer-confirmation-code">Code de confirmation</label>
              <div className="buyer-code-inputs" onPaste={handleConfirmationPaste}>
                {Array.from({ length: 6 }, (_, index) => (
                  <input
                    aria-label={`Chiffre ${index + 1} du code`}
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    autoFocus={index === 0}
                    id={index === 0 ? 'buyer-confirmation-code' : undefined}
                    inputMode="numeric"
                    key={index}
                    maxLength={1}
                    onChange={(event) => handleConfirmationChange(index, event.target.value)}
                    onKeyDown={(event) => handleConfirmationKeyDown(index, event)}
                    ref={(element) => { confirmationInputs.current[index] = element; }}
                    value={confirmationCode[index]?.trim() || ''}
                  />
                ))}
              </div>
              <small>Vérifiez aussi vos courriers indésirables.</small>
            </div>
            <button className="btn btn-primary btn-full" type="submit" disabled={submitting}>
              {submitting ? 'Vérification…' : 'Confirmer mon adresse'}
            </button>
            <button className="buyer-auth-resend" type="button" onClick={resendConfirmationCode} disabled={submitting || resendSeconds > 0}>
              {resendSeconds > 0 ? `Renvoyer dans ${resendSeconds} s` : 'Renvoyer le code'}
            </button>
            <button className="buyer-auth-resend" type="button" onClick={handleChangeEmail} disabled={submitting}>Changer d’adresse e-mail</button>
          </form>
        ) : mode === 'reset' && isRecoveryFlow ? (
          <form className="buyer-auth-form" onSubmit={handleNewPassword}>
            <div className="form-group">
              <label htmlFor="buyer-new-password">Nouveau mot de passe</label>
              <input
                autoComplete="new-password"
                autoFocus
                id="buyer-new-password"
                type={showPassword ? 'text' : 'password'}
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
                type={showPassword ? 'text' : 'password'}
                minLength={8}
                required
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
              />
            </div>
            <button className="buyer-auth-resend" type="button" onClick={() => setShowPassword((visible) => !visible)}>
              {showPassword ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}
            </button>
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
                autoFocus
                ref={firstField}
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
                autoFocus
                ref={firstField}
                id="buyer-email"
                type="email"
                placeholder="nom@gmail.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <small>Fournisseurs acceptés : Gmail, Outlook, Yahoo, iCloud, Proton et d’autres services personnels courants. Les domaines Workspace et les services temporaires sont refusés.</small>
            </div>
            <div className="form-group">
              <label htmlFor="buyer-password">Mot de passe</label>
              <div className="buyer-password-field">
                <input
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  id="buyer-password"
                  onKeyDown={(event) => setCapsLockOn(event.getModifierState('CapsLock'))}
                  onKeyUp={(event) => setCapsLockOn(event.getModifierState('CapsLock'))}
                  onBlur={() => setCapsLockOn(false)}
                  type={showPassword ? 'text' : 'password'}
                  minLength={mode === 'signup' ? 8 : undefined}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button type="button" aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onClick={() => setShowPassword((visible) => !visible)}>
                  {showPassword ? 'Masquer' : 'Afficher'}
                </button>
              </div>
              {capsLockOn && <small className="buyer-caps-warning" role="status">Verr. Maj. activé.</small>}
              {mode === 'signup' && (
                <>
                  <div className={`buyer-password-strength ${passwordStrength}`} aria-live="polite">
                    {passwordStrength && <>Robustesse du mot de passe : <strong>{passwordStrength}</strong></>}
                  </div>
                  <small>Au moins 8 caractères ; privilégiez une combinaison de lettres et de chiffres.</small>
                </>
              )}
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
        <p className="buyer-auth-footnote">Google et Facebook ne reçoivent jamais votre mot de passe de boutique.</p>
      </section>
      <aside className="buyer-auth-aside">
        <h2>Votre compte, vos achats</h2>
        <p>Retrouvez vos commandes et leurs reçus au même endroit. Votre adresse sert à associer vos achats à votre compte.</p>
        <div className="buyer-auth-mini-cart">
          <h3>Votre panier</h3>
          {details.length ? details.map((line) => (
            <div className="buyer-auth-cart-line" key={`${line.productId}-${line.planId}`}>
              <span className="buyer-auth-cart-image" style={{ background: line.gradient || 'var(--surface-alt)' }}>
                {line.imageUrl || line.logoUrl
                  ? <img src={line.imageUrl || line.logoUrl} alt="" />
                  : line.avatar}
              </span>
              <span className="buyer-auth-cart-name">{line.name} · {line.planLabel} ×{line.qty}</span>
              <strong>{formatPrice(line.lineTotal)}</strong>
            </div>
          )) : <p>Votre panier est vide.</p>}
          <div className="buyer-auth-cart-total"><span>Total</span><strong>{formatPrice(total)}</strong></div>
        </div>
        <p className="buyer-auth-footnote">Le paiement s’effectue sur une page sécurisée de notre prestataire.</p>
      </aside>
    </main>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { getBuyerNextPath } from '../utils/buyerAuth';
import Seo from '../components/site/Seo';
import './SmmAuth.css';

const CODE_LENGTH = 8;

function getSmmAuthUrl(nextPath) {
  const url = new URL('/smm/connexion', window.location.origin);
  url.searchParams.set('next', nextPath);
  return url.href;
}

function getAuthError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/invalid login credentials/i.test(message)) return 'E-mail ou mot de passe incorrect.';
  if (/email not confirmed/i.test(message)) return 'Confirme d’abord ton adresse e-mail avec le code reçu.';
  if (/failed to fetch|network|fetch failed/i.test(message)) return 'Connexion au service impossible. Vérifie ta connexion puis réessaie.';
  return message || 'Une erreur est survenue. Réessaie dans quelques instants.';
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.35 12.2c0-.72-.06-1.42-.18-2.1H12v3.98h5.23a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.92-4.2 2.92-7.27Z" />
      <path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.35l-3.14-2.45c-.87.58-1.98.93-3.31.93-2.54 0-4.7-1.72-5.47-4.04H3.29v2.53A9.75 9.75 0 0 0 12 21.75Z" />
      <path fill="#FBBC05" d="M6.53 13.84a5.87 5.87 0 0 1 0-3.68V7.63H3.29a9.75 9.75 0 0 0 0 8.74l3.24-2.53Z" />
      <path fill="#EA4335" d="M12 6.12c1.43 0 2.72.49 3.73 1.47l2.8-2.8C16.83 3.18 14.62 2.25 12 2.25a9.75 9.75 0 0 0-8.71 5.38l3.24 2.53C7.3 7.84 9.46 6.12 12 6.12Z" />
    </svg>
  );
}

export default function SmmAuth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const nextPath = getBuyerNextPath(searchParams.get('next'));
  const [mode, setMode] = useState(searchParams.get('mode') === 'reset' ? 'reset' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(
    () => new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type') === 'recovery',
  );
  const [resetStep, setResetStep] = useState(
    () => new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type') === 'recovery' ? 'password' : 'email',
  );
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const firstField = useRef(null);

  useEffect(() => {
    document.title = 'Connexion au panel social — Caleb Creative';
  }, []);

  useEffect(() => {
    if (!authLoading && !user?.email_confirmed_at) firstField.current?.focus();
    if (!authLoading && user?.email_confirmed_at && mode !== 'reset' && !isRecoveryFlow) navigate(nextPath, { replace: true });
  }, [authLoading, isRecoveryFlow, mode, navigate, nextPath, user]);

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
        setResetStep('password');
        setError('');
        setNotice('');
      }
    });
    return () => listener?.subscription?.unsubscribe();
  }, []);

  async function submitEmail(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Saisis une adresse e-mail valide.');
      return;
    }
    if (awaitingConfirmation && !new RegExp(`^\\d{${CODE_LENGTH}}$`).test(confirmationCode)) {
      setError(`Saisis les ${CODE_LENGTH} chiffres du code reçu par e-mail.`);
      return;
    }
    if (mode === 'signup' && !awaitingConfirmation && password.length < 8) {
      setError('Choisis un mot de passe d’au moins 8 caractères.');
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'signup' && !awaitingConfirmation) {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { emailRedirectTo: getSmmAuthUrl(nextPath) },
        });
        if (signupError) throw signupError;
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
          token: confirmationCode,
          type: 'signup',
        });
        if (verifyError) throw verifyError;
        if (!data.user?.email_confirmed_at) throw new Error('L’adresse e-mail n’a pas été confirmée.');
        navigate(nextPath, { replace: true });
      } else {
        const { data, error: signinError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (signinError) throw signinError;
        if (!data.user?.email_confirmed_at) {
          await supabase.auth.signOut();
          setAwaitingConfirmation(true);
          setNotice('Confirme ton adresse e-mail avec le code reçu avant de continuer.');
          return;
        }
        navigate(nextPath, { replace: true });
      }
    } catch (authError) {
      console.error('Authentification au panel social impossible :', authError);
      if (mode === 'signup' && !awaitingConfirmation && /already registered|already exists|user already/i.test(authError?.message || '')) {
        setMode('login');
        setNotice('Cette adresse possède déjà un compte partagé avec la boutique. Connecte-toi avec le même mot de passe.');
      } else {
        setError(getAuthError(authError));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function signInWithGoogle() {
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: getSmmAuthUrl(nextPath) },
      });
      if (oauthError) throw oauthError;
    } catch (oauthError) {
      console.error('Connexion Google au panel social impossible :', oauthError);
      setError(getAuthError(oauthError));
      setSubmitting(false);
    }
  }

  async function resendCode() {
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
      setResendSeconds(30);
    } catch (resendError) {
      console.error('Renvoi du code de confirmation impossible :', resendError);
      setError(getAuthError(resendError));
    } finally {
      setSubmitting(false);
    }
  }

  async function sendResetCode(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Saisis une adresse e-mail valide.');
      return;
    }
    setSubmitting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: getSmmAuthUrl(nextPath),
      });
      if (resetError) throw resetError;
      setResetStep('code');
      setConfirmationCode('');
      setResendSeconds(30);
      setNotice(`Un code de réinitialisation a été envoyé à ${email.trim()}.`);
    } catch (resetError) {
      console.error('Envoi du code de réinitialisation SMM impossible :', resetError);
      setError(getAuthError(resetError));
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyResetCode(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(confirmationCode)) {
      setError(`Saisis les ${CODE_LENGTH} chiffres du code reçu par e-mail.`);
      return;
    }
    setSubmitting(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: confirmationCode,
        type: 'recovery',
      });
      if (verifyError) throw verifyError;
      setIsRecoveryFlow(true);
      setResetStep('password');
      setConfirmationCode('');
      setNotice('Code vérifié. Tu peux maintenant choisir un nouveau mot de passe.');
    } catch (verifyError) {
      console.error('Vérification du code de réinitialisation SMM impossible :', verifyError);
      setError(getAuthError(verifyError));
    } finally {
      setSubmitting(false);
    }
  }

  async function resendResetCode() {
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'recovery',
        email: email.trim().toLowerCase(),
      });
      if (resendError) throw resendError;
      setNotice(`Un nouveau code de réinitialisation a été envoyé à ${email.trim()}.`);
      setResendSeconds(30);
    } catch (resendError) {
      console.error('Renvoi du code de réinitialisation SMM impossible :', resendError);
      setError(getAuthError(resendError));
    } finally {
      setSubmitting(false);
    }
  }

  async function saveNewPassword(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (password.length < 8) {
      setError('Choisis un mot de passe d’au moins 8 caractères.');
      return;
    }
    if (password !== passwordConfirmation) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setIsRecoveryFlow(false);
      navigate(nextPath, { replace: true });
    } catch (updateError) {
      console.error('Modification du mot de passe SMM impossible :', updateError);
      setError(getAuthError(updateError));
    } finally {
      setSubmitting(false);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setAwaitingConfirmation(false);
    setIsRecoveryFlow(false);
    setResetStep('email');
    setConfirmationCode('');
    setPassword('');
    setPasswordConfirmation('');
    setError('');
    setNotice('');
  }

  const title = awaitingConfirmation
    ? 'Confirme ton adresse'
      : mode === 'reset' && resetStep === 'password'
      ? 'Nouveau mot de passe'
      : mode === 'reset'
        ? 'Réinitialiser ton accès'
        : mode === 'signup'
          ? 'Créer mon espace'
          : 'Ravi de te revoir';

  if (authLoading) {
    return <main className="smm-auth-page"><div className="smm-auth-loading">Vérification de ta session…</div></main>;
  }

  return (
    <main className="smm-auth-page">
      <Seo
        title="Connexion au panel social — Caleb Creative"
        description="Connecte-toi à ton espace Caleb Creative pour gérer tes services sociaux."
        path="/smm/connexion"
      />
      <div className="smm-auth-orb smm-auth-orb-one" aria-hidden="true" />
      <div className="smm-auth-orb smm-auth-orb-two" aria-hidden="true" />
      <section className="smm-auth-layout">
        <aside className="smm-auth-aside">
          <div className="smm-auth-aside-copy">
            <span className="smm-auth-kicker">TON ESPACE SOCIAL</span>
            <h1>Fais grandir ta présence, simplement.</h1>
            <p>Un seul espace pour retrouver tes services, suivre tes commandes et maîtriser ton budget en FCFA.</p>
            <ul>
              <li><span>01</span> Un catalogue de services sélectionnés</li>
              <li><span>02</span> Des tarifs affichés en FCFA</li>
              <li><span>03</span> Un suivi clair de tes commandes</li>
            </ul>
          </div>
          <span className="smm-auth-aside-footer">CALEB CREATIVE · BÉNIN</span>
        </aside>

        <div className="smm-auth-main">
          <div className="smm-auth-card">
            <Link to="/" className="smm-auth-back">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M15 18l-6-6 6-6M9 12h11" />
              </svg>
              <span>Retour à l’accueil principal</span>
            </Link>
            <p className="smm-auth-kicker">PANEL SOCIAL</p>
            <h2>{title}</h2>
            <p className="smm-auth-intro">
              {awaitingConfirmation
                ? `Saisis le code envoyé à ${email.trim()}.`
                : mode === 'signup'
                  ? 'Crée ton compte pour accéder à ton espace de services sociaux.'
                  : mode === 'reset'
                    ? resetStep === 'password'
                      ? 'Choisis un nouveau mot de passe sécurisé.'
                      : resetStep === 'code'
                        ? `Saisis le code envoyé à ${email.trim()} pour continuer.`
                        : 'Nous t’enverrons un code pour retrouver ton compte.'
                    : 'Connecte-toi pour retrouver ton portefeuille et tes commandes.'}
            </p>

            {error && <p className="smm-auth-message is-error" role="alert">{error}</p>}
            {notice && <p className="smm-auth-message is-success" role="status">{notice}</p>}

            {!awaitingConfirmation && mode !== 'reset' && (
              <>
                <div className="smm-auth-tabs" role="tablist" aria-label="Type d’accès au panel">
                  <button type="button" className={mode === 'login' ? 'is-active' : ''} onClick={() => changeMode('login')}>Connexion</button>
                  <button type="button" className={mode === 'signup' ? 'is-active' : ''} onClick={() => changeMode('signup')}>Créer un compte</button>
                </div>
                <button className="smm-auth-google" type="button" onClick={signInWithGoogle} disabled={submitting}>
                  <GoogleIcon /> Continuer avec Google
                </button>
                <div className="smm-auth-divider"><span>ou avec ton e-mail</span></div>
              </>
            )}

            {awaitingConfirmation ? (
              <form className="smm-auth-form" onSubmit={submitEmail}>
                <label htmlFor="smm-confirm-code">Code de confirmation</label>
                <input
                  id="smm-confirm-code"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={CODE_LENGTH}
                  pattern={`[0-9]{${CODE_LENGTH}}`}
                  value={confirmationCode}
                  onChange={(event) => setConfirmationCode(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
                  required
                />
                <button className="smm-auth-submit" type="submit" disabled={submitting}>
                  {submitting ? 'Vérification…' : 'Confirmer mon e-mail'}
                </button>
                <button className="smm-auth-link-button" type="button" onClick={resendCode} disabled={submitting || resendSeconds > 0}>
                  {resendSeconds > 0 ? `Renvoyer le code dans ${resendSeconds} s` : 'Renvoyer le code'}
                </button>
              </form>
            ) : mode === 'reset' && resetStep === 'password' ? (
              <form className="smm-auth-form" onSubmit={saveNewPassword}>
                <label htmlFor="smm-new-password">Nouveau mot de passe</label>
                <input id="smm-new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
                <label htmlFor="smm-confirm-password">Confirmer le mot de passe</label>
                <input id="smm-confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} required />
                <button className="smm-auth-link-button" type="button" onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}
                </button>
                <button className="smm-auth-submit" type="submit" disabled={submitting}>{submitting ? 'Enregistrement…' : 'Enregistrer le mot de passe'}</button>
              </form>
            ) : mode === 'reset' && resetStep === 'code' ? (
              <form className="smm-auth-form" onSubmit={verifyResetCode}>
                <label htmlFor="smm-reset-code">Code de réinitialisation</label>
                <input
                  id="smm-reset-code"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={CODE_LENGTH}
                  pattern={`[0-9]{${CODE_LENGTH}}`}
                  value={confirmationCode}
                  onChange={(event) => setConfirmationCode(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
                  required
                />
                <button className="smm-auth-submit" type="submit" disabled={submitting}>{submitting ? 'Vérification…' : 'Vérifier le code'}</button>
                <button className="smm-auth-link-button" type="button" onClick={resendResetCode} disabled={submitting || resendSeconds > 0}>
                  {resendSeconds > 0 ? `Renvoyer le code dans ${resendSeconds} s` : 'Renvoyer le code'}
                </button>
                <button className="smm-auth-link-button" type="button" onClick={() => setResetStep('email')} disabled={submitting}>Modifier l’adresse e-mail</button>
              </form>
            ) : mode === 'reset' ? (
              <form className="smm-auth-form" onSubmit={sendResetCode}>
                <label htmlFor="smm-reset-email">Adresse e-mail</label>
                <input id="smm-reset-email" ref={firstField} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="toi@exemple.com" required />
                <button className="smm-auth-submit" type="submit" disabled={submitting}>{submitting ? 'Envoi…' : 'Envoyer le code'}</button>
                <button className="smm-auth-link-button" type="button" onClick={() => changeMode('login')}>Retour à la connexion</button>
              </form>
            ) : (
              <form className="smm-auth-form" onSubmit={submitEmail}>
                <label htmlFor="smm-email">Adresse e-mail</label>
                <input
                  id="smm-email"
                  ref={firstField}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="toi@exemple.com"
                  required
                />
                <label htmlFor="smm-password">Mot de passe</label>
                <input
                  id="smm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  minLength={mode === 'signup' ? 8 : undefined}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === 'signup' ? '8 caractères minimum' : 'Ton mot de passe'}
                  required
                />
                <div className="smm-auth-form-options">
                  <label className="smm-auth-show-password">
                    <input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />
                    Afficher
                  </label>
                  {mode === 'login' && <button type="button" className="smm-auth-inline-link" onClick={() => changeMode('reset')}>Mot de passe oublié ?</button>}
                </div>
                <button className="smm-auth-submit" type="submit" disabled={submitting}>
                  {submitting ? 'Patiente…' : mode === 'signup' ? 'Créer mon compte' : 'Accéder à mon espace'}
                  <span aria-hidden="true">→</span>
                </button>
              </form>
            )}
            <p className="smm-auth-shop-note">
              Utilise le même compte que pour la boutique. Si tu y es déjà connecté, l’accès est automatique. <Link to="/boutique">Visiter la boutique</Link>
            </p>
            <p className="smm-auth-privacy">Ton mot de passe reste géré de manière sécurisée par Supabase.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

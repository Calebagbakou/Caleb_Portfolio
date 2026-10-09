import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';

async function getInvocationError(error, data) {
  if (typeof data?.error === 'string') return data.error;
  if (error?.context && typeof error.context.clone === 'function') {
    try {
      const body = await error.context.clone().json();
      if (typeof body?.error === 'string') return body.error;
      if (typeof body?.message === 'string') return body.message;
    } catch {
      try {
        const responseText = await error.context.clone().text();
        if (responseText) return responseText.slice(0, 300);
      } catch {
        // Keep the SDK error when the response body cannot be read.
      }
    }
  }
  const status = error?.context?.status;
  const statusText = status ? `HTTP ${status}` : '';
  const message = error?.message || 'La requête PixVerify a échoué.';
  return [statusText, message].filter(Boolean).join(' — ');
}

export default function GeminiPro() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id') || '';
  const orderRef = searchParams.get('order_ref') || '';
  const [type, setType] = useState('vip');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [generationId, setGenerationId] = useState(null);
  const [status, setStatus] = useState('checking');
  const [resultUrl, setResultUrl] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadExistingVerification() {
      if (!orderId || !orderRef) {
        setStatus('invalid_order');
        return;
      }

      const { data, error: invokeError } = await supabase.functions.invoke('gemini-pro-activate', {
        body: { action: 'status', order_id: orderId, order_ref: orderRef },
      });
      if (cancelled) return;
      if (invokeError || data?.error) {
        setError(await getInvocationError(invokeError, data));
        setStatus('error');
        return;
      }

      setStatus(data.status || 'not_started');
      setGenerationId(data.generation_id || null);
      setResultUrl(data.result_url || '');
      if (data.status === 'failed') {
        setError(data.error_code
          ? `PixVerify n’a pas pu terminer la vérification (code : ${data.error_code}).`
          : 'PixVerify n’a pas pu terminer la vérification.');
      }
    }

    loadExistingVerification();
    return () => {
      cancelled = true;
    };
  }, [orderId, orderRef]);

  useEffect(() => {
    if (!orderId || !orderRef || !['starting', 'pending', 'queued', 'running'].includes(status)) return undefined;

    let cancelled = false;
    let timeoutId;

    async function checkStatus() {
      const { data, error: invokeError } = await supabase.functions.invoke('gemini-pro-activate', {
        body: { action: 'status', order_id: orderId, order_ref: orderRef },
      });

      if (cancelled) return;
      if (invokeError || data?.error) {
        setError(await getInvocationError(invokeError, data));
        setStatus('error');
        return;
      }

      setStatus(data.status);
      if (data.status === 'success') {
        setResultUrl(data.result_url || '');
      } else if (data.status === 'failed') {
        setError(data.error_code
          ? `PixVerify n’a pas pu terminer la vérification (code : ${data.error_code}).`
          : 'PixVerify n’a pas pu terminer la vérification.');
      } else {
        timeoutId = window.setTimeout(checkStatus, 4000);
      }
    }

    timeoutId = window.setTimeout(checkStatus, 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [orderId, orderRef, status]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setResultUrl('');
    setSubmitting(true);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('gemini-pro-activate', {
        body: {
          action: 'start',
          order_id: orderId,
          order_ref: orderRef,
          type,
          email: email.trim(),
          password,
          totp_secret: totpSecret.replace(/\s/g, '').toUpperCase(),
        },
      });

      if (invokeError || data?.error) throw new Error(await getInvocationError(invokeError, data));
      if (data?.generation_id === undefined) throw new Error('PixVerify n’a pas renvoyé d’identifiant de vérification.');

      setGenerationId(data.generation_id);
      setStatus(data.status || 'pending');
      setPassword('');
      setTotpSecret('');
    } catch (submitError) {
      console.error('Impossible de démarrer la vérification PixVerify:', submitError);
      setError(submitError.message || 'Impossible de démarrer la vérification. Réessaie plus tard.');
    } finally {
      setSubmitting(false);
    }
  }

  const isRunning = ['starting', 'pending', 'queued', 'running'].includes(status);
  const isVerifiedOrder = Boolean(orderId && orderRef);

  return (
    <main style={{ padding: '2rem', maxWidth: '680px', margin: '0 auto' }}>
      <div className="confirm-wrap">
        <h1 style={{ fontSize: 'clamp(1.6rem,4vw,2.1rem)', margin: '0 0 8px' }}>
          Vérification Google One
        </h1>
        <p style={{ color: 'var(--ink-dim)', marginBottom: '1.5rem' }}>
          Après une commande Gemini Pro payée, cette page envoie la demande à PixVerify et affiche son statut ou son message de solde.
        </p>

        {!isVerifiedOrder && (
          <div className="shop-admin-alert error" role="alert">
            Ouvre cette page depuis le bouton PixVerify de la confirmation d’une commande Gemini Pro payée.
          </div>
        )}

        {isVerifiedOrder && status === 'checking' && (
          <div className="state-box" role="status">Vérification de la commande…</div>
        )}

        {isVerifiedOrder && status === 'not_started' && (
          <form onSubmit={handleSubmit} className="form-card" style={{ textAlign: 'left' }}>
            <div className="form-group">
              <label htmlFor="gemini-verification-type">Type de vérification</label>
              <select id="gemini-verification-type" value={type} onChange={(event) => setType(event.target.value)}>
                <option value="vip">VIP — abonnement complet</option>
                <option value="normal">Normal — lien uniquement</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="gemini-email">Adresse Gmail</label>
              <input
                id="gemini-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="gemini-password">Mot de passe Google</label>
              <input
                id="gemini-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="gemini-totp">Secret TOTP (32 caractères Base32)</label>
              <input
                id="gemini-totp"
                type="password"
                autoComplete="off"
                required
                maxLength={39}
                value={totpSecret}
                onChange={(event) => setTotpSecret(event.target.value)}
              />
            </div>
            <p style={{ color: 'var(--ink-dim)', fontSize: '0.85rem' }}>
              Ces informations sont envoyées à PixVerify pour cette demande et ne sont pas enregistrées par ce site.
              Saisis uniquement les identifiants d’un compte que tu possèdes. PixVerify peut débiter des crédits si
              la demande est acceptée.
            </p>
            {error && <div className="shop-admin-alert error" role="alert">{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Envoi à PixVerify…' : 'Démarrer la vérification PixVerify'}
            </button>
          </form>
        )}

        {isVerifiedOrder && isRunning && (
          <div className="state-box" role="status" aria-live="polite">
            Vérification en cours auprès de PixVerify… Le statut est actualisé automatiquement.
            {generationId && <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Référence : {generationId}</div>}
          </div>
        )}

        {isVerifiedOrder && status === 'success' && resultUrl && (
          <>
            <div className="confirm-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M5 12l5 5L20 7" />
              </svg>
            </div>
            <h2>Vérification terminée</h2>
            <p style={{ color: 'var(--ink-dim)', marginBottom: '1.5rem' }}>
              PixVerify a terminé la vérification. Ouvre le lien de résultat Google.
            </p>
            <a href={resultUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              Ouvrir le résultat Google One
            </a>
          </>
        )}

        {isVerifiedOrder && ['failed', 'error'].includes(status) && (
          <div className="shop-admin-alert error" role="alert">
            {error || 'La vérification n’a pas abouti.'}
            {generationId && <div style={{ marginTop: '0.5rem' }}>Référence : {generationId}</div>}
          </div>
        )}

        <div className="shop-hero-cta" style={{ marginTop: '1.5rem' }}>
          <Link to="/boutique/catalogue" className="btn btn-outline">Retour à la boutique</Link>
        </div>
      </div>
    </main>
  );
}

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { getSettings, saveSettings } from '../../services/settings';

const SIMPLE_KEYS = ['site_name', 'logo_url', 'favicon_url', 'contact_email', 'contact_phone', 'shop_url', 'availability_banner'];
const SOCIAL_FIELDS = {
  social_facebook: 'facebook',
  social_instagram: 'instagram',
  social_linkedin: 'linkedin',
  social_whatsapp: 'whatsapp',
  social_youtube: 'youtube',
  social_tiktok: 'tiktok',
};

const emptyForm = {
  site_name: '',
  logo_url: '',
  favicon_url: '',
  contact_email: '',
  contact_phone: '',
  shop_url: '',
  availability_banner: 'Disponible pour de nouveaux projets',
  social_facebook: '',
  social_instagram: '',
  social_linkedin: '',
  social_whatsapp: '',
  social_youtube: '',
  social_tiktok: '',
};

export default function Parametres() {
  const { user } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState('loading'); // loading | error | ready
  const [errorText, setErrorText] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await getSettings();
      if (error) {
        console.error(error);
        setErrorText('Erreur de chargement : ' + error.message);
        setStatus('error');
        return;
      }

      const map = {};
      for (const row of data || []) map[row.key] = row.value;

      const next = { ...emptyForm };
      for (const key of SIMPLE_KEYS) {
        if (map[key] != null) next[key] = map[key];
      }
      const social = map.social_links || {};
      for (const [inputId, socialKey] of Object.entries(SOCIAL_FIELDS)) {
        if (social[socialKey]) next[inputId] = social[socialKey];
      }

      setForm(next);
      setStatus('ready');
    })();
  }, []);

  useEffect(() => {
    if (location.hash !== '#admin-security') return undefined;
    const frame = requestAnimationFrame(() => {
      document.getElementById('admin-security')?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.hash]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setPasswordMessage(null);
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ error: true, text: 'Les deux nouveaux mots de passe ne correspondent pas.' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage({ error: true, text: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
      return;
    }
    if (!user?.email) {
      setPasswordMessage({ error: true, text: 'Impossible de vérifier le compte administrateur connecté.' });
      return;
    }

    setPasswordSaving(true);
    try {
      const { error: verificationError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verificationError) {
        throw new Error('Le mot de passe actuel est incorrect.');
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage({ error: false, text: 'Mot de passe administrateur modifié.' });
    } catch (error) {
      console.error('Impossible de modifier le mot de passe administrateur :', error);
      setPasswordMessage({
        error: true,
        text: error instanceof Error ? error.message : 'La modification du mot de passe a échoué.',
      });
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    setSaveError(false);

    const rows = SIMPLE_KEYS.map((key) => ({ key, value: form[key].trim() }));

    const social = {};
    for (const [inputId, socialKey] of Object.entries(SOCIAL_FIELDS)) {
      const val = form[inputId].trim();
      if (val) social[socialKey] = val;
    }
    rows.push({ key: 'social_links', value: social });

    try {
      const { error } = await saveSettings(rows);
      if (error) throw error;
    } catch (error) {
      console.error('Impossible d’enregistrer les paramètres :', error);
      setSaveMsg('Erreur : ' + error.message);
      setSaveError(true);
      setSaving(false);
      return;
    }
    setSaving(false);

    setSaveMsg('✓ Paramètres enregistrés.');
    setTimeout(() => setSaveMsg(''), 4000);
  }

  return (
    <>
      <section className="panel settings-security-panel" id="admin-security">
        <div className="settings-security-heading">
          <div>
            <span className="settings-security-eyebrow">Sécurité du compte</span>
            <h2>Changer le mot de passe administrateur</h2>
            <p>Confirme le mot de passe actuel avant d’en choisir un nouveau.</p>
          </div>
          <span className="settings-security-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 118 0v3M12 14v3" />
            </svg>
          </span>
        </div>
        <form className="settings-password-form" onSubmit={handlePasswordSubmit}>
          <div className="form-group">
            <label htmlFor="admin-current-password">Mot de passe actuel</label>
            <input
              id="admin-current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="admin-new-password">Nouveau mot de passe</label>
            <input
              id="admin-new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="admin-confirm-password">Confirmer le nouveau mot de passe</label>
            <input
              id="admin-confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>
          <div className="save-bar">
            <button className="btn btn-primary" type="submit" disabled={passwordSaving}>
              {passwordSaving ? 'Modification…' : 'Mettre à jour le mot de passe'}
            </button>
            {passwordMessage && (
              <span className={`save-msg${passwordMessage.error ? ' error' : ''}`} role={passwordMessage.error ? 'alert' : 'status'}>
                {passwordMessage.text}
              </span>
            )}
          </div>
        </form>
      </section>

    <div className="panel">
      {status === 'loading' && <div className="state-box">Chargement…</div>}
      {status === 'error' && <div className="state-box error">{errorText}</div>}

      {status === 'ready' && (
        <form className="settings-form" onSubmit={handleSubmit}>
          <div className="settings-section">
            <h3>Général</h3>
            <div className="form-group">
              <label htmlFor="site_name">Nom du site</label>
              <input
                type="text"
                id="site_name"
                value={form.site_name}
                onChange={(e) => updateField('site_name', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="logo_url">URL du logo</label>
              <input
                type="url"
                id="logo_url"
                placeholder="https://…"
                value={form.logo_url}
                onChange={(e) => updateField('logo_url', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="favicon_url">URL du favicon</label>
              <input
                type="url"
                id="favicon_url"
                placeholder="https://…"
                value={form.favicon_url}
                onChange={(e) => updateField('favicon_url', e.target.value)}
              />
            </div>
          </div>

          <div className="settings-section">
            <h3>Contact</h3>
            <div className="form-group">
              <label htmlFor="availability_banner">Bandeau de disponibilité</label>
              <input
                type="text"
                id="availability_banner"
                maxLength="100"
                placeholder="Disponible pour de nouveaux projets"
                value={form.availability_banner}
                onChange={(e) => updateField('availability_banner', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="contact_email">Email de contact</label>
              <input
                type="email"
                id="contact_email"
                value={form.contact_email}
                onChange={(e) => updateField('contact_email', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="contact_phone">Téléphone de contact</label>
              <input
                type="text"
                id="contact_phone"
                placeholder="+229…"
                value={form.contact_phone}
                onChange={(e) => updateField('contact_phone', e.target.value)}
              />
            </div>
          </div>

          <div className="settings-section">
            <h3>Boutique</h3>
            <div className="form-group">
              <label htmlFor="shop_url">URL de la boutique</label>
              <input
                type="text"
                id="shop_url"
                placeholder="./boutique/index.html"
                value={form.shop_url}
                onChange={(e) => updateField('shop_url', e.target.value)}
              />
            </div>
          </div>

          <div className="settings-section">
            <h3>Réseaux sociaux</h3>
            <div className="form-group">
              <label htmlFor="social_facebook">Facebook</label>
              <input
                type="url"
                id="social_facebook"
                placeholder="https://facebook.com/…"
                value={form.social_facebook}
                onChange={(e) => updateField('social_facebook', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="social_instagram">Instagram</label>
              <input
                type="url"
                id="social_instagram"
                placeholder="https://instagram.com/…"
                value={form.social_instagram}
                onChange={(e) => updateField('social_instagram', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="social_linkedin">LinkedIn</label>
              <input
                type="url"
                id="social_linkedin"
                placeholder="https://linkedin.com/in/…"
                value={form.social_linkedin}
                onChange={(e) => updateField('social_linkedin', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="social_whatsapp">WhatsApp</label>
              <input
                type="text"
                id="social_whatsapp"
                placeholder="https://wa.me/…"
                value={form.social_whatsapp}
                onChange={(e) => updateField('social_whatsapp', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="social_youtube">YouTube</label>
              <input
                type="url"
                id="social_youtube"
                placeholder="https://youtube.com/…"
                value={form.social_youtube}
                onChange={(e) => updateField('social_youtube', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="social_tiktok">TikTok</label>
              <input
                type="url"
                id="social_tiktok"
                placeholder="https://tiktok.com/@…"
                value={form.social_tiktok}
                onChange={(e) => updateField('social_tiktok', e.target.value)}
              />
            </div>
          </div>

          <div className="save-bar">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <span className={`save-msg${saveError ? ' error' : ''}`}>{saveMsg}</span>
          </div>
        </form>
      )}
    </div>
    </>
  );
}

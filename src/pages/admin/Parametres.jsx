import { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '../../services/settings';

const SIMPLE_KEYS = ['site_name', 'logo_url', 'favicon_url', 'contact_email', 'contact_phone', 'shop_url'];
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
  social_facebook: '',
  social_instagram: '',
  social_linkedin: '',
  social_whatsapp: '',
  social_youtube: '',
  social_tiktok: '',
};

export default function Parametres() {
  const [status, setStatus] = useState('loading'); // loading | error | ready
  const [errorText, setErrorText] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState(false);

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

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    setSaveError(false);

    const rows = SIMPLE_KEYS.map((key) => ({ key, value: form[key].trim() || null }));

    const social = {};
    for (const [inputId, socialKey] of Object.entries(SOCIAL_FIELDS)) {
      const val = form[inputId].trim();
      if (val) social[socialKey] = val;
    }
    rows.push({ key: 'social_links', value: social });

    const { error } = await saveSettings(rows);
    setSaving(false);

    if (error) {
      console.error(error);
      setSaveMsg('Erreur : ' + error.message);
      setSaveError(true);
      return;
    }

    setSaveMsg('✓ Paramètres enregistrés.');
    setTimeout(() => setSaveMsg(''), 4000);
  }

  return (
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
  );
}

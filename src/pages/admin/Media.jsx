import { useEffect, useState } from 'react';
import { listShopAdminData } from '../../services/shop';
import { getSettings, saveSettings } from '../../services/settings';
import { supabase } from '../../services/supabase';
import { TOOL_GROUPS } from '../../data/tools';
import { parseSectionLogoSettings, SECTION_ICON_GROUPS, SECTION_LOGOS_SETTING } from '../../data/sectionLogos';

const BUCKET = 'site-media';
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const TOOL_LOGOS_SETTING = 'site_tool_logos';
const IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

function UploadField({ id, label, currentUrl, busy, disabled, onChange, onRemove, previewClassName = '' }) {
  return (
    <div className="media-upload-field">
      <div className={`media-upload-preview${previewClassName ? ` ${previewClassName}` : ''}`}>
        {currentUrl
          ? <img src={currentUrl} alt={label} />
          : <span>Aucune image</span>}
      </div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={onChange}
        disabled={busy || disabled}
      />
      {currentUrl && onRemove && (
        <button className="btn btn-secondary btn-sm" type="button" onClick={onRemove} disabled={busy || disabled}>
          Retirer le logo
        </button>
      )}
      <small className="project-form-hint">JPG, PNG, WebP ou AVIF · 8 Mo maximum. L’image est publiée sur le site.</small>
      {busy && <small className="media-upload-status">Importation en cours…</small>}
    </div>
  );
}

export default function Media() {
  const [products, setProducts] = useState([]);
  const [toolLogos, setToolLogos] = useState({});
  const [sectionLogos, setSectionLogos] = useState({});
  const [profileUrl, setProfileUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadMedia() {
    setLoading(true);
    setError('');
    const [shopResult, settingsResult] = await Promise.all([listShopAdminData(), getSettings()]);
    if (shopResult.error || settingsResult.error) {
      const loadError = shopResult.error || settingsResult.error;
      console.error('Impossible de charger les médias administrables :', loadError);
      setError(`Chargement impossible : ${loadError.message}`);
    } else {
      setProducts(shopResult.data.products);
      const profileSetting = settingsResult.data?.find((setting) => setting.key === 'site_profile_image_url');
      setProfileUrl(profileSetting?.value || '');
      const toolLogosSetting = settingsResult.data?.find((setting) => setting.key === TOOL_LOGOS_SETTING);
      try {
        const parsedToolLogos = toolLogosSetting?.value ? JSON.parse(toolLogosSetting.value) : {};
        if (
          !parsedToolLogos
          || typeof parsedToolLogos !== 'object'
          || Array.isArray(parsedToolLogos)
          || Object.values(parsedToolLogos).some((url) => typeof url !== 'string')
        ) {
          throw new Error('Le paramètre des logos d’outils doit contenir un objet JSON avec des URLs textuelles.');
        }
        setToolLogos(parsedToolLogos);
      } catch (parseError) {
        console.error('Impossible de lire les logos des outils enregistrés :', parseError);
        setError('Chargement impossible : le paramètre des logos des outils est invalide.');
      }
      const sectionLogosSetting = settingsResult.data?.find((setting) => setting.key === SECTION_LOGOS_SETTING);
      try {
        setSectionLogos(parseSectionLogoSettings(sectionLogosSetting?.value));
      } catch (parseError) {
        console.error('Impossible de lire les icônes personnalisées des sections :', parseError);
        setError('Chargement impossible : le paramètre des icônes des sections est invalide.');
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    loadMedia();
  }, []);

  async function handleUpload(event, { key, product, field }) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setError('');
    setNotice('');
    if (!Object.hasOwn(IMAGE_EXTENSIONS, file.type)) {
      setError('Choisis une image JPG, PNG, WebP ou AVIF.');
      input.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError('Cette image dépasse la limite de 8 Mo.');
      input.value = '';
      return;
    }

    setUploading(key);
    try {
      const scope = product
        ? `products/${product.id}`
        : field === 'tool_logo'
          ? 'tools'
          : field === 'section_logo'
            ? 'section-icons'
            : 'site';
      const path = `${scope}/${field}-${crypto.randomUUID()}.${IMAGE_EXTENSIONS[file.type]}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = publicUrlData?.publicUrl;
      if (!publicUrl) throw new Error('Supabase n’a pas renvoyé l’adresse publique de l’image.');

      if (product) {
        const { error: updateError } = await supabase
          .from('products')
          .update({ [field]: publicUrl })
          .eq('id', product.id);
        if (updateError) throw updateError;
        setProducts((current) => current.map((item) => (
          item.id === product.id ? { ...item, [field]: publicUrl } : item
        )));
      } else if (field === 'tool_logo') {
        const nextLogos = { ...toolLogos, [key]: publicUrl };
        const { error: saveError } = await saveSettings([
          { key: TOOL_LOGOS_SETTING, value: JSON.stringify(nextLogos) },
        ]);
        if (saveError) throw saveError;
        setToolLogos(nextLogos);
      } else if (field === 'section_logo') {
        const nextLogos = {
          ...sectionLogos,
          [key]: { url: publicUrl, mode: 'custom' },
        };
        const { error: saveError } = await saveSettings([
          { key: SECTION_LOGOS_SETTING, value: JSON.stringify(nextLogos) },
        ]);
        if (saveError) throw saveError;
        setSectionLogos(nextLogos);
      } else {
        const { error: saveError } = await saveSettings([
          { key: 'site_profile_image_url', value: publicUrl },
        ]);
        if (saveError) throw saveError;
        setProfileUrl(publicUrl);
      }
      setNotice('Image importée et publiée.');
    } catch (uploadError) {
      console.error('Impossible d’importer ou d’assigner cette image :', uploadError);
      setError(`Importation impossible : ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
    } finally {
      setUploading('');
      input.value = '';
    }
  }

  async function setSectionLogoMode(id, mode) {
    setError('');
    setNotice('');
    setUploading(id);
    try {
      const nextLogos = {
        ...sectionLogos,
        [id]: { url: sectionLogos[id]?.url || '', mode },
      };
      const { error: saveError } = await saveSettings([
        { key: SECTION_LOGOS_SETTING, value: JSON.stringify(nextLogos) },
      ]);
      if (saveError) throw saveError;
      setSectionLogos(nextLogos);
      setNotice(`Affichage de l’icône ${mode === 'default' ? 'par défaut' : 'personnalisée'} enregistré.`);
    } catch (saveError) {
      console.error('Impossible de modifier l’affichage de cette icône :', saveError);
      setError(`Modification impossible : ${saveError instanceof Error ? saveError.message : String(saveError)}`);
    } finally {
      setUploading('');
    }
  }

  async function removeToolLogo(toolName) {
    setError('');
    setNotice('');
    setUploading(toolName);
    try {
      const nextLogos = { ...toolLogos };
      delete nextLogos[toolName];
      const { error: saveError } = await saveSettings([
        { key: TOOL_LOGOS_SETTING, value: JSON.stringify(nextLogos) },
      ]);
      if (saveError) throw saveError;
      setToolLogos(nextLogos);
      setNotice(`Logo de ${toolName} retiré.`);
    } catch (removeError) {
      console.error('Impossible de retirer ce logo d’outil :', removeError);
      setError(`Suppression impossible : ${removeError instanceof Error ? removeError.message : String(removeError)}`);
    } finally {
      setUploading('');
    }
  }

  return (
    <div className="media-admin">
      {error && <div className="shop-admin-alert error" role="alert">{error}</div>}
      {notice && <div className="shop-admin-alert success" role="status">{notice}</div>}
      {loading && <div className="state-box">Chargement des médias…</div>}

      {!loading && (
        <>
          <section className="panel">
            <div className="projects-heading">
              <div>
                <h2>Photo de profil principale</h2>
                <p>Cette image remplace la photo principale dans le haut de la page d’accueil.</p>
              </div>
            </div>
            <UploadField
              id="media-profile-image"
              label="Importer ou remplacer la photo de profil"
              currentUrl={profileUrl}
              busy={uploading === 'profile'}
              disabled={Boolean(uploading)}
              onChange={(event) => handleUpload(event, { key: 'profile', field: 'site_profile_image_url' })}
            />
          </section>

          <section className="panel">
            <div className="projects-heading">
              <div>
                <h2>Icônes des sections Services, À propos et Contact</h2>
                <p>Pour chaque icône, garde le visuel par défaut ou importe une image personnalisée. Le choix est enregistré immédiatement.</p>
              </div>
            </div>
            {SECTION_ICON_GROUPS.map((group) => (
              <div className="media-tool-group" key={group.section}>
                <h3>{group.section}</h3>
                <div className="media-tool-list">
                  {group.items.map((item) => {
                    const logo = sectionLogos[item.id] || { url: '', mode: 'default' };
                    const busy = uploading === item.id;
                    return (
                      <div className="media-tool-card" key={item.id}>
                        <UploadField
                          id={`media-section-icon-${item.id}`}
                          label={item.label}
                          currentUrl={logo.url}
                          busy={busy}
                          disabled={Boolean(uploading)}
                          previewClassName="media-tool-logo-preview"
                          onChange={(event) => handleUpload(event, {
                            key: item.id,
                            field: 'section_logo',
                          })}
                        />
                        <label className="media-section-logo-mode" htmlFor={`media-section-logo-mode-${item.id}`}>
                          Affichage
                        </label>
                        <select
                          id={`media-section-logo-mode-${item.id}`}
                          className="media-section-logo-select"
                          value={logo.mode}
                          disabled={Boolean(uploading)}
                          onChange={(event) => setSectionLogoMode(item.id, event.target.value)}
                        >
                          <option value="default">Icône par défaut</option>
                          <option value="custom" disabled={!logo.url}>Image personnalisée</option>
                        </select>
                        {!logo.url && <small className="project-form-hint">Importe une image pour activer le choix personnalisé.</small>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>

          <section className="panel">
            <div className="projects-heading">
              <div>
                <h2>Logos des logiciels et des IA</h2>
                <p>Importe ou remplace les logos affichés dans la section Outils du portfolio. Sans logo, les initiales restent affichées.</p>
              </div>
            </div>
            {TOOL_GROUPS.map((group) => (
              <div className="media-tool-group" key={group.label}>
                <h3>{group.label}</h3>
                <div className="media-tool-list">
                  {group.tools.map((tool) => {
                    const key = tool.name;
                    return (
                      <div className="media-tool-card" key={tool.name}>
                        <UploadField
                          id={`media-tool-logo-${tool.name}`}
                          label={tool.name}
                          currentUrl={toolLogos[tool.name] || ''}
                          busy={uploading === key}
                          disabled={Boolean(uploading)}
                          previewClassName="media-tool-logo-preview"
                          onChange={(event) => handleUpload(event, {
                            key: tool.name,
                            field: 'tool_logo',
                          })}
                          onRemove={() => removeToolLogo(tool.name)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>

          <section className="panel">
            <div className="projects-heading">
              <div>
                <h2>Logos et affiches des produits</h2>
                <p>L’affiche occupe le cadre carré; le logo apparaît en petit, en bas à gauche, dans un carré aux coins légèrement arrondis.</p>
              </div>
              <button className="btn btn-secondary btn-sm" type="button" onClick={loadMedia} disabled={loading || Boolean(uploading)}>
                Actualiser
              </button>
            </div>
            {products.length === 0 && <div className="state-box">Aucun produit trouvé.</div>}
            <div className="media-product-list">
              {products.map((product) => (
                <article className="media-product-card" key={product.id}>
                  <div className="media-product-heading">
                    <h3>{product.name}</h3>
                    <span className={`badge ${product.status === 'active' ? 'badge-ok' : 'badge-off'}`}>
                      {product.status === 'active' ? 'Publié' : 'Non publié'}
                    </span>
                  </div>
                  <div className="media-product-assets">
                    <UploadField
                      id={`media-product-logo-${product.id}`}
                      label="Logo du produit"
                      currentUrl={product.logo_url}
                      busy={uploading === `${product.id}-logo_url`}
                      disabled={Boolean(uploading)}
                      onChange={(event) => handleUpload(event, {
                        key: `${product.id}-logo_url`,
                        product,
                        field: 'logo_url',
                      })}
                    />
                    <UploadField
                      id={`media-product-poster-${product.id}`}
                      label="Affiche / visuel principal"
                      currentUrl={product.image_url}
                      busy={uploading === `${product.id}-image_url`}
                      disabled={Boolean(uploading)}
                      onChange={(event) => handleUpload(event, {
                        key: `${product.id}-image_url`,
                        product,
                        field: 'image_url',
                      })}
                    />
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { listShopAdminData } from '../../services/shop';
import { getSettings, saveSettings } from '../../services/settings';
import { supabase } from '../../services/supabase';

const BUCKET = 'site-media';
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

function UploadField({ id, label, currentUrl, busy, onChange }) {
  return (
    <div className="media-upload-field">
      <div className="media-upload-preview">
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
        disabled={busy}
      />
      <small className="project-form-hint">JPG, PNG, WebP ou AVIF · 8 Mo maximum. L’image est publiée sur le site.</small>
      {busy && <small className="media-upload-status">Importation en cours…</small>}
    </div>
  );
}

export default function Media() {
  const [products, setProducts] = useState([]);
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
      const scope = product ? `products/${product.id}` : 'site';
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
              onChange={(event) => handleUpload(event, { key: 'profile', field: 'site_profile_image_url' })}
            />
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

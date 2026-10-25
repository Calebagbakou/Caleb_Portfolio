import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  archiveShopProduct,
  createShopPromoCode,
  createShopCategory,
  deleteShopPromoCode,
  deleteShopCategory,
  listShopPromoCodes,
  listShopAdminData,
  saveShopContent,
  saveShopProduct,
  updateShopPromoCode,
  updateShopCategory,
  hideActivationProvider,
} from '../../services/shop';
import { DEFAULT_SHOP_CONTENT } from '../../context/ShopContext';
import { supabase } from '../../services/supabase';
import { plainTextToRichDocument, richDocumentToPlainText } from '../../utils/richContent';
import { isApiDelivery } from '../../utils/delivery';
import {
  getDownloadExtension,
  isValidDownloadFilename,
} from '../../../supabase/functions/_shared/downloadFile.mjs';

const RichTextEditor = lazy(() => import('../../components/admin/RichTextEditor'));

const EMPTY_PRODUCT = {
  id: null,
  name: '',
  slug: '',
  description: '',
  description_rich: null,
  tagline: '',
  highlights: '',
  category_id: '',
  badge: '',
  cta_label: 'Acheter maintenant',
  regular_price: '',
  promo_price: '',
  allow_multiple_qty: false,
  status: 'active',
  featured: false,
  avatar: '',
  gradient: 'linear-gradient(135deg,#4285F4,#34A853)',
  logo_url: '',
  image_url: '',
  poster_ratio: '4/3',
  access_url: '',
  delivery_type: 'activate',
  prodseller_product_id: '',
  zfourstore_product_id: '',
  active_api_provider: 'prodseller',
  download_filename: '',
  download_size: '',
  download_platform: '',
  download_instructions: '',
  plans: [{ id: null, slug: '', label: '', currency: 'XOF', active: true }],
};

const CONTENT_FIELDS = [
  ['shop_hero_title', 'Titre principal'],
  ['shop_hero_description', 'Description de la boutique'],
  ['shop_activation_title', 'Avantage 1 — titre'],
  ['shop_activation_description', 'Avantage 1 — description'],
  ['shop_contact_title', 'Avantage 2 — titre'],
  ['shop_contact_description', 'Avantage 2 — description'],
  ['shop_payment_title', 'Avantage 3 — titre'],
  ['shop_payment_description', 'Avantage 3 — description'],
];

const EMPTY_PROMO_FORM = {
  id: null,
  name: '',
  code: '',
  discount_type: 'percentage',
  discount_value: '',
  is_gift: false,
  product_ids: [],
  max_uses: '100',
  max_uses_per_email: '1',
  starts_at: '',
  expires_at: '',
  active: true,
};

function slugify(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function makePromoCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const values = crypto.getRandomValues(new Uint8Array(8));
  return `CC-${Array.from(values, (value) => alphabet[value % alphabet.length]).join('')}`;
}

async function getInvocationErrorMessage(error) {
  if (error?.context instanceof Response) {
    try {
      const responseData = await error.context.clone().json();
      if (typeof responseData?.error === 'string') return responseData.error;
    } catch (parseError) {
      console.warn('La réponse d’erreur ProdSeller n’est pas un JSON lisible.');
    }
  }
  if (error?.name === 'FunctionsFetchError'
    || /failed to send a request/i.test(error?.message || '')) {
    return 'La fonction ProdSeller est injoignable ou ne démarre pas. Vérifiez son déploiement et ses journaux Supabase, puis réessayez.';
  }
  return error?.message || '';
}

function productForm(product) {
  return {
    ...EMPTY_PRODUCT,
    ...product,
    description_rich: product.description_rich || plainTextToRichDocument(product.description),
    highlights: (product.highlights || []).join('\n'),
    badge: product.badge || '',
    cta_label: product.cta_label || 'Acheter maintenant',
    regular_price: product.regular_price ?? '',
    promo_price: product.promo_price ?? '',
    allow_multiple_qty: product.allow_multiple_qty ?? product.slug === 'gemini-pro',
    avatar: product.avatar || '',
    gradient: product.gradient || EMPTY_PRODUCT.gradient,
    logo_url: product.logo_url || '',
    image_url: product.image_url || '',
    poster_ratio: product.poster_ratio || '4/3',
    access_url: product.access_url || '',
    delivery_type: product.delivery_type || 'activate',
    prodseller_product_id: product.prodseller_product_id || '',
    zfourstore_product_id: product.zfourstore_product_id || '',
    active_api_provider: product.active_api_provider || 'prodseller',
    download_filename: product.download_filename || '',
    download_size: product.download_size || '',
    download_platform: product.download_platform || '',
    download_instructions: product.download_instructions || '',
    plans: product.plans.length
      ? product.plans.map((plan) => ({ ...plan }))
      : EMPTY_PRODUCT.plans,
  };
}

export default function Shop({ shopSection = 'products' }) {
  const productEditorPanelRef = useRef(null);
  const downloadFilenameInputRef = useRef(null);
  const promoEditorPanelRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [apiProviders, setApiProviders] = useState(null);
  const [categories, setCategories] = useState([]);
  const [content, setContent] = useState(DEFAULT_SHOP_CONTENT);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [productEditorRevision, setProductEditorRevision] = useState(0);
  const [newCategory, setNewCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contentSaving, setContentSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [providerProducts, setProviderProducts] = useState(null);
  const [providerCatalogLoading, setProviderCatalogLoading] = useState(false);
  const [providerCatalogError, setProviderCatalogError] = useState('');
  const [promoCodes, setPromoCodes] = useState([]);
  const [promoForm, setPromoForm] = useState(EMPTY_PROMO_FORM);
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [promoNotice, setPromoNotice] = useState('');

  async function load() {
    setLoading(true);
    const [{ data, error: loadError }, promoResult, providerResult] = await Promise.all([
      listShopAdminData(),
      listShopPromoCodes(),
      shopSection === 'products'
        ? supabase.functions.invoke('shop-provider-admin', { body: { action: 'overview' } })
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (providerResult.error) {
      console.error('Impossible de charger le fournisseur Gemini Pro :', providerResult.error);
      setApiProviders(null);
    } else {
      setApiProviders(providerResult.data?.providers || null);
    }
    if (promoResult.error) {
      console.error('Impossible de charger les codes promo :', promoResult.error);
      setPromoError('Impossible de charger les codes promo. Vérifie que la migration promo est appliquée.');
    } else {
      setPromoCodes(promoResult.data || []);
      setPromoError('');
    }
    if (loadError) {
      console.error('Impossible de charger les données de la boutique :', loadError);
      setError(`Chargement impossible : ${loadError.message}. Vérifie que la migration boutique a été exécutée.`);
    } else {
      const providerProducts = new Map(
        (providerResult.data?.products || []).map((product) => [product.id, product]),
      );
      setProducts(data.products.map((product) => ({
        ...product,
        ...providerProducts.get(product.id),
      })));
      setCategories(data.categories);
      setContent({ ...DEFAULT_SHOP_CONTENT, ...data.content });
      setError('');
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function updateProductField(event) {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'name' && !current.id ? { slug: slugify(value) } : {}),
    }));
    setError('');
    setNotice('');
  }

  function updatePlan(index, field, value) {
    setForm((current) => ({
      ...current,
      plans: current.plans.map((plan, planIndex) => planIndex === index
        ? { ...plan, [field]: value, ...(field === 'label' && !plan.id ? { slug: slugify(value) } : {}) }
        : plan),
    }));
  }

  function editProduct(product) {
    setForm(productForm(product));
    setProductEditorRevision((revision) => revision + 1);
    setError('');
    setNotice('');
    requestAnimationFrame(() => {
      productEditorPanelRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
      document.getElementById('shop-product-name')?.focus({ preventScroll: true });
    });
  }

  function resetProduct() {
    setForm(EMPTY_PRODUCT);
    setProductEditorRevision((revision) => revision + 1);
    setError('');
    setNotice('');
  }

  async function saveProduct(event) {
    event.preventDefault();
    function focusDownloadFilename() {
      requestAnimationFrame(() => {
        downloadFilenameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        downloadFilenameInputRef.current?.focus({ preventScroll: true });
      });
    }
    if (!form.name.trim() || !form.slug.trim() || !form.category_id) {
      setError('Le nom, l’URL courte et la catégorie du produit sont obligatoires.');
      return;
    }
    const activePlans = form.plans.filter((plan) => plan.active);
    if (!activePlans.length || activePlans.some((plan) => !plan.label.trim())) {
      setError('Ajoute au moins une formule active avec un libellé.');
      return;
    }
    if (!form.regular_price || !form.promo_price
      || Number(form.regular_price) <= 0 || Number(form.promo_price) <= 0) {
      setError('Renseigne le prix normal et le prix promotionnel du produit.');
      return;
    }
    if (Number(form.promo_price) >= Number(form.regular_price)) {
      setError('Le prix promotionnel doit être inférieur au prix normal du produit.');
      return;
    }
    if (form.delivery_type === 'download'
      && (!form.access_url.trim() || !form.download_size.trim())) {
      setError('Pour un téléchargement, renseigne le lien source privé et la taille du fichier.');
      return;
    }
    if (form.delivery_type === 'download' && !getDownloadExtension(form.download_filename.trim())) {
      setError("Le champ « Nom du fichier » (section Téléchargement) doit inclure l’extension, par exemple CapCut-Pro.apk. Le champ « Nom » indique le nom du produit dans la boutique.");
      focusDownloadFilename();
      return;
    }
    if (form.delivery_type === 'download' && !isValidDownloadFilename(form.download_filename.trim())) {
      setError('Le champ « Nom du fichier » doit faire au maximum 120 caractères et ne contenir ni barre oblique ni guillemet.');
      focusDownloadFilename();
      return;
    }
    if (form.delivery_type === 'download' && !form.access_url.trim().startsWith('https://')) {
      setError('Le lien du fichier doit commencer par https://.');
      return;
    }
    if (form.delivery_type === 'activate' && !form.access_url.trim()) {
      setError('Renseigne le lien d’activation pour ce produit.');
      return;
    }
    if (form.delivery_type === 'api'
      && !form.prodseller_product_id.trim()
      && !form.zfourstore_product_id.trim()) {
      setError('Ajoute l’identifiant du produit chez ProdSeller ou Z FOUR STORE.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    const product = {
      ...form,
      name: form.name.trim(),
      slug: slugify(form.slug),
      description: form.slug === 'gemini-pro' ? null : richDocumentToPlainText(form.description_rich) || null,
      tagline: form.tagline.trim() || null,
      highlights: form.highlights.split('\n').map((line) => line.trim()).filter(Boolean),
      badge: form.badge.trim() || null,
      cta_label: form.cta_label,
      regular_price: Number(form.regular_price),
      promo_price: Number(form.promo_price),
      avatar: form.avatar.trim() || null,
      gradient: form.gradient.trim() || null,
      logo_url: form.logo_url.trim() || null,
      image_url: form.image_url.trim() || null,
      access_url: isApiDelivery(form) ? null : form.access_url.trim() || null,
      delivery_type: form.delivery_type,
      prodseller_product_id: form.prodseller_product_id.trim(),
      zfourstore_product_id: form.zfourstore_product_id.trim(),
      download_filename: form.download_filename.trim() || null,
      download_size: form.download_size.trim() || null,
      download_platform: form.download_platform || null,
      download_instructions: form.download_instructions.trim() || null,
    };
    const { error: saveError, partial } = await saveShopProduct(product, form.plans);
    if (saveError) {
      console.error('Enregistrement du produit impossible :', saveError);
      setError(`${partial ? 'Produit enregistré mais formules incomplètes' : 'Enregistrement impossible'} : ${saveError.message}`);
    } else {
      setNotice('Produit et formules enregistrés.');
      resetProduct();
      await load();
    }
    setSaving(false);
  }

  async function archiveProduct(product) {
    if (!window.confirm(`Retirer « ${product.name} » du catalogue ? Il restera dans les anciennes commandes.`)) return;
    const { error: archiveError } = await archiveShopProduct(product.id);
    if (archiveError) {
      console.error('Archivage du produit impossible :', archiveError);
      setError(`Archivage impossible : ${archiveError.message}`);
    } else {
      setNotice('Produit retiré du catalogue.');
      await load();
    }
  }

  async function addCategory(event) {
    event.preventDefault();
    const label = newCategory.trim();
    if (!label) return;
    const { error: categoryError } = await createShopCategory({
      slug: slugify(label),
      label,
      sort_order: (categories.length + 1) * 10,
    });
    if (categoryError) {
      setError(`Impossible d’ajouter la catégorie : ${categoryError.message}`);
      return;
    }
    setNewCategory('');
    await load();
  }

  async function renameCategory(category) {
    const label = window.prompt('Nom de la catégorie', category.label)?.trim();
    if (!label || label === category.label) return;
    const { error: categoryError } = await updateShopCategory(category.id, label, slugify(label));
    if (categoryError) {
      setError(`Impossible de modifier la catégorie : ${categoryError.message}`);
      return;
    }
    await load();
  }

  async function removeCategory(category) {
    if (!window.confirm(`Supprimer « ${category.label} » ? Les produits associés n’auront plus de catégorie.`)) return;
    const { error: categoryError } = await deleteShopCategory(category.id);
    if (categoryError) {
      setError(`Impossible de supprimer la catégorie : ${categoryError.message}`);
      return;
    }
    await load();
  }

  async function saveContent(event) {
    event.preventDefault();
    setContentSaving(true);
    setError('');
    const { error: contentError } = await saveShopContent(content);
    if (contentError) {
      console.error('Enregistrement du contenu de la boutique impossible :', contentError);
      setError(`Enregistrement du contenu impossible : ${contentError.message}`);
    } else {
      setNotice('Contenu de la boutique enregistré.');
    }
    setContentSaving(false);
  }

  async function loadProviderProducts(provider) {
    setProviderCatalogLoading(true);
    setProviderCatalogError('');
    try {
      const { data, error: invokeError } = provider === 'zfourstore'
        ? await supabase.functions.invoke('shop-provider-admin', {
          body: { action: 'catalog', provider },
        })
        : await supabase.functions.invoke('gemini-prodseller-activate', {
          body: { action: 'products' },
        });
      if (invokeError || data?.error) {
        const detail = data?.error || await getInvocationErrorMessage(invokeError);
        console.error(`Impossible de charger le catalogue ${provider} :`, {
          message: detail || 'Réponse de la fonction indisponible.',
          status: invokeError?.context?.status,
        });
        setProviderCatalogError(detail || `La fonction ${provider} ne répond pas. Vérifiez son déploiement puis réessayez.`);
        setProviderProducts(null);
      } else {
        setProviderProducts(data.products || []);
      }
    } catch (error) {
      console.error(`Impossible de charger le catalogue ${provider} :`, error instanceof Error ? error.message : 'Unknown error');
      setProviderCatalogError(`La requête vers la fonction ${provider} a échoué. Vérifiez votre connexion puis réessayez.`);
      setProviderProducts(null);
    } finally {
      setProviderCatalogLoading(false);
    }
  }

  async function savePromoCode(event) {
    event.preventDefault();
    const code = promoForm.code.trim().toUpperCase().replace(/\s+/g, '');
    const name = promoForm.name.trim();
    const value = Number(promoForm.discount_value);
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
      setPromoError('Le code doit contenir de 3 à 40 lettres, chiffres, tirets ou tirets bas.');
      return;
    }
    if (!name || name.length > 120) {
      setPromoError('Saisis un nom interne de 1 à 120 caractères.');
      return;
    }
    if (!Number.isFinite(value) || value <= 0 || (promoForm.discount_type === 'percentage' && value > 100)
      || (promoForm.discount_type === 'fixed' && !Number.isInteger(value))) {
      setPromoError(promoForm.discount_type === 'percentage'
        ? 'Le pourcentage doit être compris entre 0 et 100.'
        : 'La réduction fixe doit être un montant entier positif en FCFA.');
      return;
    }
    if (promoForm.discount_type === 'percentage' && value === 100 && !promoForm.is_gift) {
      setPromoError('Coche l’option cadeau pour autoriser une réduction de 100 %.');
      return;
    }
    const maxUses = promoForm.max_uses === '' ? null : Number(promoForm.max_uses);
    const maxUsesPerEmail = promoForm.max_uses_per_email === '' ? null : Number(promoForm.max_uses_per_email);
    if ((maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1))
      || (maxUsesPerEmail !== null && (!Number.isInteger(maxUsesPerEmail) || maxUsesPerEmail < 1))) {
      setPromoError('Les limites d’utilisation doivent être des nombres entiers positifs ou rester vides.');
      return;
    }
    const startsAt = promoForm.starts_at ? new Date(promoForm.starts_at).toISOString() : null;
    const expiresAt = promoForm.expires_at ? new Date(promoForm.expires_at).toISOString() : null;
    if (startsAt && expiresAt && new Date(expiresAt) <= new Date(startsAt)) {
      setPromoError('La date de fin doit être postérieure à la date de début.');
      return;
    }

    setPromoSaving(true);
    setPromoError('');
    setPromoNotice('');
    const changes = {
      name,
      code,
      discount_type: promoForm.discount_type,
      discount_value: value,
      is_gift: Boolean(promoForm.is_gift),
      product_ids: [...new Set(promoForm.product_ids)],
      max_uses: maxUses,
      max_uses_per_email: maxUsesPerEmail,
      starts_at: startsAt,
      expires_at: expiresAt,
      active: promoForm.active !== false && !(maxUses !== null
        && (promoForm.id
          ? (promoCodes.find((entry) => entry.id === promoForm.id)?.uses_count || 0)
          : 0) >= maxUses),
      updated_at: new Date().toISOString(),
    };
    const { error: saveError } = promoForm.id
      ? await updateShopPromoCode(promoForm.id, changes)
      : await createShopPromoCode(changes);
    if (saveError) {
      console.error('Impossible d’enregistrer le code promo :', saveError);
      setPromoError(saveError.code === '23505'
        ? 'Ce code existe déjà.'
        : `Enregistrement impossible : ${saveError.message}`);
    } else {
      setPromoForm(EMPTY_PROMO_FORM);
      setPromoNotice(promoForm.id ? `Code ${code} modifié.` : `Code ${code} créé.`);
      await load();
    }
    setPromoSaving(false);
  }

  function editPromoCode(promoCode) {
    setPromoForm({
      id: promoCode.id,
      name: promoCode.name || promoCode.code,
      code: promoCode.code,
      discount_type: promoCode.discount_type,
      discount_value: String(promoCode.discount_value),
      is_gift: Boolean(promoCode.is_gift),
      product_ids: promoCode.product_ids || [],
      max_uses: promoCode.max_uses == null ? '' : String(promoCode.max_uses),
      max_uses_per_email: promoCode.max_uses_per_email == null ? '' : String(promoCode.max_uses_per_email),
      starts_at: toDateTimeLocal(promoCode.starts_at),
      expires_at: toDateTimeLocal(promoCode.expires_at),
      active: promoCode.active,
    });
    setPromoError('');
    setPromoNotice('');
    requestAnimationFrame(() => {
      promoEditorPanelRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
      document.getElementById('promo-name')?.focus({ preventScroll: true });
    });
  }

  function resetPromoForm() {
    setPromoForm(EMPTY_PROMO_FORM);
    setPromoError('');
    setPromoNotice('');
  }

  function togglePromoProduct(productId) {
    setPromoForm((current) => ({
      ...current,
      product_ids: current.product_ids.includes(productId)
        ? current.product_ids.filter((id) => id !== productId)
        : [...current.product_ids, productId],
    }));
  }

  async function togglePromoCode(promoCode) {
    if (!promoCode.active && promoCode.max_uses != null && promoCode.uses_count >= promoCode.max_uses) {
      setPromoError('Ce code a atteint sa limite totale et ne peut pas être réactivé.');
      return;
    }
    const { error: updateError } = await updateShopPromoCode(promoCode.id, {
      active: !promoCode.active,
      updated_at: new Date().toISOString(),
    });
    if (updateError) {
      console.error('Impossible de modifier le code promo :', updateError);
      setPromoError('Le statut du code promo n’a pas pu être modifié.');
      return;
    }
    setPromoCodes((current) => current.map((entry) => entry.id === promoCode.id
      ? { ...entry, active: !entry.active }
      : entry));
  }

  async function removePromoCode(promoCode) {
    if (!window.confirm(`Supprimer le code « ${promoCode.code} » ?`)) return;
    const { error: deleteError } = await deleteShopPromoCode(promoCode.id);
    if (deleteError) {
      console.error('Impossible de supprimer le code promo :', deleteError);
      setPromoError('Le code promo n’a pas pu être supprimé.');
      return;
    }
    setPromoCodes((current) => current.filter((entry) => entry.id !== promoCode.id));
  }

  return (
    <>
      {error && <div className="shop-admin-alert error" role="alert">{error}</div>}
      {notice && <div className="shop-admin-alert success" role="status">{notice}</div>}

      {(shopSection === 'prodseller' || shopSection === 'zfourstore') && <section className="panel">
        <h2>Catalogue {shopSection === 'zfourstore' ? 'Z FOUR STORE' : 'ProdSeller'}</h2>
        <p>
          Consulte les produits disponibles et leurs identifiants, prix et stocks.
          Cette action est en lecture seule et ne lance aucun achat.
        </p>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => loadProviderProducts(shopSection)}
          disabled={providerCatalogLoading}
        >
          {providerCatalogLoading ? 'Chargement…' : 'Charger le catalogue'}
        </button>
        {providerCatalogError && <div className="shop-admin-alert error" role="alert">{providerCatalogError}</div>}
        {providerProducts && (
          <div className="shop-admin-list" style={{ marginTop: 16 }}>
            {providerProducts.length === 0 && <p>Aucun produit disponible.</p>}
            {providerProducts.map((product) => (
              <div className="shop-admin-category" key={product.id}>
                <div>
                  <strong>{hideActivationProvider(product.name)}</strong>
                  <div>ID : <code>{product.id}</code></div>
                  {product.description && (
                    <small>{hideActivationProvider(product.description)}</small>
                  )}
                  {product.price !== undefined && <div>Prix fournisseur : {product.price}</div>}
                  {product.stock !== undefined && <div>Stock : {product.stock ?? 'non communiqué'}</div>}
                  <div>Stock disponible : {product.inStock === true ? 'Oui' : product.inStock === false ? 'Non' : 'Non communiqué'}</div>
                  {product.requiresEmailActivation !== undefined && (
                    <div>Activation par e-mail : {product.requiresEmailActivation ? 'Oui' : 'Non'}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>}

      {shopSection === 'content' && <section className="panel">
        <h2>Contenu de la boutique</h2>
        <p>Modifie les textes de l’accueil sans toucher au code.</p>
        <form className="shop-admin-content-form" onSubmit={saveContent}>
          {CONTENT_FIELDS.map(([key, label]) => (
            <div className="form-group" key={key}>
              <label htmlFor={key}>{label}</label>
              {key.endsWith('_description')
                ? <textarea id={key} rows="3" value={content[key] || ''} onChange={(event) => setContent((current) => ({ ...current, [key]: event.target.value }))} />
                : <input id={key} value={content[key] || ''} onChange={(event) => setContent((current) => ({ ...current, [key]: event.target.value }))} />}
            </div>
          ))}
          <button className="btn btn-primary" type="submit" disabled={contentSaving}>
            {contentSaving ? 'Enregistrement…' : 'Enregistrer les textes'}
          </button>
        </form>
      </section>}

      {shopSection === 'promos' && <section className="panel" ref={promoEditorPanelRef}>
        <h2>Codes promo</h2>
        <p>Crée et personnalise les réductions, limite leur utilisation et choisis les produits concernés. Le montant final est recalculé côté serveur.</p>
        {promoError && <div className="shop-admin-alert error" role="alert">{promoError}</div>}
        {promoNotice && <div className="shop-admin-alert success" role="status">{promoNotice}</div>}
        <form className="shop-promo-form" onSubmit={savePromoCode}>
          <div className="form-group">
            <label htmlFor="promo-name">Nom interne</label>
            <input id="promo-name" maxLength={120} placeholder="Bienvenue nouveaux clients" required value={promoForm.name} onChange={(event) => setPromoForm((current) => ({ ...current, name: event.target.value }))} />
            <small>Visible uniquement dans le tableau de bord.</small>
          </div>
          <div className="form-group">
            <label htmlFor="promo-code">Code promo</label>
            <div className="shop-promo-code-row">
              <input
                id="promo-code"
                autoComplete="off"
                maxLength={40}
                placeholder="EXEMPLE10"
                required
                value={promoForm.code}
                onChange={(event) => setPromoForm((current) => ({ ...current, code: event.target.value }))}
              />
              <button className="btn btn-secondary" type="button" onClick={() => setPromoForm((current) => ({ ...current, code: makePromoCode() }))}>
                Générer
              </button>
            </div>
          </div>
          <div className="form-group shop-admin-wide">
            <label>Produits concernés</label>
            {products.length
              ? (
                <div className="shop-promo-products">
                  <label className="shop-admin-check">
                    <input
                      type="checkbox"
                      checked={promoForm.product_ids.length === 0}
                      onChange={() => setPromoForm((current) => ({ ...current, product_ids: [] }))}
                    />
                    Tous les produits
                  </label>
                  {products.map((product) => (
                    <label className="shop-admin-check" key={product.id}>
                      <input
                        type="checkbox"
                        checked={promoForm.product_ids.includes(product.id)}
                        onChange={() => togglePromoProduct(product.id)}
                      />
                      {product.name}
                    </label>
                  ))}
                </div>
              )
              : <small>Ajoute d’abord un produit au catalogue.</small>}
            <small>Si aucun produit particulier n’est sélectionné, le code s’applique à toute la boutique.</small>
          </div>
          <div className="form-group">
            <label htmlFor="promo-max-uses">Utilisations totales maximum</label>
            <input id="promo-max-uses" type="number" min="1" step="1" placeholder="Sans limite" value={promoForm.max_uses} onChange={(event) => setPromoForm((current) => ({ ...current, max_uses: event.target.value }))} />
            <small>Valeur initiale : 100. Le code se désactive quand cette limite est atteinte.</small>
          </div>
          <div className="form-group">
            <label htmlFor="promo-max-email">Utilisations maximum par adresse e-mail</label>
            <input id="promo-max-email" type="number" min="1" step="1" placeholder="Sans limite" value={promoForm.max_uses_per_email} onChange={(event) => setPromoForm((current) => ({ ...current, max_uses_per_email: event.target.value }))} />
            <small>Valeur initiale : 1 utilisation par client.</small>
          </div>
          <div className="form-group shop-admin-wide">
            <label className="shop-admin-check">
              <input type="checkbox" checked={promoForm.is_gift} onChange={(event) => setPromoForm((current) => ({ ...current, is_gift: event.target.checked }))} />
              Autoriser à offrir toute la commande (code cadeau)
            </label>
            <small>Obligatoire pour créer une réduction de 100 % ou pour qu’un montant fixe puisse ramener une commande à 0 FCFA.</small>
          </div>
          <div className="form-group">
            <label htmlFor="promo-type">Type de réduction</label>
            <select
              id="promo-type"
              value={promoForm.discount_type}
              onChange={(event) => setPromoForm((current) => ({ ...current, discount_type: event.target.value, discount_value: '' }))}
            >
              <option value="percentage">Pourcentage</option>
              <option value="fixed">Montant fixe (FCFA)</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="promo-value">{promoForm.discount_type === 'percentage' ? 'Pourcentage (%)' : 'Montant (FCFA)'}</label>
            <input
              id="promo-value"
              type="number"
              min="1"
              max={promoForm.discount_type === 'percentage' ? '100' : undefined}
              step={promoForm.discount_type === 'percentage' ? '0.01' : '1'}
              required
              value={promoForm.discount_value}
              onChange={(event) => setPromoForm((current) => ({ ...current, discount_value: event.target.value }))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="promo-start">Début (facultatif)</label>
            <input id="promo-start" type="datetime-local" value={promoForm.starts_at} onChange={(event) => setPromoForm((current) => ({ ...current, starts_at: event.target.value }))} />
          </div>
          <div className="form-group">
            <label htmlFor="promo-end">Fin (facultatif)</label>
            <input id="promo-end" type="datetime-local" value={promoForm.expires_at} onChange={(event) => setPromoForm((current) => ({ ...current, expires_at: event.target.value }))} />
          </div>
          <div className="shop-promo-form-actions">
            <button className="btn btn-primary" type="submit" disabled={promoSaving}>
              {promoSaving ? 'Enregistrement…' : promoForm.id ? 'Enregistrer les modifications' : 'Créer le code'}
            </button>
            {promoForm.id && <button className="btn btn-secondary" type="button" onClick={resetPromoForm}>Annuler la modification</button>}
          </div>
        </form>
        <div className="shop-admin-categories shop-promo-list">
          {promoCodes.map((promoCode) => (
            <div className="shop-admin-category" key={promoCode.id}>
              <div>
                <strong>{promoCode.name || promoCode.code}</strong>
                <div>Code : <code>{promoCode.code}</code></div>
                <div>
                  {promoCode.discount_type === 'percentage'
                    ? `${promoCode.discount_value}% de réduction`
                    : `${Number(promoCode.discount_value).toLocaleString('fr-FR')} FCFA de réduction`}
                  {promoCode.is_gift && ' · Cadeau'}
                </div>
                <small>
                  {promoCode.uses_count || 0} utilisation(s)
                  {promoCode.max_uses == null ? ' · sans limite totale' : ` / ${promoCode.max_uses}`}
                  {promoCode.max_uses_per_email == null ? ' · sans limite par e-mail' : ` · ${promoCode.max_uses_per_email} par e-mail`}
                </small>
                <small>
                  {promoCode.product_ids?.length
                    ? `Produits concernés : ${promoCode.product_ids.map((id) => products.find((product) => product.id === id)?.name || 'Produit indisponible').join(', ')}`
                    : 'Tous les produits'}
                </small>
                {(promoCode.starts_at || promoCode.expires_at) && (
                  <small>
                    {promoCode.starts_at ? `Dès le ${new Date(promoCode.starts_at).toLocaleString('fr-FR')}` : ''}
                    {promoCode.starts_at && promoCode.expires_at ? ' · ' : ''}
                    {promoCode.expires_at ? `Jusqu’au ${new Date(promoCode.expires_at).toLocaleString('fr-FR')}` : ''}
                  </small>
                )}
              </div>
              <div className="row-actions">
                <span className={`promo-state${promoCode.active ? ' active' : ''}`}>{promoCode.active ? 'Actif' : 'Inactif'}</span>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => editPromoCode(promoCode)}>
                  Modifier
                </button>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => togglePromoCode(promoCode)}>
                  {promoCode.active ? 'Désactiver' : 'Activer'}
                </button>
                <button className="btn btn-danger btn-sm" type="button" onClick={() => removePromoCode(promoCode)}>Supprimer</button>
              </div>
            </div>
          ))}
          {!promoCodes.length && <p>Aucun code promo.</p>}
        </div>
      </section>}

      {shopSection === 'categories' && <section className="panel">
        <h2>Catégories</h2>
        <p>Les catégories actives sont proposées dans le catalogue public.</p>
        <div className="shop-admin-categories">
          {categories.map((category) => (
            <div className="shop-admin-category" key={category.id}>
              <span>{category.label}</span>
              <div className="row-actions">
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => renameCategory(category)}>Renommer</button>
                <button className="btn btn-danger btn-sm" type="button" onClick={() => removeCategory(category)}>Supprimer</button>
              </div>
            </div>
          ))}
        </div>
        <form className="shop-admin-new-category" onSubmit={addCategory}>
          <div className="form-group">
            <label htmlFor="new-shop-category">Nouvelle catégorie</label>
            <input id="new-shop-category" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} />
          </div>
          <button className="btn btn-secondary" type="submit">Ajouter</button>
        </form>
      </section>}

      {shopSection === 'products' && <>
      <section className="panel" ref={productEditorPanelRef}>
        <h2>{form.id ? 'Modifier un produit' : 'Ajouter un produit'}</h2>
        <p>Les prix sont définis par formule. La boutique affiche uniquement les produits actifs.</p>
        <form onSubmit={saveProduct}>
          <div className="shop-admin-product-grid">
            <div className="form-group">
              <label htmlFor="shop-product-name">Nom</label>
              <input id="shop-product-name" name="name" value={form.name} onChange={updateProductField} required />
            </div>
            <div className="form-group">
              <label htmlFor="shop-product-slug">URL courte</label>
              <input id="shop-product-slug" name="slug" value={form.slug} onChange={updateProductField} required />
            </div>
            <div className="form-group">
              <label htmlFor="shop-product-category">Catégorie</label>
              <select id="shop-product-category" name="category_id" value={form.category_id} onChange={updateProductField} required>
                <option value="">Choisir…</option>
                {categories.map((category) => <option value={category.id} key={category.id}>{category.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="shop-product-regular-price">Prix normal du produit (FCFA)</label>
              <input id="shop-product-regular-price" type="number" min="1" step="1" name="regular_price" value={form.regular_price} onChange={updateProductField} required />
            </div>
            <div className="form-group">
              <label htmlFor="shop-product-promo-price">Prix promotionnel du produit (FCFA)</label>
              <input id="shop-product-promo-price" type="number" min="1" step="1" name="promo_price" value={form.promo_price} onChange={updateProductField} required />
              <small className="project-form-hint">Le prix normal sera affiché barré à gauche; celui-ci sera affiché à droite.</small>
            </div>
            <div className="form-group shop-admin-wide">
              <label className="shop-admin-check">
                <input
                  type="checkbox"
                  name="allow_multiple_qty"
                  checked={form.allow_multiple_qty}
                  onChange={updateProductField}
                />
                Autoriser l’achat de plusieurs unités
              </label>
              <small className="project-form-hint">Si désactivé, le client ne pourra commander qu’une unité. La quantité maximale autorisée est de 20.</small>
            </div>
            <div className="form-group">
              <label htmlFor="shop-product-tagline">Accroche</label>
              <input id="shop-product-tagline" name="tagline" value={form.tagline || ''} onChange={updateProductField} />
            </div>
            <div className="form-group shop-admin-wide">
              <label className="rich-editor-label" htmlFor="shop-product-rich-description">Description complète — présentation détaillée</label>
              <Suspense fallback={<div className="rich-editor-loading" role="status">Chargement de l’éditeur…</div>}>
                <RichTextEditor
                  key={`${form.id || 'new-product'}-${productEditorRevision}`}
                  value={form.description_rich}
                  onChange={(descriptionRich) => setForm((current) => ({ ...current, description_rich: descriptionRich }))}
                />
              </Suspense>
            </div>
            <div className="form-group shop-admin-wide">
              <label htmlFor="shop-product-highlights">Points forts (un par ligne)</label>
              <textarea id="shop-product-highlights" name="highlights" rows="3" value={form.highlights || ''} onChange={updateProductField} />
            </div>
            <div className="form-group">
              <label htmlFor="shop-product-badge">Badge (facultatif)</label>
              <input id="shop-product-badge" name="badge" value={form.badge || ''} onChange={updateProductField} />
            </div>
            <div className="form-group">
              <label htmlFor="shop-product-cta">Bouton sur l’affiche</label>
              <select id="shop-product-cta" name="cta_label" value={form.cta_label} onChange={updateProductField}>
                <option>Acheter maintenant</option>
                <option>Payer maintenant</option>
                <option>Activer maintenant</option>
                <option>Profiter de l'offre</option>
                <option>Obtenir le fichier</option>
                <option>Télécharger maintenant</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="shop-product-avatar">Initiales visuelles</label>
              <input id="shop-product-avatar" name="avatar" maxLength="4" value={form.avatar || ''} onChange={updateProductField} />
            </div>
            <div className="form-group">
              <label htmlFor="shop-product-logo">URL du logo (facultative)</label>
              <input id="shop-product-logo" type="url" name="logo_url" value={form.logo_url || ''} onChange={updateProductField} placeholder="https://…" />
              <small className="project-form-hint">Tu peux aussi importer le logo depuis la section Médias.</small>
            </div>
            <div className="form-group">
              <label htmlFor="shop-product-gradient">Dégradé CSS</label>
              <input id="shop-product-gradient" name="gradient" value={form.gradient || ''} onChange={updateProductField} />
            </div>
            <div className="form-group">
              <label htmlFor="shop-product-image">URL d’image (facultative)</label>
              <input id="shop-product-image" type="url" name="image_url" value={form.image_url || ''} onChange={updateProductField} placeholder="https://…" />
              <small className="project-form-hint">Lien direct et public vers le fichier image (.jpg, .png, .webp…). Les liens vers une page de partage ne s’affichent pas comme image.</small>
              <small className="project-form-hint">Évitez d’inclure des prix, des numéros de téléphone ou des promotions dans l’image : ils peuvent différer du prix affiché sur la fiche.</small>
            </div>
            <div className="form-group">
              <label htmlFor="shop-product-poster-ratio">Format de l’affiche</label>
              <select id="shop-product-poster-ratio" name="poster_ratio" value={form.poster_ratio} onChange={updateProductField}>
                <option value="1/1">Carré — 1:1</option>
                <option value="4/3">Paysage — 4:3</option>
                <option value="3/4">Portrait — 3:4</option>
                <option value="16/9">Large — 16:9</option>
                <option value="9/16">Vertical — 9:16</option>
              </select>
            </div>
            {form.image_url && (
              <div className="form-group shop-admin-wide">
                <span className="project-form-hint">Aperçu de l’affiche · {form.poster_ratio.replace('/', ':')}</span>
                <div className="shop-poster-preview" style={{ aspectRatio: form.poster_ratio, background: form.gradient }}>
                  <img src={form.image_url} alt={`Aperçu de l’affiche ${form.name || 'produit'}`} />
                  {form.logo_url && <img className="shop-poster-preview-logo" src={form.logo_url} alt="" />}
                </div>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="shop-product-delivery-type">Mode de livraison</label>
              <select id="shop-product-delivery-type" name="delivery_type" value={form.delivery_type} onChange={updateProductField}>
                <option value="activate">Lien d’activation direct</option>
                <option value="download">Fichier en téléchargement temporaire</option>
                <option value="api">Activation par API</option>
              </select>
            </div>
            {isApiDelivery(form) && (
              <>
                <div className="form-group">
                  <label htmlFor="shop-product-prodseller-id">ID produit ProdSeller</label>
                  <input
                    id="shop-product-prodseller-id"
                    name="prodseller_product_id"
                    value={form.prodseller_product_id}
                    onChange={updateProductField}
                    placeholder="ID du catalogue ProdSeller"
                  />
                  <small className="project-form-hint">
                    API {apiProviders?.prodseller ? 'configurée' : 'non configurée'}.
                  </small>
                </div>
                <div className="form-group">
                  <label htmlFor="shop-product-zfourstore-id">ID produit Z FOUR STORE</label>
                  <input
                    id="shop-product-zfourstore-id"
                    name="zfourstore_product_id"
                    value={form.zfourstore_product_id}
                    onChange={updateProductField}
                    placeholder="ID du catalogue Z FOUR STORE"
                  />
                  <small className="project-form-hint">
                    API {apiProviders?.zfourstore ? 'configurée' : 'non configurée'}.
                  </small>
                </div>
                <div className="form-group shop-admin-wide">
                  <span className="form-label">Livraison automatique</span>
                  <small className="project-form-hint">
                    La livraison utilise l’identifiant du fournisseur actif. Configure les IDs disponibles dans cette fiche, puis choisis le fournisseur dans{' '}
                    <Link to="/admin/shop/fournisseurs">Admin → Fournisseurs</Link>.
                    Un fournisseur sans ID pour ce produit ne pourra pas être sélectionné.
                  </small>
                </div>
              </>
            )}
            {!isApiDelivery(form) && (
              <div className="form-group shop-admin-wide">
                <label htmlFor="shop-product-access">
                  {form.delivery_type === 'download' ? 'Lien source privé (Drive ou hébergeur)' : 'Lien d’activation'}
                </label>
                <input id="shop-product-access" type="url" name="access_url" value={form.access_url || ''} onChange={updateProductField} placeholder="https://…" />
                <small className="project-form-hint">
                  {form.delivery_type === 'download'
                    ? 'Lien conservé côté serveur. Pour Drive, autorise la lecture par toute personne disposant du lien ; l’acheteur reçoit un lien temporaire, pas cette URL.'
                    : 'Le client recevra un bouton pour ouvrir directement cette page après paiement.'}
                </small>
              </div>
            )}
            {form.delivery_type === 'download' && (
              <>
                <div className="form-group">
                  <label htmlFor="shop-product-download-name">Nom du fichier</label>
                  <input ref={downloadFilenameInputRef} id="shop-product-download-name" name="download_filename" value={form.download_filename || ''} onChange={updateProductField} maxLength={120} required />
                  <small className="project-form-hint">Nom exact du fichier avec son extension, tel que le client doit le recevoir (ex. CapCut-Pro-14.2.0.apk).</small>
                </div>
                <div className="form-group">
                  <label htmlFor="shop-product-download-size">Taille du fichier (ex. 250 Mo)</label>
                  <input id="shop-product-download-size" name="download_size" value={form.download_size || ''} onChange={updateProductField} required />
                </div>
                <div className="form-group">
                  <label htmlFor="shop-product-download-platform">Plateforme du fichier</label>
                  <select id="shop-product-download-platform" name="download_platform" value={form.download_platform || ''} onChange={updateProductField}>
                    <option value="">Sélectionner une plateforme</option>
                    <option value="Android">Android</option>
                    <option value="Windows">Windows</option>
                    <option value="macOS">macOS</option>
                    <option value="iPhone/iPad">iPhone/iPad</option>
                    <option value="Tous">Tous</option>
                  </select>
                </div>
                <div className="form-group shop-admin-wide">
                  <label htmlFor="shop-product-download-instructions">Instructions d’installation (facultatif)</label>
                  <textarea id="shop-product-download-instructions" name="download_instructions" rows="3" maxLength={500} value={form.download_instructions || ''} onChange={updateProductField} />
                </div>
              </>
            )}
            <div className="form-group">
              <label htmlFor="shop-product-status">Publication</label>
              <select id="shop-product-status" name="status" value={form.status} onChange={updateProductField}>
                <option value="active">Publié</option>
                <option value="draft">Brouillon</option>
                <option value="archived">Archivé</option>
              </select>
            </div>
          </div>

          <label className="shop-admin-check">
            <input type="checkbox" name="featured" checked={form.featured} onChange={updateProductField} />
            <span>Afficher parmi les produits phares</span>
          </label>

          <div className="shop-admin-plans">
            <div className="shop-admin-plans-heading">
              <h3>Formules</h3>
              <small className="project-form-hint">Le prix promo saisi plus haut s’applique à toutes les formules et sera facturé.</small>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setForm((current) => ({
                ...current,
                plans: [...current.plans, { id: null, slug: '', label: '', currency: 'XOF', active: true }],
              }))}>Ajouter une formule</button>
            </div>
            {form.plans.map((plan, index) => (
              <div className="shop-admin-plan" key={plan.id || `new-plan-${index}`}>
                <div className="form-group">
                  <label htmlFor={`plan-label-${index}`}>Formule</label>
                  <input id={`plan-label-${index}`} value={plan.label} onChange={(event) => updatePlan(index, 'label', event.target.value)} />
                </div>
                <label className="shop-admin-check">
                  <input type="checkbox" checked={plan.active} onChange={(event) => updatePlan(index, 'active', event.target.checked)} />
                  <span>Formule active</span>
                </label>
              </div>
            ))}
          </div>

          <div className="row-actions shop-admin-form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Enregistrement…' : form.id ? 'Enregistrer le produit' : 'Créer le produit'}
            </button>
            {form.id && <button className="btn btn-secondary" type="button" onClick={resetProduct}>Annuler</button>}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="shop-admin-list-heading">
          <div><h2>Catalogue produits</h2><p>Les brouillons et produits archivés ne sont pas visibles publiquement.</p></div>
          <button className="btn btn-secondary btn-sm" type="button" onClick={load} disabled={loading}>Actualiser</button>
        </div>
        {loading && <div className="state-box">Chargement…</div>}
        {!loading && products.length === 0 && <div className="state-box">Aucun produit.</div>}
        {!loading && products.length > 0 && (
          <div className="shop-admin-product-list">
            {products.map((product) => (
              <article className="shop-admin-product" key={product.id}>
                <div className="shop-admin-product-visual" style={{ background: product.gradient }}>
                  {product.image_url && <img className="shop-admin-product-artwork" src={product.image_url} alt="" />}
                  {product.logo_url && (
                    <img className="shop-admin-product-logo" src={product.logo_url} alt={`${product.name} logo`} />
                  )}
                  {!product.image_url && !product.logo_url && product.avatar}
                </div>
                <div className="shop-admin-product-info">
                  <div className="project-admin-meta">
                    <span className={`badge ${product.status === 'active' ? 'badge-ok' : 'badge-off'}`}>
                      {product.status === 'active' ? 'Publié' : product.status === 'draft' ? 'Brouillon' : 'Archivé'}
                    </span>
                    <span className="project-admin-category">{product.categoryLabel}</span>
                    {product.featured && <span className="badge badge-unread">À la une</span>}
                  </div>
                  <h3>{product.name}</h3>
                  <p>
                    {product.plans.filter((plan) => plan.active).map((plan) => plan.label).join(' / ') || 'Aucune formule active'}
                    {product.promo_price ? ` · Promo ${Number(product.promo_price).toLocaleString('fr-FR')} FCFA` : ''}
                  </p>
                  {product.delivery_type === 'download' && !isValidDownloadFilename(product.download_filename) && (
                    <div className="shop-admin-alert error" role="alert">
                      Nom de fichier invalide : ajoute une extension autorisée (ex. CapCut-Pro.apk) et retire les barres obliques ou guillemets.
                    </div>
                  )}
                </div>
                <div className="row-actions">
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => editProduct(product)}>Modifier</button>
                  {product.status !== 'archived' && <button className="btn btn-danger btn-sm" type="button" onClick={() => archiveProduct(product)}>Retirer</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      </>}
    </>
  );
}

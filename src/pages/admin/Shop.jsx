import { useEffect, useState } from 'react';
import {
  archiveShopProduct,
  createShopCategory,
  deleteShopCategory,
  listShopAdminData,
  saveShopContent,
  saveShopProduct,
  updateShopCategory,
} from '../../services/shop';
import { DEFAULT_SHOP_CONTENT } from '../../context/ShopContext';

const EMPTY_PRODUCT = {
  id: null,
  name: '',
  slug: '',
  description: '',
  tagline: '',
  highlights: '',
  category_id: '',
  badge: '',
  status: 'active',
  featured: false,
  avatar: '',
  gradient: 'linear-gradient(135deg,#4285F4,#34A853)',
  image_url: '',
  plans: [{ id: null, slug: '', label: '', price: '', old_price: '', currency: 'XOF', active: true }],
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

function slugify(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function productForm(product) {
  return {
    ...EMPTY_PRODUCT,
    ...product,
    highlights: (product.highlights || []).join('\n'),
    badge: product.badge || '',
    avatar: product.avatar || '',
    gradient: product.gradient || EMPTY_PRODUCT.gradient,
    image_url: product.image_url || '',
    plans: product.plans.length
      ? product.plans.map((plan) => ({ ...plan, old_price: plan.old_price ?? '' }))
      : EMPTY_PRODUCT.plans,
  };
}

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [content, setContent] = useState(DEFAULT_SHOP_CONTENT);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [newCategory, setNewCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contentSaving, setContentSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    const { data, error: loadError } = await listShopAdminData();
    if (loadError) {
      console.error('Impossible de charger les données de la boutique :', loadError);
      setError(`Chargement impossible : ${loadError.message}. Vérifie que la migration boutique a été exécutée.`);
    } else {
      setProducts(data.products);
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
    setError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetProduct() {
    setForm(EMPTY_PRODUCT);
    setError('');
    setNotice('');
  }

  async function saveProduct(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.slug.trim() || !form.category_id) {
      setError('Le nom, l’URL courte et la catégorie du produit sont obligatoires.');
      return;
    }
    const activePlans = form.plans.filter((plan) => plan.active);
    if (!activePlans.length || activePlans.some((plan) => !plan.label.trim() || Number(plan.price) <= 0)) {
      setError('Ajoute au moins une formule active avec un libellé et un prix supérieur à zéro.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    const product = {
      ...form,
      name: form.name.trim(),
      slug: slugify(form.slug),
      description: form.description.trim() || null,
      tagline: form.tagline.trim() || null,
      highlights: form.highlights.split('\n').map((line) => line.trim()).filter(Boolean),
      badge: form.badge.trim() || null,
      avatar: form.avatar.trim() || null,
      gradient: form.gradient.trim() || null,
      image_url: form.image_url.trim() || null,
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

  return (
    <>
      {error && <div className="shop-admin-alert error" role="alert">{error}</div>}
      {notice && <div className="shop-admin-alert success" role="status">{notice}</div>}

      <section className="panel">
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
      </section>

      <section className="panel">
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
      </section>

      <section className="panel">
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
              <label htmlFor="shop-product-tagline">Accroche</label>
              <input id="shop-product-tagline" name="tagline" value={form.tagline || ''} onChange={updateProductField} />
            </div>
            <div className="form-group shop-admin-wide">
              <label htmlFor="shop-product-description">Description complète</label>
              <textarea id="shop-product-description" name="description" rows="4" value={form.description || ''} onChange={updateProductField} />
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
              <label htmlFor="shop-product-avatar">Initiales visuelles</label>
              <input id="shop-product-avatar" name="avatar" maxLength="4" value={form.avatar || ''} onChange={updateProductField} />
            </div>
            <div className="form-group">
              <label htmlFor="shop-product-gradient">Dégradé CSS</label>
              <input id="shop-product-gradient" name="gradient" value={form.gradient || ''} onChange={updateProductField} />
            </div>
            <div className="form-group">
              <label htmlFor="shop-product-image">URL d’image (facultative)</label>
              <input id="shop-product-image" type="url" name="image_url" value={form.image_url || ''} onChange={updateProductField} placeholder="https://…" />
              <small className="project-form-hint">Lien direct et public vers le fichier image (.jpg, .png, .webp…). Les liens vers une page de partage ne s’affichent pas comme image.</small>
            </div>
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
              <h3>Formules et prix</h3>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setForm((current) => ({
                ...current,
                plans: [...current.plans, { id: null, slug: '', label: '', price: '', old_price: '', currency: 'XOF', active: true }],
              }))}>Ajouter une formule</button>
            </div>
            {form.plans.map((plan, index) => (
              <div className="shop-admin-plan" key={plan.id || `new-plan-${index}`}>
                <div className="form-group">
                  <label htmlFor={`plan-label-${index}`}>Formule</label>
                  <input id={`plan-label-${index}`} value={plan.label} onChange={(event) => updatePlan(index, 'label', event.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor={`plan-price-${index}`}>Prix (FCFA)</label>
                  <input id={`plan-price-${index}`} type="number" min="1" step="1" value={plan.price} onChange={(event) => updatePlan(index, 'price', event.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor={`plan-old-price-${index}`}>Ancien prix (facultatif)</label>
                  <input id={`plan-old-price-${index}`} type="number" min="0" step="1" value={plan.old_price} onChange={(event) => updatePlan(index, 'old_price', event.target.value)} />
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
                  {product.image_url ? <img src={product.image_url} alt="" /> : product.avatar}
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
                  <p>{product.plans.filter((plan) => plan.active).map((plan) => `${plan.label} · ${plan.price.toLocaleString('fr-FR')} FCFA`).join(' / ') || 'Aucune formule active'}</p>
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
    </>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import './SmmServices.css';

const PAGE_SIZE = 50;

async function invokePanel(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('smm-panel', {
    body: { action, ...payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function SmmServices() {
  const [services, setServices] = useState([]);
  const [prices, setPrices] = useState({});
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadServices = useCallback(async () => {
    setError('');
    try {
      const { services: items } = await invokePanel('admin_catalog');
      setServices(items || []);
      setPrices(Object.fromEntries((items || []).map((item) => [item.id, String(item.sell_rate_xof)])));
    } catch (loadError) {
      console.error('Impossible de charger le catalogue SMM pour l’administration :', loadError);
      setError(loadError.message || 'Le catalogue ne peut pas être chargé.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadServices(); }, [loadServices]);

  async function synchronizeCatalog() {
    setWorking(true);
    setError('');
    setNotice('');
    try {
      const result = await invokePanel('sync');
      await loadServices();
      setPage(0);
      setNotice(
        `${result.synced} services importés ou actualisés ; ${result.added} nouveaux services sont disponibles à activer.`,
      );
    } catch (syncError) {
      console.error('Synchronisation SMMTurk impossible :', syncError);
      setError(syncError.message || 'La synchronisation du catalogue a échoué.');
    } finally {
      setWorking(false);
    }
  }

  async function savePrice(serviceId) {
    setWorking(true);
    setError('');
    setNotice('');
    try {
      const result = await invokePanel('set_price', {
        serviceId,
        sellRateXof: Number(prices[serviceId]),
      });
      setPrices((current) => ({ ...current, [serviceId]: String(result.service.sell_rate_xof) }));
      setServices((current) => current.map((service) => (
        service.id === serviceId ? { ...service, sell_rate_xof: result.service.sell_rate_xof } : service
      )));
      setNotice(`Tarif du service #${serviceId} enregistré.`);
    } catch (saveError) {
      console.error('Enregistrement du tarif SMM impossible :', saveError);
      setError(saveError.message || 'Le tarif n’a pas pu être enregistré.');
    } finally {
      setWorking(false);
    }
  }

  async function toggleService(service) {
    setWorking(true);
    setError('');
    setNotice('');
    try {
      const result = await invokePanel('set_active', {
        serviceId: service.id,
        active: !service.active,
      });
      setServices((current) => current.map((item) => (
        item.id === service.id ? { ...item, active: result.service.active } : item
      )));
      setNotice(
        result.service.active
          ? `Le service #${service.id} est maintenant visible dans le panel client.`
          : `Le service #${service.id} a été retiré du panel client.`,
      );
    } catch (toggleError) {
      console.error('Modification de la visibilité du service SMM impossible :', toggleError);
      setError(toggleError.message || 'La visibilité du service n’a pas pu être modifiée.');
    } finally {
      setWorking(false);
    }
  }

  const categories = [...new Set(services.map((service) => service.category || 'Autres'))].sort((a, b) => a.localeCompare(b, 'fr'));
  const filteredServices = services.filter((service) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query
      || `${service.id} ${service.name} ${service.type} ${service.category}`.toLowerCase().includes(query);
    const matchesCategory = !categoryFilter || (service.category || 'Autres') === categoryFilter;
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'active' ? service.active : !service.active);
    return matchesSearch && matchesCategory && matchesStatus;
  });
  const pageCount = Math.ceil(filteredServices.length / PAGE_SIZE);
  const pageServices = filteredServices.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const activeCount = services.filter((service) => service.active).length;

  return (
    <div className="smm-admin-page">
      <section className="panel smm-admin-panel">
      <div className="smm-admin-header">
        <div>
          <p className="smm-admin-kicker">SERVICES NUMÉRIQUES</p>
          <h2>Panel social</h2>
          <p>Importez les services SMMTurk, puis choisissez ceux que les clients pourront commander. Les tarifs clients sont en FCFA par tranche de 1 000.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={synchronizeCatalog} disabled={working}>
          {working ? 'Synchronisation…' : 'Synchroniser SMMTurk'}
        </button>
      </div>
      {error && <p className="smm-admin-notice is-error" role="alert">{error}</p>}
      {notice && <p className="smm-admin-notice is-success" role="status">{notice}</p>}
      {!loading && services.length > 0 && (
        <>
          <div className="smm-admin-toolbar">
            <label>
              Rechercher
              <input
                type="search"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(0); }}
                placeholder="Nom, réseau ou numéro…"
              />
            </label>
            <label>
              Catégorie
              <select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(0); }}>
                <option value="">Toutes les catégories</option>
                {categories.map((category) => <option value={category} key={category}>{category}</option>)}
              </select>
            </label>
            <label>
              Affichage
              <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }}>
                <option value="all">Tous les services</option>
                <option value="active">Services proposés ({activeCount})</option>
                <option value="inactive">Non sélectionnés</option>
              </select>
            </label>
            <p>{filteredServices.length} résultat{filteredServices.length > 1 ? 's' : ''}</p>
          </div>
          <p className="smm-admin-help">
            Les nouveaux services importés sont masqués par défaut. Active un service pour le rendre disponible dans le panel client.
          </p>
        </>
      )}
      {loading ? <p>Chargement du catalogue…</p> : services.length === 0 ? (
        <div className="smm-admin-empty">Aucun service importé. Lancez une synchronisation pour charger le catalogue.</div>
      ) : filteredServices.length === 0 ? (
        <div className="smm-admin-empty">Aucun service ne correspond aux filtres.</div>
      ) : (
        <>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Service</th><th>Catégorie</th><th>Tarif fournisseur</th><th>Prix client / 1 000</th><th>Visibilité client</th></tr>
            </thead>
            <tbody>
              {pageServices.map((service) => (
                <tr key={service.id}>
                  <td><strong>#{service.id} — {service.name}</strong><small>{service.type}</small></td>
                  <td>{service.category}</td>
                  <td>{Number(service.provider_rate).toLocaleString('fr-FR')} $</td>
                  <td>
                    <label className="smm-admin-price">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={prices[service.id] ?? ''}
                        onChange={(event) => setPrices((current) => ({ ...current, [service.id]: event.target.value }))}
                        aria-label={`Tarif du service ${service.id} en FCFA par 1 000`}
                      />
                      <span>FCFA</span>
                    </label>
                  </td>
                  <td>
                    <div className="smm-admin-actions">
                      <button type="button" onClick={() => savePrice(service.id)} disabled={working}>Enregistrer le prix</button>
                      <button
                        type="button"
                        className={service.active ? 'is-published' : 'is-hidden'}
                        onClick={() => toggleService(service)}
                        disabled={working}
                        aria-label={`${service.active ? 'Masquer' : 'Publier'} le service ${service.id}`}
                      >
                        {service.active ? 'Publié · masquer' : 'Masqué · publier'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <nav className="smm-admin-pagination" aria-label="Pagination du catalogue">
            <button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0 || working}>Précédent</button>
            <span>Page {page + 1} sur {pageCount}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} disabled={page >= pageCount - 1 || working}>Suivant</button>
          </nav>
        )}
        </>
      )}
      </section>
    </div>
  );
}

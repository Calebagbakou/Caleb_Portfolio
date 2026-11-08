import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../services/supabase';
import { getSupabaseFunctionError } from '../../utils/supabaseFunctionErrors';
import './SmmServices.css';

const PAGE_SIZE = 50;

async function invokePanel(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('smm-panel', {
    body: { action, ...payload },
  });
  if (error) throw await getSupabaseFunctionError(error, 'La fonction du panel social a échoué.');
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function SmmServices() {
  const [services, setServices] = useState([]);
  const [prices, setPrices] = useState({});
  const [search, setSearch] = useState('');
  const [maxProviderRate, setMaxProviderRate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState('catalog');
  const [walletSearchQuery, setWalletSearchQuery] = useState('');
  const [searchedWalletQuery, setSearchedWalletQuery] = useState('');
  const [walletUsers, setWalletUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [referralStats, setReferralStats] = useState(null);
  const creditRequestId = useRef(null);

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

  useEffect(() => {
    if (activeTab !== 'wallets') return undefined;
    let active = true;
    invokePanel('admin_referral_summary')
      .then(({ summary }) => { if (active) setReferralStats(summary); })
      .catch((summaryError) => {
        console.error('Impossible de charger le bilan des parrainages SMM :', summaryError);
        if (active) setError(summaryError.message || 'Le bilan des parrainages ne peut pas être chargé.');
      });
    return () => { active = false; };
  }, [activeTab]);

  async function searchWalletUsers(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSelectedUser(null);
    setWalletUsers([]);
    setSearchedWalletQuery('');
    if (walletSearchQuery.trim().length < 2) {
      setError('Saisissez au moins deux caractères pour rechercher un client.');
      return;
    }
    setWorking(true);
    try {
      const { users } = await invokePanel('admin_wallet_users', { query: walletSearchQuery.trim() });
      setWalletUsers(users || []);
      setSearchedWalletQuery(walletSearchQuery.trim());
    } catch (searchError) {
      console.error('Recherche de clients SMM impossible :', searchError);
      setError(searchError.message || 'La recherche de clients a échoué.');
    } finally {
      setWorking(false);
    }
  }

  async function creditWallet(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    const amountXof = Number(creditAmount);
    if (!selectedUser || !Number.isSafeInteger(amountXof) || amountXof < 1 || amountXof > 1000000000
      || creditReason.trim().length < 3) {
      setError('Sélectionnez un client et saisissez un montant et un motif valides.');
      return;
    }
    setWorking(true);
    if (!creditRequestId.current) creditRequestId.current = crypto.randomUUID();
    try {
      const { balanceXof } = await invokePanel('admin_credit_wallet', {
        userId: selectedUser.user_id,
        amountXof,
        description: creditReason.trim(),
        requestId: creditRequestId.current,
      });
      const updatedUser = { ...selectedUser, balance_xof: balanceXof };
      setSelectedUser(updatedUser);
      setWalletUsers((users) => users.map((user) => (
        user.user_id === updatedUser.user_id ? updatedUser : user
      )));
      setCreditAmount('');
      setCreditReason('');
      creditRequestId.current = null;
      setNotice(`Portefeuille de ${selectedUser.email} crédité de ${Number(amountXof).toLocaleString('fr-FR')} FCFA.`);
    } catch (creditError) {
      console.error('Crédit manuel du portefeuille SMM impossible :', creditError);
      setError(creditError.message || 'Le portefeuille n’a pas pu être crédité.');
    } finally {
      setWorking(false);
    }
  }

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
    const matchesMaxProviderRate = maxProviderRate === ''
      || Number(service.provider_rate) < Number(maxProviderRate);
    return matchesSearch && matchesCategory && matchesStatus && matchesMaxProviderRate;
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
          <p>{activeTab === 'catalog'
            ? 'Importez les services SMMTurk, puis choisissez ceux que les clients pourront commander. Les tarifs clients sont en FCFA par tranche de 1 000.'
            : 'Recherchez un compte pour créditer son portefeuille et suivez les récompenses du programme de parrainage.'}</p>
        </div>
        {activeTab === 'catalog' && (
          <button type="button" className="btn btn-primary" onClick={synchronizeCatalog} disabled={working}>
            {working ? 'Synchronisation…' : 'Synchroniser SMMTurk'}
          </button>
        )}
      </div>
      {error && <p className="smm-admin-notice is-error" role="alert">{error}</p>}
      {notice && <p className="smm-admin-notice is-success" role="status">{notice}</p>}
      <div className="smm-admin-tabs" role="tablist" aria-label="Gestion du panel social">
        <button type="button" role="tab" aria-selected={activeTab === 'catalog'} onClick={() => setActiveTab('catalog')}>Catalogue</button>
        <button type="button" role="tab" aria-selected={activeTab === 'wallets'} onClick={() => setActiveTab('wallets')}>Portefeuilles & parrainage</button>
      </div>
      {activeTab === 'wallets' ? (
        <div className="smm-admin-wallets" role="tabpanel">
          <section className="smm-admin-referral-stats" aria-label="Bilan du parrainage">
            <h3>Programme de parrainage</h3>
            <p>50 FCFA sont ajoutés au parrain après le premier dépôt confirmé de chaque filleul.</p>
            <div>
              <span><strong>{referralStats?.referrals ?? '—'}</strong> inscriptions</span>
              <span><strong>{referralStats?.rewardedReferrals ?? '—'}</strong> récompensées</span>
              <span><strong>{referralStats ? Number(referralStats.earnedXof).toLocaleString('fr-FR') : '—'}</strong> FCFA versés</span>
              <span><strong>{referralStats?.pendingReferrals ?? '—'}</strong> en attente</span>
            </div>
          </section>
          <section className="smm-admin-wallet-search" aria-labelledby="smm-admin-wallet-title">
            <h3 id="smm-admin-wallet-title">Créditer un portefeuille client</h3>
            <form className="smm-admin-wallet-form" onSubmit={searchWalletUsers}>
              <label>
                Rechercher par e-mail ou nom
                <input
                  type="search"
                  value={walletSearchQuery}
                  onChange={(event) => {
                    setWalletSearchQuery(event.target.value);
                    setSearchedWalletQuery('');
                    setWalletUsers([]);
                    setSelectedUser(null);
                  }}
                  minLength="2"
                  maxLength="120"
                  placeholder="Ex. client@email.com"
                />
              </label>
              <button type="submit" disabled={working}>{working ? 'Recherche…' : 'Rechercher'}</button>
            </form>
            {walletUsers.length > 0 ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Client</th><th>Solde actuel</th><th></th></tr></thead>
                  <tbody>
                    {walletUsers.map((user) => (
                      <tr key={user.user_id}>
                        <td><strong>{user.display_name || user.email}</strong><small>{user.email}</small></td>
                        <td>{Number(user.balance_xof).toLocaleString('fr-FR')} FCFA</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => setSelectedUser(user)}
                            disabled={working}
                            aria-pressed={selectedUser?.user_id === user.user_id}
                          >
                            {selectedUser?.user_id === user.user_id ? 'Sélectionné' : 'Choisir'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : searchedWalletQuery && !working ? (
              <p className="smm-admin-empty">Aucun client trouvé. Essayez avec une autre adresse ou un autre nom.</p>
            ) : null}
          </section>
          {selectedUser && (
            <form className="smm-admin-credit-form" onSubmit={creditWallet}>
              <h3>Crédit pour {selectedUser.email}</h3>
              <p>Solde actuel : <strong>{Number(selectedUser.balance_xof).toLocaleString('fr-FR')} FCFA</strong></p>
              <div className="smm-admin-credit-fields">
                <label>
                  Montant en FCFA
                  <input
                    type="number"
                    min="1"
                    max="1000000000"
                    step="1"
                    required
                    value={creditAmount}
                    onChange={(event) => setCreditAmount(event.target.value)}
                    placeholder="Ex. 1 000"
                  />
                </label>
                <label>
                  Motif (visible dans l’historique)
                  <input
                    type="text"
                    minLength="3"
                    maxLength="200"
                    required
                    value={creditReason}
                    onChange={(event) => setCreditReason(event.target.value)}
                    placeholder="Ex. Geste commercial"
                  />
                </label>
              </div>
              <button type="submit" className="btn btn-primary" disabled={working}>
                {working ? 'Crédit en cours…' : 'Confirmer le crédit'}
              </button>
            </form>
          )}
        </div>
      ) : (
      <>
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
              Tarif fournisseur inférieur à ($)
              <input
                type="number"
                min="0"
                step="any"
                value={maxProviderRate}
                onChange={(event) => { setMaxProviderRate(event.target.value); setPage(0); }}
                placeholder="Ex. 1"
              />
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
      </>
      )}
      </section>
    </div>
  );
}

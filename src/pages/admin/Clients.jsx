import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { formatPrice } from '../../data/products';
import { listAdminClients, saveAdminCustomerNote } from '../../services/adminClients';
import { formatOrderReference, normalizeOrderReference } from '../../utils/orderReference';

const LOYALTY_ORDER_THRESHOLD = 5;

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getWhatsAppUrl(contact, client) {
  if (!contact || client.anonymized) return '';
  let phone = String(contact).replace(/\D/g, '').replace(/^00/, '');
  if (phone.length === 10) phone = `229${phone}`;
  if (phone.length < 8 || phone.length > 15) return '';

  const firstName = client.name.split(/\s+/).filter(Boolean)[0] || 'bonjour';
  const reference = client.orders[0]?.ref;
  const message = `Bonjour ${firstName}, je vous contacte au sujet de votre commande${reference ? ` ${formatOrderReference(reference)}` : ''}.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function csvCell(value) {
  const content = String(value ?? '');
  const safe = /^[\u0000-\u0020]*[=+\-@]/.test(content) ? `'${content}` : content;
  return `"${safe.replace(/"/g, '""')}"`;
}

function exportClientsCsv(clients) {
  const rows = [
    ['Nom', 'WhatsApp', 'E-mail', 'Commandes payées', 'Total dépensé (FCFA)', 'Dernière commande'],
    ...clients.map((client) => [
      client.name,
      client.anonymized ? '' : client.contact,
      client.anonymized ? '' : client.email,
      client.paidOrderCount,
      client.totalSpent,
      formatDate(client.latestOrderAt),
    ]),
  ];
  const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'clients-caleb-creative.csv';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getSearchValue(client) {
  return [
    client.name,
    client.contact,
    client.email,
  ].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export default function Clients() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notesError, setNotesError] = useState(false);
  const [note, setNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteMessage, setNoteMessage] = useState('');

  async function loadClients() {
    setLoading(true);
    const { data, error: loadError, notesError: loadNotesError } = await listAdminClients();
    if (loadError) {
      console.error('Impossible de charger les clients :', loadError);
      setError(`Chargement impossible : ${loadError.message}`);
      setClients([]);
    } else {
      const nextClients = data || [];
      setClients(nextClients);
      setSelectedId((current) => (
        nextClients.some((client) => client.id === current) ? current : nextClients[0]?.id || ''
      ));
      setError('');
    }
    setNotesError(Boolean(loadNotesError));
    setLoading(false);
  }

  useEffect(() => {
    loadClients();
  }, []);

  const filteredClients = useMemo(() => {
    const normalizedSearch = search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const normalizedReference = normalizeOrderReference(search);
    const result = clients.filter((client) => getSearchValue(client).includes(normalizedSearch)
      || (normalizedReference && client.orders.some((order) => normalizeOrderReference(order.ref).includes(normalizedReference))));
    return result.sort((left, right) => {
      if (sort === 'spent') return right.totalSpent - left.totalSpent;
      if (sort === 'orders') return right.paidOrderCount - left.paidOrderCount;
      if (sort === 'name') return left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' });
      return new Date(right.latestOrderAt || 0).getTime() - new Date(left.latestOrderAt || 0).getTime();
    });
  }, [clients, search, sort]);

  const selectedClient = filteredClients.find((client) => client.id === selectedId) || null;

  useEffect(() => {
    setNote(selectedClient?.note || '');
    setNoteMessage('');
  }, [selectedClient?.id, selectedClient?.note]);

  async function saveNote(event) {
    event.preventDefault();
    if (!selectedClient || selectedClient.anonymized || notesError) return;

    setNoteSaving(true);
    setNoteMessage('');
    const { error: saveError } = await saveAdminCustomerNote({
      customerId: selectedClient.noteCustomerId,
      note,
      updatedBy: user?.id,
    });
    if (saveError) {
      console.error('Impossible d’enregistrer la note privée du client :', saveError);
      setNoteMessage(`Enregistrement impossible : ${saveError.message}. Vérifie que la migration 019_admin_customer_notes.sql est appliquée.`);
    } else {
      setClients((current) => current.map((client) => (
        client.id === selectedClient.id ? { ...client, note: note.trim() } : client
      )));
      setNoteMessage(note.trim() ? 'Note privée enregistrée.' : 'Note privée supprimée.');
    }
    setNoteSaving(false);
  }

  return (
    <div className="clients-admin">
      <section className="panel clients-list-panel">
        <div className="clients-heading">
          <div>
            <span className="clients-eyebrow">Relation client</span>
            <h2>Clients</h2>
            <p>Les achats sont regroupés par e-mail ou numéro. Seules les commandes payées comptent dans le total dépensé.</p>
          </div>
          <div className="clients-heading-actions">
            <span className="badge badge-read">{filteredClients.length} client{filteredClients.length === 1 ? '' : 's'}</span>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => exportClientsCsv(filteredClients)}
              disabled={!filteredClients.length}
            >
              Exporter CSV
            </button>
            <button className="btn btn-secondary btn-sm" type="button" onClick={loadClients} disabled={loading}>
              Actualiser
            </button>
          </div>
        </div>

        <div className="clients-controls">
          <label className="clients-search">
            <span>Rechercher</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nom, téléphone, e-mail ou référence"
            />
          </label>
          <label className="clients-sort">
            <span>Trier par</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="recent">Dernière commande</option>
              <option value="spent">Total dépensé</option>
              <option value="orders">Commandes payées</option>
              <option value="name">Nom</option>
            </select>
          </label>
        </div>

        {error && <div className="shop-admin-alert error" role="alert">{error}</div>}
        {notesError && (
          <div className="shop-admin-alert error" role="status">
            Les notes privées sont indisponibles. Applique la migration <code>019_admin_customer_notes.sql</code> ; la liste et l’historique restent consultables.
          </div>
        )}
        {loading && <div className="state-box">Chargement des clients…</div>}
        {!loading && !error && filteredClients.length === 0 && (
          <div className="state-box">{clients.length ? 'Aucun client ne correspond à cette recherche.' : 'Aucun client avec commande pour le moment.'}</div>
        )}

        {!loading && !error && filteredClients.length > 0 && (
          <div className="data-table-wrap clients-table-wrap">
            <table className="data-table clients-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>WhatsApp</th>
                  <th>E-mail</th>
                  <th>Commandes payées</th>
                  <th>Total dépensé</th>
                  <th>Dernière commande</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => {
                  const whatsapp = getWhatsAppUrl(client.contact, client);
                  return (
                    <tr key={client.id} className={client.id === selectedId ? 'client-row-selected' : ''}>
                      <td>
                        <button className="client-select" type="button" onClick={() => setSelectedId(client.id)}>
                          <strong>{client.name}</strong>
                          {client.anonymized && <span className="client-anonymized-badge">Anonymisé</span>}
                          {!client.anonymized && client.paidOrderCount >= LOYALTY_ORDER_THRESHOLD && (
                            <span className="client-loyalty-badge">Client fidèle</span>
                          )}
                        </button>
                      </td>
                      <td>{whatsapp ? <a className="client-whatsapp-link" href={whatsapp} target="_blank" rel="noopener noreferrer">{client.contact}</a> : '—'}</td>
                      <td>{client.email || '—'}</td>
                      <td>{client.paidOrderCount}</td>
                      <td>{formatPrice(client.totalSpent)}</td>
                      <td>{formatDate(client.latestOrderAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel clients-detail-panel" aria-label="Fiche client">
        {!selectedClient && (
          <div className="clients-detail-empty">
            <span aria-hidden="true">◎</span>
            <h2>Fiche client</h2>
            <p>Sélectionne un client dans la liste pour afficher ses commandes et ses notes privées.</p>
          </div>
        )}
        {selectedClient && (
          <>
            <div className="clients-detail-heading">
              <div>
                <span className="clients-eyebrow">Fiche client</span>
                <h2>{selectedClient.name}</h2>
                {selectedClient.anonymized && <span className="client-anonymized-badge">Données anonymisées</span>}
              </div>
              {getWhatsAppUrl(selectedClient.contact, selectedClient) && (
                <a className="btn btn-primary clients-whatsapp-button" href={getWhatsAppUrl(selectedClient.contact, selectedClient)} target="_blank" rel="noopener noreferrer">
                  Écrire sur WhatsApp
                </a>
              )}
            </div>

            {!selectedClient.anonymized && (
              <div className="clients-contact">
                <span>{selectedClient.contact || 'WhatsApp non renseigné'}</span>
                <span>{selectedClient.email || 'E-mail non renseigné'}</span>
              </div>
            )}

            <div className="clients-detail-stats">
              <div><strong>{selectedClient.orders.length}</strong><span>Commandes</span></div>
              <div><strong>{selectedClient.paidOrderCount}</strong><span>Payées</span></div>
              <div><strong>{formatPrice(selectedClient.totalSpent)}</strong><span>Total dépensé</span></div>
            </div>

            <div className="clients-history">
              <h3>Historique des commandes</h3>
              {selectedClient.orders.map((order) => (
                <article className="client-order" key={order.id}>
                  <div className="client-order-heading">
                    <div>
                      <strong>{formatOrderReference(order.ref)}</strong>
                      <span>{formatDate(order.created_at)}</span>
                    </div>
                    <div className="client-order-total">
                      <span className={`client-payment-status${order.payment_status === 'confirme' ? ' is-paid' : ''}`}>
                        {order.payment_status === 'confirme' ? 'Payée' : 'En attente'}
                      </span>
                      <strong>{formatPrice(Number(order.total) || 0)}</strong>
                    </div>
                  </div>
                  {(order.order_items || []).length > 0 && (
                    <ul>
                      {order.order_items.map((item) => (
                        <li key={item.id}>{item.product_name} · {item.plan_label} × {item.qty}</li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>

            <div className="clients-private-note">
              <h3>Notes privées</h3>
              {selectedClient.anonymized ? (
                <p className="clients-anonymized-note">Les données personnelles et les notes privées ont été effacées lors de l’anonymisation.</p>
              ) : (
                <form onSubmit={saveNote}>
                  <label htmlFor="admin-client-note">Visible uniquement dans l’administration</label>
                  <textarea
                    id="admin-client-note"
                    rows="4"
                    maxLength={3000}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Ajouter une note de suivi…"
                    disabled={notesError}
                  />
                  <div className="clients-note-actions">
                    <span>{note.length}/3 000</span>
                    <button className="btn btn-secondary btn-sm" type="submit" disabled={noteSaving || notesError}>
                      {noteSaving ? 'Enregistrement…' : note.trim() ? 'Enregistrer la note' : 'Supprimer la note'}
                    </button>
                  </div>
                  {noteMessage && <p className="clients-note-message" role="status">{noteMessage}</p>}
                </form>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

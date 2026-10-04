import { useEffect, useState } from 'react';
import { listMessages, setMessageRead, deleteMessage } from '../../services/messages';

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function Messages() {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | error | ready
  const [errorText, setErrorText] = useState('');
  const [openMessage, setOpenMessage] = useState(null);

  async function load() {
    setStatus('loading');
    const { data, error } = await listMessages();
    if (error) {
      console.error(error);
      setErrorText('Erreur de chargement : ' + error.message);
      setStatus('error');
      return;
    }
    setMessages(data || []);
    setStatus('ready');
  }

  useEffect(() => {
    load();
  }, []);

  async function openModal(id) {
    const m = messages.find((x) => x.id === id);
    if (!m) return;
    setOpenMessage(m);

    if (!m.is_read) {
      const { error } = await setMessageRead(id, true);
      if (!error) {
        setMessages((prev) => prev.map((x) => (x.id === id ? { ...x, is_read: true } : x)));
        setOpenMessage((prev) => (prev && prev.id === id ? { ...prev, is_read: true } : prev));
      }
    }
  }

  async function toggleRead() {
    if (!openMessage) return;
    const newVal = !openMessage.is_read;
    const { error } = await setMessageRead(openMessage.id, newVal);
    if (!error) {
      setMessages((prev) => prev.map((x) => (x.id === openMessage.id ? { ...x, is_read: newVal } : x)));
      setOpenMessage((prev) => ({ ...prev, is_read: newVal }));
    }
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer définitivement ce message ?')) return;
    const { error } = await deleteMessage(id);
    if (error) {
      alert('Erreur lors de la suppression : ' + error.message);
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setOpenMessage((prev) => (prev && prev.id === id ? null : prev));
  }

  return (
    <div className="panel">
      <h2>Messages reçus depuis le formulaire de contact</h2>
      <p>Clique sur un message pour le lire (il sera marqué comme lu automatiquement).</p>

      {status === 'loading' && <div className="state-box">Chargement…</div>}
      {status === 'error' && <div className="state-box error">{errorText}</div>}
      {status === 'ready' && messages.length === 0 && (
        <div className="state-box">Aucun message pour l'instant.</div>
      )}

      {status === 'ready' && messages.length > 0 && (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Statut</th>
                <th>Nom</th>
                <th>Date</th>
                <th>Contact</th>
                <th>Aperçu</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => {
                const preview = (m.content || '').slice(0, 60) + ((m.content || '').length > 60 ? '…' : '');
                return (
                  <tr key={m.id} className={!m.is_read ? 'is-unread' : ''}>
                    <td>
                      <span className={`badge ${m.is_read ? 'badge-read' : 'badge-unread'}`}>
                        {m.is_read ? 'Lu' : 'Non lu'}
                      </span>
                    </td>
                    <td>{m.name}</td>
                    <td>{fmtDate(m.created_at)}</td>
                    <td>{m.email || m.phone || '—'}</td>
                    <td>{preview}</td>
                    <td className="row-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => openModal(m.id)}>
                        Voir
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m.id)}>
                        Supprimer
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openMessage && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setOpenMessage(null)}>
          <div className="modal-box">
            <h2>{openMessage.name}</h2>
            <p className="save-msg" style={{ color: 'var(--ink-dim)' }}>
              {[openMessage.email, openMessage.phone, fmtDate(openMessage.created_at)].filter(Boolean).join(' · ')}
            </p>
            <div className="msg-body">{openMessage.content}</div>
            <div className="modal-actions">
              <button className="btn btn-secondary btn-sm" onClick={toggleRead}>
                {openMessage.is_read ? 'Marquer non lu' : 'Marquer lu'}
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(openMessage.id)}>
                Supprimer
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setOpenMessage(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

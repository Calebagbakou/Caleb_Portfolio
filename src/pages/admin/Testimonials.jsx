import { useEffect, useState } from 'react';
import {
  createTestimonial,
  deleteTestimonial,
  listTestimonials,
  updateTestimonial,
  uploadTestimonialPhoto,
} from '../../services/testimonials';

const INITIAL_FORM = { name: '', content: '', photoUrl: '' };

export default function Testimonials() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [photo, setPhoto] = useState(null);
  const [status, setStatus] = useState('');

  async function load() {
    const { data, error } = await listTestimonials();
    if (error) {
      setStatus(`Erreur : ${error.message}`);
      return;
    }
    setItems(data || []);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('Enregistrement…');
    let photoUrl = form.photoUrl.trim();
    if (photo) {
      const upload = await uploadTestimonialPhoto(photo);
      if (upload.error) {
        setStatus(`Erreur photo : ${upload.error.message}`);
        return;
      }
      photoUrl = upload.data;
    }
    const { error } = await createTestimonial({ name: form.name.trim(), content: form.content.trim(), photoUrl, isPublished: true });
    if (error) {
      setStatus(`Erreur : ${error.message}`);
      return;
    }
    setForm(INITIAL_FORM);
    setPhoto(null);
    setStatus('Témoignage ajouté.');
    await load();
  }

  async function togglePublished(item) {
    const { error } = await updateTestimonial(item.id, { is_published: !item.is_published });
    if (error) setStatus(`Erreur : ${error.message}`);
    else await load();
  }

  async function remove(item) {
    if (!window.confirm(`Supprimer le témoignage de ${item.name} ?`)) return;
    const { error } = await deleteTestimonial(item.id);
    if (error) setStatus(`Erreur : ${error.message}`);
    else await load();
  }

  return (
    <div className="panel">
      <h2>Témoignages</h2>
      <p>Ajoutez des témoignages validés ou modérez ceux reçus depuis le site.</p>
      <form className="admin-form" onSubmit={handleSubmit}>
        <label>Nom<input required minLength="2" maxLength="80" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Commentaire<textarea required minLength="10" maxLength="600" rows="4" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></label>
        <label>Photo (optionnelle)<input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} /></label>
        <label>URL photo (optionnelle)<input type="url" value={form.photoUrl} onChange={(e) => setForm({ ...form, photoUrl: e.target.value })} /></label>
        <button className="btn btn-primary" type="submit">Ajouter</button>
      </form>
      {status && <p className="save-msg" role="status">{status}</p>}
      <div className="data-table-wrap">
        <table className="data-table">
          <thead><tr><th>Nom</th><th>Commentaire</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>{items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.content}</td>
              <td>{item.is_published ? 'Publié' : 'À modérer'}</td>
              <td className="row-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => togglePublished(item)}>{item.is_published ? 'Masquer' : 'Publier'}</button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(item)}>Supprimer</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

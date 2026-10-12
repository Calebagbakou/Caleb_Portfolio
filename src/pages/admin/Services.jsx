import { useEffect, useState } from 'react';
import { DEFAULT_SERVICES, parseServices, SERVICES_SETTING_KEY, SERVICE_ICONS } from '../../data/services';
import { getSettingValue, saveSettings } from '../../services/settings';

export default function Services() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    getSettingValue(SERVICES_SETTING_KEY).then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError) {
        console.error('Impossible de charger les services :', loadError);
        setError(`Chargement impossible : ${loadError.message}`);
        setLoadFailed(true);
      } else if (data == null) {
        setServices(DEFAULT_SERVICES);
      } else {
        try {
          setServices(parseServices(data));
        } catch (parseError) {
          console.error('La liste des services enregistrée est invalide :', parseError);
          setError(`Chargement impossible : ${parseError.message}`);
          setLoadFailed(true);
        }
      }
      setLoading(false);
    }).catch((loadError) => {
      if (!active) return;
      console.error('Échec du chargement des services :', loadError);
      setError(`Chargement impossible : ${loadError instanceof Error ? loadError.message : String(loadError)}`);
      setLoadFailed(true);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  function updateService(index, field, value) {
    setServices((current) => current.map((service, serviceIndex) => (
      serviceIndex === index ? { ...service, [field]: value } : service
    )));
    setNotice('');
  }

  function moveService(index, offset) {
    setServices((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setNotice('');
  }

  function removeService(index) {
    setServices((current) => current.filter((_, serviceIndex) => serviceIndex !== index));
    setNotice('');
  }

  function addService() {
    if (services.length >= 30) {
      setError('Tu peux afficher au maximum 30 services.');
      return;
    }
    setServices((current) => [...current, {
      id: `service-${crypto.randomUUID()}`,
      title: '',
      desc: '',
      icon: 'sparkles',
    }]);
    setNotice('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    let normalized;
    try {
      normalized = parseServices(services);
      if (normalized.length === 0) throw new Error('Garde au moins un service dans cette section.');
      if (normalized.length > 30) throw new Error('Tu peux afficher au maximum 30 services.');
      const normalizedTitles = normalized.map((service) => service.title.toLocaleLowerCase('fr-FR'));
      if (new Set(normalizedTitles).size !== normalizedTitles.length) {
        throw new Error('Supprime les services en double avant d’enregistrer.');
      }
    } catch (validationError) {
      setError(validationError.message);
      return;
    }

    setSaving(true);
    try {
      const { error: saveError } = await saveSettings([
        { key: SERVICES_SETTING_KEY, value: JSON.stringify(normalized) },
      ]);
      if (saveError) throw saveError;
      setServices(normalized);
      setNotice('Services enregistrés et publiés sur le portfolio.');
    } catch (saveError) {
      console.error('Impossible d’enregistrer les services :', saveError);
      setError(`Enregistrement impossible : ${saveError instanceof Error ? saveError.message : String(saveError)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="services-admin">
      <section className="panel">
        <div className="projects-heading">
          <div>
            <h2>Services du portfolio</h2>
            <p>Modifie les prestations visibles sur l’accueil, choisis leur icône et règle leur ordre d’affichage.</p>
          </div>
          {!loading && !loadFailed && <span className="badge badge-read">{services.length} / 30</span>}
        </div>

        {error && <div className="projects-message error" role="alert">{error}</div>}
        {notice && <div className="projects-message" role="status">{notice}</div>}
        {loading && <div className="state-box">Chargement des services…</div>}
        {loadFailed && !loading && (
          <div className="state-box error">Les services ne sont pas modifiables tant que leur chargement a échoué. Recharge cette page après avoir vérifié ta connexion.</div>
        )}

        {!loading && !loadFailed && (
          <form className="services-admin-form" onSubmit={handleSubmit}>
            <div className="services-admin-list">
              {services.map((service, index) => (
                <article className="service-edit-card" key={service.id}>
                  <div className="service-edit-heading">
                    <span className="competency-order" aria-label={`Position ${index + 1}`}>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{service.title || 'Nouveau service'}</strong>
                    <div className="competency-row-actions">
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => moveService(index, -1)} disabled={index === 0} aria-label="Monter le service">↑</button>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={() => moveService(index, 1)} disabled={index === services.length - 1} aria-label="Descendre le service">↓</button>
                      <button className="btn btn-danger btn-sm" type="button" onClick={() => removeService(index)} aria-label={`Retirer ${service.title || 'ce service'}`}>Retirer</button>
                    </div>
                  </div>
                  <div className="services-admin-fields">
                    <div className="form-group">
                      <label htmlFor={`service-title-${index}`}>Nom du service</label>
                      <input
                        id={`service-title-${index}`}
                        value={service.title}
                        onChange={(event) => updateService(index, 'title', event.target.value)}
                        maxLength={80}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor={`service-icon-${index}`}>Icône</label>
                      <select
                        id={`service-icon-${index}`}
                        value={service.icon}
                        onChange={(event) => updateService(index, 'icon', event.target.value)}
                      >
                        {SERVICE_ICONS.map((icon) => <option value={icon.value} key={icon.value}>{icon.label}</option>)}
                      </select>
                    </div>
                    <div className="form-group service-edit-description">
                      <label htmlFor={`service-description-${index}`}>Description</label>
                      <textarea
                        id={`service-description-${index}`}
                        value={service.desc}
                        onChange={(event) => updateService(index, 'desc', event.target.value)}
                        rows="2"
                        maxLength={240}
                        required
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {services.length === 0 && (
              <div className="state-box">Aucun service pour le moment. Ajoute-en un pour l’afficher sur le portfolio.</div>
            )}

            <div className="competencies-actions">
              <button className="btn btn-secondary" type="button" onClick={addService} disabled={services.length >= 30}>
                + Ajouter un service
              </button>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer les services'}
              </button>
            </div>
            <small className="project-form-hint">Les services sont publiés dans l’ordre affiché. Maximum 30 services.</small>
          </form>
        )}
      </section>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { COMPETENCIES_SETTING_KEY, DEFAULT_COMPETENCIES, parseCompetencies } from '../../data/competencies';
import { getSettingValue, saveSettings } from '../../services/settings';

export default function Competencies() {
  const [competencies, setCompetencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    getSettingValue(COMPETENCIES_SETTING_KEY).then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError) {
        console.error('Impossible de charger les compétences :', loadError);
        setError(`Chargement impossible : ${loadError.message}`);
        setLoadFailed(true);
      } else if (data == null) {
        setCompetencies(DEFAULT_COMPETENCIES);
      } else {
        try {
          setCompetencies(parseCompetencies(data));
        } catch (parseError) {
          console.error('La liste des compétences enregistrée est invalide :', parseError);
          setError(`Chargement impossible : ${parseError.message}`);
          setLoadFailed(true);
        }
      }
      setLoading(false);
    }).catch((loadError) => {
      if (!active) return;
      console.error('Échec du chargement des compétences :', loadError);
      setError(`Chargement impossible : ${loadError instanceof Error ? loadError.message : String(loadError)}`);
      setLoadFailed(true);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  function updateCompetency(index, value) {
    setCompetencies((current) => current.map((competency, itemIndex) => (
      itemIndex === index ? value : competency
    )));
    setNotice('');
  }

  function moveCompetency(index, offset) {
    setCompetencies((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setNotice('');
  }

  function removeCompetency(index) {
    setCompetencies((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setNotice('');
  }

  function addCompetency() {
    if (competencies.length >= 30) {
      setError('Tu peux afficher au maximum 30 compétences.');
      return;
    }
    setCompetencies((current) => [...current, '']);
    setNotice('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    let normalized;
    try {
      normalized = parseCompetencies(competencies);
      if (normalized.length === 0) throw new Error('Garde au moins une compétence pour cette section.');
      if (normalized.length > 30) throw new Error('Tu peux afficher au maximum 30 compétences.');
      if (new Set(normalized.map((item) => item.toLocaleLowerCase('fr-FR'))).size !== normalized.length) {
        throw new Error('Supprime les compétences en double avant d’enregistrer.');
      }
    } catch (validationError) {
      setError(validationError.message);
      return;
    }

    setSaving(true);
    try {
      const { error: saveError } = await saveSettings([
        { key: COMPETENCIES_SETTING_KEY, value: JSON.stringify(normalized) },
      ]);
      if (saveError) throw saveError;
      setCompetencies(normalized);
      setNotice('Compétences enregistrées et publiées sur le portfolio.');
    } catch (saveError) {
      console.error('Impossible d’enregistrer les compétences :', saveError);
      setError(`Enregistrement impossible : ${saveError instanceof Error ? saveError.message : String(saveError)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="competencies-admin">
      <section className="panel">
        <div className="projects-heading">
          <div>
            <h2>Compétences du portfolio</h2>
            <p>Ajoute, modifie ou réorganise les savoir-faire affichés sur la page d’accueil.</p>
          </div>
          {!loading && !loadFailed && <span className="badge badge-read">{competencies.length} / 30</span>}
        </div>

        {error && <div className="projects-message error" role="alert">{error}</div>}
        {notice && <div className="projects-message" role="status">{notice}</div>}
        {loading && <div className="state-box">Chargement des compétences…</div>}
        {loadFailed && !loading && (
          <div className="state-box error">Les compétences ne sont pas modifiables tant que leur chargement a échoué. Recharge cette page après avoir vérifié ta connexion.</div>
        )}

        {!loading && !loadFailed && (
          <form className="competencies-form" onSubmit={handleSubmit}>
            <div className="competencies-list">
              {competencies.map((competency, index) => (
                <div className="competency-edit-row" key={`competency-${index}`}>
                  <span className="competency-order" aria-label={`Position ${index + 1}`}>{String(index + 1).padStart(2, '0')}</span>
                  <div className="form-group">
                    <label htmlFor={`competency-${index}`}>Compétence</label>
                    <input
                      id={`competency-${index}`}
                      value={competency}
                      onChange={(event) => updateCompetency(index, event.target.value)}
                      maxLength={80}
                      required
                    />
                  </div>
                  <div className="competency-row-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      onClick={() => moveCompetency(index, -1)}
                      disabled={index === 0}
                      aria-label={`Monter ${competency || 'la compétence'}`}
                    >↑</button>
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      onClick={() => moveCompetency(index, 1)}
                      disabled={index === competencies.length - 1}
                      aria-label={`Descendre ${competency || 'la compétence'}`}
                    >↓</button>
                    <button
                      className="btn btn-danger btn-sm"
                      type="button"
                      onClick={() => removeCompetency(index)}
                      aria-label={`Supprimer ${competency || 'la compétence'}`}
                    >Retirer</button>
                  </div>
                </div>
              ))}
            </div>

            {competencies.length === 0 && (
              <div className="state-box">Aucune compétence pour le moment. Ajoute-en une pour l’afficher sur le portfolio.</div>
            )}

            <div className="competencies-actions">
              <button className="btn btn-secondary" type="button" onClick={addCompetency} disabled={competencies.length >= 30}>
                + Ajouter une compétence
              </button>
              <button className="btn btn-primary" type="submit" disabled={saving || loading}>
                {saving ? 'Enregistrement…' : 'Enregistrer les compétences'}
              </button>
            </div>
            <small className="project-form-hint">Les compétences sont publiées dans l’ordre affiché. Maximum 30 compétences, 80 caractères chacune.</small>
          </form>
        )}
      </section>
    </div>
  );
}

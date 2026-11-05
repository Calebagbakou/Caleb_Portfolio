import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SMM_MODULES, SMM_RESOURCES, getSmmResourceContent } from '../data/smmLearning';
import { supabase } from '../services/supabase';
import Seo from '../components/site/Seo';
import './SmmLearning.css';

function downloadResource(resource) {
  const file = new Blob([getSmmResourceContent(resource)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${resource.slug}.txt`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function SmmNavigation({ active }) {
  const links = [
    { to: '/smm', label: 'Découvrir' },
    { to: '/smm/programmes', label: 'Le parcours' },
    { to: '/smm/ressources', label: 'Ressources' },
    { to: '/smm/mon-espace', label: 'Ma progression' },
    { to: '/smm/panel', label: 'Services sociaux' },
  ];
  return (
    <nav className="smm-learning-nav" aria-label="Navigation SMM">
      {links.map((link) => (
        <Link className={active === link.to ? 'is-active' : ''} to={link.to} key={link.to}>{link.label}</Link>
      ))}
    </nav>
  );
}

function ModuleCards({ completed }) {
  return (
    <div className="smm-learning-modules">
      {SMM_MODULES.map((module, index) => (
        <article className="smm-learning-module" key={module.slug}>
          <div className="smm-learning-module-top">
            <span className="smm-learning-module-number">MODULE {String(index + 1).padStart(2, '0')}</span>
            {completed.has(module.slug) && <span className="smm-learning-complete" aria-label="Module terminé">✓ Terminé</span>}
          </div>
          <h3>{module.title}</h3>
          <p>{module.summary}</p>
          <Link to={`/smm/programmes/${module.slug}`} className="smm-learning-text-link">
            Ouvrir la leçon <span aria-hidden="true">→</span>
          </Link>
        </article>
      ))}
    </div>
  );
}

function ResourceCards() {
  return (
    <div className="smm-learning-resources">
      {SMM_RESOURCES.map((resource) => (
        <article className="smm-learning-resource" key={resource.slug}>
          <span className="smm-resource-format">{resource.format} · À télécharger</span>
          <h3>{resource.title}</h3>
          <p>{resource.description}</p>
          <button type="button" className="smm-learning-text-link" onClick={() => downloadResource(resource)}>
            Télécharger le modèle <span aria-hidden="true">↓</span>
          </button>
        </article>
      ))}
    </div>
  );
}

export default function SmmLearning() {
  const location = useLocation();
  const { slug } = useParams();
  const { user } = useAuth();
  const [completed, setCompleted] = useState(new Set());
  const [progressLoading, setProgressLoading] = useState(false);
  const [savingSlug, setSavingSlug] = useState('');
  const [progressError, setProgressError] = useState('');
  const [progressNotice, setProgressNotice] = useState('');
  const isSignedIn = Boolean(user?.id);
  const module = useMemo(() => SMM_MODULES.find((item) => item.slug === slug), [slug]);
  const isResources = location.pathname === '/smm/ressources';
  const isMySpace = location.pathname === '/smm/mon-espace';
  const isModuleList = location.pathname === '/smm/programmes';
  const isLesson = location.pathname.startsWith('/smm/programmes/') && !isModuleList;
  const nextModule = module ? SMM_MODULES[SMM_MODULES.findIndex((item) => item.slug === module.slug) + 1] : null;

  const loadProgress = useCallback(async () => {
    if (!isSignedIn || !user?.id) return;
    setProgressLoading(true);
    setProgressError('');
    const { data, error } = await supabase
      .from('smm_learning_progress')
      .select('module_slug')
      .eq('user_id', user.id);
    if (error) {
      console.error('Impossible de charger la progression SMM :', error);
      setProgressError('La sauvegarde de la progression sera disponible après la mise en place de l’espace SMM. Les leçons restent accessibles.');
    } else {
      setCompleted(new Set((data || []).map((item) => item.module_slug)));
    }
    setProgressLoading(false);
  }, [isSignedIn, user?.id]);

  useEffect(() => { loadProgress(); }, [loadProgress]);

  async function markComplete() {
    if (!module || !isSignedIn || !user?.id) return;
    setSavingSlug(module.slug);
    setProgressError('');
    setProgressNotice('');
    const { error } = await supabase.from('smm_learning_progress').upsert({
      user_id: user.id,
      module_slug: module.slug,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,module_slug' });
    if (error) {
      console.error('Impossible d’enregistrer la progression SMM :', error);
      setProgressError('Ce module n’a pas pu être marqué comme terminé. Réessaie dans un instant.');
    } else {
      setCompleted((current) => new Set(current).add(module.slug));
      setProgressNotice('Module marqué comme terminé. Ta progression est enregistrée.');
    }
    setSavingSlug('');
  }

  const completedCount = completed.size;
  const progressPercent = Math.round((completedCount / SMM_MODULES.length) * 100);
  const pageTitle = isResources
    ? 'Ressources SMM gratuites'
    : isMySpace
      ? 'Ma progression SMM'
      : module
        ? `${module.title} — Parcours SMM`
        : 'Apprendre le social media management';

  return (
    <main className="smm-learning-page">
      <Seo
        title={`${pageTitle} — Caleb Creative`}
        description="Apprends à gérer les réseaux sociaux avec des leçons simples, des exemples, des exercices et des ressources pratiques."
        path={location.pathname}
      />
      <div className="smm-learning-shell">
        <SmmNavigation active={isResources ? '/smm/ressources' : isMySpace ? '/smm/mon-espace' : isModuleList || isLesson ? '/smm/programmes' : '/smm'} />

        {progressError && <p className="smm-learning-alert is-error" role="alert">{progressError}</p>}
        {progressNotice && <p className="smm-learning-alert is-success" role="status">{progressNotice}</p>}

        {isLesson ? (
          module ? (
            <article className="smm-learning-lesson">
              <Link className="smm-learning-back" to="/smm/programmes">← Tous les modules</Link>
              <p className="smm-learning-eyebrow">MODULE {String(SMM_MODULES.indexOf(module) + 1).padStart(2, '0')} · LEÇON COURTE</p>
              <h1>{module.title}</h1>
              <p className="smm-learning-lead">{module.summary}</p>
              <section className="smm-learning-lesson-block">
                <h2>À retenir</h2>
                <p>{module.lesson}</p>
              </section>
              <section className="smm-learning-example">
                <span>EXEMPLE CONCRET</span>
                <p>{module.example}</p>
              </section>
              <section className="smm-learning-lesson-block">
                <h2>Checklist</h2>
                <ul>{module.checklist.map((item) => <li key={item}>{item}</li>)}</ul>
              </section>
              <section className="smm-learning-exercise">
                <span>À TOI DE PRATIQUER</span>
                <p>{module.exercise}</p>
              </section>
              <section className="smm-learning-lesson-block">
                <h2>Ressource à utiliser</h2>
                {SMM_RESOURCES.filter((resource) => resource.slug === module.resource).map((resource) => (
                  <div className="smm-lesson-download" key={resource.slug}>
                    <div><strong>{resource.title}</strong><span>Modèle texte · fichier léger</span></div>
                    <button type="button" className="smm-learning-button is-outline" onClick={() => downloadResource(resource)}>Télécharger</button>
                  </div>
                ))}
              </section>
              <div className="smm-learning-lesson-actions">
                {isSignedIn ? (
                  <button type="button" className="smm-learning-button" onClick={markComplete} disabled={savingSlug === module.slug || completed.has(module.slug)}>
                    {completed.has(module.slug) ? '✓ Module terminé' : savingSlug === module.slug ? 'Enregistrement…' : 'Marquer comme terminé'}
                  </button>
                ) : (
                  <Link className="smm-learning-button" to={`/smm/connexion?next=${encodeURIComponent('/smm/mon-espace')}`}>
                    Se connecter pour suivre ma progression
                  </Link>
                )}
                {nextModule && <Link className="smm-learning-next" to={`/smm/programmes/${nextModule.slug}`}>Leçon suivante : {nextModule.title} →</Link>}
              </div>
            </article>
          ) : (
            <section className="smm-learning-empty">
              <p className="smm-learning-eyebrow">LEÇON INTROUVABLE</p>
              <h1>Ce module n’existe pas.</h1>
              <p>Choisis un module disponible dans le parcours débutant.</p>
              <Link className="smm-learning-button" to="/smm/programmes">Voir les modules</Link>
            </section>
          )
        ) : isResources ? (
          <section className="smm-learning-content">
            <p className="smm-learning-eyebrow">OUTILS PRATIQUES · FORMAT TEXTE</p>
            <h1>Des ressources simples à emporter.</h1>
            <p className="smm-learning-lead">Télécharge un modèle, adapte-le à ton activité et utilise-le depuis ton téléphone ou ton ordinateur.</p>
            <ResourceCards />
          </section>
        ) : isMySpace ? (
          <section className="smm-learning-content smm-learning-dashboard">
            <p className="smm-learning-eyebrow">TON ESPACE D’APPRENTISSAGE</p>
            <h1>Ta progression, à ton rythme.</h1>
            <p className="smm-learning-lead">Les leçons terminées sont rattachées à ton compte Caleb Creative.</p>
            <div className="smm-progress-card">
              <div className="smm-progress-heading"><div><span>PARCOURS DÉBUTANT</span><strong>{completedCount} / {SMM_MODULES.length} modules</strong></div><b>{progressPercent}%</b></div>
              <div className="smm-progress-track" role="progressbar" aria-label="Progression du parcours SMM" aria-valuenow={progressPercent} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${progressPercent}%` }} /></div>
              {progressLoading && <p>Chargement de ta progression…</p>}
              {!completedCount && !progressLoading && <p>Commence par le premier module, puis marque chaque leçon comme terminée.</p>}
            </div>
            <div className="smm-learning-dashboard-links">
              <Link to={completedCount < SMM_MODULES.length ? `/smm/programmes/${SMM_MODULES.find((item) => !completed.has(item.slug))?.slug || SMM_MODULES[0].slug}` : '/smm/programmes'} className="smm-learning-button">Reprendre mon parcours</Link>
              <Link to="/smm/ressources" className="smm-learning-button is-outline">Mes ressources</Link>
              <Link to="/smm/panel" className="smm-learning-text-link">Accéder aux services sociaux ↗</Link>
            </div>
          </section>
        ) : (
          <>
            {!isModuleList && (
              <>
                <section className="smm-learning-hero">
                  <div className="smm-learning-hero-copy">
                    <p className="smm-learning-eyebrow"><span /> PARCOURS DÉBUTANT · ACCESSIBLE SUR TÉLÉPHONE</p>
                    <h1>Apprends à gérer les réseaux sociaux <em>avec une vraie méthode.</em></h1>
                    <p className="smm-learning-lead">De ton premier contenu à la lecture des résultats, avance étape par étape avec des explications simples, des modèles et des exercices pratiques.</p>
                    <div className="smm-learning-hero-actions">
                      <Link className="smm-learning-button" to={`/smm/programmes/${SMM_MODULES[0].slug}`}>Commencer gratuitement <span aria-hidden="true">→</span></Link>
                      <Link className="smm-learning-button is-outline" to="/smm/programmes">Voir les programmes</Link>
                    </div>
                    <p className="smm-learning-shared-account">Un seul compte pour ta progression, tes achats boutique et tes services sociaux.</p>
                  </div>
                  <div className="smm-learning-hero-card">
                    <span>TON PARCOURS</span>
                    <strong>10</strong>
                    <b>modules pour progresser</b>
                    <ul><li>Leçons courtes</li><li>Exemples concrets</li><li>Exercices et modèles</li></ul>
                  </div>
                </section>

                <section className="smm-learning-section">
                  <div className="smm-learning-section-heading"><p className="smm-learning-eyebrow">POUR QUI ?</p><h2>Tu peux commencer d’où tu es.</h2></div>
                  <div className="smm-learning-audiences">
                    <article><span>01</span><h3>Tu débutes</h3><p>Tu ne sais pas encore quoi publier ni par où commencer.</p></article>
                    <article><span>02</span><h3>Tu entreprends</h3><p>Tu veux mieux organiser la communication de ton activité.</p></article>
                    <article><span>03</span><h3>Tu crées du contenu</h3><p>Tu cherches un rythme et une méthode pour publier régulièrement.</p></article>
                    <article><span>04</span><h3>Tu veux devenir freelance</h3><p>Tu souhaites apprendre à cadrer une prestation social media.</p></article>
                  </div>
                  <p className="smm-learning-promise">Le parcours transmet une méthode à pratiquer. Il ne promet ni audience instantanée ni résultats garantis.</p>
                </section>
              </>
            )}

            <section className="smm-learning-section" id="programmes">
              <div className="smm-learning-section-heading">
                <div><p className="smm-learning-eyebrow">LE PARCOURS DÉBUTANT</p><h2>{isModuleList ? '10 étapes pour construire ta méthode.' : 'Apprendre, puis mettre en pratique.'}</h2></div>
                {!isModuleList && <Link className="smm-learning-text-link" to="/smm/programmes">Voir les 10 modules →</Link>}
              </div>
              <ModuleCards completed={completed} />
            </section>

            {!isModuleList && (
              <>
                <section className="smm-learning-section smm-learning-offers">
                  <div className="smm-learning-section-heading"><p className="smm-learning-eyebrow">CHOISIR SON RYTHME</p><h2>Un parcours clair, sans promesse magique.</h2></div>
                  <div className="smm-learning-offer-grid">
                    <article><span>01 · DÉCOUVERTE</span><h3>Faire ses premiers pas</h3><p>Leçons d’introduction et modèles pour découvrir les bases du SMM.</p><Link to={`/smm/programmes/${SMM_MODULES[0].slug}`}>Commencer gratuitement →</Link></article>
                    <article className="is-featured"><span>02 · PARCOURS COMPLET</span><h3>Construire sa méthode</h3><p>Les dix modules, les exercices pratiques et les ressources téléchargeables.</p><Link to="/smm/programmes">Voir le parcours →</Link></article>
                    <article><span>03 · ACCOMPAGNEMENT</span><h3>Travailler sur son projet</h3><p>Pour discuter d’un besoin d’accompagnement ou d’une prestation adaptée.</p><Link to="/portfolio/#contact">Parler de mon projet →</Link></article>
                  </div>
                </section>
                <section className="smm-learning-section smm-learning-faq">
                  <div className="smm-learning-section-heading"><div><p className="smm-learning-eyebrow">QUESTIONS FRÉQUENTES</p><h2>Avant de te lancer.</h2></div></div>
                  <div className="smm-learning-faq-list">
                    <details><summary>Le SMM est-il adapté aux débutants ?</summary><p>Oui. Le parcours commence par les bases et explique les notions progressivement, sans supposer que tu connais déjà les outils.</p></details>
                    <details><summary>Ai-je besoin d’une grande audience ?</summary><p>Non. Tu peux apprendre la méthode avec un projet fictif ou une petite activité. Le nombre d’abonnés ne remplace pas un objectif clair ni une relation utile avec le public.</p></details>
                    <details><summary>Est-ce une formation ou un accompagnement ?</summary><p>Cette page propose un parcours de leçons, des exercices et des modèles à pratiquer à ton rythme. Un accompagnement personnalisé est distinct et doit être convenu séparément.</p></details>
                    <details><summary>Puis-je suivre le SMM depuis un téléphone ?</summary><p>Oui. Les leçons et modèles sont conçus pour être consultés sur téléphone comme sur ordinateur.</p></details>
                    <details><summary>Les achats de la boutique apparaissent-ils dans mon espace ?</summary><p>La boutique et l’espace SMM utilisent le même compte. Les achats restent consultables dans les pages de compte et de commandes de la boutique.</p></details>
                    <details><summary>Que se passe-t-il après un paiement ?</summary><p>Pour un achat en boutique, les informations de commande et de livraison numérique sont accessibles depuis ton compte. Les leçons gratuites du parcours SMM ne demandent pas de paiement.</p></details>
                  </div>
                </section>
                <section className="smm-learning-bottom-cta">
                  <div><p className="smm-learning-eyebrow">UNE LEÇON À LA FOIS</p><h2>Prêt à commencer ?</h2><p>Le premier module explique ce que le SMM peut apporter et comment choisir un objectif utile.</p></div>
                  <Link className="smm-learning-button" to={`/smm/programmes/${SMM_MODULES[0].slug}`}>Ouvrir le premier module <span aria-hidden="true">↗</span></Link>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

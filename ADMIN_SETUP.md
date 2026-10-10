# Administration du portfolio

L'espace de gestion des projets est disponible sur `/admin/projects`. Il
utilise l'authentification Supabase existante et vérifie que le compte fait
partie de la table `admins`. Les modifications publiées apparaissent sur le
portfolio sans nouveau déploiement du site.

## 1. Vérifier la base avant la migration

La base existante utilise déjà `projects`, `categories` et `media`; le script
réutilise ces tables. Avant de l'exécuter, ouvre **Supabase → SQL Editor** et
vérifie les colonnes et politiques actuelles :

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'projects'
order by ordinal_position;

select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'projects';
```

Fais une sauvegarde si `projects` contient déjà des données. Puis exécute
[`supabase/migrations/001_projects_admin.sql`](./supabase/migrations/001_projects_admin.sql)
dans SQL Editor. Le script conserve les lignes, identifiants, relations et
politiques RLS existants; il ajoute seulement les champs manquants, synchronise
`published` avec `status`, récupère les catégories et médias liés lorsque
possible, puis importe les 16 cartes historiques sans doublonner les titres.
L'importation peut être réexécutée.

Les politiques RLS présentes sont conservées : elles autorisent déjà la
lecture publique avec `status = 'published'` et l'écriture par `is_admin()`.
Le nouveau champ `published` reste synchronisé avec `status`, de sorte que le
filtre public et les règles de sécurité continuent de fonctionner ensemble.

Pour activer les aperçus vidéo YouTube, exécute également
[`supabase/migrations/002_project_autoplay_preview.sql`](./supabase/migrations/002_project_autoplay_preview.sql).
Cette migration ajoute `autoplay_preview`, désactivé par défaut pour chaque
projet existant.

## 2. Vérifier le compte administrateur

Le compte doit exister dans **Authentication → Users**, et son UUID doit
figurer dans `public.admins.id`. Si ce n'est pas encore le cas, exécute en
remplaçant l'UUID :

```sql
insert into public.admins (id, name)
values ('UUID-DU-COMPTE', 'Caleb')
on conflict (id) do nothing;
```

Ne crée pas de clé `service_role` dans le navigateur ni dans les variables
`VITE_*`.

## 3. Configurer le déploiement GitHub Pages

Le workflow compile les paramètres Supabase dans le bundle public. Dans le
dépôt GitHub : **Settings → Secrets and variables → Actions → New repository
secret**, ajoute :

- `VITE_SUPABASE_URL` : URL du projet Supabase ;
- `VITE_SUPABASE_ANON_KEY` : clé publique/anon Supabase.

Il ne faut jamais y mettre la clé `service_role`. Relance ensuite le workflow
**Deploy portfolio to GitHub Pages**. La copie `404.html` permet aussi aux
routes React comme `/admin` de s'ouvrir directement sur GitHub Pages.

Pour utiliser `calebcreative.com/admin`, le domaine doit déjà être relié à
l'hébergement du site et être autorisé comme URL de redirection dans
**Supabase → Authentication → URL Configuration**. Le code seul ne configure
pas le DNS du domaine. Si le domaine est relié directement à GitHub Pages, le
workflow doit compiler avec `--base=/` au lieu de `--base=/Caleb_Portfolio/`.

## 4. Gérer les projets

Après migration et déploiement, connecte-toi via `/admin`, puis ouvre
**Projets**. Tu peux ajouter, modifier, supprimer, publier et dépublier.
Les catégories sont saisies librement.

- **YouTube** : colle une URL `youtube.com/watch`, `youtu.be` ou `youtube.com/shorts`.
  L'identifiant est extrait automatiquement et le lecteur intégré est généré.
  Dans le formulaire, coche **Prévisualisation automatique silencieuse** pour
  autoriser un aperçu muet limité à 8 secondes quand la carte est visible. Le
  lecteur officiel YouTube s'ouvre dans la lightbox; le site ne redirige pas
  l'utilisateur vers YouTube. YouTube peut toutefois imposer ses propres
  éléments de marque, restrictions d'intégration ou vérifications anti-abus.
- **Image** : renseigne une URL d'image accessible publiquement.
- **Vidéo externe** : renseigne une URL MP4/WebM directe ou un lecteur Vimeo.
- **Vidéos IA** : le formulaire vérifie automatiquement les dimensions d'un
  fichier vidéo direct et reconnaît les liens YouTube Shorts. Pour les autres
  lecteurs, vérifie l'image puis sélectionne **Portrait** ou **Paysage**. Le
  portfolio range les projets dans deux lignes distinctes « Vidéos IA ·
  Portrait » et « Vidéos IA · Paysage »; les vidéos et miniatures restent
  contenues dans leur cadre sans être recadrées. Les anciens projets non
  classés restent dans la ligne Paysage jusqu'à ce que tu les modifies dans
  l'admin et confirmes leur format.
- **Miniature** : optionnelle. Les liens d'image sont enregistrés dans
  `thumbnail_url`; les fichiers ne sont pas envoyés vers Supabase Storage.
  Pour YouTube, sa miniature est utilisée automatiquement si aucun lien n'est
  fourni.

Le public ne reçoit que les projets `published = true`. La lecture publique et
les droits admin sont aussi contrôlés par RLS, pas seulement par le routage
React. Les données portfolio historiques restent affichées en secours si
Supabase ne répond pas, sans masquer les erreurs dans la console.

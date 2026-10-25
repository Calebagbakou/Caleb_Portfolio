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

Si la page de connexion indique maintenant que la vérification admin a échoué,
contrôle dans **Supabase → SQL Editor** que la table existe et que le compte est
bien inscrit. Remplace l'adresse par celle utilisée dans **Authentication → Users** :

```sql
select id, email, email_confirmed_at
from auth.users
where lower(email) = lower('adresse-admin@example.com');

select id, name
from public.admins;
```

Si l'adresse n'apparaît pas dans la première requête, crée ou retrouve le compte
dans **Authentication → Users**. Si l'UUID est absent de `public.admins`, ajoute
le compte avec la requête ci-dessus. Si la connexion échoue avec l'adresse ou le
mot de passe incorrect, utilise **Mot de passe oublié ?** sur la page admin et
ouvre le lien reçu sur le même domaine que celui enregistré dans
**Supabase → Authentication → URL Configuration**. Un message d'erreur de
configuration ou de réseau n'indique pas que le mot de passe est mauvais :
vérifie alors les paramètres Supabase du déploiement et son état.

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

Pour utiliser `calebcreative.online/admin`, le domaine doit déjà être relié à
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
- **Miniature** : optionnelle. Les liens d'image sont enregistrés dans
  `thumbnail_url`; les fichiers ne sont pas envoyés vers Supabase Storage.
  Pour YouTube, sa miniature est utilisée automatiquement si aucun lien n'est
  fourni.

Le public ne reçoit que les projets `published = true`. La lecture publique et
les droits admin sont aussi contrôlés par RLS, pas seulement par le routage
React. Les données portfolio historiques restent affichées en secours si
Supabase ne répond pas, sans masquer les erreurs dans la console.

## 5. Choisir le bouton d’appel à l’action de la boutique

Avant de déployer la mise à jour, exécute
[`supabase/migrations/015_shop_product_cta_label.sql`](./supabase/migrations/015_shop_product_cta_label.sql)
et [`supabase/migrations/016_shop_product_prices.sql`](./supabase/migrations/016_shop_product_prices.sql),
puis [`supabase/migrations/017_shop_checkout_uses_product_promo_price.sql`](./supabase/migrations/017_shop_checkout_uses_product_promo_price.sql)
dans SQL Editor. Dans `/admin/shop`, chaque produit peut ensuite choisir le
libellé de son bouton et saisir un prix normal ainsi qu’un prix promotionnel.
Sur les cartes de la boutique, le prix normal apparaît barré à gauche du prix
promotionnel. Le prix promo est le seul montant utilisé dans les formules, le
panier et le checkout; le prix normal barré sert uniquement à l’affichage.

## 6. Gérer les compétences et les services

Dans `/admin/competences`, les compétences affichées sur la page d’accueil
peuvent être ajoutées, modifiées, supprimées et réordonnées. Dans
`/admin/services`, les prestations peuvent être gérées de la même manière,
avec une description et une icône sélectionnable. Les listes sont enregistrées
dans la table `settings` sous `site_competencies` et `site_services`; aucune
migration supplémentaire n’est nécessaire. Si aucune liste n’a encore été
enregistrée, le site reprend les éléments de départ déjà présents dans le
portfolio.

## 7. Gérer les codes promo de la boutique

Applique
[`supabase/migrations/025_shop_promo_management.sql`](./supabase/migrations/025_shop_promo_management.sql),
puis déploie l’Edge Function `checkout-shop`. Dans `/admin/shop`, un code peut
avoir un nom interne, un code saisi ou généré, une remise en pourcentage ou en
montant fixe, une sélection de produits et une période de validité. Les limites
initiales sont de 100 commandes au total et une utilisation par adresse e-mail;
une limite laissée vide est sans plafond. Le code est désactivé automatiquement
quand son plafond global est atteint.

Une réduction de 100 % ou un montant fixe qui couvre toute la commande exige
l’option explicite **code cadeau**. Appliquer un code dans le checkout ne crée
pas de commande; les limites ne sont consommées qu’à la confirmation finale de
la commande. Le prix final et les limites sont recalculés côté serveur.

## 8. Configurer la livraison des produits API

L’Edge Function `gemini-prodseller-activate` traite les activations API après
confirmation du paiement boutique. Dans **Admin → Fournisseurs**, le
fournisseur se choisit individuellement pour chaque produit. Les commandes
déjà commencées restent épinglées à leur fournisseur d’origine.

1. Exécute dans l’ordre les migrations
  [`supabase/migrations/030_duolingo_super_api_product.sql`](./supabase/migrations/030_duolingo_super_api_product.sql)
  puis [`supabase/migrations/031_shop_zfourstore_provider.sql`](./supabase/migrations/031_shop_zfourstore_provider.sql)
  et [`supabase/migrations/032_shop_product_api_mappings.sql`](./supabase/migrations/032_shop_product_api_mappings.sql).
  La migration 030 ajoute Duolingo Super 12 mois au catalogue à 1 000 FCFA;
  la 031 configure Z FOUR STORE et protège les commandes contre une seconde
  tentative après une réponse incertaine; la 032 ajoute les IDs fournisseur
  et le choix fournisseur par produit.
2. Configure les secrets Supabase `PRODSELLER_API_KEY` et
  `ZFOURSTORE_API_KEY`. Les clés ne vont jamais dans le code du site, les
  variables `VITE_*` ou Git.
3. Dans `/admin/shop`, règle le mode de livraison sur **Activation par API**
  puis saisis, pour chaque fournisseur où le produit existe, l’identifiant
  retourné par son catalogue (`GET /products`). Les identifiants sont stockés
  dans les colonnes `prodseller_product_id` et `zfourstore_product_id`; il
  n’est plus nécessaire de créer un secret Supabase par produit. L’API Z FOUR
  STORE utilise l’hôte Railway documenté
  `https://zfourstore.up.railway.app/api/v1` (documentation :
  <https://zfourstore.up.railway.app/api-docs>). Les produits peuvent être
  disponibles chez un seul fournisseur; dans ce cas seul celui-ci peut être
  sélectionné. Les catalogues sont accessibles dans `/admin/shop/prodseller`
  et `/admin/shop/zfourstore`; les pages sont en lecture seule et affichent
  les IDs, prix et stocks fournisseur. Dans **Admin → Fournisseurs**, le
  contrôle vérifie le produit auprès du fournisseur actuellement sélectionné.
4. Déploie `shop-provider-admin`, `gemini-prodseller-activate`,
  `gemini-pro-activate`, `shop-account` et `shop-order-delivery`. Vérifie les
  produits et leurs prix dans les catalogues fournisseur avant le premier achat.
5. Effectue le premier achat uniquement avec une commande payée et confirmée
  dont tu acceptes le débit réel. La documentation ProdSeller consultée ne
  décrit pas de sandbox. Z FOUR STORE ne documente pas de clé d’idempotence :
  si la création d’une commande renvoie une réponse réseau incertaine, le
  système bloque toute nouvelle tentative automatique. Vérifie l’état de la
  commande auprès de Z FOUR STORE avant toute intervention manuelle.

ProdSeller peut nécessiter une activation différée et l’adresse du client selon
`requiresEmailActivation`. Z FOUR STORE renvoie les articles livrés avec la
commande ou dans `GET /api/v1/order/:id`. Les identifiants sont stockés dans
la table protégée `gemini_pro_activations` et ne sont renvoyés qu’au client
propriétaire de la commande.

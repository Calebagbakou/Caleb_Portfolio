# Caleb Creative — React + Vite

Migration du site (portfolio + boutique + admin) depuis HTML/CSS/JS vanilla
vers **React + Vite + Supabase**, en conservant le design, les données et le
fonctionnement d'origine.

## Installation

```bash
npm install
cp .env.example .env   # puis renseigne tes clés Supabase (déjà pré-remplies
                        # dans ce dépôt pour le développement local — voir
                        # note sécurité plus bas)
npm run dev             # serveur de développement
npm run build            # build de production dans dist/
npm run preview          # prévisualiser le build de production
```

## Structure

```
src/
├── assets/          → images (photo de profil)
├── styles/          → global.css (site public), admin.css, shop.css
├── services/        → couche d'accès Supabase (un fichier par domaine)
├── context/         → AuthContext (session admin), CartContext (panier)
├── data/            → contenus statiques structurés (portfolio, produits, FAQ...)
├── hooks/           → useReveal, useTilt, useDragScroll (ports des animations vanilla)
├── components/
│   ├── site/        → Header, Footer, Lightbox, ScrollProgress (portfolio)
│   ├── shop/        → ShopHeader, ShopFooter, ProductCard (boutique)
│   └── admin/       → AdminSidebar, ProtectedRoute
├── layouts/         → PublicLayout, ShopLayout, AdminLayout
├── pages/
│   ├── Home/         → page one-page du portfolio (sections dans Home/sections/)
│   ├── Boutique/      → ShopHome, Catalogue, Produit, Panier, Commande, Confirmation
│   └── Admin/         → Login, ForgotPassword, ResetPassword, Dashboard, Messages, Parametres
├── App.jsx           → arbre de routes complet
└── main.jsx           → point d'entrée (Router + AuthProvider + CartProvider)
```

## Ce qui a été migré tel quel

- **Site public** : page unique (ancre `#about`, `#services`, etc. — ce
  n'était pas des pages séparées dans l'ancien projet, donc ça reste une
  seule page ici aussi). Header, typewriter, scrubber du hero, compteurs
  animés, portfolio avec filtres/drag-scroll/lightbox, FAQ en accordéon et
  formulaire de contact (envoie réellement dans Supabase `messages`) ont
  tous été portés fidèlement.
- **Boutique** : catalogue et contenu chargés depuis Supabase, panier conservé
  dans `localStorage`, écrans d'administration pour le catalogue et les
  commandes. Le checkout crée la commande côté serveur et ne confirme le
  paiement qu'après vérification KKiaPay côté serveur.
- **Admin** : authentification Supabase + vérification dans la table
  `admins`, avec gestion des **Projets**, **Messages** et **Paramètres**.
  Les projets sont lus depuis Supabase côté public; publier ou modifier un
  projet ne nécessite pas de nouveau déploiement.

## Ce qui n'a pas été construit (et pourquoi)

Les produits hérités sont conservés dans `src/data/products.js` comme
référence de migration; la migration SQL les insère de façon idempotente dans
les tables déjà présentes. Les écrans admin Boutique et Commandes utilisent
les tables Supabase existantes.

La migration additive pour `projects`, son import des cartes historiques et
la compatibilité avec les politiques RLS déjà en place sont dans
[`supabase/migrations/001_projects_admin.sql`](./supabase/migrations/001_projects_admin.sql).
Avant de l'exécuter, vérifie la structure et les politiques déjà présentes
dans ton projet Supabase en suivant [`ADMIN_SETUP.md`](./ADMIN_SETUP.md).

### Mise en service de la boutique et de KKiaPay

1. Exécute `supabase/migrations/003_shop_admin_kkiapay.sql` dans le SQL Editor
   Supabase après avoir vérifié que le schéma correspond aux tables existantes.
2. Déploie les Edge Functions `checkout-shop`, `verify-kkiapay-payment` et
   `kkiapay-webhook`. Les fonctions serveur nécessitent les secrets
   `KKIAPAY_PRIVATE_KEY`, `KKIAPAY_PUBLIC_KEY`, `KKIAPAY_SECRET_KEY` et
   `KKIAPAY_WEBHOOK_SECRET`; `KKIAPAY_SANDBOX=true` active le mode test.
   `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont les secrets habituels
   fournis à une Edge Function Supabase. La clé `service_role` ne doit jamais
   être mise dans les variables `VITE_*`.
3. Dans les **Variables** du dépôt GitHub, renseigne
   `VITE_KKIAPAY_PUBLIC_KEY` avec la clé publique et
   `VITE_KKIAPAY_SANDBOX` à `true` pour les tests. Ces variables ne contiennent
   aucune clé serveur; la clé publique est destinée au widget navigateur.
4. Configure dans le tableau de bord KKiaPay le webhook vers l'URL de la
   fonction `kkiapay-webhook`, avec le secret correspondant à
   `KKIAPAY_WEBHOOK_SECRET`.

Ne passe pas en production avant d'avoir effectué un paiement de test complet
et vérifié la commande dans `/admin/orders`.

### Bibliothèque de médias

La section **Admin → Médias → Images** permet d’importer la photo principale
du profil, les logos et affiches des produits, les logos des logiciels et
outils d’IA, ainsi que des icônes personnalisées pour les sections Services,
À propos et Contact. Pour chaque icône de section, l’admin permet de choisir
entre le visuel par défaut et l’image importée. Les fichiers sont stockés dans
le bucket public `site-media`; les URLs des logos d’outils et des icônes de
section sont enregistrées dans `settings` sous les clés `site_tool_logos` et
`site_section_logos`. Seuls les comptes présents dans `admins` peuvent
importer ou modifier des fichiers. Exécute
[`supabase/migrations/009_admin_media_library.sql`](./supabase/migrations/009_admin_media_library.sql)
sur Supabase avant d’utiliser l’import. Les formats acceptés sont JPG, PNG,
WebP et AVIF, jusqu’à 8 Mo.

## Sécurité — variables d'environnement

Le fichier `.env` (gitignored) contient déjà l'URL et la clé **anon
publique** de ton projet Supabase, reprises telles quelles depuis l'ancien
`assets/supabase-config.js`. C'est une clé faite pour être exposée
côté navigateur — la sécurité vient des règles RLS Supabase, pas du secret
de cette clé. Ne mets en revanche jamais la clé `service_role` dans ce
projet frontend.

## Vérifications effectuées

Ce projet a été généré dans un environnement sans accès réseau : je n'ai
donc pas pu lancer `npm install` ni `npm run build` moi-même. J'ai
cependant :
- vérifié la syntaxe de chaque fichier `.js`/`.jsx` (aucune erreur) ;
- bundlé l'application avec esbuild (dépendances npm exclues) pour
  confirmer que **tous les chemins d'import internes, CSS et assets se
  résolvent correctement** ;
- vérifié à la main que chaque import nommé correspond bien à un export
  existant dans le fichier source.

La première vraie vérification (`npm install && npm run dev`) reste à
faire de ton côté — préviens-moi si quelque chose ne fonctionne pas, je
corrigerai.

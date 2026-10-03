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
- **Boutique** : catalogue **statique** (`src/data/products.js`), panier en
  `localStorage`, commande qui génère une référence et redirige vers
  WhatsApp — **aucun vrai paiement ni back-end**, exactement comme avant.
- **Admin** : authentification Supabase + vérification dans la table
  `admins`, **Messages** et **Paramètres** sont pleinement fonctionnels.

## Ce qui n'a pas été construit (et pourquoi)

Le cahier des charges de migration listait des écrans admin
(Projets, Compétences, Services, Médias, Produits, Commandes, Clients) et
un catalogue boutique branché sur Supabase. **Ces écrans n'existaient pas
dans le projet d'origine** — seuls Auth/Messages/Paramètres étaient
fonctionnels côté admin, et la boutique était entièrement statique. Pour
respecter la consigne « ne rien perdre / ne pas refaire une refonte
fonctionnelle », je n'ai pas inventé ces écrans : la sidebar admin les
affiche toujours comme « bientôt », identique à avant.

Le schéma Supabase (`supabase/schema.sql` dans l'ancien projet) contient
déjà les tables `projects`, `products`, `orders`, `customers`, etc. — le
terrain est donc prêt le jour où tu veux construire ces écrans.

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

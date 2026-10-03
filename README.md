# Caleb Creative — Portfolio, Boutique & Admin

Site statique (HTML/CSS/JavaScript vanilla, sans framework) hébergé sur
GitHub Pages, avec Supabase comme backend (base de données, authentification,
stockage de fichiers).

## Structure du projet

```
/                       Portfolio public
  index.html, style.css, script.js
  assets/               Images, config Supabase publique, scripts partagés
    config.js               URL + clé anon Supabase (client)
    site-settings.js         Centralise les paramètres (WhatsApp, etc.)
    portfolio-data.js        Charge les projets vidéo YouTube publiés

boutique/               Boutique e-commerce (interface claire, distincte du portfolio)
  index.html, catalogue.html, produit.html, panier.html, commande.html, confirmation.html
  assets/
    products.js              Données de secours (fallback) si Supabase indisponible
    supabase-shop.js         Charge produits + formules depuis Supabase
    cart.js                  Panier local (localStorage) — PAS la commande finale
    shop.js, shop.css        Comportements et styles partagés

admin/                  Back-office (protégé par authentification Supabase)
  login.html, forgot-password.html, reset-password.html
  index.html              Dashboard (compteurs en direct)
  projects.html            Gestion des projets (dont vidéos YouTube)
  media.html               Bibliothèque média (upload images/vidéos)
  products.html            Gestion des produits + formules de la boutique
  orders.html               Gestion des commandes (statuts, paiement)
  assets/
    config.js                URL + clé anon Supabase (mêmes valeurs que le site public)
    auth.js                  Vérification de session admin
    ui.js                    Toasts, confirmations, menu mobile partagés
    admin.css

supabase/               Tout ce qui doit être exécuté côté Supabase (SQL Editor)
  schema.sql                Schéma initial (tables + RLS)
  migration_002_media_library.sql
  migration_003_youtube_projects.sql
  migration_004_order_security.sql   Sécurise les prix (triggers)
  migration_005_order_rpc.sql        Fonctions RPC (commande, client, confirmation)
```

## Configuration Supabase requise

Deux fichiers contiennent la même URL/clé publique (safe à exposer, la
sécurité vient des RLS, pas du secret de la clé) :

- `assets/config.js` (site public + boutique)
- `admin/assets/config.js` (back-office)

```js
window.SUPABASE_URL = "https://TON-PROJET.supabase.co";
window.SUPABASE_ANON_KEY = "TA_CLE_ANON_OU_PUBLISHABLE";
```

⚠️ La clé `service_role` ne doit **jamais** apparaître dans un fichier de ce
repo. Si tu la vois quelque part, remplace-la immédiatement dans Supabase
(Settings → API → régénérer) et retire-la du code.

Voir `ADMIN_SETUP.md` pour la mise en place complète pas à pas (création du
projet, exécution des migrations SQL dans l'ordre, création du compte
admin).

## Comment fonctionne une commande (flux réel)

```
Visiteur (boutique)
  → ajoute au panier (localStorage, juste pour l'UX)
  → page "commande.html" : formulaire client + méthode de paiement
  → rpc find_or_create_customer()   -- retrouve ou crée le client
  → rpc create_order_with_items()   -- crée la commande + les lignes
       (le client n'envoie que plan_id + quantité, jamais de prix)
  → trigger enforce_order_item_price()  -- impose le prix officiel de product_plans
  → trigger recalc_order_total()        -- recalcule orders.total depuis les lignes
  → redirection vers confirmation.html?order=<id>
  → rpc get_order_confirmation(id)  -- relit la vraie commande enregistrée
  → bouton WhatsApp pré-rempli (numéro tiré de "settings", pas codé en dur)
```

Aucun paiement automatique n'est traité : le statut de paiement
(`payment_status`) reste `non_confirme` jusqu'à ce qu'un administrateur le
bascule manuellement sur `confirme` depuis `admin/orders.html`, après
vérification du paiement (Mobile Money / virement) via WhatsApp.

### Pourquoi des fonctions RPC plutôt que des tables ouvertes en lecture ?

`orders`, `order_items` et `customers` ne sont *jamais* lisibles directement
par un visiteur (clé anon) — sinon n'importe qui pourrait lister toutes les
commandes de tous les clients. À la place, trois fonctions Postgres
`security definer` exposent uniquement ce qui est nécessaire :

- `find_or_create_customer(name, contact, email)` → renvoie un id, jamais une liste
- `create_order_with_items(customer_id, payment_method, note, items)` → crée tout de façon atomique
- `get_order_confirmation(order_id)` → relit une seule commande, par un id non devinable

### Pourquoi pas d'Edge Function pour sécuriser les prix ?

Un trigger SQL (`before insert on order_items`) suffit : il ignore
systématiquement le prix envoyé par le client et le remplace par celui
réellement stocké dans `product_plans`, avant l'écriture en base. C'est
plus simple qu'une Edge Function, ça ne nécessite aucun déploiement
supplémentaire, et le résultat est équivalent en sécurité (le calcul se
fait entièrement côté base de données, hors de portée du navigateur).

## Boutique : Supabase comme source de vérité

`boutique/assets/products.js` ne contient plus que des données de secours
(`CALEB_SHOP_PRODUCTS_FALLBACK`). Au chargement de chaque page,
`loadShopProducts()` (dans `supabase-shop.js`) va chercher les vrais
produits actifs dans Supabase (`products` + `product_plans` + `categories`)
et les substitue. Si Supabase est injoignable, le site reste fonctionnel
grâce au secours — mais gérer les produits doit se faire depuis
`admin/products.html`, pas en éditant `products.js`.

## Sécurité — résumé

- RLS activé sur toutes les tables ; écriture réservée aux comptes présents
  dans la table `admins` (fonction `is_admin()`).
- Écriture publique limitée à : création de message de contact, création
  de commande/client (via les fonctions RPC ci-dessus, pas d'insertion
  directe dans `orders`/`customers` depuis le frontend public).
- Toute donnée provenant de Supabase, d'un formulaire ou de l'URL est
  échappée avant d'être insérée en HTML (`escapeHtml()` dans
  `boutique/assets/shop.js`) — évite les injections XSS.
- `requireAdminSession()` protège l'affichage des pages admin côté
  interface, mais la vraie barrière de sécurité reste RLS + `is_admin()`
  côté base de données : même en contournant le JavaScript, aucune
  écriture non autorisée n'est possible.

## Migration React en cours

Une nouvelle version React + Vite + Supabase est en construction dans le
dossier `app/`, en parallèle du site actuel (qui reste en ligne et
fonctionnel pendant toute la migration). Voir `app/README.md` pour
l'installation et le détail de ce qui est déjà migré.

## Déploiement

Le repo entier (portfolio + boutique + admin) est déployé tel quel sur
GitHub Pages. Aucune étape de build n'est nécessaire — ce sont des fichiers
statiques. Après toute modification, il suffit de pousser sur `main` ; le
workflow GitHub Actions déjà configuré republie automatiquement le site.

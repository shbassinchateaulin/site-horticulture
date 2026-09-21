# Backend sécurisé de l’administration

Ce dossier contient le backend Cloudflare Workers commun au site et à l’application d’administration. Cloudflare Workers et D1 peuvent être utilisés dans leur offre gratuite pour le trafic attendu par l’association.

## Sécurité

- un seul compte par personne, partagé entre l’application d’administration et le site ;
- droits par rôle : super administrateur, administrateur, publieur et membre ;
- les membres sans droit d’administration ne peuvent pas ouvrir le tableau de bord ;
- aucun mot de passe ni token GitHub dans le site public ;
- mots de passe hachés par PBKDF2-SHA-256 avec sel aléatoire ;
- sessions temporaires de 8 heures ;
- limitation des tentatives de connexion ;
- origine publique autorisée explicitement ;
- token GitHub stocké exclusivement comme secret Cloudflare ;
- validation des données avant toute écriture dans GitHub.

## Mise en service

Depuis ce dossier :

1. Installer les dépendances : `npm install`
2. Se connecter à Cloudflare : `npx wrangler login`
3. Créer la base gratuite : `npx wrangler d1 create horticulture-admin`
4. Reporter l’identifiant retourné dans `wrangler.toml`
5. Initialiser les tables : `npm run db:remote`
6. Ajouter les secrets sans les écrire dans un fichier :
   - `npx wrangler secret put GITHUB_TOKEN`
   - `npx wrangler secret put BOOTSTRAP_USERNAME`
   - `npx wrangler secret put BOOTSTRAP_PASSWORD`
7. Déployer : `npm run deploy`
8. Effectuer la première connexion. Le premier compte administrateur est créé uniquement si la base ne contient encore aucun utilisateur.
9. Après cette première connexion, supprimer les deux secrets d’amorçage :
   - `npx wrangler secret delete BOOTSTRAP_USERNAME`
   - `npx wrangler secret delete BOOTSTRAP_PASSWORD`

Le premier compte créé reçoit le rôle `super_admin`. Les comptes ajoutés ensuite par l’application utilisent la même table `users` et leurs droits sont déterminés par leur rôle.

Le token GitHub doit avoir uniquement les droits de contenu nécessaires sur les dépôts `site-horticulture` et `horticulture-contenus`.

## Connexion au site

Après le déploiement, définir l’adresse publique du Worker dans le site :

```js
window.HORTICULTURE_ADMIN_API = "https://horticulture-admin.<sous-domaine>.workers.dev";
```

L’adresse du Worker est publique ; ce n’est pas un secret. Les identifiants, les sessions et le token GitHub restent privés.

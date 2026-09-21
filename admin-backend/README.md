# Backend sécurisé de l’administration

Ce dossier contient le backend Cloudflare Workers commun au site et à l’application d’administration. Cloudflare Workers et D1 peuvent être utilisés dans leur offre gratuite pour le trafic attendu par l’association.

## Sécurité

- un seul compte par personne, partagé entre l’application d’administration et le site ;
- droits par rôle : super administrateur, administrateur, publieur et membre ;
- les membres sans droit d’administration ne peuvent pas ouvrir le tableau de bord ;
- aucun mot de passe ni token GitHub dans le site public ;
- comptes et droits lus dans le Google Sheet existant par Apps Script ;
- Apps Script accessible uniquement au Worker grâce à un secret serveur partagé ;
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
   - si la base D1 avait déjà été initialisée avec l’ancienne structure : `npm run db:migrate-google-auth`
6. Ajouter les secrets sans les écrire dans un fichier :
   - `npx wrangler secret put GITHUB_TOKEN`
   - `npx wrangler secret put GOOGLE_APPS_SCRIPT_SHARED_SECRET`
7. Ajouter `integrations/admin-auth/AppsScriptAuth.gs` au projet Apps Script et créer la propriété de script `BACKEND_SHARED_SECRET` avec exactement la même valeur.
8. Redéployer Apps Script en créant une nouvelle version.
9. Déployer le Worker : `npm run deploy`

Les comptes restent gérés dans le Google Sheet. D1 ne conserve que le profil minimal nécessaire à la session et les tentatives de connexion.

Le token GitHub doit avoir uniquement les droits de contenu nécessaires sur les dépôts `site-horticulture` et `horticulture-contenus`.

## Connexion au site

Après le déploiement, définir l’adresse publique du Worker dans le site :

```js
window.HORTICULTURE_ADMIN_API = "https://horticulture-admin.<sous-domaine>.workers.dev";
```

L’adresse du Worker est publique ; ce n’est pas un secret. Les identifiants, les sessions et le token GitHub restent privés.

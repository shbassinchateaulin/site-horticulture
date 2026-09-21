# Authentification ADMIN avec les comptes Google Sheets

Le navigateur ne doit jamais télécharger la feuille `Utilisateurs`. Le flux prévu est :

1. la fenêtre ADMIN envoie l’identifiant et le mot de passe au Worker Cloudflare ;
2. le Worker applique la limitation des tentatives ;
3. le Worker interroge Apps Script avec un secret serveur privé ;
4. Apps Script compare le mot de passe avec `passwordHash` dans la feuille ;
5. Cloudflare crée une session temporaire dans D1 et pose un cookie `HttpOnly`.

## Mise en place dans Apps Script

1. Ajouter le fichier `AppsScriptAuth.gs` au projet relié au Google Sheet.
2. Dans `doPost(e)`, immédiatement après `const b=JSON.parse(...)`, ajouter :

```js
if (b.action === 'backendAuthenticate') return json_(backendAuthenticate_(b));
```

3. Dans **Paramètres du projet → Propriétés du script**, créer `BACKEND_SHARED_SECRET` avec une valeur aléatoire longue.
4. Redéployer l’application Web en créant une nouvelle version.

La même valeur doit ensuite être enregistrée dans Cloudflare avec :

```sh
npx wrangler secret put GOOGLE_APPS_SCRIPT_SHARED_SECRET
```

Ne jamais placer cette valeur dans un fichier GitHub, le HTML ou le JavaScript public.

## Alerte concernant le code Apps Script existant

Le code transmis expose actuellement `listUsers` par défaut dans `doGet` et accepte plusieurs modifications d’utilisateurs dans `doPost` sans authentification serveur. Il ne faut donc pas considérer l’ensemble de l’application comme sécurisé tant que ces routes n’ont pas, elles aussi, été déplacées derrière le Worker.

La feuille Google Sheets doit rester en accès **Restreint**. Le partage public n’est pas nécessaire au fonctionnement d’Apps Script.

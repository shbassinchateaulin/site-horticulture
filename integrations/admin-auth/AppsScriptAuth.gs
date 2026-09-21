/**
 * Authentification serveur-à-serveur pour le site public.
 *
 * Ce fichier doit être ajouté au projet Apps Script relié au Google Sheet.
 * La valeur BACKEND_SHARED_SECRET doit être créée dans les propriétés du
 * script et doit être identique au secret Cloudflare du même nom.
 *
 * Ajouter cette ligne immédiatement après le JSON.parse dans doPost(e) :
 * if(b.action==='backendAuthenticate')return json_(backendAuthenticate_(b));
 */

function backendAuthenticate_(body) {
  const suppliedSecret = String(body.backendSecret || '');
  const expectedSecret = String(
    PropertiesService.getScriptProperties().getProperty('BACKEND_SHARED_SECRET') || ''
  );

  if (!expectedSecret || !constantTimeEqual_(suppliedSecret, expectedSecret)) {
    return { ok: false, error: 'Requête non autorisée.' };
  }

  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!username || password.length < 8 || password.length > 200) {
    return { ok: false, error: 'Identifiant ou mot de passe incorrect.' };
  }

  const rows = getSheet_().getDataRange().getValues();
  let row = null;
  for (let index = 1; index < rows.length; index++) {
    if (String(rows[index][6] || '').trim().toLowerCase() === username) {
      row = rows[index];
      break;
    }
  }

  const active = row && String(row[9]).toLowerCase() !== 'false';
  const expectedHash = row ? String(row[7] || '').toLowerCase() : '';
  const actualHash = sha256_(password).toLowerCase();
  if (!active || !expectedHash || !constantTimeEqual_(actualHash, expectedHash)) {
    return { ok: false, error: 'Identifiant ou mot de passe incorrect.' };
  }

  const permissions = String(row[10] || '')
    .split(',')
    .map(function (value) { return value.trim(); })
    .filter(Boolean);

  return {
    ok: true,
    user: {
      id: String(row[0] || ''),
      username: String(row[6] || ''),
      displayName: [String(row[1] || ''), String(row[2] || '')].join(' ').trim(),
      email: String(row[3] || ''),
      function: String(row[4] || ''),
      role: String(row[5] || 'member'),
      permissions: permissions,
      firstLogin: String(row[8]).toLowerCase() === 'true'
    }
  };
}

function constantTimeEqual_(left, right) {
  left = String(left || '');
  right = String(right || '');
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

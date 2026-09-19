/*
 * À ajouter au Code.gs existant du projet Suggestions, puis redéployer
 * l'application Web en conservant son URL /exec et ses autorisations.
 * L'enregistrement dans Google Sheets et l'e-mail restent assurés
 * par enregistrerSuggestion(data), déjà présent dans ce projet.
 */
function doPost(e) {
  const params = (e && e.parameter) || {};
  const requestId = String(params.requestId || '').slice(0, 100);
  let response = {type: 'shbc-suggestion-response', requestId: requestId, ok: false};
  try {
    // Le champ leurre doit rester vide. Ne déclenche aucun e-mail.
    if (params.website) {
      throw new Error("La suggestion n'a pas pu être envoyée.");
    }
    enregistrerSuggestion({
      nature: params.nature,
      titre: params.titre,
      suggestion: params.suggestion,
      lieu: params.lieu,
      nom: params.nom,
      email: params.email
    });
    response.ok = true;
  } catch (error) {
    response.message = error && error.message
      ? error.message
      : "Une erreur est survenue lors de l'envoi.";
  }
  const payload = JSON.stringify(response).replace(/</g, '\\u003c');
  const page = '<!doctype html><html><head><meta charset="utf-8"></head><body>'
    + '<script>window.top.postMessage(' + payload
    + ', "https://shbassinchateaulin.github.io");<\/script>'
    + '</body></html>';
  return HtmlService.createHtmlOutput(page);
}

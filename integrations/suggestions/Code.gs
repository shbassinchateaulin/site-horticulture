/* =========================================================
   CODE.GS
   Gestion des suggestions

   Société d'Horticulture et d'Art Floral
   du Bassin de Châteaulin
========================================================= */



const CONFIG_SUGGESTIONS = {

  ASSOCIATION:
    "Société d'Horticulture et d'Art Floral du Bassin de Châteaulin",

  ADMIN_EMAIL:
    "shbassinchateaulin@gmail.com",

  SITE_URL:
    "https://sites.google.com/view/societehorticulturechateaulin",

  LOGO_URL:
    "https://drive.google.com/uc?export=view&id=1Gju41lF1K6tqDLEQi4t4GR65QTiXTILW",

  PHOTO_EQUIPE_URL:
    "https://drive.google.com/uc?export=view&id=16SzgTCqYD1g5eL9jza1mbKbKId-WCRFv",

  /*
   * Nom de l'onglet Google Sheets.
   *
   * Mets ici le nom exact de l'onglet
   * qui contient ton tableau moderne.
   */

  SHEET_NAME:
    "Tableau suggestion"

};


/* =========================================================
   AFFICHAGE DU FORMULAIRE
========================================================= */

function doGet() {

  return HtmlService
    .createHtmlOutputFromFile(
      "Formulaire"
    )
    .setTitle(
      "Vos suggestions"
    )
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    );

}


/* =========================================================
   ENREGISTRER UNE SUGGESTION
========================================================= */

function enregistrerSuggestion(data) {

  try {

    if (!data) {

      throw new Error(
        "Aucune suggestion n'a été reçue."
      );

    }


    /* =====================================================
       RÉCUPÉRATION DES DONNÉES
    ===================================================== */

    const titre =
      String(
        data.titre || ""
      ).trim();


    const nature =
      String(
        data.nature || ""
      ).trim();


    const nom =
      String(
        data.nom || ""
      ).trim();


    const email =
      String(
        data.email || ""
      )
        .trim()
        .toLowerCase();


    const lieu =
      String(
        data.lieu || ""
      ).trim();


    const suggestion =
      String(
        data.suggestion || ""
      ).trim();


    /* =====================================================
       VÉRIFICATIONS
    ===================================================== */

    if (!nature) {

      throw new Error(
        "Merci de préciser la nature de votre suggestion."
      );

    }


    if (!titre) {

      throw new Error(
        "Merci d'indiquer un titre pour votre suggestion."
      );

    }


    if (!suggestion) {

      throw new Error(
        "Merci de décrire votre suggestion."
      );

    }


    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
      )
    ) {

      throw new Error(
        "L'adresse e-mail indiquée n'est pas valide."
      );

    }


    /* =====================================================
       RÉSUMÉ AUTOMATIQUE SANS IA
    ===================================================== */

    const resume =
      creerResumeSuggestion_(
        titre,
        suggestion,
        lieu
      );


    /* =====================================================
       GOOGLE SHEET
    ===================================================== */

    const ss =
      SpreadsheetApp
        .getActiveSpreadsheet();


    let sheet =
      ss.getSheetByName(
        CONFIG_SUGGESTIONS.SHEET_NAME
      );


    /*
     * Si l'onglet ne s'appelle pas exactement
     * "Suggestions", on utilise le premier onglet.
     *
     * Ça évite de bloquer si tu n'as pas encore
     * renommé ton onglet.
     */

    if (!sheet) {

      const feuilles =
        ss.getSheets();


      if (
        !feuilles ||
        feuilles.length === 0
      ) {

        throw new Error(
          "Le tableau des suggestions est introuvable."
        );

      }


      sheet =
        feuilles[0];

    }


    /* =====================================================
       NOUVELLE LIGNE

       ORDRE DU TABLEAU :

       1  Titre
       2  Nature
       3  Nom et prénom
       4  Statut
       5  Date reçue
       6  E-mail
       7  Résumé
       8  Lieu / organisme
       9  Suggestion complète
    ===================================================== */

    sheet.appendRow([

      titre,

      nature,

      nom,

      "Pas commencé",

      new Date(),

      email,

      resume,

      lieu,

      suggestion

    ]);


    const derniereLigne =
      sheet.getLastRow();


    /* =====================================================
       MISE EN FORME DE LA NOUVELLE LIGNE
    ===================================================== */

    sheet
      .getRange(
        derniereLigne,
        1,
        1,
        9
      )
      .setVerticalAlignment(
        "top"
      )
      .setWrap(
        true
      );


    /* =====================================================
       MAIL ADMINISTRATEUR
    ===================================================== */

    envoyerMailNouvelleSuggestion_({

      titre:
        titre,

      nature:
        nature,

      nom:
        nom,

      email:
        email,

      lieu:
        lieu,

      suggestion:
        suggestion,

      resume:
        resume,

      sheetUrl:
        ss.getUrl()

    });


    Logger.log(
      "Nouvelle suggestion enregistrée : " +
      titre
    );


    return (
      "Merci pour votre suggestion ! " +
      "Votre proposition a bien été transmise à l'association."
    );


  } catch (erreur) {

    Logger.log(
      "ERREUR SUGGESTION : " +
      erreur.stack
    );


    throw new Error(
      erreur.message ||
      "Une erreur est survenue lors de l'envoi de votre suggestion."
    );

  }

}


/* =========================================================
   RÉSUMÉ AUTOMATIQUE SANS GEMINI
========================================================= */

function creerResumeSuggestion_(
  titre,
  suggestion,
  lieu
) {

  let texte =
    String(
      suggestion || ""
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim();


  /*
   * Maximum environ 120 caractères.
   */

  if (
    texte.length > 120
  ) {

    texte =
      texte.substring(
        0,
        117
      ) +
      "...";

  }


  let resume =
    String(
      titre || ""
    ).trim();


  if (lieu) {

    resume +=
      " — " +
      String(
        lieu
      ).trim();

  }


  if (texte) {

    resume +=
      " : " +
      texte;

  }


  return resume;

}


/* =========================================================
   MAIL DE NOTIFICATION
========================================================= */

function envoyerMailNouvelleSuggestion_(
  data
) {

  const sujet =
    "🌿 Nouvelle suggestion reçue — " +
    data.titre;


  const html = `

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

</head>


<body style="
margin:0;
padding:0;
background:#F8F6F0;
">


<table
width="100%"
cellpadding="0"
cellspacing="0"
role="presentation"
style="
width:100%;
background:#F8F6F0;
"
>

<tr>

<td
align="center"
style="
padding:25px 10px 35px 10px;
"
>


<table
width="680"
cellpadding="0"
cellspacing="0"
role="presentation"
style="
width:100%;
max-width:680px;
background:#FFFFFF;
border-radius:20px;
overflow:hidden;
"
>


<!-- EN-TÊTE -->

<tr>

<td
align="center"
style="
padding:35px 30px 28px 30px;
"
>

<a
href="${CONFIG_SUGGESTIONS.SITE_URL}"
target="_blank"
>

<img
src="${CONFIG_SUGGESTIONS.LOGO_URL}"
width="110"
style="
display:block;
width:110px;
height:auto;
margin:0 auto;
border:0;
"
>

</a>


<h1 style="
margin:22px 0 8px 0;
font-family:Georgia,Times New Roman,serif;
font-size:28px;
font-weight:normal;
color:#284C35;
">

Nouvelle suggestion reçue

</h1>


<p style="
margin:0;
font-family:Arial,sans-serif;
font-size:15px;
line-height:1.5;
color:#5E665F;
">

Une nouvelle proposition vient d'être envoyée depuis le site internet.

</p>

</td>

</tr>


<!-- CONTENU -->

<tr>

<td style="
padding:10px 34px 35px 34px;
"
>


<table
width="100%"
cellpadding="0"
cellspacing="0"
role="presentation"
style="
background:#F0F5ED;
border-radius:16px;
"
>


<tr>

<td style="
padding:22px;
font-family:Arial,sans-serif;
font-size:15px;
line-height:1.7;
color:#3E433F;
">

<strong>Nature</strong>
<br>
${echapperHtmlSuggestion_(data.nature)}

<br><br>

<strong>Titre</strong>
<br>
${echapperHtmlSuggestion_(data.titre)}

<br><br>

<strong>Résumé</strong>
<br>
${echapperHtmlSuggestion_(data.resume)}

${data.lieu ? `

<br><br>

<strong>Lieu / organisme</strong>
<br>
${echapperHtmlSuggestion_(data.lieu)}

` : ""}


${data.nom ? `

<br><br>

<strong>Nom et prénom</strong>
<br>
${echapperHtmlSuggestion_(data.nom)}

` : ""}


${data.email ? `

<br><br>

<strong>E-mail</strong>
<br>
${echapperHtmlSuggestion_(data.email)}

` : ""}

</td>

</tr>

</table>


<h2 style="
margin:30px 0 12px 0;
font-family:Georgia,Times New Roman,serif;
font-size:22px;
font-weight:normal;
color:#284C35;
">

Suggestion complète

</h2>


<div style="
padding:20px;
background:#FFFFFF;
border:1px solid #E0E6DD;
border-radius:14px;
font-family:Arial,sans-serif;
font-size:15px;
line-height:1.75;
color:#3E433F;
">

${echapperHtmlSuggestion_(
  data.suggestion
).replace(/\n/g, "<br>")}

</div>


<p style="
margin:28px 0 0 0;
font-family:Arial,sans-serif;
font-size:14px;
line-height:1.7;
color:#6E746F;
">

Cette suggestion a automatiquement été enregistrée avec le statut
<strong>Pas commencé</strong>.

</p>


<p style="
margin:25px 0 0 0;
text-align:center;
">

<a
href="${data.sheetUrl}"
target="_blank"
style="
display:inline-block;
padding:14px 24px;
background:#4F7D58;
color:#FFFFFF;
text-decoration:none;
font-family:Arial,sans-serif;
font-size:14px;
font-weight:bold;
border-radius:24px;
"
>

Consulter le tableau des suggestions

</a>

</p>


</td>

</tr>


<!-- PIED -->

<!-- PIED -->

<tr>

<td
align="center"
style="
padding:28px 30px 30px 30px;
background:#284C35;
"
>

<p style="
margin:0 0 20px 0;
font-family:Arial,sans-serif;
font-size:13px;
line-height:1.6;
color:#E8EFE9;
">

Société d'Horticulture et d'Art Floral
<br>
du Bassin de Châteaulin

</p>


<img
src="${CONFIG_SUGGESTIONS.PHOTO_EQUIPE_URL}"
width="580"
alt="L'équipe de la Société d'Horticulture et d'Art Floral du Bassin de Châteaulin"
style="
display:block;
width:100%;
max-width:580px;
height:auto;
margin:0 auto;
border:0;
border-radius:15px;
"
>

</td>

</tr>


</table>

</td>

</tr>

</table>


</body>

</html>

`;


  MailApp.sendEmail({

    to:
      CONFIG_SUGGESTIONS.ADMIN_EMAIL,

    subject:
      sujet,

    htmlBody:
      html,

    name:
      CONFIG_SUGGESTIONS.ASSOCIATION

  });

}


/* =========================================================
   SÉCURISER LE TEXTE HTML
========================================================= */

function echapperHtmlSuggestion_(
  texte
) {

  return String(
    texte || ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#39;"
    );

}


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

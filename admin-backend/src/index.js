const SESSION_HOURS=8;
const LOGIN_WINDOW_MINUTES=15;
const LOGIN_MAX_ATTEMPTS=8;
const ROLE_PERMISSIONS={
 super_admin:['*'],
 admin:['admin.access','settings.read','settings.write','articles.layout','content.write','users.manage'],
 publisher:['admin.access','settings.read','articles.layout','content.write'],
 member:[]
};
const encoder=new TextEncoder();

export default {
 async fetch(request,env){
  try{return await handle(request,env)}
  catch(error){console.error(error);const status=Number(error?.status)||500;return json({error:status===500?'Erreur interne du service.':error.message},status,request,env)}
 }
};

async function handle(request,env){
 const url=new URL(request.url);
 const origin=request.headers.get('Origin')||'';
 if(request.method==='OPTIONS')return preflight(request,env);
 if(origin&&!allowedOrigins(env).has(origin))return json({error:'Origine non autorisée.'},403,request,env);
 if(url.pathname==='/health'&&request.method==='GET')return json({ok:true,service:'horticulture-admin'},200,request,env);
 if(url.pathname==='/login'&&request.method==='POST')return login(request,env);
 const session=await authenticate(request,env);
 if(!session)return json({error:'Authentification requise.'},401,request,env);
 if(url.pathname==='/session'&&request.method==='GET')return json({authenticated:true,user:{username:session.username,role:session.role,permissions:session.permissions}},200,request,env);
 if(url.pathname==='/logout'&&request.method==='POST'){
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(session.tokenHash).run();
  return json({ok:true},200,request,env,expiredCookie());
 }
 if(url.pathname==='/settings'&&request.method==='GET'){
  if(!hasPermission(session,'settings.read'))return forbidden(request,env);
  const file=await githubFile(env,env.SITE_REPO,'assets/data/site-settings.json');
  return json(JSON.parse(decodeBase64(file.content)),200,request,env);
 }
 if(url.pathname==='/settings/membership'&&request.method==='PUT'){
  if(!hasPermission(session,'settings.write'))return forbidden(request,env);
  return saveMembership(request,env);
 }
 const layoutMatch=url.pathname.match(/^\/articles\/(A\d{7,}(?:[A-Z]{3})?)\/layout$/i);
 if(layoutMatch&&request.method==='PUT'){
  if(!hasPermission(session,'articles.layout'))return forbidden(request,env);
  return saveLayout(request,env,layoutMatch[1].toUpperCase());
 }
 if(url.pathname==='/content/index'&&request.method==='GET'){
  if(!hasPermission(session,'content.write'))return forbidden(request,env);
  const [articles,sorties]=await Promise.all([
   githubFile(env,env.CONTENT_REPO,'actualites/index.json'),
   githubFile(env,env.CONTENT_REPO,'sorties/index.json')
  ]);
  return json({actualites:JSON.parse(decodeBase64(articles.content)),sorties:JSON.parse(decodeBase64(sorties.content))},200,request,env);
 }
 if(url.pathname==='/content/actualites'&&request.method==='POST'){
  if(!hasPermission(session,'content.write'))return forbidden(request,env);
  return savePublicArticle(request,env);
 }
 if(url.pathname==='/content/sorties'&&request.method==='POST'){
  if(!hasPermission(session,'content.write'))return forbidden(request,env);
  return savePublicOuting(request,env);
 }
 return json({error:'Route introuvable.'},404,request,env);
}

async function login(request,env){
 const clientKey=await sha256(request.headers.get('CF-Connecting-IP')||'unknown');
 const since=new Date(Date.now()-LOGIN_WINDOW_MINUTES*60000).toISOString();
 const attempts=await env.DB.prepare('SELECT COUNT(*) AS total FROM login_attempts WHERE client_key = ? AND attempted_at >= ?').bind(clientKey,since).first();
 if(Number(attempts?.total||0)>=LOGIN_MAX_ATTEMPTS)return json({error:'Trop de tentatives. Réessayez dans quelques minutes.'},429,request,env);
 const body=await readJSON(request),username=String(body.username||'').trim().toLowerCase(),password=String(body.password||'');
 if(!username||password.length<8||password.length>200){
  await recordAttempt(env,clientKey,username,false);
  return json({error:'Identifiant ou mot de passe incorrect.'},401,request,env);
 }
 const sheetResult=await authenticateWithGoogleSheet(env,{username,password,scope:String(body.scope||'')});
 const valid=!!sheetResult?.authenticated;
 await recordAttempt(env,clientKey,username,valid);
 if(!valid)return json({error:'Identifiant ou mot de passe incorrect.'},401,request,env);
 const sheetUser=sheetResult.user||{},role=normalizeRole(sheetUser.role),permissions=normalizePermissions(sheetUser.permissions,role);
 if(!permissions.includes('*')&&!permissions.includes('admin.access'))return json({error:'Ce compte ne possède pas les droits d’accès à l’administration du site.'},403,request,env);
 const now=new Date().toISOString(),externalId=String(sheetUser.id);
 // Google Sheets is authoritative. Revoke stale sessions on a rename or on
 // reassignment of an old username, then refresh the local session profile.
 await env.DB.batch([
  env.DB.prepare(`DELETE FROM sessions WHERE user_id IN (
   SELECT id FROM users WHERE (external_id = ? AND username <> ?)
    OR (username = ? AND external_id <> ?))`).bind(externalId,username,username,externalId),
  env.DB.prepare('DELETE FROM users WHERE external_id = ? AND username <> ?').bind(externalId,username),
  env.DB.prepare(`INSERT INTO users (external_id,username,display_name,email,password_hash,password_salt,password_iterations,role,permissions,active,created_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?)
   ON CONFLICT(username) DO UPDATE SET external_id=excluded.external_id,display_name=excluded.display_name,email=excluded.email,role=excluded.role,permissions=excluded.permissions,active=excluded.active`)
   .bind(externalId,username,String(sheetUser.displayName||'').slice(0,160),String(sheetUser.email||'').slice(0,254),'','',0,role,JSON.stringify(permissions),1,now)
 ]);
 const user=await env.DB.prepare('SELECT id,username,role,permissions,active FROM users WHERE username = ?').bind(username).first();
 await env.DB.prepare('DELETE FROM login_attempts WHERE client_key = ?').bind(clientKey).run();
 const token=randomToken(32),tokenHash=await sha256(token),expiresAt=new Date(Date.now()+SESSION_HOURS*3600000).toISOString();
 await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(new Date().toISOString()).run();
 await env.DB.prepare('INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').bind(tokenHash,user.id,expiresAt,new Date().toISOString()).run();
 return json({authenticated:true,sessionToken:token,expiresAt,user:{username:user.username,role:user.role,permissions}},200,request,env,sessionCookie(token));
}

async function authenticate(request,env){
 const auth=request.headers.get('Authorization')||'';
 let token=auth.startsWith('Bearer ')?auth.slice(7).trim():'';
 if(!token)token=parseCookies(request.headers.get('Cookie')||'').sh_admin_session||'';
 if(!token)return null;
 const tokenHash=await sha256(token);
 const row=await env.DB.prepare('SELECT s.token_hash,s.expires_at,u.id,u.username,u.role,u.permissions,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?').bind(tokenHash).first();
 if(!row||!row.active||new Date(row.expires_at)<=new Date()){if(row)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(tokenHash).run();return null}
 return{...row,tokenHash,permissions:normalizePermissions(parsePermissions(row.permissions),row.role)};
}

async function authenticateWithGoogleSheet(env,credentials){
 const endpoint=String(env.GOOGLE_APPS_SCRIPT_URL||'').trim();
 const secret=String(env.GOOGLE_APPS_SCRIPT_SHARED_SECRET||'');
 if(!endpoint||!secret)throw Object.assign(new Error('Le service Google Sheets n’est pas configuré.'),{status:503});
 // Follow ContentService redirects explicitly: the redirected URL serves output
 // via GET and must never receive the password or shared secret again.
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),60000);
 let response,data;
 try{
  let target=new URL(endpoint);
  if(target.protocol!=='https:'||target.hostname!=='script.google.com')throw accountError('CONFIGURATION',503);
  let options={method:'POST',redirect:'manual',signal:controller.signal,
   headers:{'Content-Type':'text/plain;charset=UTF-8'},
   body:JSON.stringify({action:'backendAuthenticate',backendSecret:secret,...credentials})};
  for(let hop=0;hop<5;hop++){
   response=await fetch(target.href,options);
   if(![301,302,303,307,308].includes(response.status))break;
   const location=response.headers.get('Location');
   if(!location)throw accountError('REDIRECTION_INVALIDE');
   const next=new URL(location,target);
   if(next.hostname==='accounts.google.com')throw accountError('ACCES_GOOGLE');
   if(next.protocol!=='https:'||next.hostname!=='script.googleusercontent.com')throw accountError('REDIRECTION_INATTENDUE');
   // Only the one-time ContentService output endpoint is accepted.
   if(!next.pathname.startsWith('/macros/echo'))throw accountError('REDIRECTION_INATTENDUE');
   target=next;
   options={method:'GET',redirect:'manual',signal:controller.signal};
  }
  if(!response.ok)throw accountError('GOOGLE_HTTP_'+response.status);
  try{data=await response.json()}catch{throw accountError('REPONSE_NON_JSON')}
 }catch(error){
  if(error.status)throw error;
  throw accountError(controller.signal.aborted?'DELAI_GOOGLE':'RESEAU_GOOGLE');
 }finally{clearTimeout(timer)}
 if(data?.ok!==true){
  if(data?.error==='Requête non autorisée.')throw accountError('SECRET_PARTAGE');
  if(data?.error==='Identifiant ou mot de passe incorrect.')return{authenticated:false};
  throw accountError('REPONSE_AUTHENTIFICATION');
 }
 // Never treat an unrelated Apps Script {ok:true} response as a successful login.
 if(!data.user||typeof data.user!=='object'||Array.isArray(data.user)||
    !String(data.user.id||'').trim()||!data.user.username||!data.user.role){
  console.warn('Unexpected account response from Apps Script',{
   hasUser:!!data.user,hasUsers:Array.isArray(data.users),
   finalHost:response.url?new URL(response.url).hostname:'unknown'
  });
  throw Object.assign(new Error('Réponse d’authentification incomplète. Vérifiez le déploiement Apps Script.'),{status:502});
 }
 if(String(data.user.username).trim().toLowerCase()!==credentials.username||[false,0,'false','FALSE','0'].includes(data.user.active))throw accountError('COMPTE_INCOHERENT');
 return{authenticated:true,user:data.user};
}

function accountError(code,status=502){
 console.error('Account service failure',{code});
 return Object.assign(new Error('Connexion au service des comptes impossible ('+code+').'),{status});
}

async function saveMembership(request,env){
 const body=await readJSON(request);
 const membershipYear=Number(body.membershipYear),membershipPrice=Number(body.membershipPrice);
 const membershipUrl=String(body.membershipUrl||'').trim(),membershipButtonLabel=String(body.membershipButtonLabel||'').trim();
 if(!Number.isInteger(membershipYear)||membershipYear<2025||membershipYear>2100)return json({error:'Année d’adhésion invalide.'},400,request,env);
 if(!Number.isFinite(membershipPrice)||membershipPrice<0||membershipPrice>1000)return json({error:'Montant invalide.'},400,request,env);
 if(membershipUrl&&!/^https:\/\//i.test(membershipUrl))return json({error:'Le lien doit commencer par https://.'},400,request,env);
 if(!membershipButtonLabel||membershipButtonLabel.length>80)return json({error:'Texte du bouton invalide.'},400,request,env);
 const path='assets/data/site-settings.json',file=await githubFile(env,env.SITE_REPO,path),settings=JSON.parse(decodeBase64(file.content));
 Object.assign(settings,{membershipYear,membershipPrice,membershipUrl,membershipButtonLabel});
 await githubPut(env,env.SITE_REPO,path,JSON.stringify(settings,null,2)+'\n',file.sha,'Met à jour les paramètres d’adhésion');
 return json({ok:true,settings},200,request,env);
}

async function saveLayout(request,env,id){
 const body=await readJSON(request),layout=String(body.layout||'').toUpperCase();
 if(!/^H(?:0[1-9]|1\d|2[0-8])$/.test(layout))return json({error:'Disposition H01 à H28 attendue.'},400,request,env);
 const path='actualites/'+id+'/layout.json';
 let file=null,data={};
 try{file=await githubFile(env,env.CONTENT_REPO,path);data=JSON.parse(decodeBase64(file.content))}
 catch(error){if(error.status!==404)throw error}
 data={...data,id,layout,updatedAt:new Date().toISOString()};
 await githubPut(env,env.CONTENT_REPO,path,JSON.stringify(data,null,2)+'\n',file?.sha||null,'Modifie la disposition de '+id);
 return json({ok:true,id,layout},200,request,env);
}


const contentRoot='https://raw.githubusercontent.com/';
function requiredText(value,label,max=12000){const text=String(value||'').trim();if(!text)throw Object.assign(new Error(label+' obligatoire.'),{status:400});if(text.length>max)throw Object.assign(new Error(label+' trop long.'),{status:400});return text}
function optionalText(value,max=12000){const text=String(value||'').trim();if(text.length>max)throw Object.assign(new Error('Un champ texte est trop long.'),{status:400});return text}
function validIsoDate(value,required=false){const date=String(value||'').trim();if(!date&& !required)return'';if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T00:00:00Z')))throw Object.assign(new Error('Date invalide.'),{status:400});return date}
function safeSeason(index){const code=String(index.seasonSystem?.currentCode||'AAA').toUpperCase();return/^[A-Z]{3}$/.test(code)?code:'AAA'}
function newArticleId(index){const number=Math.max(Number(index.nextArticleNumber)||1,...(index.articles||[]).map(a=>Number(a.number)||0))+((Number(index.nextArticleNumber)||1)>Math.max(0,...(index.articles||[]).map(a=>Number(a.number)||0))?0:1);return{id:'A'+String(number).padStart(7,'0')+safeSeason(index),number}}
function newOutingId(index,code){const numbers=(index.sorties||[]).map(x=>Number((String(x.id||'').match(/^S(\d+)/i)||[])[1])||0);return'S'+String(Math.max(0,...numbers)+1).padStart(5,'0')+code}
function safePhotoPath(path){const value=String(path||'').replace(/^\.\//,'');return/^medias\/[a-zA-Z0-9._-]+\.(?:jpg|jpeg|png|webp)$/i.test(value)&&!value.includes('..')?value:''}
async function writePublicFile(env,path,content,base64=false){
 try{
  const prior=await githubFile(env,env.CONTENT_REPO,path).catch(error=>{if(error.status===404)return null;throw error});
  const result=base64?await githubPutBase64(env,env.CONTENT_REPO,path,content,prior?.sha||null,'Ajoute un média de publication'):await githubPut(env,env.CONTENT_REPO,path,content,prior?.sha||null,'Met à jour le contenu public');
  if(!result?.commit?.sha||!result?.content?.sha)throw new Error('Réponse GitHub incomplète');
  return{path,commitSha:result.commit.sha,blobSha:result.content.sha};
 }catch(error){console.error('GitHub publication failed',{path,status:error.status||0});throw Object.assign(new Error('Écriture GitHub non confirmée pour '+path+'. La publication n’est pas considérée comme réussie.'),{status:502})}
}
function cleanUploads(value){
 if(!Array.isArray(value))return[];
 if(value.length>20)throw Object.assign(new Error('20 photos maximum par publication.'),{status:400});
 return value.map((item,index)=>{
  if(typeof item==='string'){const src=safePhotoPath(item);if(!src)throw Object.assign(new Error('Chemin photo invalide.'),{status:400});return{src,order:index+1}}
  if(item&&item.src){const src=safePhotoPath(item.src);if(!src)throw Object.assign(new Error('Chemin photo invalide.'),{status:400});return{src,order:index+1}}
  const mime=String(item?.mimeType||'image/jpeg').toLowerCase(),data=String(item?.data||'').replace(/^data:[^;]+;base64,/,'');
  if(!['image/jpeg','image/png','image/webp'].includes(mime)||!/^[A-Za-z0-9+/]+={0,2}$/.test(data)||data.length>7_000_000)throw Object.assign(new Error('Fichier photo invalide ou trop volumineux.'),{status:400});
  const ext=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';
  return{data,mimeType:mime,ext,order:index+1};
 });
}
async function persistPhotos(env,collection,id,items,writes=[]){
 const result=[];
 for(let i=0;i<items.length;i++){
  const item=items[i];
  if(item.data){
   const src='medias/photo-'+String(i+1).padStart(3,'0')+'.'+item.ext,path=collection+'/'+id+'/'+src;
   writes.push(await writePublicFile(env,path,item.data,true));
   result.push({src,order:i+1});
  }else result.push({src:item.src,order:i+1});
 }
 return result;
}
async function savePublicArticle(request,env){
 const body=await readJSON(request),input=body.article||body;
 const title=requiredText(input.title,'Titre',180),text=requiredText(input.text||input.description,'Texte',20000),summary=optionalText(input.summary||text.slice(0,260),500);
 const date=validIsoDate(input.date),indexFile=await githubFile(env,env.CONTENT_REPO,'actualites/index.json'),index=JSON.parse(decodeBase64(indexFile.content));
 if(!Array.isArray(index.articles))throw Object.assign(new Error('Index des actualités invalide.'),{status:502});
 const requested=String(input.id||'').toUpperCase(),existingMeta=requested?index.articles.find(a=>a.id===requested):null;
 if(requested&&!/^A\d{7}[A-Z]{3}$/.test(requested))throw Object.assign(new Error('Identifiant d’actualité invalide.'),{status:400});
 if(requested&&!existingMeta)throw Object.assign(new Error('Actualité introuvable dans le dépôt.'),{status:404});
 const assigned=existingMeta?{id:existingMeta.id,number:Number(existingMeta.number)||Number((existingMeta.id.match(/^A(\d+)/)||[])[1])}:newArticleId(index);
 const id=assigned.id,seasonCode=existingMeta?.seasonCode||safeSeason(index),season=existingMeta?.season||index.seasonSystem?.currentSeason||'';
 const oldFile=existingMeta?await githubFile(env,env.CONTENT_REPO,existingMeta.path||('actualites/'+id+'/contenu.json')):null;
 const old=oldFile?JSON.parse(decodeBase64(oldFile.content)):{};
 const writes=[];const photoInputs=cleanUploads(input.photos||[]),photos=await persistPhotos(env,'actualites',id,photoInputs,writes);
 const category=optionalText(input.category||old.category||'Vie de l’association',100);
 const categoryKey=optionalText(input.categoryKey||old.categoryKey||category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),80);
 const layoutCode=String(input.layoutCode||old.layoutCode||'H04').toUpperCase();
 if(!/^H(?:0[1-9]|1\d|2[0-8])$/.test(layoutCode))throw Object.assign(new Error('Disposition H01 à H28 attendue.'),{status:400});
 const event=input.event&&input.event.date?{date:validIsoDate(input.event.date,true),time:String(input.event.time||''),location:optionalText(input.event.location,250),category:optionalText(input.event.category,100)}:null;
 const placements={news:true,homeLatest:input.placements?.homeLatest!==false,upcomingEvents:!!event&&new Date(event.date+'T23:59:59')>=new Date()};
 const now=new Date().toISOString(),content={...old,schemaVersion:2,id,number:assigned.number,seasonCode,season,status:'published',type:'actualite',category,categoryKey,title,summary,date,publishedAt:existingMeta?.publishedAt||now,layoutCode,coverImage:photos[0]?.src||'',text,photos,documents:Array.isArray(input.documents)?input.documents:old.documents||[],event,placements,metrics:{...old.metrics,photoCount:photos.length,uploadedPhotoCount:photos.length,expectedPhotoCount:photos.length,documentCount:Array.isArray(input.documents)?input.documents.length:(old.documents||[]).length,hasGallery:photos.length>9,mediaImportPending:false}};
 const path='actualites/'+id+'/contenu.json',layoutPath='actualites/'+id+'/layout.json',mediaPath='actualites/'+id+'/media.json';
 writes.push(await writePublicFile(env,path,JSON.stringify(content,null,2)+'\n'));
 writes.push(await writePublicFile(env,layoutPath,JSON.stringify({layoutCode,photos,documents:content.documents,gallery:photos.length>9},null,2)+'\n'));
 writes.push(await writePublicFile(env,mediaPath,JSON.stringify({photos,documents:content.documents},null,2)+'\n'));
 const meta={...(existingMeta||{}),id,number:assigned.number,seasonCode,season,status:'published',type:'actualite',category,categoryKey,title,summary,date,publishedAt:content.publishedAt,layoutCode,coverImage:content.coverImage,path,event,placements,metrics:content.metrics,cover:photos[0]?{src:photos[0].src,order:1}:null};
 const articles=[...index.articles.filter(a=>a.id!==id),meta].sort((a,b)=>(Number(b.number)||0)-(Number(a.number)||0));
 const next={...index,contentVersion:(Number(index.contentVersion)||0)+1,updatedAt:now,articles};
 if(!existingMeta)next.nextArticleNumber=Math.max(Number(index.nextArticleNumber)||1,assigned.number+1);
 writes.push(await writePublicFile(env,'actualites/index.json',JSON.stringify(next,null,2)+'\n'));
 return json({ok:true,type:'actualite',id,repository:env.CONTENT_REPO,paths:writes.map(x=>x.path),photosSelected:(input.photos||[]).length,photosImported:photoInputs.filter(x=>x.data).length,commits:writes},200,request,env);
}
async function savePublicOuting(request,env){
 const body=await readJSON(request),input=body.sortie||body;
 const title=requiredText(input.title,'Titre',180),summary=optionalText(input.summary||input.description,1000),description=requiredText(input.description||input.text,'Description',20000);
 const startDate=validIsoDate(input.startDate||input.date,true),endDate=validIsoDate(input.endDate||input.startDate||input.date,true);
 if(endDate<startDate)throw Object.assign(new Error('La date de fin doit être après la date de début.'),{status:400});
 for(const key of ['helloAssoUrl','registrationUrl','documentUrl'])if(input[key]&&!/^https:\/\//i.test(String(input[key])))throw Object.assign(new Error('Les liens doivent commencer par https://.'),{status:400});
 const indexFile=await githubFile(env,env.CONTENT_REPO,'sorties/index.json'),index=JSON.parse(decodeBase64(indexFile.content)),items=Array.isArray(index)?index:(index.sorties||[]);
 const requested=String(input.id||'').toUpperCase(),found=requested?items.find(x=>String(x.id).toUpperCase()===requested):null;
 if(requested&&!/^S\d{5,}[A-Z]{3}$/.test(requested))throw Object.assign(new Error('Identifiant de sortie invalide.'),{status:400});
 if(requested&&!found)throw Object.assign(new Error('Sortie introuvable dans le dépôt.'),{status:404});
 const code=safeSeason(JSON.parse(decodeBase64((await githubFile(env,env.CONTENT_REPO,'actualites/index.json')).content)));
 const id=found?found.id:newOutingId({sorties:items},code),photoInputs=cleanUploads(input.photos||[]),writes=[],photos=await persistPhotos(env,'sorties',id,photoInputs,writes),now=new Date().toISOString();
 const cover=photos[0]?.src||'',out={...(found||{}),id,status:'published',title,type:optionalText(input.type||found?.type||'Sortie',60),startDate,endDate,summary,description,location:optionalText(input.location,250),pricing:input.pricing||found?.pricing||{},cover:cover||found?.cover||'',photos:photos.length?photos.map(x=>x.src):(found?.photos||[]),helloAssoUrl:String(input.helloAssoUrl||''),registrationUrl:String(input.registrationUrl||''),registrationLabel:optionalText(input.registrationLabel||'Inscription',80),bookingLabel:optionalText(input.bookingLabel||'S’inscrire',80),documentUrl:String(input.documentUrl||''),updatedAt:now};
 const updated=[...items.filter(x=>x.id!==id),out].sort((a,b)=>String(a.startDate||'').localeCompare(String(b.startDate||'')));
 const payload=Array.isArray(index)?updated:{...index,sorties:updated,updatedAt:now};
 writes.push(await writePublicFile(env,'sorties/index.json',JSON.stringify(payload,null,2)+'\n'));
 return json({ok:true,type:'sortie',id,repository:env.CONTENT_REPO,paths:writes.map(x=>x.path),photosSelected:(input.photos||[]).length,photosImported:photoInputs.filter(x=>x.data).length,commits:writes},200,request,env);
}

async function githubFile(env,repo,path){
 const response=await fetch(githubURL(env,repo,path),{headers:githubHeaders(env)});
 if(!response.ok){const error=new Error('Lecture GitHub impossible ('+response.status+').');error.status=response.status;throw error}
 return response.json();
}
async function githubPut(env,repo,path,content,sha,message){
 const payload={message,content:encodeBase64(content),branch:env.GITHUB_BRANCH||'main'};if(sha)payload.sha=sha;
 const response=await fetch(githubURL(env,repo,path),{method:'PUT',headers:{...githubHeaders(env),'Content-Type':'application/json'},body:JSON.stringify(payload)});
 if(!response.ok)throw new Error('Enregistrement GitHub impossible ('+response.status+').');
 return response.json();
}
async function githubPutBase64(env,repo,path,base64,sha,message){
 const payload={message,content:base64,branch:env.GITHUB_BRANCH||'main'};if(sha)payload.sha=sha;
 const response=await fetch(githubURL(env,repo,path),{method:'PUT',headers:{...githubHeaders(env),'Content-Type':'application/json'},body:JSON.stringify(payload)});
 if(!response.ok)throw new Error('Enregistrement GitHub impossible ('+response.status+').');
 return response.json();
}
function githubURL(env,repo,path){return'https://api.github.com/repos/'+encodeURIComponent(env.GITHUB_OWNER)+'/'+encodeURIComponent(repo)+'/contents/'+path.split('/').map(encodeURIComponent).join('/')}
function githubHeaders(env){return{'Accept':'application/vnd.github+json','Authorization':'Bearer '+env.GITHUB_TOKEN,'User-Agent':'horticulture-admin-worker','X-GitHub-Api-Version':'2022-11-28'}}
async function readJSON(request){const type=request.headers.get('Content-Type')||'';if(!type.includes('application/json'))throw Object.assign(new Error('Format JSON attendu.'),{status:415});return request.json()}
async function recordAttempt(env,clientKey,username,success){await env.DB.prepare('INSERT INTO login_attempts (client_key,username,success,attempted_at) VALUES (?,?,?,?)').bind(clientKey,username||'',success?1:0,new Date().toISOString()).run()}
async function hashPassword(password,saltBytes=crypto.getRandomValues(new Uint8Array(16)),iterations=210000){
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:saltBytes,iterations},key,256);
 return{hash:bytesToBase64(new Uint8Array(bits)),salt:bytesToBase64(saltBytes),iterations};
}
async function verifyPassword(password,salt,expected,iterations){
 const actual=await hashPassword(password,base64ToBytes(salt),Number(iterations));return timingSafeEqual(actual.hash,expected);
}
function timingSafeEqual(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
async function sha256(value){const hash=await crypto.subtle.digest('SHA-256',encoder.encode(value));return bytesToHex(new Uint8Array(hash))}
function randomToken(size){return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(size)))}
function bytesToHex(bytes){return[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('')}
function bytesToBase64(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s)}
function bytesToBase64Url(bytes){return bytesToBase64(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function base64ToBytes(value){const s=atob(value);return Uint8Array.from(s,c=>c.charCodeAt(0))}
function encodeBase64(value){return bytesToBase64(encoder.encode(value))}
function decodeBase64(value){return new TextDecoder().decode(base64ToBytes(String(value).replace(/\n/g,'')))}
function parseCookies(value){return Object.fromEntries(value.split(';').map(v=>v.trim()).filter(Boolean).map(v=>{const i=v.indexOf('=');return i<0?[v,'']:[v.slice(0,i),decodeURIComponent(v.slice(i+1))]}))}
function sessionCookie(token){return'sh_admin_session='+encodeURIComponent(token)+'; Path=/; Max-Age='+(SESSION_HOURS*3600)+'; HttpOnly; Secure; SameSite=None'}
function expiredCookie(){return'sh_admin_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None'}
function permissionsFor(role){return ROLE_PERMISSIONS[String(role||'member')]||[]}
function permissionKey(value){return String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s-]+/g,'_')}
function normalizeRole(value){
 const role=permissionKey(value);
 if(['super_admin','superadmin','super_administrateur'].includes(role))return'super_admin';
 if(['admin','administrateur','administrator'].includes(role))return'admin';
 if(['publisher','publieur','publication','editeur'].includes(role))return'publisher';
 return'member';
}
function parsePermissions(value){
 if(Array.isArray(value))return value.filter(v=>typeof v==='string');
 if(typeof value!=='string')return[];
 try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed.filter(v=>typeof v==='string'):[]}
 catch{return value.split(',').map(v=>v.trim()).filter(Boolean)}
}
function normalizePermissions(value,role){
 const supplied=parsePermissions(value).map(permissionKey).filter(Boolean);
 const permissions=new Set([...permissionsFor(role),...supplied]);
 // Explicit publication permissions allow the editor, never account management.
 if(supplied.some(p=>['publier','publication','publisher','content.write','articles.layout'].includes(p))){
  permissionsFor('publisher').forEach(p=>permissions.add(p));
 }
 return[...permissions];
}
function hasPermission(session,permission){return session.permissions.includes('*')||session.permissions.includes(permission)}
function forbidden(request,env){return json({error:'Droits insuffisants pour cette opération.'},403,request,env)}
function allowedOrigins(env){return new Set(String(env.ALLOWED_ORIGINS||'https://shbassinchateaulin.github.io').split(',').map(x=>x.trim()).filter(Boolean))}
function corsHeaders(request,env){const origin=request.headers.get('Origin')||'';return allowedOrigins(env).has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Vary':'Origin'}:{}}
function preflight(request,env){const origin=request.headers.get('Origin')||'';if(!allowedOrigins(env).has(origin))return new Response(null,{status:403});return new Response(null,{status:204,headers:{...corsHeaders(request,env),'Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization','Access-Control-Max-Age':'86400'}})}
function json(data,status,request,env,cookie){const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...corsHeaders(request,env)};if(cookie)headers['Set-Cookie']=cookie;return new Response(JSON.stringify(data),{status,headers})}

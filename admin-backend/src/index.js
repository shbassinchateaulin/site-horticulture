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
  catch(error){console.error(error);return json({error:'Erreur interne du service.'},500,request,env)}
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
 let user=await env.DB.prepare('SELECT id,username,password_hash,password_salt,password_iterations,role,active FROM users WHERE username = ?').bind(username).first();
 if(!user){
  const count=await env.DB.prepare('SELECT COUNT(*) AS total FROM users').first();
  if(Number(count?.total||0)===0&&env.BOOTSTRAP_USERNAME&&env.BOOTSTRAP_PASSWORD&&username===String(env.BOOTSTRAP_USERNAME).toLowerCase()&&password===env.BOOTSTRAP_PASSWORD){
   const credentials=await hashPassword(password);
   await env.DB.prepare('INSERT INTO users (username,password_hash,password_salt,password_iterations,role,active,created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(username,credentials.hash,credentials.salt,credentials.iterations,'super_admin',1,new Date().toISOString()).run();
   user=await env.DB.prepare('SELECT id,username,password_hash,password_salt,password_iterations,role,active FROM users WHERE username = ?').bind(username).first();
  }
 }
 const valid=!!(user&&user.active&&await verifyPassword(password,user.password_salt,user.password_hash,user.password_iterations));
 await recordAttempt(env,clientKey,username,valid);
 if(!valid)return json({error:'Identifiant ou mot de passe incorrect.'},401,request,env);
 const permissions=permissionsFor(user.role);
 if(String(body.scope||'')==='site-admin'&&!permissions.includes('*')&&!permissions.includes('admin.access'))return json({error:'Ce compte ne possède pas les droits d’accès à l’administration du site.'},403,request,env);
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
 const row=await env.DB.prepare('SELECT s.token_hash,s.expires_at,u.id,u.username,u.role,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?').bind(tokenHash).first();
 if(!row||!row.active||new Date(row.expires_at)<=new Date()){if(row)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(tokenHash).run();return null}
 return{...row,tokenHash,permissions:permissionsFor(row.role)};
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
function hasPermission(session,permission){return session.permissions.includes('*')||session.permissions.includes(permission)}
function forbidden(request,env){return json({error:'Droits insuffisants pour cette opération.'},403,request,env)}
function allowedOrigins(env){return new Set(String(env.ALLOWED_ORIGINS||'https://shbassinchateaulin.github.io').split(',').map(x=>x.trim()).filter(Boolean))}
function corsHeaders(request,env){const origin=request.headers.get('Origin')||'';return allowedOrigins(env).has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Vary':'Origin'}:{}}
function preflight(request,env){const origin=request.headers.get('Origin')||'';if(!allowedOrigins(env).has(origin))return new Response(null,{status:403});return new Response(null,{status:204,headers:{...corsHeaders(request,env),'Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization','Access-Control-Max-Age':'86400'}})}
function json(data,status,request,env,cookie){const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...corsHeaders(request,env)};if(cookie)headers['Set-Cookie']=cookie;return new Response(JSON.stringify(data),{status,headers})}

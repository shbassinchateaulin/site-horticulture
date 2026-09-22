import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import worker from '../src/index.js';

// Exercise the real Apps Script checker and Worker against an isolated sheet
// and SQLite database. No real credentials or network requests are used.
test('Google Sheets remains authoritative across logins, renames and permissions',async()=>{
 const db=new DatabaseSync(':memory:');
 db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 const hash=s=>createHash('sha256').update(s).digest('hex');
 const row=['account-1','Test','Compte','test@example.invalid','','Super Admin','ancien.identifiant',hash('mot-de-passe-test'),false,true,'communication,sorties'];
 const rows=[Array(20).fill('header'),row];
 const script=vm.createContext({
  PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'secret-test'})},
  getSheet_:()=>({getDataRange:()=>({getValues:()=>rows})}),sha256_:hash
 });
 vm.runInContext(readFileSync(new URL('../../integrations/admin-auth/AppsScriptAuth.gs',import.meta.url),'utf8'),script);
 const prepare=sql=>({bind(...args){return{
  async first(){return db.prepare(sql).get(...args)||null},
  async run(){return db.prepare(sql).run(...args)}
 }}});
 const env={DB:{prepare,async batch(statements){db.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());db.exec('COMMIT');return results}catch(e){db.exec('ROLLBACK');throw e}}},
  GOOGLE_APPS_SCRIPT_URL:'https://script.google.com/macros/s/test/exec',
  GOOGLE_APPS_SCRIPT_SHARED_SECRET:'secret-test'};
 const realFetch=globalThis.fetch;let output,googleCalls=0;
 globalThis.fetch=async(url,options)=>{
  if(new URL(url).hostname==='script.google.com'){
   googleCalls++;assert.equal(options.method,'POST');
   output=script.backendAuthenticate_(JSON.parse(options.body));
   return new Response(null,{status:302,headers:{Location:'https://script.googleusercontent.com/macros/echo?test=1'}});
  }
  assert.equal(options.method,'GET');assert.equal(options.body,undefined);
  return Response.json(output);
 };
 let client=0;
 async function login(username,password='mot-de-passe-test',scope='site-admin'){
  const response=await worker.fetch(new Request('https://worker.invalid/login',{
   method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':String(++client)},
   body:JSON.stringify({username,password,scope})}),env);
  return{status:response.status,data:await response.json()};
 }
 try{
  const initial=await login('ancien.identifiant');assert.equal(initial.status,200);
  assert.equal(initial.data.user.role,'super_admin');
  row[6]='prenom.nom.modifie';
  assert.equal((await login('ancien.identifiant')).status,401);
  const renamed=await login(' PRENOM.NOM.MODIFIE ');assert.equal(renamed.status,200);
  assert.equal(renamed.data.user.username,'prenom.nom.modifie');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users WHERE external_id = ?').get('account-1').n,1);
  const oldSession=await worker.fetch(new Request('https://worker.invalid/session',{headers:{Authorization:'Bearer '+initial.data.sessionToken}}),env);
  assert.equal(oldSession.status,401);
  assert.equal((await login(row[6],'mauvais-mot-de-passe')).status,401);
  row[7]=hash('nouveau-mot-de-passe');
  assert.equal((await login(row[6])).status,401);
  assert.equal((await login(row[6],'nouveau-mot-de-passe')).status,200);
  row[9]=false;assert.equal((await login(row[6],'nouveau-mot-de-passe')).status,401);
  row[9]=true;row[5]='Compte';row[10]='adherents,comptabilite';
  assert.equal((await login(row[6],'nouveau-mot-de-passe','')).status,403);
  row[10]='publication';const publisher=await login(row[6],'nouveau-mot-de-passe');
  assert.equal(publisher.status,200);assert.ok(publisher.data.user.permissions.includes('admin.access'));
  assert.ok(!publisher.data.user.permissions.includes('users.manage'));
  row[5]='Super Admin';row[10]='';assert.equal((await login(row[6],'nouveau-mot-de-passe')).status,200);
  env.GOOGLE_APPS_SCRIPT_SHARED_SECRET='different-secret';
  const invalidSecret=await login(row[6],'nouveau-mot-de-passe');assert.equal(invalidSecret.status,502);assert.match(invalidSecret.data.error,/SECRET_PARTAGE/);
  assert.equal(googleCalls,11);
 }finally{globalThis.fetch=realFetch;db.close()}
});

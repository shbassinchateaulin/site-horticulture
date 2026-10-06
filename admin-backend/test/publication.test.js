import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

test('publishes news and outings with confirmed GitHub media writes',async()=>{
 const files=new Map([
  ['actualites/index.json',JSON.stringify({schemaVersion:2,contentVersion:9,nextArticleNumber:13,seasonSystem:{currentCode:'AAA',currentSeason:'2025-2026'},articles:[{id:'A0000012AAA',number:12,status:'published',path:'actualites/A0000012AAA/contenu.json'}]})],
  ['sorties/index.json',JSON.stringify({sorties:[{id:'S00001AAA',status:'published',title:'Sortie déjà publiée',startDate:'2027-01-01'}]})]
 ]);
 const originalFetch=globalThis.fetch,encoder=new TextEncoder(),decoder=new TextDecoder();
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url),prefix='/repos/shbassinchateaulin/horticulture-contenus/contents/';
  assert.equal(u.hostname,'api.github.com');assert.ok(u.pathname.startsWith(prefix));
  const path=decodeURIComponent(u.pathname.slice(prefix.length));
  if(options.method==='PUT'){
   const payload=JSON.parse(options.body),content=decoder.decode(Uint8Array.from(atob(payload.content),c=>c.charCodeAt(0))),commitSha='commit-'+(files.size+1),blobSha='blob-'+(files.size+1);
   files.set(path,content);return Response.json({content:{sha:blobSha},commit:{sha:commitSha}});
  }
  if(!files.has(path))return Response.json({message:'Not Found'},{status:404});
  return Response.json({content:btoa(String.fromCharCode(...encoder.encode(files.get(path)))),sha:'existing-'+path});
 };
 const env={CONTENT_REPO:'horticulture-contenus',GITHUB_OWNER:'shbassinchateaulin',GITHUB_BRANCH:'main',GITHUB_TOKEN:'test',DB:{prepare(){return{bind(){return{async first(){return{token_hash:'test',expires_at:new Date(Date.now()+3600000).toISOString(),id:'u',username:'test',role:'publisher',permissions:'["content.write"]',active:1}}}}}}}};
 async function publish(path,body){const r=await worker.fetch(new Request('https://worker.test'+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer test',Origin:'https://shbassinchateaulin.github.io'},body:JSON.stringify(body)}),env);return{status:r.status,data:await r.json()}}
 try{
  const news=await publish('/content/actualites',{article:{title:'Actualité test',text:'Texte de test.',summary:'Résumé.',photos:[{mimeType:'image/jpeg',data:'aGVsbG8='}]}});
  assert.equal(news.status,200);assert.equal(news.data.ok,true);assert.equal(news.data.id,'A0000013AAA');assert.equal(news.data.photosImported,1);assert.ok(news.data.commits.every(x=>x.commitSha&&x.blobSha));assert.ok(files.has('actualites/A0000013AAA/medias/photo-001.jpg'));assert.ok(files.get('actualites/index.json').includes('A0000012AAA'));
  const outing=await publish('/content/sorties',{sortie:{title:'Sortie test',description:'Description test',startDate:'2027-02-01',endDate:'2027-02-02',photos:[{mimeType:'image/jpeg',data:'aGVsbG8='}]}});
  assert.equal(outing.status,200);assert.equal(outing.data.id,'S00002AAA');assert.equal(outing.data.photosImported,1);assert.ok(outing.data.commits.every(x=>x.commitSha&&x.blobSha));assert.ok(files.has('sorties/S00002AAA/medias/photo-001.jpg'));assert.ok(files.get('sorties/index.json').includes('S00001AAA'));
 }finally{globalThis.fetch=originalFetch}
});

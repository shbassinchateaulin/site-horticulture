import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

test('publishes news and outings with confirmed GitHub media writes',async()=>{
 const files=new Map([
  ['actualites/index.json',JSON.stringify({schemaVersion:2,contentVersion:9,nextArticleNumber:13,seasonSystem:{currentCode:'AAA',currentSeason:'2025-2026'},articles:[{id:'A0000012AAA',number:12,status:'published',path:'actualites/A0000012AAA/contenu.json'}]})],
  ['sorties/index.json',JSON.stringify({sorties:[{id:'S00001AAA',status:'published',title:'Sortie déjà publiée',startDate:'2027-01-01'}]})]
 ]);
 const originalFetch=globalThis.fetch,encoder=new TextEncoder(),decoder=new TextDecoder();
 const blobShas=new Map();
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url),prefix='/repos/shbassinchateaulin/horticulture-contenus/contents/';
  assert.equal(u.hostname,'api.github.com');assert.ok(u.pathname.startsWith(prefix));
  const path=decodeURIComponent(u.pathname.slice(prefix.length));
  if(options.method==='PUT'){
   const payload=JSON.parse(options.body),content=decoder.decode(Uint8Array.from(atob(payload.content),c=>c.charCodeAt(0))),commitSha='commit-'+(files.size+1),blobSha='blob-'+(files.size+1);
   files.set(path,content);blobShas.set(path,blobSha);return Response.json({content:{sha:blobSha},commit:{sha:commitSha}});
  }
  if(!files.has(path))return Response.json({message:'Not Found'},{status:404});
  return Response.json({content:btoa(String.fromCharCode(...encoder.encode(files.get(path)))),sha:blobShas.get(path)||'existing-'+path});
 };
 const env={CONTENT_REPO:'horticulture-contenus',GITHUB_OWNER:'shbassinchateaulin',GITHUB_BRANCH:'main',GITHUB_TOKEN:'test',DB:{prepare(){return{bind(){return{async first(){return{token_hash:'test',expires_at:new Date(Date.now()+3600000).toISOString(),id:'u',username:'test',role:'publisher',permissions:'["content.write"]',active:1}}}}}}}};
 async function publish(path,body){const r=await worker.fetch(new Request('https://worker.test'+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer test',Origin:'https://shbassinchateaulin.github.io'},body:JSON.stringify(body)}),env);return{status:r.status,data:await r.json()}}
 try{
  const news=await publish('/content/actualites',{article:{title:'Actualité test',text:'Texte de test.',summary:'Résumé.',season:'2026-2027',photos:[{mimeType:'image/jpeg',data:'aGVsbG8='}]}});
  assert.equal(news.status,200);assert.equal(news.data.ok,true);assert.equal(news.data.id,'A0000013AAB');assert.equal(news.data.photosImported,1);assert.ok(news.data.commits.every(x=>x.commitSha&&x.blobSha));assert.ok(files.has('actualites/A0000013AAB/medias/photo-001.jpg'));assert.ok(files.get('actualites/index.json').includes('A0000012AAA'));
  const webp=await publish('/content/actualites',{article:{title:'Photo WebP',text:'Test du format WebP.',summary:'Vérification WebP.',season:'2026-2027',photos:[{mimeType:'image/webp',data:'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA'}]}});
  assert.equal(webp.status,200);assert.equal(webp.data.ok,true);assert.equal(webp.data.photosImported,1);
  assert.ok(webp.data.paths.some(path=>path.endsWith('/medias/photo-001.webp')));
  assert.ok(files.has('actualites/'+webp.data.id+'/medias/photo-001.webp'));
  assert.ok(webp.data.commits.every(x=>x.commitSha&&x.blobSha));
  const outing=await publish('/content/sorties',{sortie:{title:'Sortie test',description:'Description test',startDate:'2027-02-01',endDate:'2027-02-02',season:'2026-2027',photos:[{mimeType:'image/jpeg',data:'aGVsbG8='}]}});
  assert.equal(outing.status,200);assert.equal(outing.data.id,'S00002AAB');assert.equal(outing.data.photosImported,1);assert.ok(outing.data.commits.every(x=>x.commitSha&&x.blobSha));assert.ok(files.has('sorties/S00002AAB/medias/photo-001.jpg'));assert.ok(files.get('sorties/index.json').includes('S00001AAA'));
 }finally{globalThis.fetch=originalFetch}
});

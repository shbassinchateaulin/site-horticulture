/* Central content store — published content is read from horticulture-contenus.
 * Public IDs are permanent: A0000001, A0000002…
 * The visitor browser only resolves already-prepared publication data; no AI runs here.
 */
(function(global){
'use strict';
const RAW_ROOT='https://raw.githubusercontent.com/shbassinchateaulin/horticulture-contenus/main/';
const INDEX_URL=RAW_ROOT+'actualites/index.json';
const memory=new Map();
async function getJSON(url,options){
  const fresh=!!(options&&options.fresh);
  if(memory.has(url)&&!fresh)return memory.get(url);
  const fetchUrl=fresh?url+(url.includes('?')?'&':'?')+'_='+Date.now():url;
  const r=await fetch(fetchUrl,{cache:fresh?'no-store':'default',credentials:'omit'});
  if(!r.ok)throw new Error('Contenu indisponible ('+r.status+')');
  const d=await r.json();memory.set(url,d);return d;
}
/* Publication numbers are permanent and monotonic: the highest A-number is the newest publication.
 * This avoids an import timestamp moving an older prepared article behind another article. */
function sortArticles(items){return(items||[]).filter(a=>a.status!=='deleted'&&a.status!=='draft').slice().sort((a,b)=>(Number(b.number)||0)-(Number(a.number)||0)||String(b.publishedAt||b.date||'').localeCompare(String(a.publishedAt||a.date||'')))}
async function index(options){const d=await getJSON(INDEX_URL,{fresh:options?.fresh!==false});return{...d,articles:sortArticles(d.articles).map(a=>({...a,cover:resolveMedia(a.id,a.cover)}))}}
function validId(id){return /^A\d{7,}$/i.test(String(id||'').trim())}
function resolveMedia(id,m){if(!m)return m;const clean=String(id||'').toUpperCase(),base=RAW_ROOT+'actualites/'+clean+'/';if(typeof m==='string')return /^(https?:|data:|blob:|\/)/i.test(m)?m:base+m.replace(/^\.\//,'');const src=m.url||m.downloadUrl||m.src||'';const resolved=/^(https?:|data:|blob:|\/)/i.test(src)?src:base+src.replace(/^\.\//,'');return{...m,src:resolved,url:m.url?resolved:m.url,downloadUrl:m.downloadUrl?resolved:m.downloadUrl}}
async function article(id,options){if(!validId(id))throw new Error('Identifiant d’actualité invalide');const clean=String(id).trim().toUpperCase(),base=RAW_ROOT+'actualites/'+clean+'/';const opts={fresh:options?.fresh!==false};const content=await getJSON(base+'contenu.json',opts);let layout={},media={};try{layout=await getJSON(base+'layout.json',opts)}catch(_){}try{media=await getJSON(base+'media.json',opts)}catch(_){}const rawPhotos=(layout.photos&&layout.photos.length?layout.photos:(content.photos&&content.photos.length?content.photos:media.photos))||[];const rawDocs=(layout.documents&&layout.documents.length?layout.documents:(content.documents&&content.documents.length?content.documents:media.documents))||[];return{...content,...layout,id:clean,photos:rawPhotos.map(x=>resolveMedia(clean,x)),documents:rawDocs.map(x=>resolveMedia(clean,x))}}
function mediaURL(m){if(!m)return'';if(typeof m==='string')return m;return m.url||m.downloadUrl||m.src||''}
function preload(url,as){if(!url||document.querySelector('link[data-content-preload="'+CSS.escape(url)+'"]'))return;const l=document.createElement('link');l.rel='preload';l.href=url;l.as=as||'image';l.dataset.contentPreload=url;document.head.appendChild(l)}
global.HorticultureContent={RAW_ROOT,INDEX_URL,index,article,mediaURL,preload,validId,resolveMedia};
})(window);
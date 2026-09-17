/* Central content store — published content is read from horticulture-contenus.
 * Canonical IDs: A0000001AAA where AAA identifies the season.
 * Legacy links A0000001 are transparently redirected to the canonical indexed ID.
 */
(function(global){
'use strict';
const RAW_ROOT='https://raw.githubusercontent.com/shbassinchateaulin/horticulture-contenus/main/';
const INDEX_URL=RAW_ROOT+'actualites/index.json';
const memory=new Map();
async function getJSON(url,options){const fresh=!!(options&&options.fresh);if(memory.has(url)&&!fresh)return memory.get(url);const fetchUrl=fresh?url+(url.includes('?')?'&':'?')+'_='+Date.now():url;const r=await fetch(fetchUrl,{cache:fresh?'no-store':'default',credentials:'omit'});if(!r.ok)throw new Error('Contenu indisponible ('+r.status+')');const d=await r.json();memory.set(url,d);return d}
function splitId(id){const m=String(id||'').trim().toUpperCase().match(/^A0*(\d+)([A-Z]{3})?$/);return m?{number:Number(m[1]),seasonCode:m[2]||''}:null}
function articleNumber(a){const explicit=Number(a&&a.number);if(Number.isFinite(explicit)&&explicit>0)return explicit;const parsed=splitId(a&&a.id);return parsed?parsed.number:0}
function articleSeasonCode(a){const parsed=splitId(a&&a.id);return String(a&&a.seasonCode||(parsed&&parsed.seasonCode)||'').toUpperCase()}
function sortArticles(items){return(items||[]).filter(a=>a.status!=='deleted'&&a.status!=='draft').slice().sort((a,b)=>articleNumber(b)-articleNumber(a))}
async function rawIndex(fresh){return getJSON(INDEX_URL,{fresh:fresh!==false})}
async function index(options){const d=await rawIndex(options?.fresh!==false);return{...d,articles:sortArticles(d.articles).map(a=>({...a,seasonCode:articleSeasonCode(a),cover:resolveMedia(a.id,a.cover)}))}}
function validId(id){return /^A\d{7,}(?:[A-Z]{3})?$/i.test(String(id||'').trim())}
async function canonicalId(id,fresh){const clean=String(id||'').trim().toUpperCase();const parsed=splitId(clean);if(!parsed)return clean;if(parsed.seasonCode)return clean;try{const d=await rawIndex(fresh!==false);const found=(d.articles||[]).find(a=>articleNumber(a)===parsed.number&&a.status!=='deleted');return found&&found.id?String(found.id).toUpperCase():clean}catch(_){return clean}}
function resolveMedia(id,m){if(!m)return m;const clean=String(id||'').toUpperCase(),base=RAW_ROOT+'actualites/'+clean+'/';if(typeof m==='string')return /^(https?:|data:|blob:|\/)/i.test(m)?m:base+m.replace(/^\.\//,'');const src=m.url||m.downloadUrl||m.src||'';const resolved=/^(https?:|data:|blob:|\/)/i.test(src)?src:base+src.replace(/^\.\//,'');return{...m,src:resolved,url:m.url?resolved:m.url,downloadUrl:m.downloadUrl?resolved:m.downloadUrl}}
async function article(id,options){if(!validId(id))throw new Error('Identifiant d’actualité invalide');const fresh=options?.fresh!==false;const clean=await canonicalId(id,fresh);const base=RAW_ROOT+'actualites/'+clean+'/';const opts={fresh};const content=await getJSON(base+'contenu.json',opts);let layout={},media={};try{layout=await getJSON(base+'layout.json',opts)}catch(_){}try{media=await getJSON(base+'media.json',opts)}catch(_){}const rawPhotos=(layout.photos&&layout.photos.length?layout.photos:(content.photos&&content.photos.length?content.photos:media.photos))||[];const rawDocs=(layout.documents&&layout.documents.length?layout.documents:(content.documents&&content.documents.length?content.documents:media.documents))||[];return{...content,...layout,id:clean,seasonCode:articleSeasonCode({...content,...layout,id:clean}),photos:rawPhotos.map(x=>resolveMedia(clean,x)),documents:rawDocs.map(x=>resolveMedia(clean,x))}}
function mediaURL(m){if(!m)return'';if(typeof m==='string')return m;return m.url||m.downloadUrl||m.src||''}
function preload(url,as){if(!url||document.querySelector('link[data-content-preload="'+CSS.escape(url)+'"]'))return;const l=document.createElement('link');l.rel='preload';l.href=url;l.as=as||'image';l.dataset.contentPreload=url;document.head.appendChild(l)}
global.HorticultureContent={RAW_ROOT,INDEX_URL,index,article,mediaURL,preload,validId,resolveMedia,articleNumber,articleSeasonCode,splitId,canonicalId};
})(window);
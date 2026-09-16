/* Central content store — published content is read from horticulture-contenus.
 * Public IDs are permanent: A0000001, A0000002…
 * The visitor browser only resolves already-prepared publication data; no AI runs here.
 */
(function(global){
'use strict';
const RAW_ROOT='https://raw.githubusercontent.com/shbassinchateaulin/horticulture-contenus/main/';
const INDEX_URL=RAW_ROOT+'actualites/index.json';
const memory=new Map();
async function getJSON(url,options){if(memory.has(url)&&!(options&&options.fresh))return memory.get(url);const r=await fetch(url,{cache:options&&options.fresh?'no-store':'force-cache',credentials:'omit'});if(!r.ok)throw new Error('Contenu indisponible ('+r.status+')');const d=await r.json();memory.set(url,d);return d}
function sortArticles(items){return(items||[]).filter(a=>a.status!=='deleted'&&a.status!=='draft').slice().sort((a,b)=>String(b.publishedAt||b.date||'').localeCompare(String(a.publishedAt||a.date||''))||(b.number||0)-(a.number||0))}
async function index(options){const d=await getJSON(INDEX_URL,options);return{...d,articles:sortArticles(d.articles)}}
function validId(id){return /^A\d{7,}$/i.test(id||'')}
async function article(id,options){if(!validId(id))throw new Error('Identifiant d’actualité invalide');const clean=String(id).toUpperCase(),base=RAW_ROOT+'actualites/'+clean+'/';const content=await getJSON(base+'contenu.json',options);let layout={},media={};try{layout=await getJSON(base+'layout.json',options)}catch(_){}try{media=await getJSON(base+'media.json',options)}catch(_){}return{...content,...layout,id:clean,photos:layout.photos||content.photos||media.photos||[],documents:layout.documents||content.documents||media.documents||[]}}
function mediaURL(m){if(!m)return'';if(typeof m==='string')return m;return m.url||m.downloadUrl||m.src||''}
function preload(url,as){if(!url||document.querySelector('link[data-content-preload="'+CSS.escape(url)+'"]'))return;const l=document.createElement('link');l.rel='preload';l.href=url;l.as=as||'image';l.dataset.contentPreload=url;document.head.appendChild(l)}
global.HorticultureContent={RAW_ROOT,INDEX_URL,index,article,mediaURL,preload,validId};
})(window);
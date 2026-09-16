/* Central content store — published content is read from horticulture-contenus.
 * Public IDs are permanent: A0000001, A0000002…
 * The browser only resolves an article ID to already-prepared content; storage details stay hidden.
 */
(function (global) {
  'use strict';
  const RAW_ROOT = 'https://raw.githubusercontent.com/shbassinchateaulin/horticulture-contenus/main/';
  const INDEX_URL = RAW_ROOT + 'actualites/index.json';
  const memory = new Map();

  async function getJSON(url, options) {
    if (memory.has(url) && !(options && options.fresh)) return memory.get(url);
    const response = await fetch(url, { cache: options && options.fresh ? 'no-store' : 'force-cache', credentials: 'omit' });
    if (!response.ok) throw new Error('Contenu indisponible (' + response.status + ')');
    const data = await response.json(); memory.set(url, data); return data;
  }
  function sortArticles(articles) {
    return (articles || []).filter(a => a.status !== 'deleted' && a.status !== 'draft')
      .slice().sort((a,b) => String(b.publishedAt || b.date || '').localeCompare(String(a.publishedAt || a.date || '')) || (b.number||0)-(a.number||0));
  }
  async function index(options) { const data=await getJSON(INDEX_URL,options); data.articles=sortArticles(data.articles); return data; }
  function validId(id){ return /^A\d{7,}$/i.test(id||'') || /^actu-\d{4,}$/i.test(id||''); }
  async function article(id, options) {
    if (!validId(id)) throw new Error('Identifiant d’actualité invalide');
    const clean=String(id).toUpperCase().startsWith('A')?String(id).toUpperCase():String(id);
    const base=RAW_ROOT+'actualites/'+encodeURIComponent(clean)+'/';
    const content=await getJSON(base+'contenu.json',options);
    let layout=null; try { layout=await getJSON(base+'layout.json',options); } catch (_) {}
    return {content,layout};
  }
  function mediaURL(media) { if(!media)return ''; if(typeof media==='string')return media; return media.url||media.downloadUrl||media.src||''; }
  function preload(url,as) { if(!url||document.querySelector('link[data-content-preload="'+CSS.escape(url)+'"]'))return; const link=document.createElement('link');link.rel='preload';link.href=url;link.as=as||'image';link.dataset.contentPreload=url;document.head.appendChild(link); }
  global.HorticultureContent={RAW_ROOT,INDEX_URL,index,article,mediaURL,preload,validId};
})(window);

/* Central content store — generated content is read from horticulture-contenus.
 * The browser only deals with article IDs and resolved URLs; physical media
 * batches/releases remain an implementation detail.
 */
(function (global) {
  'use strict';
  const RAW_ROOT = 'https://raw.githubusercontent.com/shbassinchateaulin/horticulture-contenus/main/';
  const INDEX_URL = RAW_ROOT + 'actualites/index.json';
  const memory = new Map();

  async function getJSON(url, options) {
    if (memory.has(url) && !(options && options.fresh)) return memory.get(url);
    const response = await fetch(url, {
      cache: options && options.fresh ? 'no-store' : 'force-cache',
      credentials: 'omit'
    });
    if (!response.ok) throw new Error('Contenu indisponible (' + response.status + ')');
    const data = await response.json();
    memory.set(url, data);
    return data;
  }

  function sortArticles(articles) {
    return (articles || []).filter(a => a.status !== 'deleted' && a.status !== 'draft')
      .slice().sort((a,b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')) || (b.number||0)-(a.number||0));
  }

  async function index(options) {
    const data = await getJSON(INDEX_URL, options);
    data.articles = sortArticles(data.articles);
    return data;
  }

  async function article(id, options) {
    if (!/^actu-\d{4,}$/.test(id || '')) throw new Error('Identifiant d’actualité invalide');
    const base = RAW_ROOT + 'actualites/' + encodeURIComponent(id) + '/';
    const content = await getJSON(base + 'contenu.json', options);
    let layout = null;
    try { layout = await getJSON(base + 'layout.json', options); } catch (_) {}
    return { content, layout };
  }

  function mediaURL(media) {
    if (!media) return '';
    if (media.url) return media.url;
    if (media.downloadUrl) return media.downloadUrl;
    return '';
  }

  function preload(url, as) {
    if (!url || document.querySelector('link[data-content-preload="'+CSS.escape(url)+'"]')) return;
    const link=document.createElement('link'); link.rel='preload'; link.href=url; link.as=as||'image'; link.dataset.contentPreload=url; document.head.appendChild(link);
  }

  global.HorticultureContent = { RAW_ROOT, INDEX_URL, index, article, mediaURL, preload };
})(window);

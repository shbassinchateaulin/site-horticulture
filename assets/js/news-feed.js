/* Automatic news feed. The publication index is the single source of truth.
 * New articles automatically become #1; older cards shift naturally.
 */
(function(){
'use strict';
if(!window.HorticultureContent)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const idOf=a=>a.id||a.articleId||('A'+String(a.number||0).padStart(7,'0'));
const titleOf=a=>a.title||a.titre||'Actualité';
const summaryOf=a=>a.summary||a.resume||a.excerpt||'';
const labelOf=a=>a.categoryLabel||a.categoryName||a.category||a.categorie||'Actualité';
const categoryOf=a=>String(a.categoryKey||a.category||a.categorie||'association').toLowerCase();
const imageOf=a=>HorticultureContent.mediaURL(a.cover||a.coverImage||a.thumbnail||a.image||a.hero||'');
const articleHref=(a,prefix='')=>prefix+'actualites/article/?id='+encodeURIComponent(idOf(a));

function actualitesCard(a){
 const img=imageOf(a), id=idOf(a);
 const el=document.createElement('article'); el.className='actualite-card'; el.dataset.category=categoryOf(a); el.dataset.articleId=id;
 el.innerHTML=`<div class="actualite-photo"></div><div class="actualite-body"><span class="actualite-tag">${esc(labelOf(a))}</span><h2>${esc(titleOf(a))}</h2><p>${esc(summaryOf(a))}</p><a href="article/?id=${encodeURIComponent(id)}">Lire la suite <b>→</b></a></div>`;
 if(img){el.querySelector('.actualite-photo').style.backgroundImage=`url("${img.replace(/"/g,'%22')}")`; HorticultureContent.preload(img,'image');}
 return el;
}
function homeCard(a){
 const img=imageOf(a),id=idOf(a),el=document.createElement('article');
 el.innerHTML=`<div class="pic"></div><div class="card"><time>${esc(labelOf(a))}</time><h3>${esc(titleOf(a))}</h3><p>${esc(summaryOf(a))}</p><a href="actualites/article/?id=${encodeURIComponent(id)}">Lire la suite →</a></div>`;
 if(img)el.querySelector('.pic').style.backgroundImage=`url("${img.replace(/"/g,'%22')}")`;
 return el;
}
function clickable(card){const a=card.querySelector('a[href]');if(!a)return;card.tabIndex=0;card.setAttribute('role','link');card.addEventListener('click',e=>{if(!e.target.closest('a'))location.href=a.href});card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();location.href=a.href}});}
async function boot(){
 try{
  const data=await HorticultureContent.index(); const articles=data.articles||[]; if(!articles.length)return;
  const ag=document.querySelector('.actualites-grid');
  if(ag){ag.replaceChildren(...articles.map(actualitesCard)); [...ag.children].forEach(clickable); document.dispatchEvent(new CustomEvent('horticulture:news-ready',{detail:{articles}}));}
  const hg=document.querySelector('main .news .news-grid');
  if(hg&&!location.pathname.includes('/actualites/')){const top=articles.slice(0,3);hg.replaceChildren(...top.map(homeCard));[...hg.children].forEach(clickable);}
  window.HorticulturePublishedArticles=articles;
 }catch(e){console.warn('Flux publié indisponible, contenu statique conservé.',e);}
}
boot();
})();

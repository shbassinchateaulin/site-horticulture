const toggle=document.querySelector('.menu-toggle');const nav=document.querySelector('.main-nav');if(toggle&&nav){toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));});document.addEventListener('keydown',e=>{if(e.key==='Escape'){nav.classList.remove('open');toggle.setAttribute('aria-expanded','false')}});}

// Préparation de l'accueil dynamique : une section facultative disparaît entièrement
// lorsqu'aucun événement / aucune sortie ne lui est fourni par la future source de données.
document.querySelectorAll('[data-optional-section]').forEach(section=>{const container=section.querySelector('.optional-items');if(!container)return;const items=[...container.children].filter(item=>!item.hidden&&item.getAttribute('aria-hidden')!=='true');if(items.length===0)section.hidden=true;});

// Détails visuels de la maquette mobile : calendrier pour les actualités,
// puis repère de localisation sous chaque événement et chaque sortie.
const mobileDetails=document.createElement('style');mobileDetails.textContent=`@media(max-width:900px){
.news-grid .card time{display:flex!important;align-items:center!important;gap:5px!important;color:#737a74!important}.news-grid .card time:before{content:'▣';font-size:11px;color:#285f3b;line-height:1}
.outing-grid article>div:last-child{display:flex!important;flex-direction:column!important;justify-content:center!important}
.outing-grid h3{margin-bottom:4px!important}
.mobile-location{display:flex;align-items:center;gap:4px;font-size:8px;line-height:1.15;color:#6d746e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mobile-location:before{content:'●';font-size:7px;color:#285f3b;position:relative}.mobile-location:after{content:'';width:3px;height:3px;border:1px solid #285f3b;border-radius:50%;position:absolute;margin-left:2px;margin-top:-1px;background:#f2f0e8}
}`;document.head.appendChild(mobileDetails);

const mobileLocations={
  '.events-feature .outing-grid article:nth-child(1)':'Châteaulin (29)',
  '.events-feature .outing-grid article:nth-child(2)':'Châteaulin (29)',
  '.outings .outing-grid article:nth-child(1)':'Île de Groix (56)',
  '.outings .outing-grid article:nth-child(2)':'Finistère (29)'
};
Object.entries(mobileLocations).forEach(([selector,place])=>{const article=document.querySelector(selector);if(!article)return;const box=article.querySelector('div:last-child');if(!box||box.querySelector('.mobile-location'))return;const location=document.createElement('small');location.className='mobile-location';location.textContent=place;const title=box.querySelector('h3');if(title)title.insertAdjacentElement('afterend',location);});
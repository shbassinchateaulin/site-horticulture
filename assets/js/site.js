const toggle=document.querySelector('.menu-toggle');const nav=document.querySelector('.main-nav');if(toggle&&nav){toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));});document.addEventListener('keydown',e=>{if(e.key==='Escape'){nav.classList.remove('open');toggle.setAttribute('aria-expanded','false')}});}

// Préparation de l'accueil dynamique : une section facultative disparaît entièrement
// lorsqu'aucun événement / aucune sortie ne lui est fourni par la future source de données.
document.querySelectorAll('[data-optional-section]').forEach(section=>{const container=section.querySelector('.optional-items');if(!container)return;const items=[...container.children].filter(item=>!item.hidden&&item.getAttribute('aria-hidden')!=='true');if(items.length===0)section.hidden=true;});

// Correctif mobile final : empêche tout élément de forcer une largeur supérieure à l'écran
// tout en conservant les carrousels horizontaux prévus par la maquette.
const mobileDetails=document.createElement('style');mobileDetails.textContent=`@media(max-width:900px){
html,body{width:100%!important;max-width:100%!important;overflow-x:hidden!important}
body>*{max-width:100vw!important}
main,header,footer,section,.content,.news,.events,.upcoming,.flower-stage{max-width:100%!important;min-width:0!important}
.site-header{width:100%!important;max-width:100%!important}
.brand{min-width:0!important;max-width:calc(100% - 150px)!important}.brand-name{min-width:0!important}
.hero{width:100%!important;max-width:100vw!important}
.content{width:100%!important;max-width:100%!important}
.news{width:100%!important;min-width:0!important;max-width:100%!important}
.news-grid{width:auto!important;max-width:none!important;min-width:0!important}
.news-grid article{box-sizing:border-box!important;max-width:82vw!important;min-width:0!important}
.news-grid .card,.news-grid .pic{min-width:0!important;max-width:100%!important}
.news-grid .card time{display:flex!important;align-items:center!important;gap:5px!important;color:#737a74!important;white-space:nowrap!important;font-size:8px!important}.news-grid .card time:before{content:'▣';font-size:10px;color:#285f3b;line-height:1}
.events{width:100%!important;max-width:100%!important;min-width:0!important;overflow:hidden!important}
.events-head{min-width:0!important}.events-head h2{min-width:0!important}
.event{width:100%!important;max-width:100%!important;min-width:0!important;grid-template-columns:58px minmax(0,1fr) 15px!important;overflow:hidden!important}
.event>strong{font-size:17px!important;min-width:0!important}.event span{min-width:0!important;overflow:hidden!important}.event span b,.event span small{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
.upcoming{width:100%!important;max-width:100%!important;min-width:0!important;overflow:hidden!important}
.outing-grid{width:auto!important;max-width:none!important;min-width:0!important}
.outing-grid article{box-sizing:border-box!important;max-width:66vw!important;min-width:0!important;overflow:hidden!important}
.outing-grid article>div:last-child{display:flex!important;flex-direction:column!important;justify-content:center!important;min-width:0!important;max-width:100%!important}
.outing-grid h3{margin-bottom:4px!important;min-width:0!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
.outing-photo{max-width:100%!important;min-width:0!important}
.mobile-location{display:flex!important;align-items:center!important;gap:4px!important;font-size:8px!important;line-height:1.15!important;color:#6d746e!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important;position:relative!important;padding-left:10px!important}.mobile-location:before{content:''!important;position:absolute!important;left:1px!important;top:2px!important;width:6px!important;height:6px!important;background:#285f3b!important;border-radius:50% 50% 50% 0!important;transform:rotate(-45deg)!important}.mobile-location:after{content:''!important;position:absolute!important;left:3px!important;top:4px!important;width:2px!important;height:2px!important;background:#f2f0e8!important;border-radius:50%!important}
footer{width:100%!important;max-width:100%!important;overflow:hidden!important}
}
@media(max-width:420px){.news-grid article{max-width:82vw!important}.outing-grid article{max-width:66vw!important}}
`;document.head.appendChild(mobileDetails);

const mobileLocations={
  '.events-feature .outing-grid article:nth-child(1)':'Châteaulin (29)',
  '.events-feature .outing-grid article:nth-child(2)':'Châteaulin (29)',
  '.outings .outing-grid article:nth-child(1)':'Île de Groix (56)',
  '.outings .outing-grid article:nth-child(2)':'Finistère (29)'
};
Object.entries(mobileLocations).forEach(([selector,place])=>{const article=document.querySelector(selector);if(!article)return;const box=article.querySelector('div:last-child');if(!box||box.querySelector('.mobile-location'))return;const location=document.createElement('small');location.className='mobile-location';location.textContent=place;const title=box.querySelector('h3');if(title)title.insertAdjacentElement('afterend',location);});
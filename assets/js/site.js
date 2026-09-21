// Menu commun : bouton à droite, fermeture après navigation ou avec Échap.
(()=>{
 const header=document.querySelector('.site-header');
 const button=header?.querySelector('.menu-toggle'),nav=header?.querySelector('.main-nav');
 if(!button||!nav)return;
 button.type='button';
 if(!nav.id)nav.id='site-navigation';
 button.setAttribute('aria-controls',nav.id);
 const setOpen=open=>{
  nav.classList.toggle('open',open);
  button.setAttribute('aria-expanded',String(open));
  button.setAttribute('aria-label',open?'Fermer le menu':'Ouvrir le menu');
 };
 setOpen(false);
 button.addEventListener('click',()=>setOpen(!nav.classList.contains('open')));
 nav.addEventListener('click',e=>{if(e.target.closest('a'))setOpen(false)});
 document.addEventListener('click',e=>{if(!header.contains(e.target))setOpen(false)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('open')){setOpen(false);button.focus()}});
 window.matchMedia('(max-width:900px)').addEventListener('change',()=>setOpen(false));
})();
document.querySelectorAll('[data-optional-section]').forEach(section=>{const container=section.querySelector('.optional-items');if(!container)return;const items=[...container.children].filter(item=>!item.hidden&&item.getAttribute('aria-hidden')!=='true');if(items.length===0)section.hidden=true;});
const mobileDetails=document.createElement('style');mobileDetails.textContent=`.mobile-location,.mobile-calendar-icon{display:none}.social{display:flex!important;align-items:flex-start!important;justify-content:center!important;gap:28px!important}.social-item{display:flex!important;flex-direction:column!important;align-items:center!important;gap:7px!important;color:#fff!important;text-decoration:none!important;min-width:78px!important}.social-icon{height:30px!important;display:flex!important;align-items:center!important;justify-content:center!important}.social-item svg{display:block!important;width:27px!important;height:27px!important}.social-facebook svg{fill:#fff!important}.social-mail svg{fill:none!important;stroke:#fff!important;stroke-width:1.65!important}.social-label{font:500 9px/1.2 var(--sans)!important;letter-spacing:.02em!important;color:#e3ebe5!important;white-space:nowrap!important}.flower-cutout span{display:none!important}.news-preview{position:fixed;z-index:1000;width:430px;padding:12px;background:#fff;border:1px solid #e4e5df;border-radius:0 0 12px 12px;box-shadow:0 15px 35px rgba(18,61,41,.15);display:none;grid-template-columns:1fr 1fr;gap:10px}.news-preview.open{display:grid}.news-preview a{display:block!important;text-decoration:none!important;color:#183e2b!important;background:#f6f4ec!important;border-radius:8px!important;padding:12px!important;line-height:1.25!important}.news-preview small{display:block;color:#718076;font-size:9px;margin-bottom:5px}.news-preview strong{display:block;font:500 14px/1.2 var(--serif)}.news-grid article{cursor:pointer}.actualite-card{cursor:pointer}@media(max-width:900px){html,body{width:100%!important;max-width:100%!important;overflow-x:hidden!important}body>*{max-width:100vw!important}.social{gap:18px!important;transform:translateY(-3px)!important}.social-item{min-width:70px!important;gap:5px!important}.social-item svg{width:25px!important;height:25px!important}.social-label{font-size:8px!important}.news-preview{display:none!important}}`;document.head.appendChild(mobileDetails);
const isActualitesIndex=location.pathname.endsWith('/actualites/')||location.pathname.endsWith('/actualites/index.html');
const articleUrlFromCard=(card,fromHome=false)=>{const a=card?.querySelector('a[href]');if(!a)return null;let href=a.getAttribute('href');if(isActualitesIndex){const slug=href.replace(/\/$/,'').split('/').pop();return 'article/?id='+encodeURIComponent(slug);}if(fromHome){if(href.includes('article/?id='))return href;const slug=href.replace(/\/$/,'').split('/').pop();return 'actualites/article/?id='+encodeURIComponent(slug);}return href;};
function makeCardsClickable(root=document){root.querySelectorAll('.actualite-card').forEach(card=>{const url=articleUrlFromCard(card);if(!url)return;const a=card.querySelector('a[href]');if(a)a.href=url;card.tabIndex=0;card.setAttribute('role','link');card.addEventListener('click',e=>{if(e.target.closest('a'))return;location.href=url});card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();location.href=url}});});root.querySelectorAll('main .news .news-grid article').forEach(card=>{const a=card.querySelector('a[href]');if(!a)return;card.tabIndex=0;card.setAttribute('role','link');card.addEventListener('click',e=>{if(e.target.closest('a'))return;location.href=a.href});card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();location.href=a.href}});});}
if(isActualitesIndex)makeCardsClickable();
async function getLatestCards(){const prefix=location.pathname.includes('/actualites/')?'../':'./';const response=await fetch(prefix+'actualites/');if(!response.ok)throw new Error('Actualités indisponibles');const html=await response.text();const doc=new DOMParser().parseFromString(html,'text/html');return [...doc.querySelectorAll('.actualites-grid .actualite-card')];}
async function syncHomeLatestNews(){const grid=document.querySelector('main .news .news-grid');if(!grid||location.pathname.includes('/actualites/'))return;try{const latest=(await getLatestCards()).slice(0,3);if(!latest.length)return;grid.innerHTML='';latest.forEach(source=>{const title=source.querySelector('h2')?.textContent.trim()||'';const excerpt=source.querySelector('p')?.textContent.trim()||'';const tag=source.querySelector('.actualite-tag')?.textContent.trim()||'Actualité';const sourceLink=source.querySelector('a[href]')?.getAttribute('href')||'';const slug=sourceLink.replace(/\/$/,'').split('/').pop();const url='actualites/article/?id='+encodeURIComponent(slug);const sourcePhoto=source.querySelector('.actualite-photo');const article=document.createElement('article');const pic=document.createElement('div');pic.className='pic';if(sourcePhoto){[...sourcePhoto.classList].filter(c=>c!=='actualite-photo').forEach(c=>pic.classList.add(c.replace(/^actualite-/,'')));const inlineBg=sourcePhoto.style.backgroundImage;if(inlineBg)pic.style.backgroundImage=inlineBg;}const body=document.createElement('div');body.className='card';body.innerHTML='<time></time><h3></h3><p></p><a>Lire la suite →</a>';body.querySelector('time').textContent=tag;body.querySelector('h3').textContent=title;body.querySelector('p').textContent=excerpt;body.querySelector('a').href=url;article.append(pic,body);grid.appendChild(article);});makeCardsClickable(document);}catch(e){console.warn('Synchronisation des actualités impossible',e);}}
syncHomeLatestNews();
const actualitesLink=[...document.querySelectorAll('.main-nav a')].find(a=>a.textContent.trim()==='Actualités');
if(actualitesLink&&window.matchMedia('(min-width:901px)').matches){
 const preview=document.createElement('div');preview.className='news-preview';document.body.appendChild(preview);
 let timer;
 const place=()=>{const r=actualitesLink.getBoundingClientRect();preview.style.left=Math.max(12,Math.min(innerWidth-442,r.left-120))+'px';preview.style.top=r.bottom+'px'};
 const show=()=>{clearTimeout(timer);place();preview.classList.add('open')};
 const hide=()=>{timer=setTimeout(()=>preview.classList.remove('open'),160)};
 actualitesLink.addEventListener('mouseenter',show);actualitesLink.addEventListener('mouseleave',hide);
 preview.addEventListener('mouseenter',show);preview.addEventListener('mouseleave',hide);window.addEventListener('resize',place);
 const articleHref=id=>{const p=location.pathname;const base=p.includes('/actualites/article/')?'../':p.includes('/actualites/')?'article/':p==='/'||/\/index\.html$/.test(p)&&!p.replace(/\/index\.html$/,'').replace(/^\//,'')?'actualites/article/':'../actualites/article/';return base+'?id='+encodeURIComponent(id)};
 fetch('https://raw.githubusercontent.com/shbassinchateaulin/horticulture-contenus/main/actualites/index.json?_='+Date.now(),{cache:'no-store'})
  .then(r=>{if(!r.ok)throw new Error('index actualités indisponible');return r.json()})
  .then(data=>{
   const number=a=>Number(a.number)||Number((String(a.id||'').match(/^A0*(\d+)/i)||[])[1])||0;
   const latest=(data.articles||[]).filter(a=>a.status!=='deleted'&&a.status!=='draft'&&a.id&&a.title).sort((a,b)=>number(b)-number(a)).slice(0,2);
   preview.innerHTML='';
   latest.forEach(item=>{const a=document.createElement('a');a.href=articleHref(item.id);const strong=document.createElement('strong');strong.textContent=item.title;a.appendChild(strong);preview.appendChild(a)});
   if(!latest.length)preview.remove();
  }).catch(err=>{console.warn('Aperçu des actualités indisponible',err);preview.remove()});
}
const social=document.querySelector('.social');if(social){social.innerHTML='<a class="social-item social-mail" href="#" aria-label="Contactez-nous"><span class="social-icon"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M4 7l8 6 8-6"/></svg></span><span class="social-label">Contactez-nous</span></a><a class="social-item social-facebook" href="https://www.facebook.com/groups/5336206996506252/" target="_blank" rel="noopener noreferrer"><span class="social-icon"><svg viewBox="0 0 24 24"><path d="M13.7 22v-9h3l.45-3.5H13.7V7.25c0-1.01.28-1.7 1.74-1.7h1.86V2.42c-.32-.04-1.43-.14-2.72-.14-2.69 0-4.53 1.64-4.53 4.66V9.5H7v3.5h3.05v9h3.65z"/></svg></span><span class="social-label">Rejoignez-nous</span></a>';}
// Le footer partage le même formulaire et le même lien de contact sur toutes les pages.
(()=>{
 const script=document.currentScript;
 const siteRoot=new URL('../../',script.src);
 const contact=document.querySelector('.social-mail');
 if(contact)contact.href=new URL('contact/',siteRoot).href;
 const footer=document.querySelector('footer');
 if(!footer)return;
 let newsletter=footer.querySelector('.newsletter-footer');
 if(!newsletter){
  newsletter=document.createElement('section');
  newsletter.className='newsletter-footer';
  footer.insertBefore(newsletter,footer.querySelector('.legal'));
 }
 newsletter.setAttribute('aria-labelledby','newsletterTitle');
 newsletter.innerHTML=`
  <div><h3 id="newsletterTitle">Recevez nos actualités</h3><p>Les nouvelles de l’association, les sorties et les prochains rendez-vous, directement par e-mail.</p></div>
  <form class="newsletter-form" id="newsletterForm">
   <label class="newsletter-email-label" for="newsletterEmail">Votre adresse e-mail</label>
   <input type="email" id="newsletterEmail" name="email" autocomplete="email" placeholder="Votre adresse e-mail" required>
   <button type="submit">S’inscrire</button>
   <label class="newsletter-consent"><input type="checkbox" id="newsletterConsent" required><span>J’accepte de recevoir les actualités de l’association par e-mail.</span></label>
   <p class="newsletter-message" id="newsletterMessage" role="status" aria-live="polite"></p>
  </form>`;
 const form=newsletter.querySelector('form');
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const email=form.querySelector('#newsletterEmail'),consent=form.querySelector('#newsletterConsent');
  const message=form.querySelector('#newsletterMessage'),button=form.querySelector('button');
  if(button.disabled||!form.reportValidity()||!consent.checked)return;
  button.disabled=true;button.textContent='Inscription…';message.textContent='';
  try{
   const response=await fetch('https://script.google.com/macros/s/AKfycbz9zvJ85a62Exi2K29_H3kB4JEisRLrX29hX_y9JsHPQByo8jIPlJRkK2CRueUzLXAwEA/exec',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({email:email.value.trim(),consentement:String(consent.checked)})
   });
   if(!response.ok)throw new Error('Inscription indisponible');
   message.textContent='Merci pour votre inscription !';form.reset();
  }catch(error){
   message.textContent='La confirmation n’a pas pu être reçue. Contactez l’association si nécessaire.';
  }finally{button.disabled=false;button.textContent='S’inscrire'}
 });
})();

if(location.pathname.endsWith('/a-venir/')||location.pathname.endsWith('/a-venir/index.html')){const replaceArt=()=>{const old=document.querySelector('#panel .garden-art,#panel svg.empty-art');if(!old)return false;const img=document.createElement('img');img.className='empty-art';img.src='../assets/images/a-venir-empty.webp?v=20260917-fixed3';img.alt='';img.decoding='async';img.style.cssText='display:block;width:100%;max-width:520px;height:auto;margin:0 auto 14px;object-fit:contain';old.replaceWith(img);return true;};if(!replaceArt()){const panel=document.getElementById('panel');if(panel){const observer=new MutationObserver(()=>{if(replaceArt())observer.disconnect()});observer.observe(panel,{childList:true,subtree:true});}}}
// Accès discret à l’administration : taper A D M I N sur une page publique.
(()=>{
 if(document.getElementById('horticultureAdminAccess'))return;
 let typed='',timer,lastFocus=null;

 const projectBase=()=>{
  const parts=location.pathname.split('/').filter(Boolean);
  return parts[0]==='site-horticulture'?'/site-horticulture':'';
 };
 const adminURL=projectBase()+'/administration/';
 const api=()=>String(window.HORTICULTURE_ADMIN_API||'').replace(/\/$/,'');

 const style=document.createElement('style');
 style.textContent=`
  .admin-access[hidden]{display:none!important}
  .admin-access{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:22px}
  .admin-access-backdrop{position:absolute;inset:0;background:rgba(250,250,246,.76);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
  .admin-access-dialog{position:relative;width:min(430px,100%);padding:31px 31px 27px;border:1px solid rgba(37,71,51,.18);border-radius:13px;background:#fffdf8;box-shadow:0 24px 75px rgba(18,48,32,.2);color:#183226}
  .admin-access-close{position:absolute;right:13px;top:12px;width:35px;height:35px;border:0;border-radius:50%;background:transparent;color:#607067;font-size:24px;line-height:1;cursor:pointer}
  .admin-access-mark{margin:0 0 12px;color:#477454;font:600 9px/1.4 var(--sans);letter-spacing:.22em;text-transform:uppercase}
  .admin-access-dialog h2{margin:0;font:400 31px/1.16 var(--serif);color:#15382a}
  .admin-access-intro{margin:10px 0 21px;color:#647067;font:12px/1.6 var(--sans)}
  .admin-access-field{display:grid;gap:7px;margin:14px 0}
  .admin-access-field label{color:#2f503c;font:600 10px/1.4 var(--sans);letter-spacing:.04em}
  .admin-access-field input{width:100%;height:45px;border:1px solid #c8d4c9;border-radius:7px;background:#fff;padding:0 12px;color:#20342a;font:14px var(--sans);outline:none}
  .admin-access-field input:focus{border-color:#39704c;box-shadow:0 0 0 3px rgba(57,112,76,.1)}
  .admin-access-submit{width:100%;height:46px;margin-top:8px;border:0;border-radius:7px;background:#225d3a;color:#fff;font:600 12px var(--sans);cursor:pointer}
  .admin-access-submit:hover{background:#194d30}.admin-access-submit:disabled{opacity:.65;cursor:wait}
  .admin-access-status{min-height:18px;margin:12px 0 0;color:#6d4a41;font:11px/1.55 var(--sans)}
  .admin-access-note{margin:13px 0 0;padding-top:13px;border-top:1px solid #e0e5de;color:#7a847d;font:10px/1.5 var(--sans)}
  body.admin-access-open{overflow:hidden}
  @media(max-width:520px){.admin-access{padding:15px}.admin-access-dialog{padding:28px 21px 23px}.admin-access-dialog h2{font-size:28px}}
 `;
 document.head.appendChild(style);

 const layer=document.createElement('div');
 layer.id='horticultureAdminAccess';layer.className='admin-access';layer.hidden=true;
 layer.innerHTML=`
  <div class="admin-access-backdrop" data-admin-close></div>
  <section class="admin-access-dialog" role="dialog" aria-modal="true" aria-labelledby="adminAccessTitle" aria-describedby="adminAccessIntro">
   <button class="admin-access-close" type="button" aria-label="Fermer" data-admin-close>×</button>
   <p class="admin-access-mark">Espace réservé</p>
   <h2 id="adminAccessTitle">Administration</h2>
   <p class="admin-access-intro" id="adminAccessIntro">Connectez-vous pour accéder aux outils de gestion du site.</p>
   <form id="adminAccessForm">
    <div class="admin-access-field"><label for="adminAccessUser">Identifiant</label><input id="adminAccessUser" name="username" autocomplete="username" required></div>
    <div class="admin-access-field"><label for="adminAccessPass">Mot de passe ou code</label><input id="adminAccessPass" name="password" type="password" autocomplete="current-password" required></div>
    <button class="admin-access-submit" type="submit">Connexion</button>
    <p class="admin-access-status" id="adminAccessStatus" role="status" aria-live="polite"></p>
   </form>
   <p class="admin-access-note">L’authentification sécurisée nécessite le service d’administration privé. Aucun secret n’est stocké dans le site public.</p>
  </section>
 `;
 document.body.appendChild(layer);

 const form=layer.querySelector('#adminAccessForm'),user=layer.querySelector('#adminAccessUser'),pass=layer.querySelector('#adminAccessPass');
 const status=layer.querySelector('#adminAccessStatus'),submit=form.querySelector('button[type=submit]');
 const open=()=>{
  lastFocus=document.activeElement;layer.hidden=false;document.body.classList.add('admin-access-open');status.textContent='';
  requestAnimationFrame(()=>user.focus());
 };
 const close=()=>{
  layer.hidden=true;document.body.classList.remove('admin-access-open');pass.value='';status.textContent='';
  if(lastFocus&&typeof lastFocus.focus==='function')lastFocus.focus();
 };
 layer.querySelectorAll('[data-admin-close]').forEach(el=>el.addEventListener('click',close));
 document.addEventListener('keydown',event=>{
  if(!layer.hidden){if(event.key==='Escape'){event.preventDefault();close()}return}
  if(event.ctrlKey||event.altKey||event.metaKey||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''))return;
  if(event.key.length!==1)return;
  typed=(typed+event.key.toLowerCase()).slice(-5);clearTimeout(timer);timer=setTimeout(()=>typed='',2500);
  if(typed==='admin'){typed='';event.preventDefault();open()}
 },true);
 layer.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const focusable=[...layer.querySelectorAll('button,input')].filter(el=>!el.disabled);
  const first=focusable[0],last=focusable.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault();status.textContent='';
  if(!api()){status.textContent='Le service sécurisé n’est pas encore relié. La connexion sera activée lors de la mise en place du backend.';return}
  submit.disabled=true;submit.textContent='Connexion…';
  try{
   const response=await fetch(api()+'/login',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:user.value.trim(),password:pass.value,scope:'site-admin'})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||(response.status===401?'Identifiant ou mot de passe incorrect.':'Connexion momentanément indisponible.'));
   if(data.sessionToken)sessionStorage.setItem('horticulture_admin_session',data.sessionToken);
   if(data.user)sessionStorage.setItem('horticulture_admin_user',JSON.stringify(data.user));
   pass.value='';location.assign(adminURL);
  }catch(error){status.textContent=error.message||'Connexion impossible.'}
  finally{submit.disabled=false;submit.textContent='Connexion'}
 });
})();

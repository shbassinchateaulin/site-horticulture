const API=String(window.HORTICULTURE_ADMIN_API||'https://horticulture-admin.shbassinchateaulin.workers.dev').replace(/\/$/,'');
const $=selector=>document.querySelector(selector);
const login=$('#login'),app=$('#adminApp'),loginStatus=$('#loginStatus');
const sessionKey='horticulture_admin_session',userKey='horticulture_admin_user';
const token=()=>sessionStorage.getItem(sessionKey)||'';
const request=async(path,options={})=>{
 if(!API)throw new Error("Le service d’administration sécurisé n’est pas encore relié.");
 const headers={'Content-Type':'application/json',...(options.headers||{})};
 if(token())headers.Authorization='Bearer '+token();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 let response;
 try{response=await fetch(API+path,{credentials:'include',...options,headers,signal:controller.signal})}
 catch(error){throw new Error(controller.signal.aborted?'Le délai de connexion est dépassé. Réessayez.':error.message)}
 finally{clearTimeout(timer)}
 const data=response.status===204?null:await response.json().catch(()=>null);
 if(!response.ok)throw Object.assign(new Error(data?.error||'Erreur du service d’administration.'),{status:response.status});
 return data;
};
const permissions=user=>Array.isArray(user?.permissions)?user.permissions:[];
const can=(user,permission)=>permissions(user).includes('*')||permissions(user).includes(permission);
function applyRights(user){
 sessionStorage.setItem(userKey,JSON.stringify(user||{}));
 const membership=$('#saveMembership')?.closest('.admin-card');
 const membershipWrite=can(user,'settings.write');
 membership?.querySelectorAll('input,button').forEach(element=>element.disabled=!membershipWrite);
 if(membership&&!membershipWrite)membership.insertAdjacentHTML('beforeend','<p class="status">Consultation uniquement : votre compte ne peut pas modifier l’adhésion.</p>');
 const layout=$('#saveLayout')?.closest('.admin-card');
 const layoutWrite=can(user,'articles.layout');
 layout?.querySelectorAll('input,button').forEach(element=>element.disabled=!layoutWrite);
 if(layout&&!layoutWrite)layout.insertAdjacentHTML('beforeend','<p class="status">Votre compte ne peut pas modifier les dispositions.</p>');
}
function showApp(user){login.hidden=true;app.hidden=false;loginStatus.textContent='';applyRights(user)}
function showLogin(message=''){app.hidden=true;login.hidden=false;loginStatus.textContent=message}
const legacyLayouts=$('#layouts');for(let i=1;i<=28;i++){const n=String(i).padStart(2,'0');legacyLayouts?.insertAdjacentHTML('beforeend',`<label><input type="radio" name="layout" value="H${n}">H${n}</label>`)}
$('#loginForm').addEventListener('submit',async event=>{
 event.preventDefault();loginStatus.textContent='Connexion…';
 try{
  const data=await request('/login',{method:'POST',body:JSON.stringify({username:$('#adminUser').value.trim(),password:$('#adminPass').value,scope:'site-admin'})});
  if(data.sessionToken)sessionStorage.setItem(sessionKey,data.sessionToken);
  $('#adminPass').value='';showApp(data.user);await loadSettingsSafely();
 }catch(error){loginStatus.textContent=error.message}
});
async function loadSettingsSafely(){
 try{await loadSettings()}
 catch(error){
  $('#membershipStatus').textContent='Connexion réussie. Les réglages ne peuvent pas être chargés : '+error.message;
  $('#saveMembership').disabled=true;
  $('#removeMembership').disabled=true;
 }
}
async function loadSettings(){
 const settings=await request('/settings');
 $('#membershipYear').value=settings.membershipYear||new Date().getFullYear();
 $('#membershipPrice').value=settings.membershipPrice??20;
 $('#membershipUrl').value=settings.membershipUrl||'';
 $('#membershipButtonLabel').value=settings.membershipButtonLabel||'Adhérer en ligne';
}
$('#saveMembership').onclick=async()=>{
 const status=$('#membershipStatus');status.textContent='Enregistrement…';
 try{await request('/settings/membership',{method:'PUT',body:JSON.stringify({membershipYear:+$('#membershipYear').value,membershipPrice:+$('#membershipPrice').value,membershipUrl:$('#membershipUrl').value.trim(),membershipButtonLabel:$('#membershipButtonLabel').value.trim()})});status.textContent='Enregistré.'}
 catch(error){status.textContent=error.message}
};
$('#removeMembership').onclick=async()=>{if(!confirm('Supprimer le lien d’adhésion en ligne ?'))return;$('#membershipUrl').value='';$('#saveMembership').click()};
const legacySaveLayout=$('#saveLayout');if(legacySaveLayout)legacySaveLayout.onclick=async()=>{
 const status=$('#layoutStatus'),layout=document.querySelector('input[name=layout]:checked')?.value,id=$('#articleId').value.trim().toUpperCase();
 if(!/^A\d{7,}(?:[A-Z]{3})?$/.test(id)||!layout){status.textContent='Indiquez une actualité et une disposition.';return}
 status.textContent='Enregistrement…';
 try{await request('/articles/'+encodeURIComponent(id)+'/layout',{method:'PUT',body:JSON.stringify({layout})});status.textContent='Disposition enregistrée.'}
 catch(error){status.textContent=error.message}
};
$('#logout').onclick=async()=>{try{await request('/logout',{method:'POST'})}catch{}sessionStorage.removeItem(sessionKey);sessionStorage.removeItem(userKey);location.href='../'};
(async()=>{
 // Mode éditeur temporaire : l’authentification sera réactivée après la mise au point visuelle.
 showApp({username:'éditeur',role:'super_admin',permissions:['*']});
 if(token())await loadSettingsSafely();
})();

// Éditeur visuel contrôlé : les données sensibles restent enregistrées par le backend.
let selectedArticle='A0000003',loadedArticle=null,originalSnapshot=null;
const modelSelect=$('#modelSelect'),modelPreview=$('#modelPreview'),articleEditor=$('#articleEditor'),membershipEditor=$('#membershipEditor');
const undoAll=document.createElement('button');undoAll.className='btn secondary';undoAll.id='undoAll';undoAll.textContent='Annuler les modifications';$('#saveAll')?.after(undoAll);
for(let i=1;i<=28;i++){const id='H'+String(i).padStart(2,'0');modelSelect?.insertAdjacentHTML('beforeend',`<option value="${id}">${id}${id==='H28'?' — sans photo':''}</option>`);modelPreview?.insertAdjacentHTML('beforeend',`<div class="model" data-model="${id}"><div class="model-shape"></div>${id}</div>`)}
function markDirty(){if($('#editorState'))$('#editorState').textContent='Modifications non enregistrées'}
async function selectArticle(id){selectedArticle=id;articleEditor.hidden=false;membershipEditor.hidden=true;$('#inspectorTitle').textContent='Mise en page de l’actualité';$('#breadcrumb').textContent='Pages › Actualités › '+id;$('#editorTitle').value='';$('#editorText').value='';modelSelect.value='H28';markDirty();try{const r=await fetch('https://raw.githubusercontent.com/shbassinchateaulin/horticulture-contenus/main/actualites/'+encodeURIComponent(id)+'/contenu.json');if(!r.ok)throw new Error('article');const a=await r.json();loadedArticle=a;originalSnapshot={title:a.title||'',text:a.text||a.body||a.content||a.paragraphs?.map(p=>typeof p==='string'?p:p.text||'').join('\n\n')||a.summary||'',layout:a.layoutCode||a.layout||((a.photos||[]).length?'H04':'H28')};$('#editorTitle').value=originalSnapshot.title;$('#editorText').value=originalSnapshot.text;modelSelect.value=originalSnapshot.layout;document.querySelectorAll('.model').forEach(x=>x.classList.toggle('active',x.dataset.model===modelSelect.value));refreshArticlePreview()}catch(error){console.warn('Contenu de l’actualité indisponible',error)}}
function selectPage(page){articleEditor.hidden=true;membershipEditor.hidden=page!=='membership';$('#inspectorTitle').textContent=page==='membership'?'Modifier l’adhésion':'Modifier la page';$('#breadcrumb').textContent='Pages › '+page.charAt(0).toUpperCase()+page.slice(1);document.querySelectorAll('.tree-item').forEach(x=>x.classList.toggle('active',x.dataset.page===page));markDirty()}
document.querySelectorAll('[data-article]').forEach(el=>el.addEventListener('click',()=>{document.querySelectorAll('.tree-item').forEach(x=>x.classList.remove('active'));el.classList.add('active');selectArticle(el.dataset.article)}));
document.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',()=>{selectPage(el.dataset.page);const map={home:'',news:'actualites/',calendar:'a-venir/',outings:'sorties/',association:'association/',membership:'adhesion/',contact:'contact/',suggestions:'suggestions/',retro:'retrospective/'};if(map[el.dataset.page]!==undefined)openLivePage(map[el.dataset.page])}));
modelPreview?.addEventListener('click',e=>{const item=e.target.closest('[data-model]');if(!item)return;modelSelect.value=item.dataset.model;document.querySelectorAll('.model').forEach(x=>x.classList.toggle('active',x===item));refreshArticlePreview();markDirty()});modelSelect?.addEventListener('change',()=>{document.querySelectorAll('.model').forEach(x=>x.classList.toggle('active',x.dataset.model===modelSelect.value));refreshArticlePreview();markDirty()});
$('#editorTitle')?.addEventListener('input',markDirty);$('#editorText')?.addEventListener('input',markDirty);
$('#saveAll')?.addEventListener('click',async()=>{const status=$('#layoutStatus');if(!selectedArticle){status.textContent='Sélectionnez une actualité.';return}status.textContent='Enregistrement…';try{await request('/articles/'+encodeURIComponent(selectedArticle)+'/layout',{method:'PUT',body:JSON.stringify({layout:modelSelect.value})});status.textContent='Modifications enregistrées.';$('#editorState').textContent='Toutes les modifications sont enregistrées'}catch(error){status.textContent=error.message}});
undoAll.addEventListener('click',()=>{if(!originalSnapshot)return;$('#editorTitle').value=originalSnapshot.title;$('#editorText').value=originalSnapshot.text;modelSelect.value=originalSnapshot.layout;refreshArticlePreview();markDirty();$('#layoutStatus').textContent='Modifications annulées.'});
selectArticle(selectedArticle);

async function buildPageTree(){const tree=document.querySelector('.page-tree');if(!tree)return;tree.innerHTML='<div class="tree-title">Pages du site <span>⌕</span></div><div class="tree-group">Pages principales</div><div class="tree-item active" data-page="home">⌂ &nbsp;Accueil</div>';const groups=[['news','Actualités'],['calendar','À venir'],['outings','Sorties'],['retro','Rétrospective']];for(const [key,label] of groups){const folder=document.createElement('div');folder.className='tree-folder';folder.innerHTML='<button class="tree-folder-toggle" type="button" aria-expanded="'+(key==='news'?'true':'false')+'" data-toggle-folder="'+key+'">'+(key==='news'?'⌄':'›')+'</button><div class="tree-item" data-page="'+key+'">'+label+'</div><div class="tree-sub" id="'+key+'Children" '+(key==='news'?'':'hidden')+'></div>';tree.appendChild(folder)}tree.insertAdjacentHTML('beforeend','<div class="tree-item" data-page="association">♧ &nbsp;L’association</div><div class="tree-item" data-page="membership">▤ &nbsp;Adhésion</div><div class="tree-item" data-page="contact">✉ &nbsp;Contact</div><div class="tree-item" data-page="suggestions">◌ &nbsp;Suggestions</div>');const news=document.getElementById('newsChildren');try{const r=await fetch('https://raw.githubusercontent.com/shbassinchateaulin/horticulture-contenus/main/actualites/index.json');const data=await r.json();(data.articles||[]).filter(a=>a.status!=='deleted'&&a.status!=='draft').sort((a,b)=>(Number(b.number)||0)-(Number(a.number)||0)).forEach(a=>{const item=document.createElement('div');item.className='tree-item';item.dataset.article=a.id;item.textContent='↪  '+(a.title||a.id);news.appendChild(item);item.addEventListener('click',()=>{document.querySelectorAll('.tree-item').forEach(x=>x.classList.remove('active'));item.classList.add('active');selectArticle(a.id)})})}catch(error){news.innerHTML='<div class="tree-empty">Actualités indisponibles</div>'}tree.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',()=>selectPage(el.dataset.page)));tree.querySelectorAll('[data-toggle-folder]').forEach(btn=>btn.addEventListener('click',()=>{const box=document.getElementById(btn.dataset.toggleFolder+'Children');const open=box.hidden;box.hidden=!open;btn.setAttribute('aria-expanded',String(open));btn.textContent=open?'⌄':'›'}))}
buildPageTree();
document.querySelector('.page-tree')?.addEventListener('click',e=>{if(e.target.closest('[data-article]'))setTimeout(refreshArticlePreview,0)});
function refreshArticlePreview(){if(!selectedArticle)return;const frame=$('#siteFrame');if(!frame)return;const apply=()=>{try{const article=loadedArticle?{...loadedArticle,layoutCode:modelSelect.value}:null;if(article&&frame.contentWindow.ArticleLayouts){frame.contentWindow.ArticleLayouts.render(frame.contentDocument.getElementById('articleRoot'),article)}}catch(error){console.warn('Aperçu de disposition indisponible',error)}};if(frame.contentDocument?.getElementById('articleRoot'))apply();else frame.addEventListener('load',apply,{once:true});frame.src='../actualites/article/?id='+encodeURIComponent(selectedArticle)}
function openLivePage(path){const frame=$('#siteFrame');if(!frame)return;frame.addEventListener('load',()=>{if(loadedArticle)updateCompatibleModels(loadedArticle)}, {once:true});frame.src=new URL('../'+path,document.baseURI).href}
document.querySelectorAll('[data-article]').forEach(el=>el.addEventListener('click',()=>{document.querySelectorAll('.tree-item').forEach(x=>x.classList.remove('active'));el.classList.add('active');selectArticle(el.dataset.article);refreshArticlePreview()}));

function updateCompatibleModels(article){const win=$('#siteFrame')?.contentWindow;const registry=win?.ArticleLayouts?.registry;if(!registry)return;const text=String(article.text||article.body||article.content||article.summary||'');const sentences=Math.max(1,(text.match(/[.!?]+/g)||[]).length);const photos=Array.isArray(article.photos)?article.photos.length:Number(article.uploadedPhotoCount||article.expectedPhotoCount||0)||(article.cover?1:0);[...modelSelect.options].forEach(option=>{const d=registry[option.value];const ok=d&&photos>=d.minPhotos&&photos<=d.maxPhotos&&sentences>=d.minSentences&&(option.value!=='H28'||photos===0);option.hidden=!ok;option.disabled=!ok});if(![...modelSelect.options].some(o=>!o.disabled)){[...modelSelect.options].forEach(o=>{o.hidden=false;o.disabled=false})}if(modelSelect.selectedOptions[0]?.disabled){const first=[...modelSelect.options].find(o=>!o.disabled);if(first)modelSelect.value=first.value}}
let articleIndexCache=null;
async function selectArticle(id){articleEditor.hidden=false;membershipEditor.hidden=true;const requested=String(id).toUpperCase();try{if(!articleIndexCache){const ir=await fetch('https://raw.githubusercontent.com/shbassinchateaulin/horticulture-contenus/main/actualites/index.json');articleIndexCache=await ir.json()}const list=articleIndexCache.articles||[];const numeric=(requested.match(/^A0*(\d+)/)||[])[1];const meta=list.find(a=>a.id===requested||String(a.number)===numeric)||{};const canonical=meta.id||requested;selectedArticle=canonical;$('#inspectorTitle').textContent='Mise en page de l’actualité';$('#breadcrumb').textContent='Pages › Actualités › '+canonical;openLivePage('actualites/article/?id='+encodeURIComponent(canonical));const draft=drafts[canonical]||drafts[requested];if(draft){$('#editorTitle').value=draft.title||meta.title||'';$('#editorText').value=draft.text||meta.summary||'';modelSelect.value=draft.layout||meta.layoutCode||'H28';renderDraftPreview();return}$('#editorTitle').value=meta.title||'';$('#editorText').value=meta.summary||'';modelSelect.value=meta.layoutCode||'H28';document.querySelectorAll('.model').forEach(x=>x.classList.toggle('active',x.dataset.model===modelSelect.value));const r=await fetch('https://raw.githubusercontent.com/shbassinchateaulin/horticulture-contenus/main/actualites/'+encodeURIComponent(canonical)+'/contenu.json');if(r.ok){const a=await r.json();loadedArticle=a;const text=a.text||a.body||a.content||a.paragraphs?.map(p=>typeof p==='string'?p:p.text||'').join('\n\n')||meta.summary||'';$('#editorTitle').value=a.title||meta.title||'';$('#editorText').value=text;modelSelect.value=a.layoutCode||a.layout||meta.layoutCode||'H28';updateCompatibleModels(a)}markDirty()}catch(error){console.warn('Actualité indisponible',error)}}

// Brouillons locaux : les changements restent disponibles pendant toute la session d’édition.
const draftKey='horticulture_admin_drafts_v1';let drafts=JSON.parse(localStorage.getItem(draftKey)||'{}');
const saveDrafts=()=>localStorage.setItem(draftKey,JSON.stringify(drafts));
const currentDraft=()=>drafts[selectedArticle]||null;
const captureDraft=()=>{if(!selectedArticle)return;drafts[selectedArticle]={...(drafts[selectedArticle]||{}),title:$('#editorTitle')?.value||'',text:$('#editorText')?.value||'',layout:modelSelect?.value||'H28'};saveDrafts();markDirty()};
function renderDraftPreview(){const frame=$('#siteFrame'),draft=currentDraft();if(!frame||!draft)return;const paint=async()=>{try{const win=frame.contentWindow,root=frame.contentDocument?.getElementById('articleRoot');if(!root||!win?.HorticultureContent||!win.ArticleLayouts)return;const article=await win.HorticultureContent.article(selectedArticle);Object.assign(article,{title:draft.title,text:draft.text,layoutCode:draft.layout});win.ArticleLayouts.render(root,article)}catch(error){console.warn('Aperçu local indisponible',error)}};if(frame.contentDocument?.getElementById('articleRoot'))paint();else frame.addEventListener('load',paint,{once:true})}
function refreshArticlePreview(){renderDraftPreview()}
function selectArticleWithDraft(id){selectedArticle=id;articleEditor.hidden=false;membershipEditor.hidden=true;const draft=drafts[id];if(draft){$('#editorTitle').value=draft.title||'';$('#editorText').value=draft.text||'';modelSelect.value=draft.layout||'H28';document.querySelectorAll('.model').forEach(x=>x.classList.toggle('active',x.dataset.model===modelSelect.value));renderDraftPreview();return}selectArticle(id)}
$('#editorTitle')?.addEventListener('input',()=>{captureDraft();renderDraftPreview()});$('#editorText')?.addEventListener('input',()=>{captureDraft();renderDraftPreview()});modelSelect?.addEventListener('change',()=>{captureDraft();renderDraftPreview()});
document.querySelector('.page-tree')?.addEventListener('click',e=>{const item=e.target.closest('[data-article]');if(item){setTimeout(()=>selectArticleWithDraft(item.dataset.article),0)}});
document.querySelector('.page-tree')?.addEventListener('click',e=>{const article=e.target.closest('[data-article]');if(article){openLivePage('actualites/article/?id='+encodeURIComponent(article.dataset.article));setTimeout(renderDraftPreview,500);return}const page=e.target.closest('[data-page]');if(page){const map={home:'',news:'actualites/',calendar:'a-venir/',outings:'sorties/',association:'association/',membership:'adhesion/',contact:'contact/',suggestions:'suggestions/',retro:'retrospective/'};if(map[page.dataset.page]!==undefined)openLivePage(map[page.dataset.page])}});
$('#undoAll')?.addEventListener('click',()=>{drafts={};saveDrafts();location.reload()});

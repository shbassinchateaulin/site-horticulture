const API=String(window.HORTICULTURE_ADMIN_API||'https://horticulture-admin.shbassinchateaulin.workers.dev').replace(/\/$/,'');
const $=selector=>document.querySelector(selector);
const login=$('#login'),app=$('#adminApp'),loginStatus=$('#loginStatus');
const sessionKey='horticulture_admin_session',userKey='horticulture_admin_user';
const token=()=>sessionStorage.getItem(sessionKey)||'';
const request=async(path,options={})=>{
 if(!API)throw new Error("Le service d’administration sécurisé n’est pas encore relié.");
 const headers={'Content-Type':'application/json',...(options.headers||{})};
 if(token())headers.Authorization='Bearer '+token();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),70000);
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
for(let i=1;i<=28;i++){const n=String(i).padStart(2,'0');$('#layouts').insertAdjacentHTML('beforeend',`<label><input type="radio" name="layout" value="H${n}">H${n}</label>`)}
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
$('#saveLayout').onclick=async()=>{
 const status=$('#layoutStatus'),layout=document.querySelector('input[name=layout]:checked')?.value,id=$('#articleId').value.trim().toUpperCase();
 if(!/^A\d{7,}(?:[A-Z]{3})?$/.test(id)||!layout){status.textContent='Indiquez une actualité et une disposition.';return}
 status.textContent='Enregistrement…';
 try{await request('/articles/'+encodeURIComponent(id)+'/layout',{method:'PUT',body:JSON.stringify({layout})});status.textContent='Disposition enregistrée.'}
 catch(error){status.textContent=error.message}
};
$('#logout').onclick=async()=>{try{await request('/logout',{method:'POST'})}catch{}sessionStorage.removeItem(sessionKey);sessionStorage.removeItem(userKey);location.reload()};
(async()=>{
 if(!API){showLogin("Le backend sécurisé doit encore être déployé et relié.");return}
 if(!token()){showLogin();return}
 try{const data=await request('/session');showApp(data.user);await loadSettingsSafely()}
 catch(error){if(error.status===401){sessionStorage.removeItem(sessionKey);sessionStorage.removeItem(userKey)}showLogin(error.status===401?'Votre session a expiré. Reconnectez-vous.':error.message)}
})();

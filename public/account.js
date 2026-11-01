(()=>{
 const api=SATClient.api,loc=(ru,uz,en)=>({ru,uz,en}[SATClient.lang()]||en),escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const email=`<label>Email<input type="email" name="email" autocomplete="email" required maxlength="254"></label>`;
 const password=()=>`<label>${loc('Новый пароль — от 10 символов','Yangi parol — kamida 10 belgi','New password — at least 10 characters')}<input name="password" type="password" minlength="10" maxlength="128" autocomplete="new-password" required></label>`;
 const submit=(form,fn)=>{form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button'),status=form.querySelector('[role=status]');button.disabled=true;try{await fn(Object.fromEntries(new FormData(form)),status);}catch(error){status.textContent=SATI18N.error(error);}finally{button.disabled=false;}};};
 window.SATAccount={async render(page,id,user,features){
  if(!['recover','reset','verify','security'].includes(page))return false;
  const root=document.querySelector('#hub');
  root.innerHTML=`<section class="hub-card auth-card"><h1>${loc('Безопасность аккаунта','Akkaunt xavfsizligi','Account security')}</h1><div id="account-content"></div><p><a class="linklike" href="#${user?'':'login'}">${loc('Назад','Orqaga','Back')}</a></p></section>`;
  const content=root.querySelector('#account-content');
  if(page==='verify'){
   content.innerHTML=`<p>${loc('Подтверди адрес электронной почты.','Email manzilingizni tasdiqlang.','Confirm your email address.')}</p><form><button class="btn primary">${loc('Подтвердить','Tasdiqlash','Confirm')}</button><p role="status"></p></form>`;
   submit(content.querySelector('form'),async(_,status)=>{await api('/auth/verify','POST',{token:id});status.textContent=loc('Почта подтверждена.','Email tasdiqlandi.','Email confirmed.');});return true;
  }
  if(page==='reset'){
   content.innerHTML=`<form class="hub-form">${password()}<button class="btn primary">${loc('Изменить пароль','Parolni o‘zgartirish','Change password')}</button><p role="status"></p></form>`;
   submit(content.querySelector('form'),async(d,status)=>{await api('/auth/reset','POST',{...d,token:id});localStorage.removeItem('sat_session');localStorage.removeItem('sat_user_id');status.textContent=loc('Пароль изменён. Войди заново.','Parol o‘zgardi. Qayta kiring.','Password changed. Sign in again.');});return true;
  }
  if(page==='recover'){
   content.innerHTML=`<h2>${loc('Восстановить доступ','Kirishni tiklash','Recover access')}</h2><p>${loc('Используй сохранённый код восстановления. После смены пароля все старые сеансы завершатся.','Saqlangan tiklash kodidan foydalaning. Parol o‘zgarsa, eski seanslar tugaydi.','Use your saved recovery code. Changing the password invalidates existing sessions.')}</p><form id="recover-code" class="hub-form">${email}<label>${loc('Код восстановления','Tiklash kodi','Recovery code')}<input name="code" required minlength="48" maxlength="48" autocomplete="off" spellcheck="false"></label>${password()}<button class="btn primary">${loc('Восстановить','Tiklash','Recover')}</button><p role="status"></p></form>${features.email?`<hr><h2>${loc('Или получить ссылку по email','Yoki email orqali havola olish','Or request an email link')}</h2><form id="recover-email" class="hub-form">${email}<button class="btn secondary">${loc('Отправить ссылку','Havola yuborish','Send link')}</button><p role="status"></p></form>`:''}`;
   submit(content.querySelector('#recover-code'),async(d,status)=>{await api('/auth/reset','POST',d);localStorage.removeItem('sat_session');localStorage.removeItem('sat_user_id');status.textContent=loc('Готово. Войди с новым паролем. Код использован — после входа создай новый.','Tayyor. Yangi parol bilan kiring va yangi tiklash kodi yarating.','Done. Sign in with your new password, then generate a new recovery code.');});
   if(features.email)submit(content.querySelector('#recover-email'),async(d,status)=>{await api('/auth/forgot','POST',d);status.textContent=loc('Если аккаунт существует, ссылка отправлена. Проверь также спам.','Akkaunt mavjud bo‘lsa, havola yuborildi. Spamni ham tekshiring.','If the account exists, a link has been sent. Check spam too.');});return true;
  }
  if(!user){location.hash='login';return true;}
  content.innerHTML=`<p>${escape(user.email)} · ${user.emailVerified?loc('Подтверждён','Tasdiqlangan','Verified'):loc('Не подтверждён','Tasdiqlanmagan','Unverified')}</p>${features.email&&!user.emailVerified?`<form id="verify-email"><button class="btn secondary">${loc('Подтвердить почту','Emailni tasdiqlash','Verify email')}</button><p role="status"></p></form>`:''}<h2>${loc('Код восстановления','Tiklash kodi','Recovery code')}</h2><p>${loc('Сохрани код отдельно от пароля. Он позволит восстановить аккаунт. Создание нового кода отменяет предыдущий.','Kodni paroldan alohida saqlang. U akkauntni tiklashga yordam beradi. Yangi kod eskisini bekor qiladi.','Keep the code separate from your password. It can recover your account. A new code replaces the previous one.')}</p><form id="create-code"><button class="btn primary">${loc('Создать новый код','Yangi kod yaratish','Generate new code')}</button><p role="status" class="recovery-code"></p></form>`;
  submit(content.querySelector('#create-code'),async(_,status)=>{const r=await api('/auth/recovery-code','POST',{});status.textContent=r.code;});
  if(features.email&&!user.emailVerified)submit(content.querySelector('#verify-email'),async(_,status)=>{await api('/auth/send-verification','POST',{});status.textContent=loc('Ссылка отправлена на твою почту.','Emailingizga havola yuborildi.','A link was sent to your email.');});return true;
 }};
})();

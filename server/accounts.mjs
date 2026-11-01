import {randomBytes,createHash,scrypt as scryptCallback} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
const hash=v=>createHash('sha256').update(v).digest('hex');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export function accountService(store,env={}) {
 const mailReady=!!(env.RESEND_API_KEY&&env.MAIL_FROM&&env.FRONTEND_URL);
 async function send(email,kind,token) {
  if(!mailReady)fail(503,'MAIL_NOT_CONFIGURED');
  const url=new URL('hub.html',env.FRONTEND_URL);url.hash=kind+'/'+token;
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:env.MAIL_FROM,to:[email],subject:kind==='verify'?'SAT: confirm your email':'SAT: reset your password',text:`${kind==='verify'?'Confirm your email':'Reset your password'}: ${url.href}\nThis link expires in 30 minutes. If you did not request this, ignore this email.`}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)fail(503,'MAIL_UNAVAILABLE');
 }
 async function recovery(user) {
  if(user.guest)fail(401,'LOGIN_REQUIRED');
  const code=randomBytes(24).toString('hex');
  await store.change('users',user.id,u=>({...u,recoveryHash:hash(code)}));
  return {code};
 }
 async function start(email,kind) {
  if(!mailReady)fail(503,'MAIL_NOT_CONFIGURED');
  const normalized=String(email||'').trim().toLowerCase();
  const user=(await store.list('users',{email:normalized,guest:false}))[0];
  if(!user)return {ok:true};
  const token=randomBytes(32).toString('hex'),key=kind==='verify'?'verifyToken':'resetToken';
  await store.change('users',user.id,u=>({...u,[key]:{hash:hash(token),expires:Date.now()+1800000}}));
  try {await send(user.email,kind,token);}catch(e){await store.change('users',user.id,u=>u[key]?.hash===hash(token)?{...u,[key]:null}:u);throw e;}
  return {ok:true};
 }
 async function verify(token) {
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))fail(400,'INVALID_LINK');
  const digest=hash(token),user=(await store.list('users')).find(u=>u.verifyToken?.hash===digest&&u.verifyToken.expires>Date.now());
  if(!user)fail(400,'INVALID_LINK');
  await store.change('users',user.id,u=>{if(u.verifyToken?.hash!==digest||u.verifyToken.expires<=Date.now())fail(400,'INVALID_LINK');return {...u,emailVerified:true,verifyToken:null};});
  return {ok:true};
 }
 async function reset({email,code,token,password}) {
  if(typeof password!=='string'||password.length<10||password.length>128)fail(400,'INVALID_PASSWORD');
  const byCode=typeof code==='string'&&/^[a-f0-9]{48}$/.test(code.trim());
  const byToken=typeof token==='string'&&/^[a-f0-9]{64}$/.test(token);
  if(!byCode&&!byToken)fail(400,'INVALID_RECOVERY');
  const digest=hash(byCode?code.trim():token);
  const user=byCode?(await store.list('users',{email:String(email||'').trim().toLowerCase(),guest:false}))[0]:(await store.list('users')).find(u=>u.resetToken?.hash===digest);
  const matches=u=>!!u&&!u.guest&&(byCode?u.recoveryHash===digest:u.resetToken?.hash===digest&&u.resetToken.expires>Date.now());
  if(!matches(user))fail(400,'INVALID_RECOVERY');
  const salt=randomBytes(16).toString('hex'),key=(await scrypt(password,salt,64)).toString('hex');
  await store.change('users',user.id,u=>{if(!matches(u))fail(400,'INVALID_RECOVERY');return {...u,password:salt+':'+key,authVersion:(u.authVersion||0)+1,recoveryHash:null,resetToken:null};});
  return {ok:true};
 }
 return {mailReady,recovery,start,verify,reset};
}

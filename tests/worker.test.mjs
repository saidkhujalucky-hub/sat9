import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions,Response as MFResponse} from 'miniflare';
import {readFileSync} from 'node:fs';

test('Cloudflare runtime: D1 init, duplicate email, training, exam protection, recovery, and session invalidation',async()=>{
 const outboundService=async request=>{
  assert.equal(new URL(request.url).hostname,'qbank-api.collegeboard.org');
  return new MFResponse(JSON.stringify({type:'mcq',stem:'TEST FIXTURE: choose A',stimulus:'TEST FIXTURE',answerOptions:['A','B','C','D'].map(content=>({content})),correct_answer:['A'],rationale:'TEST FIXTURE'}),{headers:{'Content-Type':'application/json'}});
 };
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:readFileSync(new URL('../dist/worker/index.js',import.meta.url),'utf8'),compatibilityDate:'2026-10-30',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{PAYMENT_MODE:'manual',NODE_ENV:'test'},outboundService}));
 const request=async(path,method='GET',data,token='')=>{const r=await mf.dispatchFetch('https://sat.test/api'+path,{method,headers:{'Content-Type':'application/json','CF-Connecting-IP':'127.0.0.1',...(token?{Authorization:'Bearer '+token}:{})},body:data===undefined?undefined:JSON.stringify(data)});const text=await r.text();let value;try{value=JSON.parse(text);}catch{throw Error(path+": "+text);}return {status:r.status,data:value};};
 try{
  assert.equal((await request('/health')).data.database,'d1');
  const registration={email:'learner@example.test',name:'Learner',password:'correct-password-123'};
  const r=await request('/auth/register','POST',registration);assert.equal(r.status,201,JSON.stringify(r.data));const token=r.data.token;
  assert.equal((await request('/auth/register','POST',registration)).status,409);
  const ls=await request('/lessons','GET',undefined,token);assert.equal(ls.data.length,30);assert.equal(ls.data.filter(l=>!l.locked).length,2);assert.ok(ls.data.every(l=>!l.practice));
  const catalog=(await request('/catalog','GET',undefined,token)).data;
  const qid=catalog.variants[0].sections.rw.mixed[0].id;
  const exam=(await request('/exams','POST',{variant:1,mode:'exam'},token)).data;
  const training=(await request('/exams','POST',{variant:1,mode:'training'},token)).data;assert.notEqual(exam.id,training.id);
  assert.equal((await request('/translations/exams/'+exam.id+'/'+qid,'POST',{lang:'ru'},token)).status,403);
  const q=await request('/exams/'+training.id+'/question/'+qid,'GET',undefined,token);assert.equal(q.status,200);assert.equal(q.data.answers,undefined);
  assert.equal((await request('/translations/exams/'+training.id+'/'+qid,'POST',{lang:'ru',explanation:true},token)).status,403);
  const db=(await mf.getBindings()).DB;await db.prepare("UPDATE documents SET body=json_set(body,'$.endsAt',0) WHERE collection='exams' AND id=?").bind(training.id).run();
  assert.equal((await request('/exams/'+training.id+'/state','PUT',{index:0,answers:{[qid]:'A'}},token)).status,200);
  let current=training;
  for(let index=0;index<4;index++){
   if(current.stage==='break')current=(await request('/exams/'+training.id+'/continue','POST',{},token)).data;
   const section=index<2?'rw':'math',branch=index%2?current.routing[section]:'mixed';
   const refs=catalog.variants[0].sections[section][branch];
   const saved=await request('/exams/'+training.id+'/state','PUT',{index,answers:Object.fromEntries(refs.map(q=>[q.id,'A']))},token);assert.equal(saved.status,200);
   const finished=await request('/exams/'+training.id+'/finish','POST',{index},token);assert.equal(finished.status,200,JSON.stringify(finished.data));current=finished.data;
  }
  assert.equal(current.stage,'done');
  const history=await request('/progress','GET',undefined,token);assert.equal(history.data.history.find(a=>a.id===training.id).total,98);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM documents WHERE collection='events'").first()).n,98);
  assert.deepEqual((await request('/exams/'+training.id+'/question/'+qid,'GET',undefined,token)).data.answers,['A']);
  const code=(await request('/auth/recovery-code','POST',{},token)).data.code;
  assert.equal((await request('/auth/reset','POST',{email:registration.email,code,password:'replacement-password-123'})).status,200);
  assert.equal((await request('/auth/me','GET',undefined,token)).status,401);
  assert.equal((await request('/auth/reset','POST',{email:registration.email,code,password:'replacement-password-123'})).status,400);
  assert.equal((await request('/auth/login','POST',{email:registration.email,password:registration.password})).status,401);
  assert.equal((await request('/auth/login','POST',{email:registration.email,password:'replacement-password-123'})).status,200);
 }finally{await mf.dispose();}
});

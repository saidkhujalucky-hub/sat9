import test from 'node:test';
import assert from 'node:assert/strict';
import {accountService} from '../server/accounts.mjs';
import {translationService} from '../server/translation.mjs';
import {lessons} from '../server/content.mjs';
import {catalog,lessonForRef,questionService} from '../server/questions.mjs';
const memory=()=>{const docs=new Map();return {get:async(n,id)=>structuredClone(docs.get(n+':'+id)||null),list:async(n,filter={})=>[...docs.entries()].filter(([key,v])=>key.startsWith(n+':')&&Object.entries(filter).every(([k,x])=>v[k]===x)).map(([,v])=>structuredClone(v)),insert:async(n,v)=>{assert.ok(!docs.has(n+':'+v.id));docs.set(n+':'+v.id,structuredClone(v));return v;},change:async(n,id,fn)=>{const key=n+':'+id;if(!docs.has(key))return null;const next=fn(structuredClone(docs.get(key)));docs.set(key,next);return structuredClone(next);}};};

test('every catalog topic has a localized lesson, worked example, and practice',()=>{
 const unique=new Set();
 for(const v of catalog.variants)for(const section of Object.values(v.sections))for(const branch of Object.values(section))for(const q of branch){const id=lessonForRef(q);assert.ok(id,q.topic);unique.add(q.topic.trim());assert.ok(lessons.some(l=>l.id===id));}
 assert.equal(unique.size,29);assert.equal(new Set(lessons.map(l=>l.id)).size,30);
 for(const l of lessons){for(const lang of ['ru','uz','en']){assert.ok(l.title[lang]);assert.ok(l.explain[lang].length>40);assert.ok(l.rules[lang].length);assert.ok(l.example[lang].length>=2);assert.ok(l.mistakes[lang].length);assert.ok(l.practice.explanation[lang]);}assert.equal(l.practice.options.length,4);assert.ok(l.practice.answer>=0&&l.practice.answer<4);}
});
test('recovery is single use, revokes existing auth versions, and rotating invalidates the old code',async()=>{
 const store=memory();await store.insert('users',{id:'u',email:'u@example.test',guest:false,password:'old'});const accounts=accountService(store);
 const first=await accounts.recovery({id:'u'}),second=await accounts.recovery({id:'u'});
 const reset=code=>accounts.reset({email:'u@example.test',code,password:'new-password-123'});
 await assert.rejects(reset(first.code),/INVALID_RECOVERY/);
 await assert.rejects(accounts.reset({email:'other@example.test',code:second.code,password:'new-password-123'}),/INVALID_RECOVERY/);
 const races=await Promise.allSettled([reset(second.code),reset(second.code)]);assert.equal(races.filter(r=>r.status==='fulfilled').length,1);
 const user=await store.get('users','u');assert.equal(user.authVersion,1);assert.equal(user.recoveryHash,null);assert.notEqual(user.password,'old');await assert.rejects(reset(second.code),/INVALID_RECOVERY/);
 await assert.rejects(accounts.start('u@example.test','verify'),/MAIL_NOT_CONFIGURED/);
});
test('email verification and password links expire and cannot be replayed',async()=>{
 const store=memory();await store.insert('users',{id:'u',email:'u@example.test',guest:false});
 const previous=globalThis.fetch;const sent=[];
 globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');sent.push(JSON.parse(options.body));return new Response('{}');};
 try{
  const accounts=accountService(store,{RESEND_API_KEY:'test-only',MAIL_FROM:'test@example.test',FRONTEND_URL:'https://example.test/SAT/'});
  await accounts.start('missing@example.test','reset');assert.equal(sent.length,0);
  await accounts.start('u@example.test','verify');const token=sent[0].text.match(/#verify\/([a-f0-9]+)/)[1];
  assert.equal((await accounts.verify(token)).ok,true);assert.equal((await store.get('users','u')).emailVerified,true);await assert.rejects(accounts.verify(token),/INVALID_LINK/);
  await accounts.start('u@example.test','reset');const reset=sent[1].text.match(/#reset\/([a-f0-9]+)/)[1];await store.change('users','u',u=>({...u,resetToken:{...u.resetToken,expires:0}}));await assert.rejects(accounts.reset({token:reset,password:'new-password-123'}),/INVALID_RECOVERY/);
 }finally{globalThis.fetch=previous;}
});
test('translation is opt in, cached, and question translation does not contain answers or explanation',async()=>{
 const store=memory(),q={id:'q',passage:'A passage',prompt:'A prompt',options:[{letter:'A',html:'Choice'}],answers:['A'],explanation:'SECRET ANSWER'};
 await assert.rejects(translationService(store,{}).translate(q,'ru'),/TRANSLATION_NOT_CONFIGURED/);
 const calls=[],env={AI:{run:async(model,input)=>{calls.push(input);return {translated_text:'Перевод '+input.text};}}};
 const service=translationService(store,env),result=await service.translate(q,'ru');assert.equal(result.parts.length,3);assert.ok(!JSON.stringify(calls).includes('SECRET ANSWER'));const count=calls.length;await service.translate(q,'ru');assert.equal(calls.length,count);
 await service.translate(q,'uz',true);assert.ok(calls.some(c=>c.text==='SECRET ANSWER'));await assert.rejects(service.translate(q,'fr'),/INVALID_LANGUAGE/);
});
test('official questions reuse persistent cache after an upstream outage',async()=>{
 const store=memory(),id=catalog.variants[0].sections.rw.mixed[0].id,previous=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({type:'mcq',stem:'Original question',stimulus:'Original passage',answerOptions:['One','Two','Three','Four'].map(content=>({content})),correct_answer:['A'],rationale:'Original explanation'});};
 try{
  const first=await questionService({},store).load(id);assert.equal(calls,1);assert.equal(first.answers[0],'A');
  globalThis.fetch=async()=>{throw Error('offline');};
  assert.equal((await questionService({},store).load(id)).prompt,'Original question');
  await store.change('question_cache',id,row=>({...row,created:Date.now()-8*86400000}));assert.equal((await questionService({},store).load(id)).prompt,'Original question');
 }finally{globalThis.fetch=previous;}
});

import catalogData from './official-variants.json';
import { lessonMap, topicLessons } from '../server/content.mjs';

export const catalog = catalogData;
export const refs = new Map();
for (const variant of catalog.variants) for (const [section, branches] of Object.entries(variant.sections)) {
  for (const branch of Object.values(branches)) for (const q of branch) refs.set(q.id, { ...q, section });
}
export function lessonForRef(ref) { return topicLessons[ref?.topic?.trim()] || null; }
export function fault(status, message) { const e = Error(message); e.status = status; throw e; }
export function numberValue(value) {
  const s = String(value ?? '').trim().replace(/−/g,'-').replace(',','.');
  const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
  if (s.includes('/')) { const parts = s.split('/').map(x=>x.trim()); if (parts.length !== 2 || !parts.every(v=>numeric.test(v)) || Number(parts[1]) === 0) return NaN; return Number(parts[0])/Number(parts[1]); }
  return numeric.test(s) ? Number(s) : NaN;
}
export function correct(q, value) {
  if (value == null || String(value).trim() === '') return false;
  if (q.type === 'mcq') return q.answers.includes(String(value).toUpperCase());
  const n = numberValue(value);
  return Number.isFinite(n) && q.answers.some(a=>Number.isFinite(numberValue(a)) && Math.abs(n-numberValue(a)) <= 1e-9*Math.max(1,Math.abs(numberValue(a))));
}
export function questionService(env = process.env, store = null) {
  // Test fixtures are opt-in and impossible to activate in production.
  const fixture = null;
  const cache = new Map(), pending = new Map();
  async function load(id) {
    if (!refs.has(id)) fault(404,'QUESTION_NOT_FOUND');
    if (cache.has(id)) return cache.get(id);
    if (pending.has(id)) return pending.get(id);
    const task = (async()=>{
      let raw;
      const persisted=!fixture&&store?await store.get('question_cache',id):null;
      if(persisted?.question&&Date.now()-persisted.created<7*86400000){cache.set(id,persisted.question);return persisted.question;}
      if (fixture) raw = fixture[id];
      else {
        let response;
        for(let attempt=0;attempt<2;attempt++){
          try{response=await fetch('https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/digital/get-question',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({external_id:id}),signal:AbortSignal.timeout(12000)});if(response.ok)break;if(response.status<500&&response.status!==429)break;}catch{}
        }
        if(!response?.ok){
          if(persisted?.question&&Date.now()-persisted.created<30*86400000){cache.set(id,persisted.question);return persisted.question;}
          fault(503,'QUESTION_SOURCE_UNAVAILABLE');
        }
        try{raw=await response.json();}catch{fault(503,'QUESTION_SOURCE_UNAVAILABLE');}

      }
      if (!raw || !['mcq','spr'].includes(raw.type) || typeof raw.stem !== 'string') fault(503,'QUESTION_SOURCE_UNAVAILABLE');
      const ref = refs.get(id);
      const q = { id, type:raw.type==='spr'?'numeric':'mcq',passage:String(raw.stimulus||''),prompt:raw.stem,options:(raw.answerOptions||[]).map((o,i)=>({letter:'ABCD'[i],html:String(o.content||'')})),answers:(Array.isArray(raw.correct_answer)?raw.correct_answer:[raw.correct_answer]).filter(v=>v!=null).map(String),explanation:String(raw.rationale||''),skill:lessonForRef(ref)||ref.topic,lessonId:lessonForRef(ref),topic:ref.topic,section:ref.section,difficulty:ref.difficulty,sourceId:ref.sourceId };
      if (!q.answers.length || q.type==='mcq' && (q.options.length!==4 || q.options.some(o=>!o.html))) fault(503,'QUESTION_SOURCE_UNAVAILABLE');
      if (cache.size >= 600) cache.delete(cache.keys().next().value);
      cache.set(id,q);
      if(store&&!fixture){const row={id,question:q,created:Date.now()};if(persisted)await store.change('question_cache',id,()=>row);else try{await store.insert('question_cache',row);}catch(e){if(!await store.get('question_cache',id))throw e;}}
      return q;
    })();
    pending.set(id,task);
    try { return await task; } finally { pending.delete(id); }
  }
  const safe = q => { const {answers,explanation,...rest} = q; return rest; };
  function review(q) {
    const l = lessonMap.get(q.lessonId);
    return {...q,method:l?.rules||null,explanationLanguage:'en'};
  }
  return {load,safe,review};
}

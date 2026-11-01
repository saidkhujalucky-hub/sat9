const plain=html=>String(html||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(0x10ffff,Number(n)))).replace(/\s+/g,' ').trim();
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export function translationService(store,env) {
 async function translate(q,lang,explanation=false) {
  if(!['ru','uz'].includes(lang))fail(400,'INVALID_LANGUAGE');
  if(!env.AI)fail(503,'TRANSLATION_NOT_CONFIGURED');
  const id=q.id+':'+lang+':'+(explanation?'review':'question'),cached=await store.get('translations',id);
  if(cached)return cached;
  const parts=explanation?[q.explanation]:[q.passage,q.prompt,...q.options.map(o=>o.letter+'. '+o.html)];
  const output=[];
  for(const part of parts){
   const text=plain(part);if(!text){output.push('');continue;}
   const chunks=text.match(/.{1,900}(?:\s|$)|\S{1,900}/g)||[text];
   const translated=[];
   for(const chunk of chunks){
    let response;try{response=await env.AI.run('@cf/meta/m2m100-1.2b',{text:chunk,source_lang:'en',target_lang:lang});}catch{fail(503,'TRANSLATION_UNAVAILABLE');}
    if(typeof response?.translated_text!=='string')fail(503,'TRANSLATION_UNAVAILABLE');
    translated.push(response.translated_text);
   }
   output.push(translated.join(' '));
  }
  const result={id,lang,parts:output,machine:true};
  try{await store.insert('translations',result);}catch(e){if(!await store.get('translations',id))throw e;}
  return result;
 }
 return {translate};
}

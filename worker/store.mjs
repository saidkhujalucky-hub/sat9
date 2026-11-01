export function openStore(db) {
 const query=(sql,...args)=>db.prepare(sql).bind(...args);
 return {
  kind:'d1',
  async get(name,id){const row=await query('SELECT body FROM documents WHERE collection=? AND id=?',name,id).first();return row?JSON.parse(row.body):null;},
  async list(name,filter={}){const entries=Object.entries(filter);if(entries.some(([k])=>!/^\w+$/.test(k)))throw Error('INVALID_FILTER');const rows=await query('SELECT body FROM documents WHERE collection=?'+entries.map(([k])=>` AND json_extract(body,'$.${k}')=?`).join(''),name,...entries.map(([,v])=>typeof v==='boolean'?Number(v):v)).all();return rows.results.map(r=>JSON.parse(r.body));},
  async insertMany(name,docs){for(let i=0;i<docs.length;i+=80)await db.batch(docs.slice(i,i+80).map(doc=>query('INSERT INTO documents(collection,id,body) VALUES(?,?,?) ON CONFLICT(collection,id) DO NOTHING',name,doc.id,JSON.stringify(doc))));},
  async insert(name,doc){await query('INSERT INTO documents(collection,id,body) VALUES(?,?,?)',name,doc.id,JSON.stringify(doc)).run();return doc;},
  async remove(name,id){await query('DELETE FROM documents WHERE collection=? AND id=?',name,id).run();},
  async change(name,id,fn){for(let i=0;i<10;i++){const row=await query('SELECT body FROM documents WHERE collection=? AND id=?',name,id).first();if(!row)return null;const old=JSON.parse(row.body),next=fn(structuredClone(old));if(!next)return old;const result=await query('UPDATE documents SET body=? WHERE collection=? AND id=? AND body=?',JSON.stringify(next),name,id,row.body).run();if(result.meta.changes)return next;}throw Error('CONCURRENT_UPDATE');}
 };
}
export async function insertOnce(store,name,doc){try{return await store.insert(name,doc);}catch(e){if(String(e).includes('UNIQUE constraint failed'))return store.get(name,doc.id);throw e;}}

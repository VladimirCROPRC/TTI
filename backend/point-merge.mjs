const json=(v,s=200)=>Response.json(v,{status:s});
const tables=['photos','observations','deleted_photos','merged_point_photos'];
const slots=ids=>ids.map(()=>'?').join(',');
async function content(env,ids){const result={};for(const table of tables)result[table]=(await env.DB.prepare(`SELECT * FROM ${table} WHERE point_id IN (${slots(ids)})`).bind(...ids).all()).results;return result;}
function guard(points,counts){const values=[],clauses=[];for(const p of points){clauses.push('EXISTS(SELECT 1 FROM points WHERE id=? AND version=? AND deleted=?)');values.push(p.id,p.version,p.deleted);}const ids=points.map(p=>p.id);for(const t of tables){clauses.push(`(SELECT COUNT(*) FROM ${t} WHERE point_id IN (${slots(ids)}))=?`);values.push(...ids,counts[t]);}return {sql:clauses.join(' AND '),values};}
export async function mergeRoutes(request,env,path,manifest,validCategory){
 const undo=path.match(/^\/history\/([a-f0-9-]{36})\/undo$/);
 if(undo&&request.method==='POST'){
  const op=await env.DB.prepare('SELECT * FROM point_merges WHERE id=?').bind(undo[1]).first();if(!op)return null;if(op.applied===2)return json({ok:true});if(op.applied!==1)return json({error:'Unirea nu este finalizată.'},409);
  const s=JSON.parse(op.snapshot),g=guard(s.points.map(p=>({...p,version:p.version+1,deleted:p.id===s.target?0:1})),s.afterCounts);
  const gate='EXISTS(SELECT 1 FROM point_merges WHERE id=? AND applied=3)';
  const statements=[env.DB.prepare('UPDATE point_merges SET applied=3 WHERE id=? AND applied=1 AND '+g.sql).bind(op.id,...g.values)];
  for(const p of s.points)statements.push(env.DB.prepare('UPDATE points SET category=?,deleted=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND '+gate).bind(p.category,p.deleted,p.id,op.id));
  statements.push(env.DB.prepare('DELETE FROM merged_point_photos WHERE merge_id=? AND '+gate).bind(op.id,op.id));
  if(s.observationIds.length)statements.push(env.DB.prepare(`DELETE FROM observations WHERE id IN (${slots(s.observationIds)}) AND `+gate).bind(...s.observationIds,op.id));
  statements.push(env.DB.prepare('UPDATE operation_history SET undone_at=CURRENT_TIMESTAMP WHERE id=? AND '+gate).bind(op.id,op.id),env.DB.prepare('UPDATE point_merges SET applied=2 WHERE id=? AND applied=3').bind(op.id));
  const result=await env.DB.batch(statements);if(!result[0].meta.changes)return json({error:'Punctele au fost modificate după unire. Anularea ar putea pierde modificări; reîncarcă datele.'},409);return json({ok:true});
 }
 if(path!=='/points/merge'||request.method!=='POST')return null;
 const b=await request.json();if(typeof b.id!=='string'||!/^[a-f0-9-]{36}$/.test(b.id)||!Array.isArray(b.points)||b.points.length<2||b.points.length>12||b.points.some(p=>typeof p.id!=='string'||!p.id||p.id.length>100||!Number.isInteger(p.version)||p.version<0)||new Set(b.points.map(p=>p.id)).size!==b.points.length||!b.points.some(p=>p.id===b.target)||!validCategory(b.category))return json({error:'Selectează între 2 și 12 puncte distincte, punctul păstrat și stratul rezultat.'},400);
 const signature=JSON.stringify({points:[...b.points].sort((a,c)=>a.id.localeCompare(c.id)).map(p=>({id:p.id,version:p.version})),target:b.target,category:b.category});
 const prior=await env.DB.prepare('SELECT signature,applied FROM point_merges WHERE id=?').bind(b.id).first();if(prior)return prior.signature===signature?json({id:b.target,undone:prior.applied===2}):json({error:'Identificator reutilizat.'},409);
 const ids=b.points.map(p=>p.id),points=(await env.DB.prepare(`SELECT * FROM points WHERE id IN (${slots(ids)})`).bind(...ids).all()).results;
 if(points.length!==ids.length||points.some(p=>p.deleted||p.version!==b.points.find(v=>v.id===p.id).version))return json({error:'Un punct a fost modificat de alt utilizator sau este șters. Reîncarcă selecția.'},409);
 const inactive=await env.DB.prepare(`SELECT f.id FROM imported_features f JOIN kmz_imports i ON i.id=f.import_id WHERE f.id IN (${slots(ids)}) AND i.active=0`).bind(...ids).first();if(inactive)return json({error:'Un punct aparține unui import anulat.'},409);
 const all=await content(env,ids),sourceIds=ids.filter(id=>id!==b.target),photos=new Map();
 for(const id of sourceIds){const removed=new Set(all.deleted_photos.filter(p=>p.point_id===id).map(p=>p.src));const list=[...(manifest.originalPhotos?.[id]||[]).map(src=>({src,caption:'Fotografie din punctul unit'})),...all.photos.filter(p=>p.point_id===id).map(p=>({src:'/photos/'+p.id,caption:p.caption})),...all.merged_point_photos.filter(p=>p.point_id===id)];for(const p of list)if(!removed.has(p.src))photos.set(p.src,{src:p.src,caption:p.caption});}
 const existingSources=new Set([...(manifest.originalPhotos?.[b.target]||[]),...all.photos.filter(p=>p.point_id===b.target).map(p=>'/photos/'+p.id),...all.merged_point_photos.filter(p=>p.point_id===b.target).map(p=>p.src)]);for(const src of existingSources)photos.delete(src);
 const observations=all.observations.filter(o=>sourceIds.includes(o.point_id)).map(o=>({...o,id:crypto.randomUUID()}));
 for(const p of points.filter(p=>sourceIds.includes(p.id)))if(p.notes?.trim()&&!all.observations.some(o=>o.point_id===p.id&&o.text===p.notes.trim()))observations.push({id:crypto.randomUUID(),text:p.notes.trim(),created_at:p.updated_at.replace(' ','T')+'Z',legacy:1});
 // Keep undo within D1's bound-parameter limit; no source observations are removed.
 if(observations.length>80)return json({error:'Selecția conține prea multe observații pentru o singură unire. Unește mai puține puncte pe rând.'},400);
 const counts=Object.fromEntries(tables.map(t=>[t,all[t].length])),snapshot={points,target:b.target,observationIds:observations.map(o=>o.id),afterCounts:{...counts,observations:counts.observations+observations.length,merged_point_photos:counts.merged_point_photos+photos.size}};
 if(JSON.stringify(snapshot).length+JSON.stringify(observations).length>1000000)return json({error:'Datele selecției sunt prea mari. Unește mai puține puncte pe rând.'},400);
 const g=guard(points,counts),gate='EXISTS(SELECT 1 FROM point_merges WHERE id=? AND applied=0)';
 const statements=[env.DB.prepare('INSERT OR IGNORE INTO point_merges(id,signature,snapshot) SELECT ?,?,? WHERE '+g.sql).bind(b.id,signature,JSON.stringify(snapshot),...g.values)];
 statements.push(env.DB.prepare(`INSERT OR IGNORE INTO merged_point_photos(point_id,src,caption,merge_id) SELECT ?,json_extract(value,'$.src'),json_extract(value,'$.caption'),? FROM json_each(?) WHERE `+gate).bind(b.target,b.id,JSON.stringify([...photos.values()]),b.id));
 statements.push(env.DB.prepare(`INSERT INTO observations(id,point_id,text,created_at,legacy) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.text'),json_extract(value,'$.created_at'),json_extract(value,'$.legacy') FROM json_each(?) WHERE `+gate).bind(b.target,JSON.stringify(observations.map(o=>({...o,legacy:o.legacy||0}))),b.id));
 for(const p of points)statements.push(env.DB.prepare('UPDATE points SET category=?,deleted=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND '+gate).bind(p.id===b.target?b.category:p.category,p.id===b.target?0:1,p.id,b.id));
 statements.push(env.DB.prepare("INSERT OR IGNORE INTO operation_history(id,kind,title,payload) SELECT ?,'point-merge',?,? WHERE "+gate).bind(b.id,'Unire · '+points.length+' puncte',JSON.stringify({mergeId:b.id}),b.id),env.DB.prepare('UPDATE point_merges SET applied=1 WHERE id=? AND applied=0').bind(b.id));
 const result=await env.DB.batch(statements);if(!result[0].meta.changes){const done=await env.DB.prepare('SELECT applied,signature FROM point_merges WHERE id=?').bind(b.id).first();if(!done||done.signature!==signature||done.applied!==1)return json({error:'Punctele au fost modificate de alt utilizator. Reîncarcă selecția.'},409);}return json({id:b.target},201);
}

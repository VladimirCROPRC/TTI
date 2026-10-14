const json=(b,s=200)=>Response.json(b,{status:s}),uuid=s=>typeof s==='string'&&/^[a-f0-9-]{36}$/.test(s);
const coordinate=p=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Math.abs(p[0])<=90&&Number.isFinite(p[1])&&Math.abs(p[1])<=180;
export function historyStatement(env,kind,title,payload,condition='1',values=[]){return env.DB.prepare('INSERT INTO operation_history(id,kind,title,payload) SELECT ?,?,?,? WHERE '+condition).bind(crypto.randomUUID(),kind,title,JSON.stringify(payload),...values);}
export async function importRoutes(request,env,path){
 if(path==='/imports'&&request.method==='GET'){
 const imports=(await env.DB.prepare('SELECT * FROM kmz_imports ORDER BY created_at DESC').all()).results;
 const features=(await env.DB.prepare('SELECT * FROM imported_features').all()).results.map(f=>({...JSON.parse(f.original_json),importId:f.import_id,active:Boolean(imports.find(i=>i.id===f.import_id)?.active)}));return json({imports,features});
 }
 if(path==='/history'&&request.method==='GET')return json({history:(await env.DB.prepare('SELECT * FROM operation_history ORDER BY rowid DESC LIMIT 200').all()).results.map(r=>({...r,payload:JSON.parse(r.payload)}))});
 if(path==='/imports'&&request.method==='POST'){
 if(Number(request.headers.get('Content-Length'))>12*1024*1024)return json({error:'Importul depășește 12 MB de geometrie și simboluri.'},413);
 const b=await request.json();if(!uuid(b.id)||typeof b.label!=='string'||!b.label.trim()||b.label.length>200||!Array.isArray(b.features)||!b.features.length||b.features.length>250)return json({error:'Import invalid: maximum 250 de elemente per fișier.'},400);
 const ids=new Set();for(const f of b.features){
 if(!uuid(f.id)||ids.has(f.id)||!['Point','LineString'].includes(f.type)||typeof f.name!=='string'||f.name.length>200||typeof f.description!=='string'||f.description.length>10000||(f.type==='Point'?!coordinate(f.coordinates):!Array.isArray(f.coordinates)||f.coordinates.length<2||f.coordinates.length>2000||f.coordinates.some(p=>!coordinate(p))||!f.coordinates.some(p=>p[0]!==f.coordinates[0][0]||p[1]!==f.coordinates[0][1])))return json({error:'Geometrie sau identificator invalid.'},400);ids.add(f.id);
 const s=f.style;if(!s||!/^#[0-9a-f]{6}$/i.test(s.color)||!Number.isFinite(s.width)||s.width<1||s.width>12||!Number.isFinite(s.opacity)||s.opacity<0||s.opacity>1||!Number.isFinite(s.scale)||s.scale<.2||s.scale>3||(s.icon&&(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s.icon)||s.icon.length>180000)))return json({error:'Simbol sau stil invalid.'},400);
 }
 const old=await env.DB.prepare('SELECT id FROM kmz_imports WHERE id=?').bind(b.id).first();if(old){const prior=(await env.DB.prepare('SELECT id FROM imported_features WHERE import_id=?').bind(b.id).all()).results;if(prior.length!==ids.size||prior.some(f=>!ids.has(f.id)))return json({error:'Identificator de import reutilizat.'},409);return json({id:b.id});}
 const category='TTI (1)/Importate/'+b.id,status='Importate/'+b.id;
 const statements=[env.DB.prepare('INSERT INTO kmz_imports(id,label) VALUES(?,?)').bind(b.id,b.label.trim())];
 for(const f of b.features){statements.push(env.DB.prepare('INSERT INTO imported_features(id,import_id,feature_type,original_json) VALUES(?,?,?,?)').bind(f.id,b.id,f.type,JSON.stringify(f)));
 if(f.type==='Point')statements.push(env.DB.prepare('INSERT INTO points(id,category,latitude,longitude,name,address) VALUES(?,?,?,?,?,?)').bind(f.id,category,...f.coordinates,f.name,''));
 else statements.push(env.DB.prepare('INSERT INTO cables(id,status) VALUES(?,?)').bind(f.id,status),env.DB.prepare('INSERT INTO drawn_cables(id,name,coordinates) VALUES(?,?,?)').bind(f.id,f.name||'Cablu importat',JSON.stringify(f.coordinates)));
 }
 statements.push(historyStatement(env,'import','Import KMZ · '+b.label,{importId:b.id}));await env.DB.batch(statements);return json({id:b.id},201);
 }
 const undo=path.match(/^\/history\/([a-f0-9-]{36})\/undo$/);
 if(undo&&request.method==='POST'){
 const event=await env.DB.prepare('SELECT * FROM operation_history WHERE id=?').bind(undo[1]).first();if(!event)return json({error:'Acțiune inexistentă.'},404);if(event.undone_at)return json({ok:true});const p=JSON.parse(event.payload);let statements;
 if(event.kind==='point-layer'){
 statements=[env.DB.prepare('UPDATE points SET category=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=? AND category=? AND deleted=0 AND EXISTS(SELECT 1 FROM operation_history WHERE id=? AND undone_at IS NULL)').bind(p.before,p.id,p.version,p.after,event.id),env.DB.prepare('UPDATE operation_history SET undone_at=CURRENT_TIMESTAMP WHERE id=? AND changes()>0 AND EXISTS(SELECT 1 FROM points WHERE id=? AND version=? AND category=?)').bind(event.id,p.id,p.version+1,p.before)];
 }else if(event.kind==='cable-section'){
 if(await env.DB.prepare('SELECT section_id FROM deleted_cable_sections WHERE section_id=?').bind(p.sectionId).first())return json({error:'Înregistrarea a fost deja ștearsă. Reîncarcă istoricul.'},409);
 statements=[env.DB.prepare('INSERT OR IGNORE INTO deleted_cable_sections(section_id) SELECT ? FROM cables WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM operation_history WHERE id=? AND undone_at IS NULL)').bind(p.sectionId,p.id,p.version,event.id),env.DB.prepare('UPDATE cables SET version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM deleted_cable_sections WHERE section_id=?)').bind(p.id,p.version,p.sectionId),env.DB.prepare('UPDATE operation_history SET undone_at=CURRENT_TIMESTAMP WHERE id=? AND changes()>0 AND EXISTS(SELECT 1 FROM cables WHERE id=? AND version=?)').bind(event.id,p.id,p.version+1)];
 }else if(event.kind==='import'){
 const category='TTI (1)/Importate/'+p.importId,status='Importate/'+p.importId;
 statements=[env.DB.prepare(`UPDATE kmz_imports SET active=0 WHERE id=? AND active=1
 AND NOT EXISTS(SELECT 1 FROM imported_features i JOIN points p ON p.id=i.id WHERE i.import_id=? AND (p.category<>? OR p.deleted<>0 OR p.notes<>'' OR EXISTS(SELECT 1 FROM observations o WHERE o.point_id=p.id)))
 AND NOT EXISTS(SELECT 1 FROM imported_features i JOIN cables c ON c.id=i.id WHERE i.import_id=? AND (c.status<>? OR EXISTS(SELECT 1 FROM cable_sections s WHERE s.cable_id=c.id AND NOT EXISTS(SELECT 1 FROM deleted_cable_sections d WHERE d.section_id=s.id))))`).bind(p.importId,p.importId,category,p.importId,status),env.DB.prepare('UPDATE operation_history SET undone_at=CURRENT_TIMESTAMP WHERE id=? AND changes()>0 AND EXISTS(SELECT 1 FROM kmz_imports WHERE id=? AND active=0)').bind(event.id,p.importId)];
 }else return json({error:'Această acțiune nu poate fi anulată.'},400);
 if(p.id)statements.push(env.DB.prepare("UPDATE operation_history SET payload=json_set(payload,'$.version',?) WHERE id=(SELECT id FROM operation_history WHERE kind=? AND undone_at IS NULL AND json_extract(payload,'$.id')=? ORDER BY rowid DESC LIMIT 1) AND EXISTS(SELECT 1 FROM operation_history WHERE id=? AND undone_at IS NOT NULL)").bind(p.version+1,event.kind,p.id,event.id));
 const result=await env.DB.batch(statements);if(!result[0].meta.changes)return json({error:'Elementele au fost modificate între timp. Anulează întâi mutările ulterioare sau reîncarcă istoricul.'},409);return json({ok:true});
 }
 return null;
}

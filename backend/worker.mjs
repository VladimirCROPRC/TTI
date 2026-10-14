import manifest from './manifest.json' with {type:'json'};
const json=(value,status=200)=>Response.json(value,{status});
const categories=new Set(manifest.categories),ids=new Set(manifest.ids);
const validCategory=c=>categories.has(c)||(typeof c==='string'&&/^TTI \(1\)\/Tichete\/[A-Za-z0-9][A-Za-z0-9_. -]{0,99}$/.test(c));
export function imageType(bytes){
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if([137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))return 'image/png';
 if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
export default {async fetch(request,env){
 const origin=request.headers.get('Origin');const allowed=(env.ALLOWED_ORIGINS||'https://vladimircroprc.github.io').split(',');
 if(origin&&!allowed.includes(origin))return json({error:'Origine nepermisă.'},403);
 const headers={'Access-Control-Allow-Origin':origin||allowed[0],'Vary':'Origin','Access-Control-Allow-Methods':'GET,PATCH,POST,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-TTI-Client','Cache-Control':'no-store'};
 let response;
 try{response=await route(request,env);}catch(e){console.error(e);response=json({error:'Salvarea nu a reușit. Încearcă din nou.'},500);}
 Object.entries(headers).forEach(([k,v])=>response.headers.set(k,v));return response;
}};
async function route(request,env){
 if(request.method==='OPTIONS')return new Response(null,{status:204});
 const path=new URL(request.url).pathname;
 if(path==='/health')return json({ok:true});
 if(request.method==='GET'&&path==='/points'){
 const {results}=await env.DB.prepare('SELECT * FROM points').all();
 const photos=await env.DB.prepare('SELECT id, point_id, caption FROM photos ORDER BY created_at,id').all();
 const observations=await env.DB.prepare('SELECT * FROM observations ORDER BY created_at DESC,id').all();
 const removed=await env.DB.prepare('SELECT point_id,src FROM deleted_photos').all();
 return json({points:results.map(p=>({...p,deletedPhotos:removed.results.filter(x=>x.point_id===p.id).map(x=>x.src),observations:observations.results.filter(x=>x.point_id===p.id),photos:photos.results.filter(x=>x.point_id===p.id&&!removed.results.some(d=>d.point_id===p.id&&d.src==='/photos/'+x.id)).map(x=>({id:x.id,src:'/photos/'+x.id,caption:x.caption}))}))});
 }
 const photo=path.match(/^\/photos\/([a-f0-9-]{36})$/);
 if(photo&&request.method==='GET'){
 const row=await env.DB.prepare('SELECT object_key FROM photos WHERE id=?').bind(photo[1]).first();
 if(!row)return json({error:'Fotografia nu există.'},404);
 const object=await env.PHOTOS.get(row.object_key);if(!object)return json({error:'Fotografia nu există.'},404);
 return new Response(object.body,{headers:{'Content-Type':object.httpMetadata.contentType,'X-Content-Type-Options':'nosniff'}});
 }
 if(request.headers.get('X-TTI-Client')!=='web')return json({error:'Cerere nepermisă.'},403);
 if(path==='/points'&&request.method==='POST'){
 const b=await request.json();
 if(typeof b.id!=='string'||!/^[a-f0-9-]{36}$/.test(b.id)||!Number.isFinite(b.latitude)||Math.abs(b.latitude)>90||!Number.isFinite(b.longitude)||Math.abs(b.longitude)>180||!validCategory(b.category)||typeof b.name!=='string'||b.name.length>200||typeof b.address!=='string'||b.address.length>500)return json({error:'Poziție sau strat invalid.'},400);
 await env.DB.prepare('INSERT OR IGNORE INTO points(id,category,latitude,longitude,name,address) VALUES(?,?,?,?,?,?)').bind(b.id,b.category,b.latitude,b.longitude,b.name.trim(),b.address.trim()).run();
 const p=await env.DB.prepare('SELECT * FROM points WHERE id=?').bind(b.id).first();
 if(p.latitude!==b.latitude||p.longitude!==b.longitude||p.category!==b.category)return json({error:'Identificator reutilizat.'},409);
 return json(p,201);
 }
 const match=path.match(/^\/points\/([^/]+)(\/(?:photos|observations))?$/);if(!match)return json({error:'Punct inexistent.'},404);
 const id=match[1];
 const existing=await env.DB.prepare('SELECT id FROM points WHERE id=?').bind(id).first();if(!existing)return json({error:'Punct inexistent.'},404);
 if(match[2]==='/photos'&&request.method==='DELETE'){
 const b=await request.json();if(typeof b.src!=='string')return json({error:'Fotografie invalidă.'},400);
 const upload=b.src.startsWith('/photos/')?await env.DB.prepare('SELECT id FROM photos WHERE point_id=? AND id=?').bind(id,b.src.slice(8)).first():null;
 if(!upload&&!(manifest.originalPhotos?.[id]||[]).includes(b.src))return json({error:'Fotografia nu aparține punctului.'},404);
 await env.DB.prepare('INSERT OR IGNORE INTO deleted_photos(point_id,src) VALUES(?,?)').bind(id,b.src).run();return json({ok:true});
 }
 if(match[2]==='/observations'&&request.method==='POST'){
 const body=await request.json();
 if(typeof body.text!=='string'||!body.text.trim()||body.text.length>10000||typeof body.id!=='string'||!/^[a-f0-9-]{36}$/.test(body.id))return json({error:'Introdu o observație de maximum 10.000 de caractere.'},400);
 const result=await env.DB.prepare('INSERT OR IGNORE INTO observations(id,point_id,text,created_at) SELECT ?,id,?,? FROM points WHERE id=? AND deleted=0').bind(body.id,body.text.trim(),new Date().toISOString(),id).run();
 const row=await env.DB.prepare('SELECT * FROM observations WHERE id=? AND point_id=?').bind(body.id,id).first();
 if(!row)return json({error:'Punctul a fost șters.'},409);
 if(row.text!==body.text.trim())return json({error:'Identificator de observație reutilizat.'},409);
 return json(row,result.meta.changes?201:200);
 }
 if(match[2]==='/photos'&&request.method==='POST'){
 const row=await env.DB.prepare('SELECT deleted FROM points WHERE id=?').bind(id).first();if(!row||row.deleted)return json({error:'Punctul a fost șters.'},409);
 if(Number(request.headers.get('Content-Length'))>10*1024*1024)return json({error:'Fotografia trebuie să aibă maximum 10 MB.'},413);
 const bytes=new Uint8Array(await request.arrayBuffer());if(bytes.length>10*1024*1024)return json({error:'Fotografia trebuie să aibă maximum 10 MB.'},413);
 const type=imageType(bytes);if(!type)return json({error:'Folosește o fotografie JPEG, PNG sau WebP.'},415);
 const photoId=crypto.randomUUID(),key=id+'/'+photoId;
 await env.PHOTOS.put(key,bytes,{httpMetadata:{contentType:type}});
 try{await env.DB.prepare('INSERT INTO photos(id,point_id,object_key,caption) VALUES(?,?,?,?)').bind(photoId,id,key,'Fotografie adăugată · '+new Date().toLocaleDateString('ro-RO')).run();}catch(e){await env.PHOTOS.delete(key);throw e;}
 return json({id:photoId,src:'/photos/'+photoId},201);
 }
 if(!match[2]&&request.method==='PATCH'){
 const body=await request.json();
 if(!validCategory(body.category)||typeof body.notes!=='string'||body.notes.length>10000||typeof body.deleted!=='boolean'||!Number.isInteger(body.version))return json({error:'Date invalide.'},400);
 const result=await env.DB.prepare('UPDATE points SET category=?,notes=?,deleted=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=?').bind(body.category,body.notes,Number(body.deleted),id,body.version).run();
 if(!result.meta.changes)return json({error:'Punctul a fost modificat de alt utilizator. Reîncarcă datele înainte de salvare.'},409);
 return json(await env.DB.prepare('SELECT * FROM points WHERE id=?').bind(id).first());
 }
 return json({error:'Operație indisponibilă.'},405);
}

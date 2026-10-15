import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import manifest from './manifest.json' with {type:'json'};
const base='http://127.0.0.1:8787/api',category='TTI (1)/Patrulare/OK',points=[];
async function req(path,method='GET',body){const r=await fetch(base+path,{method,headers:{'X-TTI-Client':'web','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
for(let i=0;i<3;i++){const id=randomUUID();assert.equal((await req('/points','POST',{id,name:'Merge test '+i,address:'Adresa '+i,latitude:47.05+i*.001,longitude:21.91,category})).status,201);points.push(id);}
for(const [i,text] of [[1,'Observația unu'],[2,'Observația doi']])assert.equal((await req('/points/'+points[i]+'/observations','POST',{id:randomUUID(),text})).status,201);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII=','base64');
const photoIds=[];for(let i=0;i<2;i++){const r=await fetch(base+'/points/'+points[1]+'/photos',{method:'POST',headers:{'X-TTI-Client':'web','Content-Type':'image/png'},body:png});assert.equal(r.status,201);photoIds.push((await r.json()).src);}
await req('/points/'+points[1]+'/photos','DELETE',{src:photoIds[1]});
const get=async()=>(await req('/points')).data.points;const before=await get(),operation={id:randomUUID(),target:points[0],category:'TTI (1)/Patrulare/NOT OK',points:points.map(id=>({id,version:0}))};
assert.equal((await req('/points/merge','POST',{...operation,points:[operation.points[0],operation.points[0]]})).status,400);
assert.equal((await req('/points/merge','POST',{...operation,id:randomUUID(),points:operation.points.map((p,i)=>({...p,version:i===1?99:0}))})).status,409);
assert.equal((await req('/points/merge','POST',operation)).status,201);assert.equal((await req('/points/merge','POST',operation)).status,200);
let after=await get(),target=after.find(p=>p.id===points[0]);assert.equal(target.deleted,0);assert.equal(target.category,operation.category);assert.equal(target.photos.length,1);assert.equal(target.photos[0].src,photoIds[0]);assert.equal(target.observations.length,2);for(const id of points.slice(1))assert.equal(after.find(p=>p.id===id).deleted,1);
for(const original of before.filter(p=>points.slice(1).includes(p.id)).flatMap(p=>p.observations))assert.ok(target.observations.some(o=>o.text===original.text&&o.created_at===original.created_at));
assert.equal((await req('/history/'+operation.id+'/undo','POST')).status,200);assert.equal((await req('/history/'+operation.id+'/undo','POST')).status,200);
after=await get();target=after.find(p=>p.id===points[0]);assert.equal(target.category,category);assert.equal(target.photos.length,0);assert.equal(target.observations.length,0);for(const id of points)assert.equal(after.find(p=>p.id===id).deleted,0);
const second={...operation,id:randomUUID(),points:points.map(id=>({id,version:after.find(p=>p.id===id).version}))};assert.equal((await req('/points/merge','POST',second)).status,201);
await req('/points/'+points[0]+'/observations','POST',{id:randomUUID(),text:'După unire'});assert.equal((await req('/history/'+second.id+'/undo','POST')).status,409);
assert.equal((await req('/points/'+points[0]+'/photos','DELETE',{src:photoIds[0]})).status,200);target=(await get()).find(p=>p.id===points[0]);assert.ok(target.deletedPhotos.includes(photoIds[0]));assert.ok(!target.photos.some(p=>p.src===photoIds[0]));
const originals=await get(),original=originals.find(p=>!p.deleted&&(manifest.originalPhotos[p.id]||[]).some(src=>!p.deletedPhotos.includes(src)));
if(original){const id=randomUUID();await req('/points','POST',{id,name:'Test KMZ merge',address:'',latitude:47,longitude:21,category});const op={id:randomUUID(),target:id,category,points:[{id,version:0},{id:original.id,version:original.version}]};assert.equal((await req('/points/merge','POST',op)).status,201);const kept=(await get()).find(p=>p.id===id);for(const src of manifest.originalPhotos[original.id])assert.equal(kept.photos.some(p=>p.src===src),!original.deletedPhotos.includes(src));assert.equal((await req('/history/'+op.id+'/undo','POST')).status,200);}
console.log('Point merge: 3 points, visible photos, dated observations, idempotency, conflict rejection, shared undo and merged photo deletion passed.');

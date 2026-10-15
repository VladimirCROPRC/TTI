import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
const base='http://127.0.0.1:8787/api',id=randomUUID();
async function request(path,method='GET',body){const r=await fetch(base+path,{method,headers:{'X-TTI-Client':'web','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
const geometry=[[47.05,21.91],[47.051,21.911],[47.052,21.912]];
assert.equal((await request('/cables','POST',{id,name:'Test ștergere cablu',coordinates:geometry,status:'Neprogramate',week:''})).status,201);
const section={id:randomUUID(),version:0,status:'Patrulate',week:'2026-W41',start_pos:0,end_pos:1};assert.equal((await request('/cables/'+id+'/sections','POST',section)).status,201);
const get=async()=>(await request('/cables')).data.cables.find(c=>c.id===id);
let cable=await get();assert.equal(cable.version,1);assert.equal(cable.sections.length,1);
assert.equal((await request('/cables/'+id+'/visibility','PATCH',{deleted:true,version:0})).status,409);
assert.equal((await request('/cables/'+id+'/visibility','PATCH',{deleted:true,version:1})).status,200);
cable=await get();assert.equal(cable.deleted,1);assert.equal(cable.version,2);assert.deepEqual(cable.coordinates,geometry);assert.equal(cable.sections.length,1);
assert.equal((await request('/cables/'+id+'/sections','POST',{...section,id:randomUUID(),version:2})).status,409);
assert.equal((await request('/cables/'+id+'/visibility','PATCH',{deleted:false,version:1})).status,409);
assert.equal((await request('/cables/'+id+'/visibility','PATCH',{deleted:false,version:2})).status,200);
cable=await get();assert.equal(cable.deleted,0);assert.equal(cable.version,3);assert.deepEqual(cable.coordinates,geometry);assert.equal(cable.sections[0].week,'2026-W41');
await request('/cables/'+id+'/visibility','PATCH',{deleted:true,version:3});
console.log('Cable deletion: soft delete/restore, stale version rejection, blocked edits and geometry/week/sections retained.');

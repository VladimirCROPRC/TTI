import assert from 'node:assert/strict';
import worker from './worker.mjs';
const ip='92.180.22.209';
let assetCalls=0;
const env={ALLOWED_CLIENT_IP:ip,ALLOWED_ORIGINS:'https://prevent.proconect.online',ASSETS:{fetch:async()=>{assetCalls++;return new Response('asset');}}};
const req=(path,headers={})=>new Request('https://prevent.proconect.online'+path,{headers});
for(const path of ['/','/data.js','/files/S001_01.jpg','/api/points','/api/photos/123','/points','/health']){
 for(const headers of [{},{'CF-Connecting-IP':'203.0.113.1'},{'X-Forwarded-For':ip},{'X-Real-IP':ip}])assert.equal((await worker.fetch(req(path,headers),env)).status,403);
}
assert.equal(assetCalls,0);
for(const path of ['/','/data.js','/files/S001_01.jpg']){
 const r=await worker.fetch(req(path,{'CF-Connecting-IP':ip}),env);assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'private, no-store');
}
for(const path of ['/health','/api/health'])assert.deepEqual(await (await worker.fetch(req(path,{'CF-Connecting-IP':ip}),env)).json(),{ok:true});
assert.equal((await worker.fetch(req('/health',{'CF-Connecting-IP':ip}),{...env,ALLOWED_CLIENT_IP:''})).status,403);
assert.equal((await worker.fetch(req('/api/health',{'CF-Connecting-IP':ip,Origin:'https://other.example'}),env)).status,403);
console.log('VPN gate: denied missing/wrong/spoofed IP, protected assets and API, allowed VPN, failed closed without config.');

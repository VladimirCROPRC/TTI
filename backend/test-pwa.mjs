import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const root=new URL('../dist/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.webmanifest',root),'utf8'));
assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');
for(const size of [192,512]){const icon=manifest.icons.find(i=>i.sizes===`${size}x${size}`);assert.ok(icon);const bytes=fs.readFileSync(new URL(icon.src,root));assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);}
const handlers={};let upstream;
const context={URL,Request,Response,fetch:async request=>upstream(request),self:{location:{origin:'https://tti.proconect.online'},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting(){},clients:{claim(){}}}};vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('sw.js',root),'utf8'),context);
async function call(path,mode='navigate'){let response;handlers.fetch({request:{url:'https://tti.proconect.online'+path,mode},respondWith:p=>response=p});return await response;}
// Use a real request for fetch forwarding; navigation mode is read from this wrapper.
const R=context.Request;context.Request=function(request,options){return new R(request.url,options);};
let calls=0;upstream=async request=>{calls++;assert.equal(request.cache,'no-store');return new Response('VPN required',{status:403});};
assert.equal((await call('/')).status,403);assert.equal(calls,1);
upstream=async()=>{throw Error('offline');};const offline=await call('/');assert.equal(offline.status,503);assert.match(await offline.text(),/VPN-ul WireGuard/);assert.equal((await call('/api/points','cors')).type,'error');
let intercepted=false;handlers.fetch({request:{url:'https://tile.openstreetmap.org/0/0/0.png'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
console.log('PWA: standalone manifest, PNG dimensions, network-only requests, VPN denial preserved, offline fallback and external requests checked.');

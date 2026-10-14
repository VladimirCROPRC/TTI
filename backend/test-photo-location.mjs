import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {photoLocation,locationResult} from './photo-location.mjs';
import worker,{imageType} from './worker.mjs';
const gpsContext={};vm.createContext(gpsContext);vm.runInContext(fs.readFileSync(new URL('../dist/photo-gps.js',import.meta.url),'utf8'),gpsContext);
function fixture(le=true){const t=new Uint8Array(128),v=new DataView(t.buffer);t.set(le?[73,73]:[77,77]);const s=(p,n)=>v.setUint16(p,n,le),l=(p,n)=>v.setUint32(p,n,le);s(2,42);l(4,8);s(8,1);s(10,0x8825);s(12,4);l(14,1);l(18,26);s(26,4);
 for(const [i,tag,type,count,value] of [[0,1,2,2,0],[1,2,5,3,80],[2,3,2,2,0],[3,4,5,3,104]]){const p=28+i*12;s(p,tag);s(p+2,type);l(p+4,count);l(p+8,value);}t[36]=83;t[60]=87;for(const [p,d] of [[80,[47,3,18]],[104,[21,54,24]]])d.forEach((n,i)=>{l(p+i*8,n);l(p+i*8+4,1);});const jpg=new Uint8Array(140);jpg.set([255,216,255,225,0,136,69,120,105,102,0,0]);jpg.set(t,12);return jpg;}
for(const le of [true,false]){const bytes=fixture(le),gps=gpsContext.photoGPS(bytes.buffer);assert.ok(Math.abs(gps.latitude+47.055)<1e-9);assert.ok(Math.abs(gps.longitude+21.9066666667)<1e-8);for(const length of [0,10,100])assert.equal(gpsContext.photoGPS(bytes.buffer.slice(0,length)),null);}
const jpeg=fixture(),request=()=>new Request('https://prevent.proconect.online/api/photo-location',{method:'POST',body:jpeg});
const result={latitude:47.055,longitude:21.9066667,stamp:'47.055 N 21.9066667 E',address:'',captured_at:'',confidence:'high',warning:''};
assert.throws(()=>locationResult({...result,latitude:91}));assert.throws(()=>locationResult({...result,longitude:null}));assert.throws(()=>locationResult({...result,stamp:''}));
assert.equal((await photoLocation(request(),{},imageType)).status,503);
assert.equal((await photoLocation(new Request('https://example.test',{method:'POST',body:'not a photo'}),{OPENAI_API_KEY:'test'},imageType)).status,415);
let calls=0;const fake=async(url,options)=>{calls++;const b=JSON.parse(options.body);assert.equal(b.store,false);assert.equal(b.text.format.strict,true);assert.ok(b.input[0].content[1].image_url.startsWith('data:image/jpeg;base64,'));return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(result)}]}]});};
assert.deepEqual(await (await photoLocation(request(),{OPENAI_API_KEY:'test'},imageType,fake)).json(),result);assert.equal(calls,1);
assert.equal((await photoLocation(request(),{OPENAI_API_KEY:'test'},imageType,async()=>new Response('',{status:429}))).status,429);
assert.equal((await photoLocation(request(),{OPENAI_API_KEY:'test'},imageType,async()=>Response.json({status:'incomplete'}))).status,422);
const env={ALLOWED_CLIENT_IP:'92.180.22.209',ALLOWED_ORIGINS:'https://prevent.proconect.online'};
assert.equal((await worker.fetch(request(),env)).status,403);
const req=new Request(request(),{headers:{'CF-Connecting-IP':env.ALLOWED_CLIENT_IP}});assert.equal((await worker.fetch(req,env)).status,403);
const allowed=new Request(request(),{headers:{'CF-Connecting-IP':env.ALLOWED_CLIENT_IP,'X-TTI-Client':'web'}});assert.equal((await worker.fetch(allowed,env)).status,503);
console.log('Photo location: EXIF endian/signs/truncation, validated AI output, API errors, request schema and VPN/client gates passed.');

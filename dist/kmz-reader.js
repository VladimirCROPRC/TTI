/* ZIP/KML is parsed as data only. No remote icons, HTML or scripts are loaded. */
const KMZ={
 crc(bytes){this.crcTable??=Array.from({length:256},(_,i)=>{for(let k=0;k<8;k++)i=(i>>>1)^((i&1)?0xedb88320:0);return i;});let c=0xffffffff;for(const b of bytes)c=(c>>>8)^this.crcTable[(c^b)&255];return (c^0xffffffff)>>>0;},
 async open(file){
 if(file.size>50*1024*1024)throw Error('Fișierul KMZ trebuie să aibă maximum 50 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer);let end=-1;
 for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(view.getUint32(p,true)===0x06054b50&&p+22+view.getUint16(p+20,true)===bytes.length){end=p;break;}
 if(end<0)throw Error('Arhivă KMZ invalidă.');
 const count=view.getUint16(end+10,true);let p=view.getUint32(end+16,true),total=0;const entries=new Map();
 if(count>3000||count===65535||view.getUint16(end+4,true)!==0)throw Error('Arhiva este prea mare sau folosește un format ZIP nesuportat.');
 for(let i=0;i<count;i++){
 if(p+46>bytes.length||view.getUint32(p,true)!==0x02014b50)throw Error('Director ZIP invalid.');
 const flags=view.getUint16(p+8,true),method=view.getUint16(p+10,true),crc=view.getUint32(p+16,true),packed=view.getUint32(p+20,true),size=view.getUint32(p+24,true),n=view.getUint16(p+28,true),extra=view.getUint16(p+30,true),comment=view.getUint16(p+32,true),offset=view.getUint32(p+42,true);
 if(p+46+n+extra+comment>bytes.length)throw Error('Arhivă incompletă.');
 const name=new TextDecoder().decode(bytes.slice(p+46,p+46+n)).replace(/\\/g,'/');p+=46+n+extra+comment;
 if(name.endsWith('/'))continue;
 if(flags&1||![0,8].includes(method)||size>10*1024*1024||name.split('/').includes('..')||name.startsWith('/')||entries.has(name))throw Error('Arhiva conține fișiere nesuportate sau prea mari (maximum 10 MB fiecare).');
 total+=size;if(total>200*1024*1024)throw Error('Conținutul dezarhivat depășește 200 MB.');
 entries.set(name,{name,size,async read(){
 if(offset+30>bytes.length||view.getUint32(offset,true)!==0x04034b50)throw Error('Fișier ZIP invalid.');
 const start=offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true);if(start+packed>bytes.length)throw Error('Fișier ZIP incomplet.');
 const stream=new Blob([bytes.slice(start,start+packed)]).stream(),reader=(method===8?stream.pipeThrough(new DecompressionStream('deflate-raw')):stream).getReader();const chunks=[];let length=0;
 for(;;){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>size){await reader.cancel();throw Error('Dimensiune ZIP invalidă.');}chunks.push(r.value);}
 const out=new Uint8Array(length);let pos=0;for(const chunk of chunks){out.set(chunk,pos);pos+=chunk.length;}if(length!==size||KMZ.crc(out)!==crc)throw Error('Fișier deteriorat în arhiva KMZ.');return out;
 }});
 }
 return entries;
 },
 async parse(file){
 const entries=await this.open(file),kml=[...entries.keys()].find(n=>n.toLowerCase()==='doc.kml')||[...entries.keys()].find(n=>n.toLowerCase().endsWith('.kml'));if(!kml)throw Error('Arhiva nu conține un fișier KML.');
 const xml=new TextDecoder().decode(await entries.get(kml).read());if(/<!DOCTYPE/i.test(xml))throw Error('Declarațiile DOCTYPE nu sunt permise.');
 const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('KML invalid.');
 const all=(n,name)=>[...n.getElementsByTagNameNS('*',name)],text=(n,name)=>all(n,name)[0]?.textContent?.trim()||'',direct=(n,name)=>[...n.children].find(c=>c.localName===name);
 const plain=s=>s.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').trim();
 const styles=new Map(all(doc,'Style').filter(n=>n.getAttribute('id')).map(n=>[n.getAttribute('id'),n])),maps=new Map(all(doc,'StyleMap').filter(n=>n.getAttribute('id')).map(n=>[n.getAttribute('id'),text(all(n,'Pair').find(p=>text(p,'key')==='normal')||n,'styleUrl').replace(/^#/,'')]));
 const resolve=raw=>{let path=raw.replace(/\\/g,'/').replace(/^\.\//,'');try{path=decodeURIComponent(path);}catch{}if(/^[a-z]+:|^\/|(?:^|\/)\.\.(?:\/|$)/i.test(path))return null;const prefix=kml.includes('/')?kml.slice(0,kml.lastIndexOf('/')+1):'';const candidate=entries.get(prefix+path)||entries.get(path)||[...entries.values()].find(e=>e.name.toLowerCase()===(prefix+path).toLowerCase());return candidate;};
 const color=s=>/^[a-f\d]{8}$/i.test(s)?{color:'#'+s.slice(6,8)+s.slice(4,6)+s.slice(2,4),opacity:parseInt(s.slice(0,2),16)/255}:{color:'#168d7b',opacity:1};
 const iconCache=new Map(),features=[],photos=[];let unsupported=0;
 for(const pm of all(doc,'Placemark')){
 let id=text(pm,'styleUrl').replace(/^#/,'');id=maps.get(id)||id;const style=direct(pm,'Style')||styles.get(id),lineStyle=style&&all(style,'LineStyle')[0],iconStyle=style&&all(style,'IconStyle')[0];
 const c=color(lineStyle?text(lineStyle,'color'):iconStyle?text(iconStyle,'color'):''),base={...c,width:Math.max(1,Math.min(12,Number(lineStyle&&text(lineStyle,'width'))||4)),scale:Math.max(.2,Math.min(3,Number(iconStyle&&text(iconStyle,'scale'))||1))};
 const href=iconStyle&&text(iconStyle,'href'),icon=href&&resolve(href);if(icon&&icon.size<130000&&/\.(png|jpe?g|webp)$/i.test(icon.name)){if(!iconCache.has(icon.name)){const bytes=await icon.read();let binary='';for(const b of bytes)binary+=String.fromCharCode(b);iconCache.set(icon.name,'data:image/'+(/\.png$/i.test(icon.name)?'png':/\.webp$/i.test(icon.name)?'webp':'jpeg')+';base64,'+btoa(binary));}base.icon=iconCache.get(icon.name);}
 const raw=direct(pm,'description')?.textContent||'',description=plain(raw).slice(0,10000),name=(direct(pm,'name')?.textContent||'Element importat').trim().slice(0,200),photoEntries=[];
 for(const match of raw.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)){const entry=resolve(match[1].replace(/&amp;/g,'&'));if(entry&&/\.(png|jpe?g|webp)$/i.test(entry.name)&&!photoEntries.includes(entry))photoEntries.push(entry);}
 const geometries=[...all(pm,'Point'),...all(pm,'LineString')];if(!geometries.length){unsupported++;continue;}
 for(const geometry of geometries){const coords=text(geometry,'coordinates').split(/\s+/).filter(Boolean).map(s=>{const n=s.split(',').map(Number);return[n[1],n[0]];});if(coords.some(p=>!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>90||Math.abs(p[1])>180))throw Error('Coordonate invalide în '+name);const type=geometry.localName==='Point'?'Point':'LineString';if((type==='Point'&&coords.length!==1)||(type==='LineString'&&(coords.length<2||coords.length>2000)))throw Error('Geometrie nesuportată în '+name);
 const feature={id:crypto.randomUUID(),type,name,description,coordinates:type==='Point'?coords[0]:coords,style:{...base}};features.push(feature);if(type==='Point')for(const entry of photoEntries)photos.push({id:crypto.randomUUID(),pointId:feature.id,entry});
 }
 }
 if(!features.length)throw Error('Nu există puncte sau cabluri importabile.');if(features.length>250)throw Error('Maximum 250 de puncte și cabluri per import. Împarte fișierul în mai multe KMZ-uri.');
 return {id:crypto.randomUUID(),label:file.name.slice(0,200),features,photos,unsupported};
 }
};

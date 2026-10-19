/* Local ZIP store writer: no application data is sent to an external service. */
globalThis.KMZExport={
 xml(value){return String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));},
 color(value,opacity=1){const hex=/^#[a-f0-9]{6}$/i.test(value)?value.slice(1):'168d7b';return Math.round(Math.max(0,Math.min(1,opacity))*255).toString(16).padStart(2,'0')+hex.slice(4,6)+hex.slice(2,4)+hex.slice(0,2);},
 zip(entries){
  if(entries.length>3000)throw Error('Prea multe fișiere pentru un singur export KMZ.');
  const encoder=new TextEncoder(),parts=[],central=[];let offset=0,centralSize=0;
  for(const entry of entries){const name=encoder.encode(entry.name),bytes=entry.bytes,crc=KMZ.crc(bytes),header=new Uint8Array(30+name.length),v=new DataView(header.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,0x21,true);v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,name.length,true);header.set(name,30);
   const directory=new Uint8Array(46+name.length),d=new DataView(directory.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(14,0x21,true);d.setUint32(16,crc,true);d.setUint32(20,bytes.length,true);d.setUint32(24,bytes.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);directory.set(name,46);parts.push(header,bytes);central.push(directory);offset+=header.length+bytes.length;centralSize+=directory.length;
  }
  const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/vnd.google-earth.kmz'});
 },
 async document(features,asset,layerName,partsFor){
  const xml=value=>this.xml(value),root={folders:new Map(),marks:[]};let count=0;
  const add=(path,mark)=>{let folder=root;for(const name of path.split('/').filter(Boolean)){if(!folder.folders.has(name))folder.folders.set(name,{folders:new Map(),marks:[]});folder=folder.folders.get(name);}folder.marks.push(mark);count++;};
  const extended=values=>'<ExtendedData>'+Object.entries(values).map(([key,value])=>'<Data name="'+xml(key)+'"><value>'+xml(typeof value==='string'?value:JSON.stringify(value))+'</value></Data>').join('')+'</ExtendedData>';
  for(const f of features){
   if(f.type==='Point'){
    const icon=await asset(f.style?.icon||('tti-dot:'+(f.style?.color||'#168d7b'))),photos=[];for(const photo of f.photos||[])photos.push({src:await asset(photo.src),caption:photo.caption||''});
    const info=[f.description,f.notes,...(f.observations||[]).map(o=>o.created_at+' · '+o.text)].filter(Boolean).map(value=>'<p>'+xml(value).replace(/\n/g,'<br>')+'</p>').join('')+photos.map(p=>'<p>'+xml(p.caption)+'<br><img src="'+p.src+'" width="600"></p>').join('');
    const style=icon?'<IconStyle><scale>'+Math.max(.2,Math.min(3,f.style?.scale||1))+'</scale><Icon><href>'+xml(icon)+'</href></Icon></IconStyle>':'<IconStyle><color>'+this.color(f.style?.color)+'</color><scale>0.7</scale></IconStyle>';
    add(layerName(f.category),'<Placemark><name>'+xml(f.name||'Punct')+'</name><description>'+xml(info)+'</description><Style>'+style+'</Style>'+extended({tti_id:f.id,category:f.category,observations:f.observations||[],notes:f.notes||''})+'<Point><coordinates>'+f.coordinates[1]+','+f.coordinates[0]+',0</coordinates></Point></Placemark>');
   }else if(f.type==='LineString'){
    for(const part of partsFor(f)){
     const color=cableColors[part.status]||f.originalStyle?.color||f.style?.color,week=(part.section?part.section.week:part.status==='Programate pentru patrulare'?f.cable?.scheduled_week:part.status.startsWith('Patrulate')?f.cable?.patrolled_week:'')||'';
     const dotted=['Patrulate - traseu diferit fata de documentatie','Segmente documentate eronat'].includes(part.status);
     const info=[f.description,part.status,week?'Săptămâna: '+week:'',dotted?'Stil în aplicație: linie punctată.':''].filter(Boolean).join('\n');
     add(layerName(cableLayer(part.status)),'<Placemark><name>'+xml(f.name||'Cablu')+'</name><description>'+xml(info)+'</description><Style><LineStyle><color>'+this.color(color,f.style?.opacity??1)+'</color><width>'+(f.style?.width||4)+'</width></LineStyle></Style>'+extended({tti_id:f.id,status:part.status,week,start_pos:part.start,end_pos:part.end,dotted})+'<LineString><tessellate>1</tessellate><coordinates>'+part.coordinates.map(p=>p[1]+','+p[0]+',0').join(' ')+'</coordinates></LineString></Placemark>');
    }
   }
  }
  const folder=node=>node.marks.join('')+[...node.folders].map(([name,child])=>'<Folder><name>'+xml(name)+'</name>'+folder(child)+'</Folder>').join('');
  return {kml:'<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>TTI - mentenanță preventivă</name>'+folder(root)+'</Document></kml>',count};
 }
};
TTI.setupKMZExport=function(){
 this.exportKMZ=async()=>{
  if(this.busy)return;this.busy=true;let url;
  try{
   $('status').textContent='Pregătesc exportul KMZ…';await this.refresh();const features=structuredClone(this.all.filter(f=>!f.deleted)),entries=[],paths=new Map();let size=0;
   const asset=async src=>{if(paths.has(src))return paths.get(src);let target=src;if(src.startsWith('tti-dot:')){const canvas=document.createElement('canvas');canvas.width=canvas.height=48;const ctx=canvas.getContext('2d');ctx.beginPath();ctx.arc(24,24,18,0,2*Math.PI);ctx.fillStyle=/^#[a-f0-9]{6}$/i.test(src.slice(8))?src.slice(8):'#168d7b';ctx.fill();ctx.lineWidth=4;ctx.strokeStyle='white';ctx.stroke();target=canvas.toDataURL('image/png');}if(!/^data:image\/(png|jpeg|webp);base64,/i.test(target)){const parsed=new URL(this.photoUrl(src),location.href);if(parsed.origin!==location.origin)throw Error('Export oprit: o fotografie sau pictogramă are o adresă externă.');target=parsed.href;}
    $('status').textContent='Export KMZ: '+(paths.size+1)+' fotografii și pictograme…';const response=await fetch(target,{cache:'no-store',signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('Nu am putut descărca toate fotografiile/pictogramele. Verifică VPN-ul și încearcă din nou.');const bytes=new Uint8Array(await response.arrayBuffer());size+=bytes.length;if(size>200*1024*1024)throw Error('Exportul depășește 200 MB. Contactează administratorul pentru un export complet.');
    const type=response.headers.get('Content-Type')||'',extension=type.includes('png')?'png':type.includes('webp')?'webp':type.includes('jpeg')?'jpg':null;if(!extension)throw Error('O fotografie sau pictogramă are un format nesuportat.');const name='files/media-'+String(paths.size+1).padStart(4,'0')+'.'+extension;paths.set(src,name);entries.push({name,bytes});return name;
   };
   const result=await KMZExport.document(features,asset,short,cableParts),encoder=new TextEncoder();entries.unshift({name:'doc.kml',bytes:encoder.encode(result.kml)});entries.push({name:'tti-state.json',bytes:encoder.encode(JSON.stringify({format:'TTI',version:1,exportedAt:new Date().toISOString(),features,assets:Object.fromEntries(paths)},null,2))});
   const blob=KMZExport.zip(entries);url=URL.createObjectURL(blob);const link=el('a');const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Bucharest',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date()).replace(/[^0-9]/g,'-');link.href=url;link.download='TTI-'+date+'.kmz';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);$('status').textContent='KMZ pregătit: '+features.filter(f=>f.type==='Point').length+' puncte și '+features.filter(f=>f.type==='LineString').length+' cabluri, cu fotografii și observații.';
  }catch(e){if(url)URL.revokeObjectURL(url);$('status').textContent='Export KMZ nereușit. '+e.message;alert('KMZ-ul nu a fost salvat: '+e.message);}finally{this.busy=false;}
 };
 document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.shiftKey&&!event.altKey&&(event.code==='KeyS'||event.key.toLowerCase()==='s')){event.preventDefault();if(!event.repeat)this.exportKMZ();}},true);
};

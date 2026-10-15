const operationalStatuses=['Solicitate','Programate','Pending','Finalizate'];
const cableStatuses=['Patrulate','Patrulate - traseu diferit fata de documentatie','Programate pentru patrulare','Segmente documentate eronat','Neprogramate'];
const cableColors={'Patrulate':'#23a455','Patrulate - traseu diferit fata de documentatie':'#23a455','Programate pentru patrulare':'#2677e8','Segmente documentate eronat':'#ef4444','Neprogramate':'#ff00ff'};
function cableLayer(status){return status.startsWith('Importate/')?'TTI (1)/'+status:'Cabluri/'+status;}
function featureLayer(f){return f.type==='LineString'?cableLayer(f.cable?.status||'Neprogramate'):f.category;}
function normalizeOperational(key){return ['TTI (1)/Pichetare','TTI (1)/Predari amplasament'].includes(key)?key+'/Finalizate':key;}
function statusSymbol(key){const status=key.split('/').at(-1);return {Solicitate:'+',Programate:'▦',Pending:'⌛',Finalizate:'✓'}[status]||'';}
function pointIcon(f){
 const size=32*(f.style.scale||1),symbol=statusSymbol(f.category);
 if(!f.style.icon){const dot=el('span',undefined,'import-point-symbol');dot.style.background=f.style.color;return L.divIcon({html:dot,className:'import-point',iconSize:[size,size],iconAnchor:[size/2,size/2]});}
 if(!symbol)return L.icon({iconUrl:f.style.icon,iconSize:[size,size],iconAnchor:[size/2,size/2]});
 const node=el('div',undefined,'status-marker');node.append(image(f.style.icon,''),el('span',symbol,'status-symbol'));
 return L.divIcon({html:node,iconSize:[size,size],iconAnchor:[size/2,size/2],className:'operational-marker'});
}
function weekLabel(value){return value?`${value.slice(0,4)} · S${value.slice(6)}`:'Necompletată';}
TTI.preparePlanning=function(dataset){
 for(const root of ['TTI (1)/Pichetare','TTI (1)/Predari amplasament']){
  const style=this.styles.get(root)||[...this.styles.entries()].find(([key])=>key.startsWith(root+'/'))?.[1];
  for(const status of operationalStatuses)this.styles.set(root+'/'+status,style);
 }
 dataset.categories=dataset.categories.flatMap(key=>['TTI (1)/Pichetare','TTI (1)/Predari amplasament'].includes(key)?operationalStatuses.map(status=>key+'/'+status):[key]);
 for(const f of this.all){if(f.type==='Point')f.category=normalizeOperational(f.category);else{f.originalStyle={...f.style};f.cable={status:f.style.color==='#55ff7f'?'Patrulate':'Neprogramate',scheduled_week:null,patrolled_week:null,version:0};}}
};
TTI.syncCables=async function(){const result=await this.request('/cables');for(const state of result.cables){let f=this.all.find(f=>f.id===state.id&&f.type==='LineString');if(!f&&state.coordinates){f={id:state.id,type:'LineString',name:state.name,description:'Cablu desenat pe hartă',category:'Cabluri',coordinates:state.coordinates,photos:[],originalStyle:{width:4,opacity:1}};this.all.push(f);}if(f){const meta=this.imported?.get(f.id);if(meta){f.importId=meta.importId;f.originalStyle=meta.style;f.description=meta.description;f.deleted=!meta.active;}f.deleted=Boolean(state.deleted)||Boolean(meta&&!meta.active);f.cable=state;f.style={...f.originalStyle,color:cableColors[state.status]};}}data.features=this.all.filter(f=>!f.deleted);};

function cableStroke(status,sourceStyle){return {color:cableColors[status]||sourceStyle?.color||'#168d7b',dashArray:['Patrulate - traseu diferit fata de documentatie','Segmente documentate eronat'].includes(status)?'1 9':null,lineCap:'round'};}

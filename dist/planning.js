const operationalStatuses=['Solicitate','Programate','Pending','Finalizate'];
const cableStatuses=['Patrulate','Programate pentru patrulare','Neprogramate'];
const cableColors={'Patrulate':'#23a455','Programate pentru patrulare':'#2677e8','Neprogramate':'#ff00ff'};
function featureLayer(f){return f.type==='LineString'?'Cabluri/'+(f.cable?.status||'Neprogramate'):f.category;}
function normalizeOperational(key){return ['TTI (1)/Pichetare','TTI (1)/Predari amplasament'].includes(key)?key+'/Finalizate':key;}
function statusSymbol(key){const status=key.split('/').at(-1);return {Solicitate:'+',Programate:'▦',Pending:'⌛',Finalizate:'✓'}[status]||'';}
function pointIcon(f){
 const size=32*(f.style.scale||1),symbol=statusSymbol(f.category);
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
TTI.syncCables=async function(){const result=await this.request('/cables');for(const state of result.cables){const f=this.all.find(f=>f.id===state.id&&f.type==='LineString');if(f){f.cable=state;f.style={...f.originalStyle,color:cableColors[state.status]};}}};
TTI.addCableEditor=function(f,content){
 content.querySelector('.detail-category').textContent=featureLayer(f);
 const block=el('section',undefined,'point-editor');block.append(el('h3','Patrulare traseu'));
 const state=f.cable;
 block.append(el('p','Săptămână programată: '+weekLabel(state.scheduled_week)),el('p','Săptămână patrulată: '+weekLabel(state.patrolled_week)));
 if(this.offline||!this.api){block.append(el('p','Salvarea comună este momentan indisponibilă.'));content.insertBefore(block,content.querySelector('h3'));return;}
 const layerLabel=el('label','Strat cablu'),select=el('select');for(const status of cableStatuses){const o=el('option',status);o.value=status;o.selected=status===state.status;select.append(o);}layerLabel.append(select);
 const scheduledLabel=el('label','Săptămâna programării'),scheduled=el('input');scheduled.type='week';scheduled.value=state.scheduled_week||'';scheduledLabel.append(scheduled);
 const patrolLabel=el('label','Săptămâna patrulării'),patrolled=el('input');patrolled.type='week';patrolled.value=state.patrolled_week||'';patrolLabel.append(patrolled);
 const update=()=>{scheduled.required=select.value==='Programate pentru patrulare';patrolled.required=select.value==='Patrulate';};select.onchange=update;update();
 const message=el('p',undefined,'save-status'),save=el('button','Salvează traseul','save-point');save.onclick=async()=>{if(this.busy)return;if(!scheduled.reportValidity()||!patrolled.reportValidity())return;this.busy=true;save.disabled=true;try{await this.request('/cables/'+f.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:select.value,scheduled_week:scheduled.value||null,patrolled_week:patrolled.value||null,version:state.version})});await this.refresh();enabled.set(featureLayer(f),true);render();show(f);}catch(error){message.textContent=error.message;const reload=el('button','Reîncarcă traseul');reload.onclick=async()=>{await this.refresh();show(f);};block.append(reload);}finally{this.busy=false;save.disabled=false;}};
 block.append(layerLabel,scheduledLabel,patrolLabel,save,message);content.insertBefore(block,content.querySelector('h3'));
};

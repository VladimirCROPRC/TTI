function pointMarker(f){const size=32*(f.style.scale||1);const marker=L.marker(f.coordinates,{title:f.name,icon:pointIcon(f)});marker.bindTooltip(el('span',f.name));marker.on('click',()=>show(f));return marker;}
function rebuildLayers(){
 const collapsed=new Set([...document.querySelectorAll('.layer-group')].filter(s=>s.querySelector('.layer-group-children').hidden).map(s=>s.dataset.prefix));
 $('layers').replaceChildren();for(const key of [...cableStatuses.map(status=>'Cabluri/'+status),...data.categories]){
 if(!groups.has(key)){groups.set(key,L.featureGroup().addTo(map));enabled.set(key,true);}
 const features=data.features.filter(f=>featureLayers(f).includes(key)),label=el('label',undefined,'layer'),check=el('input');check.type='checkbox';check.checked=enabled.get(key);check.dataset.key=key;check.onchange=()=>toggleCategory(key,check.checked);label.append(check);
 if(key.startsWith('Cabluri/')){const swatch=el('i',undefined,'line-symbol');const status=key.slice(8);swatch.style.background=status==='Patrulate - traseu diferit fata de documentatie'?`radial-gradient(circle, ${cableColors[status]} 2px, transparent 2.5px) left center / 8px 6px repeat-x`:cableColors[status];label.append(swatch);}else{const style=TTI.styles.get(key)||TTI.ticketStyle();if(style?.icon){const icon=el('span',undefined,'layer-marker');icon.append(image(style.icon,''));const symbol=statusSymbol(key);if(symbol)icon.append(el('b',symbol,'status-symbol'));label.append(icon);}}
 label.append(el('span',short(key),'layer-name'),el('small',String(features.length)));$('layers').append(label);
 }groupLayerControls();for(const section of document.querySelectorAll('.layer-group'))if(collapsed.has(section.dataset.prefix))section.querySelector('.layer-group-heading button').click();
}
TTI.ticketStyle=function(){return [...this.styles.entries()].find(([key])=>short(key).startsWith('Tichete/'))?.[1]||[...this.styles.values()][0];};
TTI.deletePhoto=async function(f,p){if(this.busy||!confirm('Ștergi această fotografie din punct pentru toți utilizatorii?'))return;this.busy=true;try{await this.request('/points/'+f.id+'/photos',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({src:p.src})});if($('viewer').open)$('viewer').close();await this.refresh();show(f);}catch(e){alert(e.message);}finally{this.busy=false;}};
TTI.setupCreation=function(){
 const button=el('button','＋ Adaugă punct','add-point');$('sidebar').insertBefore(button,$('sidebar').firstChild);
 let picking=false,draft=null;const cancel=()=>{picking=false;button.textContent='＋ Adaugă punct';map.getContainer().classList.remove('placing-point');if(draft){map.removeLayer(draft);draft=null;}};
 this.cancelPointCreation=cancel;
 button.onclick=()=>{this.cancelCableSelection();if(picking){cancel();return;}picking=true;button.textContent='Anulează adăugarea';map.getContainer().classList.add('placing-point');$('status').textContent='Click pe hartă pentru poziția punctului nou.';if(innerWidth<=650)$('sidebar').classList.add('mobile-hidden');};
 map.on('click',e=>{if(!picking)return;if(draft)map.removeLayer(draft);draft=L.circleMarker(e.latlng,{radius:9,color:'#168d7b',fillOpacity:1}).addTo(map);const coords=e.latlng;selected=null;$('details').hidden=false;const content=$('detail-content');content.replaceChildren(el('h2','Punct nou','detail-title'),el('p',`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`));
 const nameLabel=el('label','Nume (opțional)'),name=el('input');name.maxLength=200;nameLabel.append(name);
 const addressLabel=el('label','Adresă (opțional)'),address=el('input');address.maxLength=500;addressLabel.append(address);
 const layerLabel=el('label','Strat'),layer=el('select');const placeholder=el('option','Selectează stratul');placeholder.value='';layer.append(placeholder);
 for(const key of data.categories.filter(key=>!short(key).startsWith('Tichete/'))){const option=el('option',short(key));option.value=key;layer.append(option);}const tickets=el('option','Tichete');tickets.value='tickets';layer.append(tickets);layerLabel.append(layer);
 const ticketLabel=el('label','Număr tichet'),ticket=el('input');ticket.maxLength=100;ticket.placeholder='Ex. 5175126_10773204';ticketLabel.append(ticket);ticketLabel.hidden=true;layer.onchange=()=>ticketLabel.hidden=layer.value!=='tickets';
 const message=el('p',undefined,'save-status'),save=el('button','Salvează punctul','save-point'),abort=el('button','Anulează');abort.onclick=()=>{cancel();$('details').hidden=true;render();};let id=crypto.randomUUID();
 save.onclick=async()=>{if(this.busy)return;let category=layer.value;if(!category){message.textContent='Selectează stratul.';return;}if(category==='tickets'){const number=ticket.value.trim();if(!/^[A-Za-z0-9][A-Za-z0-9_. -]{0,99}$/.test(number)){message.textContent='Introdu numărul tichetului.';return;}category=data.categories.find(k=>short(k)==='Tichete/'+number)||'TTI (1)/Tichete/'+number;}
 this.busy=true;save.disabled=true;try{await this.request('/points',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,latitude:coords.lat,longitude:coords.lng,name:name.value,address:address.value,category})});cancel();$('search').value='';await this.refresh();const f=this.all.find(f=>f.id===id);enabled.set(f.category,true);focus(f);}catch(error){message.textContent=error.message;}finally{this.busy=false;save.disabled=false;}};
 const form=el('section',undefined,'point-editor');form.append(nameLabel,addressLabel,layerLabel,ticketLabel,save,abort,message);content.append(form);
 });
 $('close-details').addEventListener('click',cancel);
};

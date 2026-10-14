window.TTI={
 api:'', all:[], states:new Map(), styles:new Map(), busy:false,
 async request(path,options={}){
  const response=await fetch(this.api+path,{...options,headers:{'X-TTI-Client':'web',...options.headers}});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Salvarea nu a reușit.');return result;
 },
 photoUrl(src){return src.startsWith('/photos/')?this.api+src:src;},
 async load(dataset){
  this.api=(window.TTI_CONFIG?.apiUrl||'').replace(/\/$/,'');
  this.all=dataset.features;for(const f of this.all){if(f.type==='Point'&&!this.styles.has(f.category))this.styles.set(f.category,f.style);f.originalPhotos=[...f.photos];}
  if(!this.api)return;
  try{await this.sync(dataset);}catch(e){this.offline=e.message;}
 },
 async sync(dataset){
  const result=await this.request('/points');this.states=new Map(result.points.map(p=>[p.id,p]));
  for(const f of this.all){const p=this.states.get(f.id);if(!p)continue;f.category=p.category;f.notes=p.notes;f.observations=p.observations||[];f.version=p.version;f.deleted=Boolean(p.deleted);f.photos=[...f.originalPhotos,...p.photos];f.style=this.styles.get(p.category)||f.style;}
  dataset.features=this.all.filter(f=>!f.deleted);this.offline=null;
 },
 async refresh(){await this.sync(data);for(const f of data.features){const marker=records.get(f.id);if(f.type==='Point'&&marker){const size=32*(f.style.scale||1);marker.setIcon(L.icon({iconUrl:f.style.icon,iconSize:[size,size],iconAnchor:[size/2,size/2]}));}}render();this.updateCounts();updateLayerGroups();},
 updateCounts(){document.querySelectorAll('.layer').forEach(label=>{const key=label.querySelector('input').dataset.key;label.querySelector('small').textContent=data.features.filter(f=>(f.type==='LineString'?'Cabluri':f.category)===key).length;});},
 addEditor(f,content){
  if(f.type!=='Point')return;
  const box=el('section',undefined,'point-editor');box.append(el('h3','Editează punctul'));
  if(!this.api||this.offline){box.append(el('p',this.offline?'Salvarea comună este momentan indisponibilă. '+this.offline:'Salvarea comună nu este încă configurată.'));const retry=el('button','Reîncarcă datele');retry.onclick=async()=>{try{await this.refresh();show(f);}catch(e){alert(e.message);}};box.append(retry);content.insertBefore(box,content.querySelector('h3'));return;}
  const noteLabel=el('label','Observații');const notes=el('textarea');notes.value='';notes.maxLength=10000;notes.rows=4;notes.placeholder='Adaugă observații despre punct…';noteLabel.append(notes);
  const layerLabel=el('label','Strat');const select=el('select');data.categories.forEach(key=>{const option=el('option',short(key));option.value=key;option.selected=f.category===key;select.append(option);});layerLabel.append(select);
  const msg=el('p','Modificările sunt comune tuturor utilizatorilor.','save-status');msg.setAttribute('role','status');
  const save=el('button','Salvează stratul','save-point');
  const perform=async(fn)=>{if(this.busy)return;this.busy=true;box.querySelectorAll('button,input,select,textarea').forEach(n=>n.disabled=true);try{await fn();}catch(e){msg.textContent=e.message;if(e.message.includes('alt utilizator')){const retry=el('button','Încarcă ultima versiune');retry.onclick=async()=>{await this.refresh();show(f);};box.append(retry);}}finally{this.busy=false;box.querySelectorAll('button,input,select,textarea').forEach(n=>n.disabled=false);}};
  save.onclick=()=>perform(async()=>{await this.request('/points/'+f.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({notes:f.notes||'',category:select.value,deleted:false,version:f.version})});await this.refresh();enabled.set(f.category,true);render();show(f);});
  const history=el('div',undefined,'observations-list');history.append(el('h3','Observații'));
  if(!f.observations?.length)history.append(el('p','Nu există observații.'));
  for(const observation of f.observations||[]){const entry=el('article',undefined,'observation');const date=el('time',new Intl.DateTimeFormat('ro-RO',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Bucharest'}).format(new Date(observation.created_at)));date.dateTime=observation.created_at;entry.append(date,el('p',observation.text));if(observation.legacy)entry.append(el('small','Observație anterioară · data ultimei actualizări a punctului'));history.append(entry);}
  let pendingId=null;
  const addNote=el('button','Adaugă observația','save-point');addNote.onclick=()=>perform(async()=>{if(!notes.value.trim())throw Error('Introdu textul observației.');pendingId=pendingId||crypto.randomUUID();await this.request('/points/'+f.id+'/observations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:pendingId,text:notes.value})});notes.value='';pendingId=null;await this.refresh();show(f);});
  const uploadLabel=el('label','Adaugă fotografii');const files=el('input');files.type='file';files.accept='image/jpeg,image/png,image/webp';files.multiple=true;uploadLabel.append(files);
  const upload=el('button','Încarcă fotografiile');upload.onclick=()=>perform(async()=>{if(!files.files.length)throw Error('Selectează fotografiile.');const chosen=[...files.files];if(chosen.some(p=>p.size>10*1024*1024))throw Error('Fiecare fotografie trebuie să aibă maximum 10 MB.');let done=0;try{for(const file of chosen){msg.textContent=`Se încarcă ${++done} / ${chosen.length}…`;await this.request('/points/'+f.id+'/photos',{method:'POST',headers:{'Content-Type':file.type},body:file});}}finally{await this.refresh();}show(f);});
  const remove=el('button','Șterge punctul','delete-point');remove.onclick=()=>{if(!confirm('Ștergi punctul pentru toți utilizatorii? Poate fi restaurat din „Puncte șterse”.'))return;perform(async()=>{await this.request('/points/'+f.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({notes:f.notes||'',category:f.category,deleted:true,version:f.version})});await this.refresh();$('details').hidden=true;});};
  box.append(history,noteLabel,addNote,layerLabel,save,uploadLabel,el('small','JPEG, PNG sau WebP · maximum 10 MB / fotografie'),upload,msg,remove);content.insertBefore(box,content.querySelector('h3'));
 },
 setup(){
  const button=el('button','Puncte șterse','deleted-points');button.onclick=async()=>{try{await this.refresh();const deleted=this.all.filter(f=>f.deleted);const content=$('detail-content');content.replaceChildren(el('h2','Puncte șterse','detail-title'));$('details').hidden=false;if(!deleted.length)content.append(el('p','Nu există puncte șterse.'));for(const f of deleted){const row=el('div',undefined,'restore-row');row.append(el('p',(f.description.match(/Adresa:\s*([^\n]*)/)||[])[1]||f.name));const restore=el('button','Restaurează');restore.onclick=async()=>{restore.disabled=true;try{await this.request('/points/'+f.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({notes:f.notes||'',category:f.category,deleted:false,version:f.version})});await this.refresh();row.remove();}catch(e){alert(e.message);restore.disabled=false;}};row.append(restore);content.append(row);}}catch(e){alert(e.message);}};
  if(this.api)$('sidebar').insertBefore(button,$('sidebar').querySelector('footer'));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&this.api&&!this.busy&&$('details').hidden)this.refresh().catch(()=>{});});
  setInterval(()=>{if(this.api&&!document.hidden&&!this.busy&&$('details').hidden)this.refresh().catch(()=>{});},30000);
 }
};

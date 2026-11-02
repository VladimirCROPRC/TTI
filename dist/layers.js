function groupLayerControls(){
 const root=$('layers');
 for(const [name,prefix] of [['Cabluri','Cabluri/'],['Patrulare','Patrulare/'],['Pichetare','Pichetare/'],['Predări de amplasament','Predări de amplasament/'],['Tichete','Tichete/'],['Importate','Importate/']]){
  const rows=[...root.querySelectorAll('.layer')].filter(row=>{const key=row.querySelector('input').dataset.key;if(!short(key).startsWith(prefix))return false;if(prefix==='Tichete/'&&!data.features.some(f=>f.type==='Point'&&f.category===key)){row.remove();return false;}return true;});
  if(!rows.length)continue;
  const section=el('section',undefined,'layer-group');section.dataset.prefix=prefix;
  const heading=el('div',undefined,'layer-group-heading');const label=el('label');
  const check=el('input');check.type='checkbox';check.className='group-check';check.setAttribute('aria-label',name+' — toate sublayerele');
  label.append(check,el('strong',name));const count=el('small');count.className='group-count';label.append(count);
  const toggle=el('button','▾');toggle.setAttribute('aria-label','Restrânge grupul '+name);toggle.setAttribute('aria-expanded','true');
  const children=el('div',undefined,'layer-group-children');
  heading.append(label,toggle);section.append(heading,children);root.insertBefore(section,rows[0]);
  if(prefix==='Tichete/'&&TTI.api){const manage=el('button','Selectează tichete');manage.type='button';manage.onclick=()=>TTI.selectTickets();section.insertBefore(manage,children);}
  for(const row of rows){row.querySelector('.layer-name').textContent=short(row.querySelector('input').dataset.key).slice(prefix.length);children.append(row);}
  check.onchange=()=>{for(const row of rows)enabled.set(row.querySelector('input').dataset.key,check.checked);render();};
  toggle.onclick=()=>{children.hidden=!children.hidden;toggle.textContent=children.hidden?'▸':'▾';toggle.setAttribute('aria-expanded',String(!children.hidden));toggle.setAttribute('aria-label',(children.hidden?'Extinde':'Restrânge')+' grupul '+name);};
 }
 updateLayerGroups();
}
TTI.selectTickets=async function(){
 if(this.busy)return;
 try{await this.refresh();}catch(e){alert(e.message);return;}
 selected=null;const content=$('detail-content');content.replaceChildren(el('h2','Ștergere tichete','detail-title'),el('p','Selectează tichetele de șters. Se vor ascunde toate punctele lor, pentru toți utilizatorii. Punctele și fotografiile pot fi recuperate din „Puncte șterse”.'));$('details').hidden=false;
 const entries=new Map();for(const f of data.features)if(f.type==='Point'&&short(f.category).startsWith('Tichete/')){if(!entries.has(f.category))entries.set(f.category,[]);entries.get(f.category).push(f);}
 const choices=[],list=el('div',undefined,'ticket-delete-list'),message=el('p','','save-status');message.setAttribute('role','status');
 const remove=el('button','Șterge tichetele selectate','delete-point');remove.disabled=true;
 const allLabel=el('label'),all=el('input');all.type='checkbox';allLabel.append(all,document.createTextNode(' Selectează toate tichetele'));
 const update=()=>{const n=choices.filter(c=>c.input.checked).length;remove.disabled=!n;all.checked=n>0&&n===choices.length;all.indeterminate=n>0&&n<choices.length;};
 for(const [key,points] of entries){const label=el('label'),input=el('input');input.type='checkbox';label.style.display='block';label.style.margin='12px 0';label.append(input,document.createTextNode(' '+short(key).slice(8)+' · '+points.length+' puncte'));input.onchange=update;choices.push({input,points});list.append(label);}
 all.onchange=()=>{for(const c of choices)c.input.checked=all.checked;update();};
 remove.onclick=async()=>{if(this.busy)return;const chosen=choices.filter(c=>c.input.checked),points=chosen.flatMap(c=>c.points);if(!points.length||!confirm('Ștergi '+chosen.length+' tichete și '+points.length+' puncte pentru toți utilizatorii? Punctele pot fi restaurate din „Puncte șterse”.'))return;
  this.busy=true;content.querySelectorAll('button,input').forEach(n=>n.disabled=true);let done=0,error;
  try{for(const f of points){message.textContent='Se șterg punctele: '+done+' / '+points.length;await this.request('/points/'+encodeURIComponent(f.id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({notes:f.notes||'',category:f.category,deleted:true,version:f.version})});done++;}}catch(e){error=e;}
  try{await this.refresh();}catch(e){error=error||e;}finally{this.busy=false;}
  if(error){message.textContent='Au fost șterse '+done+' din '+points.length+' puncte. '+error.message+' Redeschide selecția pentru a încărca ultima versiune.';const retry=el('button','Reîncarcă lista');retry.onclick=()=>this.selectTickets();content.append(retry);}else{content.replaceChildren(el('h2','Tichete șterse','detail-title'),el('p','Au fost șterse '+chosen.length+' tichete ('+done+' puncte). Le poți recupera din „Puncte șterse”.'));}
 };
 if(!choices.length)content.append(el('p','Nu există tichete active.'));else content.append(allLabel,list,remove,message);
};
function updateLayerGroups(){
 document.querySelectorAll('.layer-group').forEach(section=>{
  const checks=[...section.querySelectorAll('.layer input')];const active=checks.filter(n=>enabled.get(n.dataset.key)).length;
  const check=section.querySelector('.group-check');check.checked=active===checks.length;check.indeterminate=active>0&&active<checks.length;
  section.querySelector('.group-count').textContent=data.features.filter(f=>checks.some(c=>featureLayers(f).includes(c.dataset.key))).length;
 });
}

function groupLayerControls(){
 const root=$('layers');
 for(const [name,prefix] of [['Cabluri','Cabluri/'],['Patrulare','Patrulare/'],['Pichetare','Pichetare/'],['Predări de amplasament','Predări de amplasament/'],['Tichete','Tichete/']]){
  const rows=[...root.querySelectorAll('.layer')].filter(row=>short(row.querySelector('input').dataset.key).startsWith(prefix));
  if(!rows.length)continue;
  const section=el('section',undefined,'layer-group');section.dataset.prefix=prefix;
  const heading=el('div',undefined,'layer-group-heading');const label=el('label');
  const check=el('input');check.type='checkbox';check.className='group-check';check.setAttribute('aria-label',name+' — toate sublayerele');
  label.append(check,el('strong',name));const count=el('small');count.className='group-count';label.append(count);
  const toggle=el('button','▾');toggle.setAttribute('aria-label','Restrânge grupul '+name);toggle.setAttribute('aria-expanded','true');
  const children=el('div',undefined,'layer-group-children');
  heading.append(label,toggle);section.append(heading,children);root.insertBefore(section,rows[0]);
  for(const row of rows){row.querySelector('.layer-name').textContent=short(row.querySelector('input').dataset.key).slice(prefix.length);children.append(row);}
  check.onchange=()=>{for(const row of rows)enabled.set(row.querySelector('input').dataset.key,check.checked);render();};
  toggle.onclick=()=>{children.hidden=!children.hidden;toggle.textContent=children.hidden?'▸':'▾';toggle.setAttribute('aria-expanded',String(!children.hidden));toggle.setAttribute('aria-label',(children.hidden?'Extinde':'Restrânge')+' grupul '+name);};
 }
 updateLayerGroups();
}
function updateLayerGroups(){
 document.querySelectorAll('.layer-group').forEach(section=>{
  const checks=[...section.querySelectorAll('.layer input')];const active=checks.filter(n=>enabled.get(n.dataset.key)).length;
  const check=section.querySelector('.group-check');check.checked=active===checks.length;check.indeterminate=active>0&&active<checks.length;
  section.querySelector('.group-count').textContent=data.features.filter(f=>checks.some(c=>featureLayers(f).includes(c.dataset.key))).length;
 });
}

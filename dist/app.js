function matchesLocation(f,q){
 const address=(f.description.match(/Adresa:\s*([^\n]*)/i)||[])[1]||'';
 const normalize=s=>s.toLocaleLowerCase('ro').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 if(normalize(address).includes(normalize(q)))return true;
 const coordinates=f.type==='Point'?[f.coordinates]:f.coordinates;
 const query=q.replace(/\s+/g,'').replace(/;/g,',');
 return coordinates.some(pair=>[pair.join(','),pair.map(n=>n.toFixed(6)).join(',')].some(s=>s.includes(query)));
}
/* Local KMZ data is treated as content, never executable markup. */
const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
let map,data,base,selected,photoIndex=0;const groups=new Map(),records=new Map(),enabled=new Map();
const short=name=>name.replace(/^TTI \(1\)\//,'').replace(/^Tikete(?=\/|$)/,'Tichete').replace(/^Predari amplasament(?=\/|$)/,'Predări de amplasament');
function asset(path){return path.startsWith('files/')&&!path.includes('..')?path:null;}
function image(path,alt){const n=el('img');n.src=TTI.photoUrl(asset(path)||path);n.alt=alt;n.loading='lazy';return n;}
function toggleCategory(key,on){enabled.set(key,on);render();}
function show(f){if(TTI.cablePicking)return;TTI.cancelCableSelection();selected=f;$('details').hidden=false;const content=$('detail-content');content.replaceChildren(el('div',short(f.category),'detail-category'),el('h2',f.name,'detail-title'),el('p',f.description,'description'));
 if(f.type==='Point')content.append(el('span',f.coordinates.map(n=>n.toFixed(6)).join(', '),'coordinates'));
 if(f.type==='LineString'){TTI.addCableEditor(f,content);return;}content.append(el('h3',`${f.photos.length} fotografii`));const gallery=el('div',undefined,'gallery');
 f.photos.forEach((p,i)=>{const b=el('button');b.append(image(p.src,p.caption||`Fotografia ${i+1}`),el('small',p.caption));b.onclick=()=>openPhoto(i);const tile=el('div',undefined,'photo-tile');const remove=el('button','Șterge fotografia','remove-photo');remove.onclick=()=>TTI.deletePhoto(f,p);tile.append(b,remove);gallery.append(tile);});
 if(!f.photos.length)gallery.append(el('p','Nu există fotografii asociate acestui element.','empty'));content.append(gallery);TTI.addEditor(f,content);
}
function openPhoto(i){photoIndex=(i+selected.photos.length)%selected.photos.length;const p=selected.photos[photoIndex];$('full-photo').src=TTI.photoUrl(asset(p.src)||p.src);$('full-photo').alt=p.caption;$('caption').textContent=`${photoIndex+1} / ${selected.photos.length} · ${p.caption}`;if(!$('viewer').open)$('viewer').showModal();}
function focus(f){const key=featureLayer(f);enabled.set(key,true);render();const r=records.get(f.id);if(f.type==='Point'){map.setView(f.coordinates,Math.max(map.getZoom(),16));r.openTooltip();}else map.fitBounds(r.getBounds(),{padding:[40,40]});show(f);if(innerWidth<=650)$('sidebar').classList.add('mobile-hidden');}
function render(){const q=$('search').value.trim().toLocaleLowerCase('ro');let visible=0;const visibleIds=new Set();groups.forEach(g=>g.clearLayers());const found=[];for(const f of data.features){const key=featureLayer(f);if(q&&!matchesLocation(f,q))continue;if(f.type==='LineString'){let added=false;records.get(f.id).eachLayer(part=>{if(enabled.get(part._ttiLayer)){groups.get(part._ttiLayer).addLayer(part);added=true;}});if(!added)continue;}else{if(!enabled.get(key))continue;groups.get(key).addLayer(records.get(f.id));}visibleIds.add(f.id);visible++;if(f.type==='Point')found.push(f);}
 $('results').replaceChildren();for(const f of found){const b=el('button',undefined,'result');if(asset(f.style.icon))b.append(image(f.style.icon,''));const t=el('div');t.append(el('strong',f.name),el('small',short(f.category)));b.append(t,el('small',`${f.photos.length} foto`,'photo-count'));b.onclick=()=>focus(f);$('results').append(b);}if(!found.length)$('results').append(el('p','Niciun punct pentru filtrele selectate.','empty'));
 $('result-count').textContent=found.length;$('status').textContent=`${visible} elemente vizibile · Click pe un punct pentru fotografii`;document.querySelectorAll('.layer input').forEach(n=>n.checked=enabled.get(n.dataset.key));$('all').textContent=[...enabled.values()].some(Boolean)?'Ascunde toate':'Arată toate';
 updateLayerGroups();if(selected&&!visibleIds.has(selected.id))$('details').hidden=true;
}
function fit(){const bounds=L.latLngBounds([]);groups.forEach(g=>{if(g.getLayers().length)bounds.extend(g.getBounds());});if(bounds.isValid())map.fitBounds(bounds,{padding:[35,85]});else $('status').textContent='Nu există elemente vizibile de încadrat.';}
async function init(){try{if(!window.L)throw Error('Biblioteca hărții nu s-a încărcat.');data=structuredClone(window.TTI_DATA);if(!data)throw Error('Datele nu s-au încărcat.');await TTI.load(data);map=L.map('map',{zoomControl:false,preferCanvas:true});L.control.zoom({position:'topright'}).addTo(map);L.control.scale({imperial:false,position:'bottomright'}).addTo(map);
 const bases={osm:L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}),satellite:L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'})};base=bases.osm.addTo(map);
 for(const key of ['osm','satellite'])$(key).onclick=()=>{map.removeLayer(base);base=bases[key].addTo(map);for(const k of ['osm','satellite']){$(k).classList.toggle('active',k===key);$(k).setAttribute('aria-pressed',String(k===key));}};
 rebuildLayers();
 for(const f of TTI.all){const r=f.type==='Point'?pointMarker(f):cableRecord(f);records.set(f.id,r);}
 render();fit();TTI.setup();$('search').oninput=render;$('fit').onclick=fit;$('all').onclick=()=>{const on=![...enabled.values()].some(Boolean);enabled.forEach((_,k)=>enabled.set(k,on));render();};
 }catch(e){$('status').textContent=`Eroare: ${e.message} Reîncarcă pagina.`;console.error(e);}}
$('close-details').onclick=()=>{$('details').hidden=true;TTI.cancelCableSelection();};$('close-viewer').onclick=()=>$('viewer').close();$('prev').onclick=()=>openPhoto(photoIndex-1);$('next').onclick=()=>openPhoto(photoIndex+1);$('viewer').addEventListener('keydown',e=>{if(e.key==='ArrowLeft')openPhoto(photoIndex-1);if(e.key==='ArrowRight')openPhoto(photoIndex+1);});$('menu').onclick=()=>$('sidebar').classList.toggle('mobile-hidden');if(innerWidth<=650)$('sidebar').classList.add('mobile-hidden');init();

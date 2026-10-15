TTI.setCableDeleted=async function(f,deleted){
 if(this.busy)return;if(deleted&&!confirm('Ștergi întregul cablu „'+f.name+'” pentru toți utilizatorii? Traseul și porțiunile înregistrate pot fi recuperate din „Cabluri șterse”.'))return;
 this.busy=true;try{await this.request('/cables/'+f.id+'/visibility',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({deleted,version:f.cable.version})});this.cancelCableSelection();selected=null;await this.refresh();$('details').hidden=true;return true;}catch(e){alert(e.message);await this.refresh().catch(()=>{});return false;}finally{this.busy=false;}
};
TTI.addCableDeleteButton=function(f,block){const remove=el('button','Șterge cablul','delete-point');remove.onclick=()=>this.setCableDeleted(f,true);block.append(el('p','Ștergerea ascunde întregul cablu pentru toți utilizatorii. Poate fi restaurat din „Cabluri șterse”.'),remove);};
TTI.setupCableDeletion=function(){
 const button=el('button','Cabluri șterse','deleted-points');
 const list=async()=>{if(this.busy)return;try{this.cancelCableSelection();this.cancelPointCreation?.();selected=null;await this.refresh();const content=$('detail-content');content.replaceChildren(el('h2','Cabluri șterse','detail-title'));$('details').hidden=false;const deleted=this.all.filter(f=>f.type==='LineString'&&f.cable?.deleted&&(!f.importId||this.imported?.get(f.id)?.active));if(!deleted.length)content.append(el('p','Nu există cabluri șterse.'));for(const f of deleted){const row=el('article',undefined,'restore-row');row.append(el('strong',f.name||f.id));const restore=el('button','Restaurează cablul');restore.onclick=async()=>{if(await this.setCableDeleted(f,false))await list();};row.append(restore);content.append(row);}}catch(e){alert(e.message);}};
 button.onclick=list;if(this.api)$('sidebar').insertBefore(button,$('sidebar').querySelector('footer'));
};

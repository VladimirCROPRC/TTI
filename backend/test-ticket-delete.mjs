import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class Node {
 constructor(tag,text){this.tag=tag;this.textContent=text||'';this.children=[];this.style={};}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(){}
 querySelectorAll(){return this.children.flatMap(n=>[n,...(n.querySelectorAll?.()||[])]).filter(n=>['button','input'].includes(n.tag));}
}
async function run(failAt){
 const points=[{id:'a',type:'Point',category:'Tichete/1',version:3},{id:'b',type:'Point',category:'Tichete/1',version:4},{id:'c',type:'Point',category:'Tichete/2',version:5},{id:'d',type:'Point',category:'Patrulare/OK',version:2}];
 const nodes={details:new Node('article'),'detail-content':new Node('div')},calls=[];
 const context={TTI:{busy:false,refresh:async()=>{},request:async(path,options)=>{if(calls.length===failAt)throw Error('conflict');calls.push({path,body:JSON.parse(options.body)});}},data:{features:points},selected:null,$:id=>nodes[id],el:(tag,text)=>new Node(tag,text),short:s=>s,document:{createTextNode:text=>new Node('text',text)},confirm:()=>true,alert:message=>{throw Error(message);},encodeURIComponent};
 vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../dist/layers.js',import.meta.url),'utf8'),context);
 await context.TTI.selectTickets();const content=nodes['detail-content'],inputs=content.querySelectorAll().filter(n=>n.tag==='input'),remove=content.querySelectorAll().find(n=>n.textContent==='Șterge tichetele selectate');
 assert.equal(inputs.length,3);assert.equal(remove.disabled,true);
 inputs[1].checked=true;inputs[1].onchange();assert.equal(remove.disabled,false);assert.equal(inputs[0].indeterminate,true);
 await remove.onclick();assert.equal(context.TTI.busy,false);assert.equal(calls.length,failAt===undefined?2:failAt);assert.ok(calls.every(c=>c.body.deleted===true&&c.body.category==='Tichete/1'));assert.equal(calls[0].body.version,3);
 if(failAt!==undefined)assert.match(content.children.find(n=>n.textContent.includes('Au fost șterse')).textContent,/1 din 2/);
 else assert.match(content.children[1].textContent,/1 tichete \(2 puncte\)/);
}
await run();await run(1);console.log('Ticket deletion: selected ticket only, all associated points, versions, recovery flag and partial failure passed.');

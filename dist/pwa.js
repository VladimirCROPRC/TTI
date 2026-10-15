(()=>{
 const standalone=()=>matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone===true;
 const button=document.createElement('button');button.id='install-app';button.textContent='Instalează aplicația';button.hidden=standalone();document.querySelector('header').append(button);
 let installPrompt=null;
 addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;button.hidden=standalone();});
 addEventListener('appinstalled',()=>{button.hidden=true;installPrompt=null;});
 button.onclick=async()=>{
  if(installPrompt){const prompt=installPrompt;installPrompt=null;try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')button.hidden=true;}catch{instructions();}return;}
  instructions();
 };
 function instructions(){
  let dialog=document.getElementById('install-help');if(dialog){dialog.showModal();return;}
  dialog=document.createElement('dialog');dialog.id='install-help';dialog.setAttribute('aria-labelledby','install-title');
  const heading=document.createElement('h2');heading.id='install-title';heading.textContent='Instalează TTI';dialog.append(heading);
  for(const text of ['Windows 11 · Deschide site-ul în Chrome sau Edge și folosește pictograma de instalare din bara de adresă ori meniul browserului: Instalează TTI / Aplicații → Instalează acest site ca aplicație.','macOS · În Chrome sau Edge folosește instalarea din meniul browserului. În Safari pe macOS Sonoma 14 sau mai nou: Fișier → Adaugă în Dock (File → Add to Dock).','După instalare, pornește TTI din Start, bara de activități sau Dock. Se deschide într-o fereastră proprie, fără bara de adresă. Internetul și VPN-ul WireGuard rămân necesare.']){const p=document.createElement('p');p.textContent=text;dialog.append(p);}
  const close=document.createElement('button');close.textContent='Am înțeles';close.onclick=()=>dialog.close();dialog.append(close);document.body.append(dialog);dialog.showModal();
 }
 if('serviceWorker' in navigator&&isSecureContext)addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{/* Browser installation help remains available. */});});
})();

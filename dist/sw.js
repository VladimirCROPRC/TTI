/* Network only: installation never stores network data, photos or map tiles offline. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(fetch(new Request(event.request,{cache:'no-store'})).catch(()=>{
  if(event.request.mode!=='navigate')return Response.error();
  return new Response('<!doctype html><html lang="ro"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TTI · Conexiune necesară</title><body style="margin:0;background:#102735;color:#fff;font:17px system-ui;display:grid;place-items:center;min-height:100vh"><main style="max-width:420px;padding:32px"><h1>TTI</h1><h2>Conexiune necesară</h2><p>Verifică internetul și conectează VPN-ul WireGuard pentru a accesa harta.</p><a href="/" style="color:#4ad9c0">Reîncearcă</a></main></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
 }));
});

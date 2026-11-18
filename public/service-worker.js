/* Frontline PWA: caches PUBLIC app shell and immutable assets only.
 * Never caches or replays account, API, OAuth or project responses.
 */
const VERSION='frontline-public-v2';
const STATIC_CACHE=VERSION+'-static';
const SHELL_CACHE=VERSION+'-shell';
const SHELL=['/','/favicon.svg','/pwa-icon.svg','/manifest.webmanifest'];
const isPrivate=path=>path.startsWith('/api/')||path.startsWith('/auth/');
// Vite's script and stylesheet are loaded before the newly registered worker
// controls the first tab. Precaching the exact hashed paths referenced by the
// public HTML makes a FIRST-install offline reopen possible.
const immutableFromIndex=html=>{
  const paths=new Set();
  for(const match of String(html||'').matchAll(/(?:src|href)=["'](\/assets\/[a-zA-Z0-9_.-]+\.(?:js|css|png|svg|woff2?))["']/g))
    paths.add(match[1]);
  return [...paths].slice(0,25);
};
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const shell=await caches.open(SHELL_CACHE);
    await shell.addAll(SHELL);
    const document=await shell.match('/');
    if(!document)throw new Error('Public app shell unavailable during PWA installation.');
    const assets=immutableFromIndex(await document.text());
    // A Vite-built production shell must include at least one JS bundle.
    // Do not install a misleading partial offline shell.
    if(!assets.some(p=>p.endsWith('.js')))
      throw new Error('Production JavaScript bundle was not found in the app shell.');
    const staticCache=await caches.open(STATIC_CACHE);
    await staticCache.addAll(assets);
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('frontline-public-')&&
      ![STATIC_CACHE,SHELL_CACHE].includes(k)).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||isPrivate(url.pathname))return;
  if(url.pathname.startsWith('/assets/')){
    // Built Vite assets have content-hashed names.
    event.respondWith(caches.open(STATIC_CACHE).then(async cache=>{
      const saved=await cache.match(request);
      if(saved)return saved;
      const network=await fetch(request);
      if(network.ok&&network.type==='basic')await cache.put(request,network.clone());
      return network;
    }));
    return;
  }
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const network=await fetch(request);
        if(network.ok&&network.type==='basic'&&
          (url.pathname==='/'||url.pathname==='/studio'||url.pathname==='/login')){
          const cache=await caches.open(SHELL_CACHE);
          await cache.put('/',network.clone());
        }
        return network;
      }catch{
        const saved=await caches.match('/');
        return saved||Response.error();
      }
    })());
    return;
  }
  // Skip cross-origin third-party assets; public icons/manifest can be cached.
  if(['/favicon.svg','/pwa-icon.svg','/pwa-icon-maskable.svg','/manifest.webmanifest'].includes(url.pathname)){
    event.respondWith(caches.open(SHELL_CACHE).then(async cache=>{
      const hit=await cache.match(request);
      if(hit)return hit;
      const response=await fetch(request);
      if(response.ok&&response.type==='basic')await cache.put(request,response.clone());
      return response;
    }));
  }
});

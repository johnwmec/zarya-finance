
const SW_VERSION='v2.3.4';
self.addEventListener('install', (e)=>{ self.skipWaiting(); });
self.addEventListener('activate', (e)=>{ e.waitUntil((async()=>{ await self.clients.claim(); })()); });

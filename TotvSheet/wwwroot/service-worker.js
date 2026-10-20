// In development the service worker does nothing, so changes show up on refresh.
// The published app uses service-worker.published.js (offline support, TVCS-105).
self.addEventListener('fetch', () => { });

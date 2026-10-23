// Install/offline support (TVCS-105): registers the service worker, offers updates without forcing a reload,
// and asks the browser to keep this site's storage (characters and imported books) instead of clearing it.
(function () {
  // Keep stored data: browsers may otherwise evict it when space runs low.
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persisted().then(function (done) { if (!done) navigator.storage.persist(); }).catch(function () { });
  }
  if (!('serviceWorker' in navigator)) return;

  var bar = document.getElementById('update-bar');
  var userAskedToReload = false;

  function offer(worker) {
    if (!bar || !worker) return;
    bar.hidden = false;
    document.getElementById('update-reload').onclick = function () {
      userAskedToReload = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    };
  }

  // Reload only when the player chose to, so nothing they're typing is lost.
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (userAskedToReload) location.reload();
  });

  navigator.serviceWorker.register('service-worker.js', { updateViaCache: 'none' }).then(function (reg) {
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', function () {
      var w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', function () {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
      });
    });
    // Look for a new version whenever the app comes back to the foreground.
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () { }); });
  }).catch(function (e) { console.warn('Service worker not registered:', e); });
})();

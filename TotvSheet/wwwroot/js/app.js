// Small helpers called from Blazor via JS interop.
window.totv = {
  download: function (fileName, content) {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  confirm: function (message) {
    return window.confirm(message);
  },
  // localStorage write that reports failure (storage full or blocked) instead of throwing (TVCS-101).
  lsSet: function (key, value) {
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  },
  lsRemove: function (key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  },
  // Short device description for problem reports (TVCS-106), e.g. "Chrome 141 · Android 14 · 800×1280 · installed".
  deviceInfo: function () {
    const ua = navigator.userAgent;
    const m = (re) => { const r = ua.match(re); return r ? r[1] : null; };
    const browser = m(/CriOS\/(\d+)/) ? 'Chrome ' + m(/CriOS\/(\d+)/) : m(/FxiOS\/(\d+)/) ? 'Firefox ' + m(/FxiOS\/(\d+)/) : m(/EdgiOS\/(\d+)/) ? 'Edge ' + m(/EdgiOS\/(\d+)/)
      : m(/Edg\/(\d+)/) ? 'Edge ' + m(/Edg\/(\d+)/) : m(/SamsungBrowser\/(\d+)/) ? 'Samsung Internet ' + m(/SamsungBrowser\/(\d+)/)
      : m(/Firefox\/(\d+)/) ? 'Firefox ' + m(/Firefox\/(\d+)/) : m(/Chrome\/(\d+)/) ? 'Chrome ' + m(/Chrome\/(\d+)/)
      : m(/Version\/([\d.]+).*Safari/) ? 'Safari ' + m(/Version\/([\d.]+).*Safari/) : 'Unknown browser';
    const os = m(/Android ([\d.]+)/) ? 'Android ' + m(/Android ([\d.]+)/) : /iPhone|iPad|iPod/.test(ua) ? 'iOS ' + (m(/OS (\d+[_\d]*)/) || '').replace(/_/g, '.')
      : /Mac OS X/.test(ua) && navigator.maxTouchPoints > 1 ? 'iPadOS'
      : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
    const installed = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone ? 'installed' : 'in browser';
    return [browser, os, screen.width + '×' + screen.height, installed].join(' · ');
  },
  // Opens a visually hidden file input from a real button.
  clickElement: function (id) {
    const el = document.getElementById(id);
    if (el) el.click();
  },
  // IndexedDB key/value store for data too big for localStorage (the content library).
  // idbGet resolves the stored string, "" when the key is missing, or null when IndexedDB is unavailable.
  _db: null,
  _open: function () {
    if (!this._db) {
      this._db = new Promise(function (res, rej) {
        const r = indexedDB.open("totv-sheet", 1);
        r.onupgradeneeded = function () { r.result.createObjectStore("kv"); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
        r.onblocked = function () { rej(new Error("blocked")); };
        setTimeout(function () { rej(new Error("timeout")); }, 2000);
      });
      const self = this;
      this._db.catch(function () { self._db = null; }); // try again on the next call
    }
    return this._db;
  },
  idbGet: async function (key) {
    try {
      const db = await this._open();
      return await new Promise(function (res, rej) {
        const q = db.transaction("kv").objectStore("kv").get(key);
        q.onsuccess = function () { res(typeof q.result === "string" ? q.result : ""); };
        q.onerror = function () { rej(q.error); };
      });
    } catch (e) { return null; }
  },
  idbSet: async function (key, value) {
    try {
      const db = await this._open();
      await new Promise(function (res, rej) {
        const t = db.transaction("kv", "readwrite");
        t.objectStore("kv").put(value, key);
        t.oncomplete = function () { res(); };
        t.onerror = function () { rej(t.error); };
        t.onabort = function () { rej(t.error || new Error("aborted")); };
      });
      return true;
    } catch (e) { return false; }
  }
};

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
  }
};

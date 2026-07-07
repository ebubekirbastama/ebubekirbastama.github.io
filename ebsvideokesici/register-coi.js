if (!window.crossOriginIsolated && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./coi-serviceworker.js').then(() => {
    if (!navigator.serviceWorker.controller) window.location.reload();
  }).catch(console.error);
}

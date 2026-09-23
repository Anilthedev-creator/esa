/*
 * tracking.js
 * Lightweight page-view tracking for the ESA Engineering website.
 * Sends a beacon to the backend analytics endpoint on each page load
 * so the admin dashboard can show visit statistics.
 */

(function () {
  'use strict';

  var API = (window.ESA_API_URL ? window.ESA_API_URL.replace(/\/$/, '') : '') + '/api/analytics/track';

  // don't track admin pages or if the user opted out
  if (window.doNotTrack === '1' || navigator.doNotTrack === '1') return;

  // figure out which page this is
  var parts = window.location.pathname.split('/');
  var page = parts[parts.length - 1] || 'index.html';

  // use sendBeacon if available (doesn't block page unload),
  // otherwise fall back to a plain fetch
  var payload = JSON.stringify({
    page: page,
    referrer: document.referrer || '',
    ts: new Date().toISOString()
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(API, new Blob([payload], { type: 'application/json' }));
  } else {
    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    }).catch(function () { /* silent fail */ });
  }
})();
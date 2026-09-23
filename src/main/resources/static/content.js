/*
 * content.js
 * loads any content changes made in the admin panel and applies
 * them to this page. elements you want to be editable get a
 * data-cms attribute on them, eg:
 *
 *   <p data-cms="hero-intro">This text can be edited in the admin</p>
 *
 * if the page has no data-cms elements this script does nothing,
 * and if the backend is not running the page just shows its normal text.
 */

document.addEventListener("DOMContentLoaded", function () {
  // only bother if this page actually has editable elements
  var editable = document.querySelectorAll("[data-cms]");
  if (editable.length === 0) return;

  // work out which page we are on (eg about.html)
  var parts = window.location.pathname.split("/");
  var page = parts[parts.length - 1] || "index.html";

  fetch("/api/content?slug=" + encodeURIComponent(page))
    .then(function (res) {
      if (!res.ok) return null;
      return res.json();
    })
    .then(function (data) {
      if (!data || !data.blocks) return;

      // put any saved text into the matching elements
      for (var i = 0; i < editable.length; i++) {
        var el = editable[i];
        var key = el.getAttribute("data-cms");
        if (data.blocks[key] === undefined) continue; // not edited, leave it

        if (el.hasAttribute("data-cms-html")) {
          // keep the html inside (for text with <br> or <strong> etc)
          el.innerHTML = data.blocks[key];
        } else {
          // plain text (safer, no html)
          el.textContent = data.blocks[key];
        }
      }
    })
    .catch(function () {
      // backend not running - just show the normal page text
    });
});

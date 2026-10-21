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

(function () {
  'use strict';

  var allowedTags = {
    A: true, B: true, BR: true, EM: true, I: true, LI: true,
    OL: true, P: true, SMALL: true, SPAN: true, STRONG: true,
    U: true, UL: true
  };
  var blockedTags = {
    IFRAME: true, OBJECT: true, SCRIPT: true, STYLE: true, SVG: true,
    MATH: true, TEMPLATE: true, VIDEO: true, AUDIO: true
  };
  var safeColours = ['var(--cyan)', 'var(--cyan-text)', 'var(--navy)', 'var(--red)', 'var(--muted)'];

  function safeLink(value) {
    var link = String(value || '').trim();
    if (!link || /[\u0000-\u001f]/.test(link)) return '';
    if (/^(mailto:|tel:)/i.test(link)) return link;
    if (link.charAt(0) === '#') return link;
    try {
      var url = new URL(link, window.location.href);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
      if (window.location.protocol === 'https:' && url.protocol !== 'https:') return '';
      if (url.origin === window.location.origin) return url.pathname + url.search + url.hash;
      return url.href;
    } catch (_) {
      return '';
    }
  }

  function copySafeNode(node) {
    if (node.nodeType === 3) return document.createTextNode(node.nodeValue || '');
    if (node.nodeType !== 1) return document.createDocumentFragment();

    var tag = node.tagName.toUpperCase();
    if (blockedTags[tag]) return document.createDocumentFragment();

    if (!allowedTags[tag]) {
      var plain = document.createDocumentFragment();
      Array.prototype.forEach.call(node.childNodes, function (child) {
        plain.appendChild(copySafeNode(child));
      });
      return plain;
    }

    var clean = document.createElement(tag.toLowerCase());
    if (tag === 'A') {
      var href = safeLink(node.getAttribute('href'));
      if (href) {
        clean.setAttribute('href', href);
        if (/^https:\/\//i.test(href) && new URL(href, window.location.href).origin !== window.location.origin) {
          clean.setAttribute('rel', 'noopener noreferrer');
        }
      }
    }
    if (node.hasAttribute('style')) {
      var colour = node.style.color;
      var weight = node.style.fontWeight;
      var safeStyles = [];
      if (safeColours.indexOf(colour) !== -1) safeStyles.push('color: ' + colour);
      if (weight === '600' || weight === '700' || weight === 'bold') safeStyles.push('font-weight: ' + weight);
      if (safeStyles.length) clean.setAttribute('style', safeStyles.join('; '));
    }
    Array.prototype.forEach.call(node.childNodes, function (child) {
      clean.appendChild(copySafeNode(child));
    });
    return clean;
  }

  function safeCmsHtml(value) {
    var parser = new DOMParser();
    var parsed = parser.parseFromString(String(value || ''), 'text/html');
    var fragment = document.createDocumentFragment();
    Array.prototype.forEach.call(parsed.body.childNodes, function (child) {
      fragment.appendChild(copySafeNode(child));
    });
    return fragment;
  }

  document.addEventListener('DOMContentLoaded', function () {
    // only bother if this page actually has editable elements
    var editable = document.querySelectorAll('[data-cms]');
    if (editable.length === 0) return;

    // work out which page we are on (eg about.html)
    var parts = window.location.pathname.split('/');
    var page = parts[parts.length - 1] || 'index.html';

    fetch('/api/content?slug=' + encodeURIComponent(page))
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.blocks) return;

        // put any saved text into the matching elements
        for (var i = 0; i < editable.length; i++) {
          var el = editable[i];
          var key = el.getAttribute('data-cms');
          if (data.blocks[key] === undefined) continue; // not edited, leave it

          if (el.hasAttribute('data-cms-html')) {
            // keep only small safe bits of markup (br, strong, links etc)
            el.textContent = '';
            el.appendChild(safeCmsHtml(data.blocks[key]));
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
})();

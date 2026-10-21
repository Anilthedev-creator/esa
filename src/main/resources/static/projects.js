// projects.js
// makes the filter buttons above the project grid actually work, and pulls in
// the case studies the office publishes from the admin (caseStudies.html).
// each project photo carries a data-cat="water|mining|food|fuel|infra"
// and each button carries a data-filter with the same word (or "all").

document.addEventListener("DOMContentLoaded", function () {
  var buttons = document.querySelectorAll(".filter-bar button");
  var grid = document.querySelector(".project-grid");
  if (!buttons.length || !grid) return;

  var countEl = document.getElementById("projectCount");
  var currentFilter = "all";

  // category -> the label we show on the card
  var LABELS = {
    water: "Water & Wastewater",
    mining: "Mining",
    food: "Food & Beverage",
    fuel: "Fuel & Energy",
    infra: "Infrastructure"
  };

  // three shimmer cards so the grid doesnt jump when the api cards arrive
  function showSkeletons() {
    for (var i = 0; i < 3; i++) {
      var sk = document.createElement("div");
      sk.className = "skeleton-card";
      sk.setAttribute("data-skeleton", "1");
      sk.innerHTML = '<div class="skeleton-img"></div>' +
        '<div class="skeleton-line w60"></div>' +
        '<div class="skeleton-line"></div>' +
        '<div class="skeleton-line w60"></div>';
      grid.appendChild(sk);
    }
  }
  function hideSkeletons() {
    grid.querySelectorAll("[data-skeleton]").forEach(function (sk) { sk.remove(); });
  }

  function safeImageUrl(value) {
    var fallback = "images/project-remote-site.jpg";
    if (!value || typeof value !== "string") return fallback;
    try {
      var raw = value.trim();
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw)) return fallback;
      var url = new URL(raw, window.location.origin + "/");
      if (url.origin !== window.location.origin || !/^\/images\/[A-Za-z0-9._/-]+\.(?:jpg|jpeg|png|webp)$/i.test(url.pathname)) return fallback;
      return url.pathname;
    } catch (_) {
      return fallback;
    }
  }

  function buildCard(p, i) {
    var card = document.createElement("div");
    card.className = "card" + ((i % 2) ? " card-red" : "");

    // Use DOM fields instead of joining admin content into HTML.
    var category = Object.prototype.hasOwnProperty.call(LABELS, p.category) ? p.category : "infra";
    var img = document.createElement("img");
    img.className = "card-photo";
    img.src = safeImageUrl(p.image);
    img.setAttribute("data-cat", category);
    img.alt = String(p.title || "");
    img.loading = "lazy";

    var label = document.createElement("span");
    label.className = "accent-label";
    label.textContent = LABELS[category];

    var title = document.createElement("h3");
    title.className = "proj-card-title";
    title.textContent = p.title || "";

    var summary = document.createElement("p");
    summary.className = "proj-card-sum";
    summary.textContent = p.summary || "";

    var foot = document.createElement("div");
    foot.className = "proj-card-foot";
    var location = document.createElement("span");
    location.className = "proj-loc";
    location.textContent = p.location || "";
    var value = document.createElement("span");
    value.className = "proj-val";
    value.textContent = p.valueLabel || "";
    foot.appendChild(location);
    foot.appendChild(value);

    card.appendChild(img);
    card.appendChild(label);
    card.appendChild(title);
    card.appendChild(summary);
    card.appendChild(foot);
    return card;
  }

  // "Showing X of Y projects" under the filter bar
  function updateCount() {
    if (!countEl) return;
    var photos = grid.querySelectorAll(".card-photo");
    var shown = 0;
    photos.forEach(function (img) {
      var card = img.closest(".card");
      if (card && card.style.display !== "none") shown++;
    });
    countEl.textContent = "Showing " + shown + " of " + photos.length + " projects";
  }

  function applyFilter(want) {
    currentFilter = want;
    var photos = grid.querySelectorAll(".card-photo");
    var visibleCount = 0;
    photos.forEach(function (img) {
      var card = img.closest(".card");
      if (!card) return;
      if (want === "all" || img.getAttribute("data-cat") === want) {
        card.style.display = "";
        visibleCount++;
      } else {
        card.style.display = "none";
      }
    });
    // friendly message instead of a wall of blank space
    var oldEmpty = grid.querySelector(".empty-state");
    if (oldEmpty) oldEmpty.remove();
    if (!visibleCount) {
      var e = document.createElement("div");
      e.className = "empty-state";
      e.textContent = "No projects in this category yet - check back soon or pick another filter.";
      grid.appendChild(e);
    }
    updateCount();
  }

  showSkeletons();
  fetch("/api/projects")
    .then(function (r) { return r.ok ? r.json() : { projects: [] }; })
    .then(function (data) {
      hideSkeletons();
      (data.projects || []).forEach(function (p, i) {
        grid.appendChild(buildCard(p, i));
      });
      // re-apply whatever filter is on so new cards respect it
      applyFilter(currentFilter);
    })
    .catch(function () {
      // offline is fine, the built-in cards still show
      hideSkeletons();
      updateCount();
    });

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      // swap the active look onto the clicked button
      buttons.forEach(function (b) {
        b.classList.remove("btn-navy");
        b.classList.add("btn-ghost");
      });
      btn.classList.remove("btn-ghost");
      btn.classList.add("btn-navy");
      applyFilter(btn.getAttribute("data-filter"));
    });
  });

  updateCount();
});

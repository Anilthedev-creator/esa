// projects.js
// makes the filter buttons above the project grid actually work.
// each project photo carries a data-cat="water|mining|food|fuel|infra"
// and each button carries a data-filter with the same word (or "all").

document.addEventListener("DOMContentLoaded", function () {
  var buttons = document.querySelectorAll(".filter-bar button");
  var grid = document.querySelector(".project-grid");
  if (!buttons.length || !grid) return;

  // case studies the office published from the admin get tacked on after the
  // built-in cards, same markup so the filters work on them too
  fetch("/api/projects")
    .then(function (r) { return r.ok ? r.json() : { projects: [] }; })
    .then(function (data) {
      (data.projects || []).forEach(function (p) {
        var card = document.createElement("div");
        card.className = "card" + ((data.projects.indexOf(p) % 2) ? " card-red" : "");
        card.innerHTML =
          '<img class="card-photo" src="' + (p.image || "images/project-remote-site.jpg") + '" data-cat="' + (p.category || "infra") + '" alt="' + String(p.title || "").replace(/"/g, "&quot;") + '" loading="lazy">' +
          '<span class="accent-label">' + (p.category === "water" ? "Water & Wastewater" : p.category === "mining" ? "Mining" : p.category === "food" ? "Food & Beverage" : p.category === "fuel" ? "Fuel & Energy" : "Infrastructure") + "</span>" +
          '<h3 style="font-size:1rem;margin-bottom:.5rem;color:var(--navy)">' + String(p.title || "") + "</h3>" +
          '<p style="font-size:var(--sm);color:var(--muted);margin-bottom:var(--s4)">' + String(p.summary || "") + "</p>" +
          '<div style="display:flex;justify-content:space-between;align-items:center;padding-top:var(--s4);border-top:1px solid var(--border)">' +
            '<span style="font-size:var(--xs);color:var(--muted)">' + String(p.location || "") + "</span>" +
            '<span style="font-size:var(--xs);font-weight:700;color:var(--navy)">' + String(p.valueLabel || "") + "</span>" +
          "</div>";
        grid.appendChild(card);
      });
    })
    .catch(function () { /* offline is fine, the built-in cards still show */ });

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var want = btn.getAttribute("data-filter");

      // swap the active look onto the clicked button
      buttons.forEach(function (b) {
        b.classList.remove("btn-navy");
        b.classList.add("btn-ghost");
      });
      btn.classList.remove("btn-ghost");
      btn.classList.add("btn-navy");

      // show/hide the cards (re-queried so added case studies are included)
      var photos = grid.querySelectorAll(".card-photo");
      photos.forEach(function (img) {
        var card = img.closest(".card");
        if (!card) return;
        if (want === "all" || img.getAttribute("data-cat") === want) {
          card.style.display = "";
        } else {
          card.style.display = "none";
        }
      });
    });
  });
});

// projects.js
// makes the filter buttons above the project grid actually work.
// each project photo carries a data-cat="water|mining|food|fuel|infra"
// and each button carries a data-filter with the same word (or "all").

document.addEventListener("DOMContentLoaded", function () {
  var buttons = document.querySelectorAll(".filter-bar button");
  var photos = document.querySelectorAll(".project-grid .card-photo");
  if (!buttons.length || !photos.length) return;

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

      // show/hide the cards (the photo sits inside the card)
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

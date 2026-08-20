/* FAQ 아코디언: 클릭 시 열고 닫기, 키보드(Enter/Space)로도 동작 */
(function () {
  "use strict";

  var items = document.querySelectorAll(".accordion-item");
  if (!items.length) return;

  items.forEach(function (item) {
    var trigger = item.querySelector(".accordion-trigger");
    trigger.addEventListener("click", function () {
      var isOpen = item.getAttribute("data-open") === "true";
      item.setAttribute("data-open", String(!isOpen));
      trigger.setAttribute("aria-expanded", String(!isOpen));
    });
  });

  var searchInput = document.querySelector("[data-faq-search]");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      var query = searchInput.value.trim().toLowerCase();
      items.forEach(function (item) {
        var text = item.textContent.toLowerCase();
        item.style.display = query && text.indexOf(query) === -1 ? "none" : "";
      });
    });
  }
})();

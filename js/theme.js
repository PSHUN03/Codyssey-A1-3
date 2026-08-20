/*
  다크 모드 수동 토글.
  초기 테마(FOUC 방지)는 각 HTML <head>의 인라인 스크립트가 담당하고,
  이 파일은 토글 버튼 클릭에 대한 반응만 처리한다.
*/
(function () {
  "use strict";

  var STORAGE_KEY = "fructus-theme";

  function applyTheme(theme) {
    var root = document.documentElement;
    if (theme === "dark" || theme === "light") {
      root.setAttribute("data-theme", theme);
    } else {
      root.removeAttribute("data-theme");
    }
    updateToggleLabel(theme);
  }

  function currentEffectiveTheme() {
    var explicit = document.documentElement.getAttribute("data-theme");
    if (explicit) return explicit;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function updateToggleLabel(theme) {
    var toggle = document.querySelector("[data-theme-toggle]");
    if (!toggle) return;
    var effective = theme || currentEffectiveTheme();
    var isDark = effective === "dark";
    toggle.setAttribute("aria-pressed", String(isDark));
    toggle.setAttribute("aria-label", isDark ? "라이트 모드로 전환" : "다크 모드로 전환");
  }

  function init() {
    var toggle = document.querySelector("[data-theme-toggle]");
    updateToggleLabel();

    if (!toggle) return;

    toggle.addEventListener("click", function () {
      var next = currentEffectiveTheme() === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch (err) {
        /* 저장소 접근 불가(프라이빗 모드 등) 시에도 이번 세션 토글은 동작하게 둔다 */
      }
      applyTheme(next);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

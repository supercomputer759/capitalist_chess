(function () {
  "use strict";

  const wrapper = document.getElementById("boardWrap");
  const toggle = document.getElementById("boardFullscreenToggle");
  const label = toggle?.querySelector("[data-fullscreen-label]");
  if (!wrapper || !toggle || !label) return;

  function isExpanded() {
    return document.fullscreenElement === wrapper || wrapper.classList.contains("is-fullscreen-fallback");
  }

  function update() {
    const expanded = isExpanded();
    const labelKey = expanded ? "board.fullscreenExit" : "board.fullscreenEnter";
    const ariaKey = expanded ? "board.exitFullscreen" : "board.fullscreen";
    const fallback = expanded ? "나가기" : "전체 화면";
    label.textContent = window.GameLanguage?.text(labelKey, fallback) || fallback;
    toggle.setAttribute("aria-label", window.GameLanguage?.text(ariaKey, expanded ? "전체 화면 닫기" : "체스판 전체 화면") || (expanded ? "전체 화면 닫기" : "체스판 전체 화면"));
    toggle.setAttribute("aria-pressed", String(expanded));
  }

  async function enter() {
    if (wrapper.requestFullscreen) {
      try {
        await wrapper.requestFullscreen();
        return;
      } catch (_) {
        // 브라우저가 전체 화면 요청을 거부하면 화면 안 확장 모드로 전환합니다.
      }
    }
    wrapper.classList.add("is-fullscreen-fallback");
    update();
  }

  async function exit() {
    if (document.fullscreenElement === wrapper && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
      } catch (_) {
        wrapper.classList.remove("is-fullscreen-fallback");
      }
    }
    wrapper.classList.remove("is-fullscreen-fallback");
    update();
  }

  toggle.addEventListener("click", () => {
    if (isExpanded()) void exit();
    else void enter();
  });
  document.addEventListener("fullscreenchange", update);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && wrapper.classList.contains("is-fullscreen-fallback")) {
      wrapper.classList.remove("is-fullscreen-fallback");
      update();
    }
  });
  window.addEventListener("game-language-change", update);
  update();
})();

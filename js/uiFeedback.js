(function () {
  "use strict";

  document.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    const button = event.target.closest("button:not(:disabled)");
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const ripple = document.createElement("span");
    const size = Math.ceil(Math.hypot(rect.width, rect.height) * 1.5);
    ripple.className = "button-click-ripple";
    ripple.setAttribute("aria-hidden", "true");
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    button.classList.add("button-feedback-target");
    button.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove(), {once: true});
    window.setTimeout(() => ripple.remove(), 550);
  }, true);
})();

(function () {
  "use strict";
  let activeCancel = null;
  const text = (key, fallback) => window.GameLanguage?.text(key, fallback) ?? fallback;

  // 확정된 결과만 표시한다. 게임 상태와 경제 판정은 호스트 게임이 담당한다.
  function play(result, { muted = false, onComplete, onFallback } = {}) {
    activeCancel?.();
    const previousFocus = document.activeElement;
    const background = [...document.body.children].map(element => [element, element.inert]);
    const overlay = document.createElement("div");
    overlay.className = "cataclysm-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", text("orbital.cinematic", "궤도 타격 연출"));
    const frame = document.createElement("iframe");
    frame.title = text("orbital.cinematic", "궤도 타격 연출");
    frame.src = "assets/effects/cataclysm/index.html";
    frame.allow = "autoplay";
    const skip = document.createElement("button");
    skip.type = "button";
    skip.className = "cataclysm-skip";
    skip.textContent = text("orbital.skipCinematic", "연출 건너뛰기");
    overlay.append(frame, skip);

    let closed = false, loaded = false;
    const close = (showResult = true) => {
      if (closed) return;
      closed = true;
      clearTimeout(loadTimeout);
      window.removeEventListener("message", onMessage);
      document.removeEventListener("keydown", onKey);
      frame.onload = frame.onerror = null;
      try { frame.contentWindow?.CATACLYSM?.destroy(); } catch (_) { /* 제거된 프레임 */ }
      overlay.remove();
      background.forEach(([element, inert]) => { element.inert = inert; });
      if (activeCancel === cancel) activeCancel = null;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      if (showResult) onComplete?.();
    };
    const cancel = () => close(false);
    const fail = () => {
      if (closed) return;
      close(false);
      onFallback?.();
    };
    const onKey = event => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
    };
    const onMessage = event => {
      if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
      const message = event.data;
      if (message?.source !== "CATACLYSM_V16") return;
      if (message.type === "CATACLYSM:COMPLETE" || message.type === "CATACLYSM:SKIP") close();
      if (message.type === "CATACLYSM:ERROR") fail();
    };
    const loadTimeout = setTimeout(fail, 10000);
    frame.onerror = fail;
    frame.onload = () => {
      if (closed || loaded) return;
      loaded = true;
      try {
        const api = frame.contentWindow?.CATACLYSM;
        if (!api) return fail();
        const destroyed = result.destroyedPieces || [];
        const glyphs = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" };
        const pieces = (result.boardPieces || destroyed).map(piece => ({
          ...piece, glyph: glyphs[piece.visualType || piece.type] || "♞"
        }));
        const ok = api.configure({
          embedded: true, cost: result.cost ?? 24000, currency: "USD", muted,
          quality: "HIGH", resolutionScale: .8, fpsLimit: 60, adaptiveQuality: true,
          target: result.target, pieces,
          report: {
            piecesInZone: destroyed.length,
            whiteInZone: destroyed.filter(piece => piece.color === "w").length,
            blackInZone: destroyed.filter(piece => piece.color === "b").length,
            destroyedAssetValue: (result.friendlyDamage || 0) + (result.enemyDamage || 0),
            currency: "USD"
          }
        });
        if (!ok || !api.launch()) return fail();
        clearTimeout(loadTimeout);
      } catch (error) {
        console.warn("궤도 연출을 기본 효과로 대체해.", error);
        fail();
      }
    };
    skip.addEventListener("click", () => close());
    document.addEventListener("keydown", onKey);
    window.addEventListener("message", onMessage);
    activeCancel = cancel;
    background.forEach(([element]) => { element.inert = true; });
    document.body.appendChild(overlay);
    skip.focus({ preventScroll: true });
    return cancel;
  }
  window.CataclysmBridge = { play, cancel: () => activeCancel?.() };
})();

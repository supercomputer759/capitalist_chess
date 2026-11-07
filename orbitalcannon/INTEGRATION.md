# CATACLYSM V16 · Capitalist Chess integration

현재 프로젝트에 적용된 분리 구조와 최적화·연결 방법은 [최신 연출 안내](../assets/effects/cataclysm/README.md)를 참고하세요. 아래 내용은 제공된 V16의 원래 통합 가이드입니다.

This is the V16 cinematic with a small host-game adapter. The original standalone preview, cinematic sequence, quality controls, replay, performance HUD, and battle-damage report are retained.

## Recommended integration

Host this HTML as a same-origin static asset and open it in an iframe/modal when the host game authorizes an orbital strike.

```html
<iframe id="cataclysmFrame"
  src="/effects/CATACLYSM_V16_CAPITALIST_CHESS.html"
  title="Orbital cannon sequence"
  allow="autoplay"
  style="width:100%;height:790px;border:0"></iframe>
```

Wait for `CATACLYSM:READY`, then configure it:

```js
const frame = document.querySelector("#cataclysmFrame");

frame.contentWindow.postMessage({
  type: "CAPITALIST_CHESS:CONFIG",
  options: {
    embedded: true,
    cost: 50000,
    currency: "USD"
  }
}, location.origin);
```

After the host game has validated the action, charged the player, and resolved the multiplayer-authoritative 3×3 target, launch it:

```js
frame.contentWindow.postMessage({
  type: "CAPITALIST_CHESS:LAUNCH",
  options: {
    target: "e4",
    report: {
      piecesInZone: 4,
      whiteInZone: 1,
      blackInZone: 3,
      destroyedAssetValue: 19350,
      currency: "USD",
      assessment: "3 enemy pieces and 1 allied piece destroyed"
    }
  }
}, location.origin);
```

The target is standard algebraic notation (`a1` through `h8`). The 3×3 blast is centered on that square and clipped to the 8×8 board edges. The host game must compute the actual casualties and asset value from its authoritative board state before sending the report. Do not trust client-side casualty reports for multiplayer.

## Events from the iframe

Listen for messages where `event.source === frame.contentWindow` and `event.data.source === "CATACLYSM_V16"`:

- `CATACLYSM:READY` — adapter loaded.
- `CATACLYSM:STARTED` — cinematic began.
- `CATACLYSM:COMPLETE` — 45-second sequence completed; includes target and supplied report.

Example:

```js
window.addEventListener("message", event => {
  if (event.source !== frame.contentWindow) return;
  if (event.data?.source !== "CATACLYSM_V16") return;
  if (event.data.type === "CATACLYSM:COMPLETE") {
    // Close the overlay, show the host game's final result, etc.
  }
});
```

## Direct API (same-origin iframe)

The iframe also exposes `window.CATACLYSM`:

- `configure({ embedded, cost, currency, target, report })`
- `setTarget("e4")`
- `launch({ target: "e4", report: {...} })`
- `setBattleReport({...})`
- `reset()`
- `getState()`
- `getPerformanceReport()`

**Important:** this effect does not deduct money, decide whose turn it is, or mutate the chessboard. Capitalist Chess remains authoritative for affordability, AP, target validation, multiplayer synchronization, casualties, asset values, and applying the result. The iframe is the cinematic renderer only.

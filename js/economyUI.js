(function () {
  "use strict";
  const R = window.EconomyRules;
  const RULE_KEY = "capitalistChessEconomyCustom", AUTO_KEY = "capitalistChessFinanceAutomation";
  const labels = {
    casual: "캐주얼", standard: "스탠더드", full: "풀 자본주의", custom: "사용자 설정",
    labor: "알바", salary: "월급 인상", deposits: "적금", ventures: "벤처", stocks: "주식·시장 뉴스",
    property: "부동산·통행료", credit: "신용 구매", tax: "기물 유지세", auction: "경매장", automation: "금융 자동화",
    preset: "경제 프리셋", multiplier: "기물·부동산 가격 배율", save: "사용자 규칙 저장", saved: "이 브라우저에 저장했어.",
    hint: "캐주얼: 노동·월급 / 스탠더드: 기존 경제·금융 자동화 / 풀 자본주의: 경매 포함 전체",
    list: "선택 기물 등록 · 1 AP", starting: "시작 가격 (기본 기물 가치 50%)", empty: "진행 중인 경매 없음",
    rules: "4턴 전환 후 종료 · 입찰 1 AP · 인상액 $50 또는 10% · 취소 불가 · 유찰 시 판매자 창고로 반환",
    warehouse: "창고", warehouseEmpty: "창고가 비어 있어.", deploy: "배치 · 1 AP", bid: "입찰 · 1 AP",
    turns: "남은 턴 전환", minimum: "최소 입찰", seller: "판매자", bidder: "입찰자", none: "없음",
    finance: "금융 자동화", repay: "대출 자동 상환", interest: "이자 자동 정산", maturity: "적금·벤처 만기 자동 지급", warning: "파산 위험 알림",
    financeHint: "설정은 플레이어별 적용. 자동 정산을 꺼도 이자는 누적되며, 만기금은 직접 수령할 수 있어.",
    claim: "만기금 수령", repayNow: "대출 직접 상환", interestNow: "이자 정산", pending: "수령 대기", unpaid: "미정산 이자",
    failed: "처리할 수 없어. 내 턴·AP·자금·가격·선택한 칸을 확인해 줘.", done: "경제 요청을 처리했어.",
    choose: "창고 기물을 배치할 자기 진영의 빈 칸을 클릭해.", disabled: "이 프리셋에서 비활성화됨", risk: "파산 위험: 다음 턴 예상 현금", settled: "경매가 종료되어 기물이 창고로 이동했어.", payout: "만기금 지급", debt: "총 대출 잔액", closed: "게임 종료: 경매 예치금 반환 및 기물 창고 보관 완료"
  };
  const t = (key, values = {}) => window.GameLanguage?.text(`expansion.${key}`, labels[key] || key, values) ?? labels[key] ?? key;
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; } };
  let host, saved = read(RULE_KEY, null);
  function node(tag, text, parent, className) {
    const element = document.createElement(tag); if (text !== undefined) element.textContent = text;
    if (className) element.className = className; parent?.appendChild(element); return element;
  }
  function button(parent, label, op, data = {}) {
    const element = node("button", label, parent); element.type = "button"; element.dataset.econOp = op;
    Object.assign(element.dataset, data); return element;
  }
  function renderLobby(rules) {
    const select = document.getElementById("economyPreset"); if (!select) return;
    select.value = rules.preset;
    document.getElementById("economyPriceMultiplier").value = rules.priceMultiplier;
    for (const key of R.FEATURES) document.getElementById(`economyFeature-${key}`).checked = rules.features[key];
    const readonly = ["guest", "spectator"].includes(host.role()) || host.state.started;
    select.disabled = readonly;
    document.querySelectorAll("[data-economy-custom]").forEach(input => { input.disabled = readonly || rules.preset !== "custom"; });
    document.getElementById("economySave").disabled = readonly;
  }
  function lobbyRules() {
    const preset = document.getElementById("economyPreset").value;
    if (preset !== "custom") return R.preset(preset);
    return R.normalize({ preset, priceMultiplier: Number(document.getElementById("economyPriceMultiplier").value),
      features: Object.fromEntries(R.FEATURES.map(key => [key, document.getElementById(`economyFeature-${key}`).checked])) });
  }
  function syncLobby() { if(host)renderLobby(host.state.economyRules); }
  function publishLobby() {
    if (host.state.started || ["guest", "spectator"].includes(host.role())) return;
    host.state.economyRules = lobbyRules();
    if (host.role() === "host") host.publish();
  }
  function init(adapter) {
    host = adapter;
    if(saved?.rules&&!["guest","spectator"].includes(host.role()))host.state.economyRules=R.normalize(saved.rules);
    const lobby = document.getElementById("economyPresetPanel");
    const label = node("label", undefined, lobby); const presetText=node("span", t("preset"), label);presetText.dataset.i18n="expansion.preset";
    const select = node("select", undefined, label); select.id = "economyPreset";
    for (const key of ["casual", "standard", "full", "custom"]) { const option = node("option", t(key), select); option.value = key; option.dataset.i18n = `expansion.${key}`; }
    const hint = node("p", t("hint"), lobby, "hint"); hint.dataset.i18n = "expansion.hint";
    const grid = node("div", undefined, lobby, "economy-feature-grid");
    for (const key of R.FEATURES) {
      const row = node("label", undefined, grid), input = node("input", undefined, row);
      input.type = "checkbox"; input.id = `economyFeature-${key}`; input.dataset.economyCustom = "";
      const span = node("span", t(key), row); span.dataset.i18n = `expansion.${key}`;
    }
    const priceLabel = node("label", undefined, lobby); const priceText = node("span", t("multiplier"), priceLabel); priceText.dataset.i18n = "expansion.multiplier";
    const multiplier = node("input", undefined, priceLabel); Object.assign(multiplier, { id: "economyPriceMultiplier", type: "number", min: ".25", max: "4", step: ".05" }); multiplier.dataset.economyCustom = "";
    const save = node("button", t("save"), lobby); save.id = "economySave"; save.type = "button"; save.dataset.i18n = "expansion.save";
    const saveStatus=node("p","",lobby,"hint");saveStatus.setAttribute("role","status");
    select.addEventListener("change", () => {
      if (["guest", "spectator"].includes(host.role()) || host.state.started) return;
      renderLobby(select.value === "custom" ? R.normalize(saved?.rules || { ...host.state.economyRules, preset: "custom" }) : R.preset(select.value));
      if (select.value === "custom" && saved?.inputs) for (const [id, value] of Object.entries(saved.inputs)) {
        const input = document.getElementById(id); if (input?.matches(".lobby-settings input,.lobby-economy-settings input,.lobby-rules input:not([readonly]):not([disabled])")) {
          if (input.type === "checkbox") input.checked = !!value; else input.value = value;
        }
      }
      publishLobby();
    });
    lobby.addEventListener("change", publishLobby);
    save.addEventListener("click", () => {
      if (["guest", "spectator"].includes(host.role()) || host.state.started) return;
      const rules = { ...lobbyRules(), preset: "custom" }, inputs = {};
      document.querySelectorAll(".lobby-settings input,.lobby-economy-settings input,.lobby-rules input:not([readonly]):not([disabled])").forEach(input => { inputs[input.id] = input.type === "checkbox" ? input.checked : input.value; });
      saved = { rules, inputs };
      if (write(RULE_KEY, saved)) {saveStatus.textContent=t("saved");host.log(t("saved"), "good");}
      renderLobby(rules); publishLobby();
    });
    renderLobby(host.state.economyRules);
    if(saved?.inputs&&!host.role())for(const [id,value] of Object.entries(saved.inputs)){
      const input=document.getElementById(id);
      if(input?.matches(".lobby-settings input,.lobby-economy-settings input,.lobby-rules input:not([readonly]):not([disabled])")){
        if(input.type==="checkbox")input.checked=!!value;else input.value=value;
      }
    }
    document.getElementById("auctionPanel").addEventListener("click", event => handleClick(event));
    document.getElementById("financePanel").addEventListener("click", event => handleClick(event));
    document.getElementById("financePanel").addEventListener("change", event => {
      if (event.target.dataset.financeSetting) send("automation", { key: event.target.dataset.financeSetting, value: event.target.checked });
    });
    window.addEventListener("game-language-change", () => { render(); });
  }
  function send(op, data = {}) {
    if (host.role() === "guest") return window.multiplayer.sendAction({ type: "economyExpansion", op, ...data });
    if (host.role() === "spectator") return;
    host.action(host.role() === "host" ? "w" : host.state.turn, { op, ...data });
  }
  function handleClick(event) {
    const button = event.target.closest("button[data-econ-op]"); if (!button) return;
    const op = button.dataset.econOp, id = Number(button.dataset.id);
    if (op === "list") {
      const input = document.getElementById("auctionStartingPrice");
      return send(op, { square: host.state.selected, startPrice: input.value.trim() ? Number(input.value) : undefined });
    }
    if (op === "bid") return send(op, { id, amount: Number(document.getElementById(`auctionBid-${id}`).value) });
    if (op === "deploy") {
      host.state.mode = "warehouse-deploy"; host.state.pendingWarehouseId = id; host.log(t("choose")); return;
    }
    send(op);
  }
  function ownColor() { return host.role() === "guest" ? "b" : host.role() === "host" ? "w" : host.state.turn; }
  function render() {
    if (!host) return;
    syncLobby();
    const state = host.state, color = ownColor(), p = R.player(state.players[color]);
    const active = state.started && !state.gameOver && state.turn === color && host.role() !== "spectator";
    const auctionPanel = document.getElementById("auctionPanel"), financePanel = document.getElementById("financePanel");
    auctionPanel.hidden = !R.enabled(state, "auction"); financePanel.hidden = !R.enabled(state, "automation");
    const body = document.getElementById("auctionContent");
    const retained = Object.fromEntries([...body.querySelectorAll("input")].map(input => [input.id, input.value])); body.replaceChildren();
    node("p", t("rules"), body, "hint");
    const startLabel = node("label", t("starting"), body), start = node("input", undefined, startLabel);
    Object.assign(start, { id: "auctionStartingPrice", type: "number", min: "1", step: "1", value: retained.auctionStartingPrice || "" });
    button(body, t("list"), "list").disabled = !active || p.ap < 1 || !state.selected;
    if (!state.auctions?.length) node("p", t("empty"), body, "hint");
    for (const item of state.auctions || []) {
      const row = node("div", undefined, body, "economy-item");
      node("b", host.pieceName(item.piece), row);
      node("p", `${t("seller")}: ${host.sideName(item.seller)} · ${t("turns")}: ${Math.max(0, item.endsAt - state.turnNo)}`, row);
      node("p", `${t("bidder")}: ${item.bidder ? host.sideName(item.bidder) : t("none")} · ${host.money(item.bid)} · ${t("minimum")}: ${host.money(R.minimumBid(item))}`, row);
      const amount = node("input", undefined, row); Object.assign(amount, { id: `auctionBid-${item.id}`, type: "number", min: String(R.minimumBid(item)), step: "1", value: retained[`auctionBid-${item.id}`] || String(R.minimumBid(item)) });
      amount.setAttribute("aria-label", t("minimum"));
      button(row, t("bid"), "bid", { id: String(item.id) }).disabled = !active || p.ap < 1 || item.seller === color || item.bidder === color;
    }
    node("h3", t("warehouse"), body);
    if (!p.warehouse.length) node("p", t("warehouseEmpty"), body, "hint");
    for (const item of p.warehouse) { const row = node("div", host.pieceName(item.piece), body, "economy-item"); button(row, t("deploy"), "deploy", { id: String(item.id) }).disabled = !active || p.ap < 1; }
    const finance = document.getElementById("financeContent"); finance.replaceChildren();
    node("p", `${host.sideName(color)} · ${t("financeHint")}`, finance, "hint");
    for (const key of Object.keys(R.DEFAULT_AUTOMATION)) {
      const label = node("label", undefined, finance, "finance-toggle"), input = node("input", undefined, label);
      input.type = "checkbox"; input.checked = p.automation[key]; input.dataset.financeSetting = key;
      input.disabled = !state.started || state.gameOver || host.role() === "spectator"; node("span", t(key), label);
    }
    const pending = p.receivables.reduce((sum, item) => sum + item.amount, 0);
    node("p", `${t("debt")}: ${host.money((p.creditDebt || 0) + p.pendingInterest)} · ${t("unpaid")}: ${host.money(p.pendingInterest)} · ${t("pending")}: ${host.money(pending)}`, finance);
    button(finance, t("claim"), "claim").disabled = !active || !p.receivables.length;
    button(finance, t("interestNow"), "interest").disabled = !active || !p.pendingInterest;
    button(finance, t("repayNow"), "repay").disabled = !active || p.money <= 0 || !((p.creditDebt || 0) + p.pendingInterest);
    const risk = document.getElementById("financeRisk");
    let forecast = p.money + p.salary - host.tax(color);
    if(p.automation.repay){
      const debt=(p.creditDebt||0)+p.pendingInterest;
      forecast-=Math.min(debt+Math.ceil(debt*.08),Math.max(0,Math.floor(p.salary*.2)),Math.max(0,forecast));
    }
    risk.textContent = R.enabled(state, "automation") && p.automation.warning && !state.gameOver && Math.min(p.money, forecast) <= host.bankruptcy + 300 ? `${t("risk")} ${host.money(forecast)}` : "";
    const map = { jobBtn: "labor", salaryBtn: "salary", depositBtn: "deposits", ventureBtn: "ventures", buyPropertyBtn: "property" };
    for (const [id, key] of Object.entries(map)) { const element = document.getElementById(id); if (element) element.hidden = !R.enabled(state, key); }
    document.querySelector(".stocks-panel")?.classList.toggle("economy-disabled", !R.enabled(state, "stocks"));
  }
  function initialAutomation(color) {
    const saved=read(AUTO_KEY,{});
    return saved?.[color] || (typeof saved?.repay==="boolean"?saved:R.DEFAULT_AUTOMATION);
  }
  function saveAutomation(p) {
    const saved=read(AUTO_KEY,{});
    write(AUTO_KEY,{w:saved?.w||R.DEFAULT_AUTOMATION,b:saved?.b||R.DEFAULT_AUTOMATION,[p.color]:p.automation});
  }
  window.EconomyUI = { init, render, lobbyRules, syncLobby, publishLobby, initialAutomation, saveAutomation, send, t, labels };
})();

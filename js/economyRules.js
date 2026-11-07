(function (root) {
  "use strict";
  const FEATURES = ["labor", "salary", "deposits", "ventures", "stocks", "property", "credit", "tax", "auction", "automation"];
  const DEFAULT_AUTOMATION = { repay: true, interest: true, maturity: true, warning: true };
  const number = (value, fallback, min, max) => typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  function preset(name = "standard") {
    const features = Object.fromEntries(FEATURES.map(key => [key, name === "casual" ? ["labor", "salary"].includes(key) : key !== "auction" || name === "full"]));
    return { preset: ["casual", "standard", "full"].includes(name) ? name : "custom", priceMultiplier: 1, features };
  }
  function normalize(value = {}) {
    const result = preset(value.preset);
    result.priceMultiplier = number(value.priceMultiplier, 1, .25, 4);
    for (const key of FEATURES) if (typeof value.features?.[key] === "boolean") result.features[key] = value.features[key];
    return result;
  }
  function player(p) {
    p.automation = { ...DEFAULT_AUTOMATION, ...Object.fromEntries(Object.entries(p.automation || {}).filter(([key, value]) => key in DEFAULT_AUTOMATION && typeof value === "boolean")) };
    p.warehouse ||= []; p.receivables ||= []; p.pendingInterest ||= 0;
    return p;
  }
  function enabled(state, key) { return normalize(state.economyRules).features[key] !== false; }
  function price(state, value) { return Math.round(value * normalize(state.economyRules).priceMultiplier); }
  function minimumBid(auction) { return auction.bidder ? auction.bid + Math.max(50, Math.ceil(auction.bid * .1)) : auction.startPrice; }
  function canAct(state, color) { return state.started && !state.gameOver && state.turn === color && state.players[color]?.ap >= 1; }
  function list(state, color, square, startPrice, value, isKing) {
    if (!enabled(state, "auction") || !canAct(state, color) || !Number.isInteger(square?.r) || !Number.isInteger(square?.c)) return false;
    const piece = state.board[square.r]?.[square.c];
    if (!piece || piece.color !== color || isKing(piece)) return false;
    const amount = startPrice === undefined ? Math.max(1, Math.round(value(piece) * .5)) : startPrice;
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000000) return false;
    state.auctions ||= []; state.auctionSerial = (state.auctionSerial || 0) + 1;
    state.auctions.push({ id: state.auctionSerial, seller: color, piece: JSON.parse(JSON.stringify(piece)), startPrice: amount, bid: 0, bidder: null, endsAt: state.turnNo + 4 });
    state.board[square.r][square.c] = null; state.players[color].ap--;
    return true;
  }
  function bid(state, color, id, amount) {
    const auction = state.auctions?.find(item => item.id === id), p = state.players[color];
    if (!enabled(state, "auction") || !canAct(state, color) || !auction || auction.endsAt <= state.turnNo || auction.seller === color || auction.bidder === color) return false;
    if (!Number.isSafeInteger(amount) || amount < minimumBid(auction) || amount > p.money) return false;
    if (auction.bidder) state.players[auction.bidder].money += auction.bid;
    p.money -= amount; p.ap--; auction.bidder = color; auction.bid = amount;
    return true;
  }
  function settleAuctions(state) {
    const completed = [];
    state.auctions = (state.auctions || []).filter(auction => {
      if (auction.endsAt > state.turnNo) return true;
      const color = auction.bidder || auction.seller, p = player(state.players[color]);
      if (auction.bidder) state.players[auction.seller].money += auction.bid;
      p.warehouse.push({ id: auction.id, piece: { ...auction.piece, color } });
      completed.push(auction); return false;
    });
    return completed;
  }
  function deploy(state, color, id, square) {
    const p = player(state.players[color]), item = p.warehouse.find(entry => entry.id === id);
    if (!enabled(state, "auction") || !canAct(state, color) || !item || !Number.isInteger(square?.r) || !Number.isInteger(square?.c)) return false;
    const { r, c } = square;
    if (r < 0 || r > 7 || c < 0 || c > 7 || (color === "w" ? r < 6 : r > 1) || state.board[r][c]) return false;
    const piece = { ...item.piece, color, moved: true };
    // 창고를 이용한 재활성화·재판매로 능력 충전 횟수를 복제하지 않는다.
    if (piece.specialId) Object.assign(piece, { active: false, activationTurn: state.turnNo + 1, purchaseLocked: true, attackLockedTurns: Math.max(3, piece.attackLockedTurns || 0) });
    state.board[r][c] = piece; p.ap--; p.warehouse = p.warehouse.filter(entry => entry !== item);
    return true;
  }
  function settleInterest(p) {
    player(p); const amount = p.pendingInterest; p.creditDebt = (p.creditDebt || 0) + amount; p.pendingInterest = 0; return amount;
  }
  function repay(p, maximum = Infinity, includeInterest = true) {
    player(p); if(includeInterest)settleInterest(p);
    const amount = Math.min(p.creditDebt || 0, Math.max(0, Math.floor(p.money)), maximum);
    p.creditDebt -= amount; p.money -= amount; return amount;
  }
  function creditTurn(p, rate, automationEnabled = true) {
    player(p); const total = (p.creditDebt || 0) + p.pendingInterest;
    const fee = Math.ceil(total * number(rate, .08, 0, 1)); p.pendingInterest += fee;
    if (!automationEnabled || p.automation.interest) settleInterest(p);
    const paid = (!automationEnabled || p.automation.repay) ? repay(p, Math.max(0, Math.floor(p.salary * .2)), false) : 0;
    return { fee, paid };
  }
  function mature(p, depositReturn, bankerBonus, automatic = true) {
    player(p);
    for (const [key, multiplier] of [["deposits", depositReturn * bankerBonus], ["ventures", null]]) {
      p[key] = (p[key] || []).filter(item => {
        if (item.due > p.ownTurns) return true;
        p.receivables.push({ kind: key, amount: Math.round(item.principal * (multiplier ?? item.mult)) }); return false;
      });
    }
    return automatic ? claim(p) : 0;
  }
  function claim(p) { player(p); const amount = p.receivables.reduce((sum, item) => sum + item.amount, 0); p.money += amount; p.receivables = []; return amount; }
  function closeAuctions(state) {
    for(const auction of state.auctions||[]){
      if(auction.bidder)state.players[auction.bidder].money+=auction.bid;
      player(state.players[auction.seller]).warehouse.push({id:auction.id,piece:auction.piece});
    }
    state.auctions=[];
  }
  const api = { FEATURES, DEFAULT_AUTOMATION, preset, normalize, player, enabled, price, minimumBid, list, bid, settleAuctions, closeAuctions, deploy, creditTurn, settleInterest, repay, mature, claim };
  root.EconomyRules = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window === "undefined" ? globalThis : window);

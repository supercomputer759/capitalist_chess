(function () {
  "use strict";
  const ids = new Set([
    "mounted_king", "black_hole", "golden_pawn", "banker", "tax_accountant", "stock_broker",
    "factory", "suicide_pawn", "bodyguard", "ghost", "magnet", "warp_bishop", "sniper", "taxi",
    "cavalry", "fortress", "fake_king", "judge", "pirate", "vampire", "swapper", "mirror", "wall",
    "rental_house", "bankrupt_queen", "credit_card_knight", "venture_knight", "short_seller",
    "chaebol_king", "mounted_king_mk2"
  ]);
  function path(id, color = "w") {
    return ids.has(id) ? `assets/pieces/special/${id}-${color === "b" ? "b" : "w"}.svg` : null;
  }
  window.SpecialPieceArt = { path };
})();

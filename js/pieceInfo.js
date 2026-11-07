(function(){
  "use strict";
  function text(key,fallback){return window.GameLanguage?.text(key,fallback)??fallback;}
  function movementCells(def){return window.movementPreviewCells?window.movementPreviewCells(def?.movement||{}):def?.movement?.preview?.cells||[];}
  function movementText(def){const m=def?.movement||{};if(m.type==="compound")return `${m.type} (${(m.modes||m.parts||[]).map(x=>typeof x==="string"?x:x.type).join(" + ")})`;return m.type||text("pieceInfo.unknownMovement","정보 없음");}
  function showPieceInfo(def,stock,viewerOwns=false,pieceId=null,dataId=null,ownerColor=null){
    if(!def)return;
    const modal=document.getElementById("pieceInfoModal"),body=document.getElementById("pieceInfoBody");
    if(!modal||!body)return;
    const fake=Boolean(def.fakeKing||(def.abilities||[]).some(a=>a.id==="fake_king_identity"));
    const nameKey=def.id?`piece.${def.id}.name`:`piece.standard.${pieceId||"p"}`;
    const descriptionKey=def.id?`piece.${def.id}.description`:"pieceInfo.generalDescription";
    const visibleName=fake&&!viewerOwns?text("piece.standard.k","킹"):text(nameKey,def.name||"기물");
    const visibleDescription=fake&&!viewerOwns?text("pieceInfo.fakeKingDescription","체스판에서 킹으로 보이는 기물."):text(descriptionKey,def.description||"일반 체스 기물");
    const icon=window.specialChessVisual?window.specialChessVisual(def,ownerColor||"w",visibleName):(def.icon||def.emoji||"\u265f");
    const chessGlyph=window.specialChessGlyph?window.specialChessGlyph(def):"\u2659";
    const score=def.score??def.pieceScore??0;
    const tax=def.maintenanceTax??def.tax??0;
    const cells=movementCells(def); const marks=new Set(cells.map(([r,c])=>`${r+2},${c+2}`));
    let mini=`<div class="movement-mini" aria-label="${text("pieceInfo.preview","행마 미리보기")}">`;
    for(let r=0;r<5;r++)for(let c=0;c<5;c++)mini+=`<span class=\"mini-cell ${r===2&&c===2?"center":""} ${marks.has(`${r},${c}`)?"move":""}\">${r===2&&c===2?chessGlyph:""}</span>`;
    mini+="</div>";
    const hiddenFake=!viewerOwns&&fake;
    const abilities=hiddenFake?`<li>${text("pieceInfo.hiddenAbility","공개되지 않은 능력")}</li>`:(def.abilities||[]).map(a=>`<li>${text(`ability.${a.id}`,a.id.replaceAll("_"," "))}</li>`).join("")||`<li>${text("pieceInfo.noAbilities","없음")}</li>`;
    const warnings=hiddenFake?"":(def.warnings?.length?`<div class=\"piece-warnings\"><b>${text("pieceInfo.warning","경고")}</b><ul>${def.warnings.map((w,index)=>`<li>${text(`piece.${def.id}.warning.${index}`,w)}</li>`).join("")}</ul></div>`:"");
    body.innerHTML=`<div class=\"piece-info-title\"><span>${icon}</span><div><h2>${visibleName}</h2><small>${def.rarity}</small></div></div><div class=\"piece-info-grid\"><span>${text("pieceInfo.score","기물점수")} <b>${score}</b></span><span>${text("pieceInfo.price","가격")} <b>$${Number(def.price).toLocaleString()}</b></span><span>${text("pieceInfo.buyAP","구매 AP")} <b>${def.buyAP}</b></span><span>${text("pieceInfo.upkeep","유지세")} <b>$${Number(tax).toLocaleString()}</b></span><span>${text("pieceInfo.stock","현재 재고")} <b>${stock??0}</b></span><span>${text("pieceInfo.movement","행마법")} <b>${movementText(def)}</b></span></div>${mini}<p>${visibleDescription}</p><div><b>${text("pieceInfo.abilities","특수능력")}</b><ul>${abilities}</ul></div>${warnings}`;
    if(ownerColor){const ownerRow=document.createElement("span");ownerRow.innerHTML=`${text("pieceInfo.owner","소유 진영")} <b>${ownerColor==="w"?text("game.white","백"):text("game.black","흑")}</b>`;body.querySelector(".piece-info-grid")?.prepend(ownerRow);}
    const idRow=document.createElement("span");
    idRow.innerHTML=`${text("pieceInfo.id","기물 ID")} <b class="piece-id">${pieceId||dataId||"-"}</b>`;
    body.querySelector(".piece-info-grid")?.prepend(idRow);
    if(dataId&&pieceId&&dataId!==pieceId){
      const dataRow=document.createElement("span");
      dataRow.innerHTML=`${text("pieceInfo.dataId","데이터 ID")} <b class="piece-id">${dataId}</b>`;
      body.querySelector(".piece-info-grid")?.prepend(dataRow);
    }
    modal.classList.remove("hidden");
  }
  window.showPieceInfo=showPieceInfo;
})();

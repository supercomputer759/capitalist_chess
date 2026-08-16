(function(){
  "use strict";
  function movementCells(def){return window.movementPreviewCells?window.movementPreviewCells(def?.movement||{}):def?.movement?.preview?.cells||[];}
  function movementText(def){const m=def?.movement||{};if(m.type==="compound")return `${m.type} (${(m.modes||m.parts||[]).map(x=>typeof x==="string"?x:x.type).join(" + ")})`;return m.type||"정보 없음";}
  function showPieceInfo(def,stock,viewerOwns=false,pieceId=null,dataId=null,ownerColor=null){
    if(!def)return;
    const modal=document.getElementById("pieceInfoModal"),body=document.getElementById("pieceInfoBody");
    if(!modal||!body)return;
    const fake=Boolean(def.fakeKing||(def.abilities||[]).some(a=>a.id==="fake_king_identity"));
    const visibleName=fake&&!viewerOwns?"킹":def.name;
    const visibleDescription=fake&&!viewerOwns?"체스판에서 킹으로 보이는 기물.":def.description;
    const icon=def.icon||def.emoji||"♟";
    const score=def.score??def.pieceScore??0;
    const tax=def.maintenanceTax??def.tax??0;
    const cells=movementCells(def); const marks=new Set(cells.map(([r,c])=>`${r+2},${c+2}`));
    let mini="<div class=\"movement-mini aria-label=\"행마 미리보기\">";
    for(let r=0;r<5;r++)for(let c=0;c<5;c++)mini+=`<span class=\"mini-cell ${r===2&&c===2?"center":""} ${marks.has(`${r},${c}`)?"move":""}\">${r===2&&c===2?(def.icon||"•"):""}</span>`;
    mini+="</div>";
    const hiddenFake=!viewerOwns&&fake;
    const abilities=hiddenFake?"<li>공개되지 않은 능력</li>":(def.abilities||[]).map(a=>`<li>${a.id}</li>`).join("")||"<li>없음</li>";
    const warnings=hiddenFake?"":(def.warnings?.length?`<div class=\"piece-warnings\"><b>경고</b><ul>${def.warnings.map(w=>`<li>${w}</li>`).join("")}</ul></div>`:"");
    body.innerHTML=`<div class=\"piece-info-title\"><span>${icon}</span><div><h2>${visibleName}</h2><small>${def.rarity}</small></div></div><div class=\"piece-info-grid\"><span>기물점수 <b>${score}</b></span><span>가격 <b>$${Number(def.price).toLocaleString("ko-KR")}</b></span><span>구매 AP <b>${def.buyAP}</b></span><span>유지세 <b>$${Number(tax).toLocaleString("ko-KR")}</b></span><span>현재 재고 <b>${stock??0}</b></span><span>행마법 <b>${movementText(def)}</b></span></div>${mini}<p>${visibleDescription}</p><div><b>특수능력</b><ul>${abilities}</ul></div>${warnings}`;
    if(ownerColor){const ownerRow=document.createElement("span");ownerRow.innerHTML=`소유 진영 <b>${ownerColor==="w"?"백":"흑"}</b>`;body.querySelector(".piece-info-grid")?.prepend(ownerRow);}
    const idRow=document.createElement("span");
    idRow.innerHTML=`기물 ID <b class="piece-id">${pieceId||dataId||"-"}</b>`;
    body.querySelector(".piece-info-grid")?.prepend(idRow);
    if(dataId&&pieceId&&dataId!==pieceId){
      const dataRow=document.createElement("span");
      dataRow.innerHTML=`데이터 ID <b class="piece-id">${dataId}</b>`;
      body.querySelector(".piece-info-grid")?.prepend(dataRow);
    }
    modal.classList.remove("hidden");
  }
  window.showPieceInfo=showPieceInfo;
})();

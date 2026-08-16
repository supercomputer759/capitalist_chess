"use strict";

const FILES = ["a","b","c","d","e","f","g","h"];
const PIECES = {
  p: {name:"폰", price:100},
  n: {name:"나이트", price:300},
  b: {name:"비숍", price:300},
  r: {name:"룩", price:500},
  q: {name:"퀸", price:900},
  k: {name:"킹", price:1500}
};
const CFG = {
  startMoney: 1500,
  startSalary: 180,
  maxAP: 3,
  taxPerPiece: 25,
  jobPay: 100,
  salaryRaise: 50,
  salaryBaseCost: 350,
  bankruptcy: -1000,
  propertyBase: 100,
  propertyVisitPrice: 60,
  tollPerVisit: 18,
  sellRatio: 0.60,
  brilliantBonus: 350,
  bestBonus: 160,
  promoteCost: 600,
  teleportCost: 800,
  insuranceCost: 1200
};

// Wikipedia/Wikimedia의 원본 SVG를 직접 사용한다.
// 백은 light(l), 흑은 classic dark(d) SVG를 사용해 기존 흑/백 색감을 유지한다.
const IMG = {
  wk:"https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_klt45.svg",
  wq:"https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_qlt45.svg",
  wr:"https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_rlt45.svg",
  wb:"https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_blt45.svg",
  wn:"https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_nlt45.svg",
  wp:"https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_plt45.svg",
  bk:"https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_kdt45.svg",
  bq:"https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_qdt45.svg",
  br:"https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_rdt45.svg",
  bb:"https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_bdt45.svg",
  bn:"https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_ndt45.svg",
  bp:"https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_pdt45.svg"
};
const IMG_FALLBACK = Object.fromEntries(Object.keys(IMG).map(k=>[k,`assets/pieces/${k}.png`]));
function pieceImgTag(key, cls="piece", alt=key){
  return `<img class="${cls}" src="${IMG[key]}" data-fallback="${IMG_FALLBACK[key]}" alt="${alt}">`;
}
function attachImageFallbacks(scope=document){
  scope.querySelectorAll("img[data-fallback]").forEach(img=>{
    img.onerror=()=>{
      if(img.dataset.fallback && img.src!==new URL(img.dataset.fallback, location.href).href){
        img.onerror=null;
        img.src=img.dataset.fallback;
      }
    };
  });
}

const STOCKS = {
  pastry: {name:"앙파상 제과", price:100, last:100},
  check: {name:"체크전자", price:135, last:135},
  castle: {name:"캐슬링 공업", price:122, last:122},
  knight: {name:"나이트 AI", price:188, last:188},
  bed: {name:"킹 침대", price:96, last:96}
};

const NEWS = [
  ["pastry", +0.13, "앙파상 제과, 신규 과자 ‘킹맛 쓰냌’ 출시… 반응 좋아"],
  ["pastry", -0.18, "앙파상 제과, 원재료 가격 급등… 마진 악화 우려"],
  ["check", -0.19, "체크전자, 부품 사기 논란에 소비자 불만 커져…"],
  ["check", +0.12, "체크전자, 차세대 보드 센서 공개… 예약 주문 몰려"],
  ["castle", +0.14, "캐슬링 공업, 새로운 금속 가공 기술 공개… ‘매우 효율적’"],
  ["castle", -0.10, "캐슬링 공업, 룩 생산라인 정비로 출하 지연"],
  ["knight", +0.22, "나이트 AI, Plus 요금제 가격 인하… 이용객 폭주"],
  ["knight", -0.15, "나이트 AI, 말이 자꾸 L자로 답한다는 품질 논란"],
  ["bed", -0.31, "킹 침대, 매트리스 유해물질 논란 거세져… 주가 폭락"],
  ["bed", +0.18, "킹 침대, 왕실 납품 계약 체결… 실적 기대감 상승"]
];

function makePlayer(color) {
  return {
    color,
    money: CFG.startMoney,
    salary: CFG.startSalary,
    salaryLevel: 0,
    ap: CFG.maxAP,
    moveUsed: false,
    insurance: false,
    holdings: Object.fromEntries(Object.keys(STOCKS).map(k=>[k,0])),
    deposits: [],
    ventures: [],
    ownTurns: 0
  };
}

const state = {
  board: Array.from({length:8},()=>Array(8).fill(null)),
  turn:"w",
  turnNo:1,
  players:{w:makePlayer("w"), b:makePlayer("b")},
  selected:null,
  mode:null,
  pendingPiece:null,
  legalTargets:[],
  visits:{},
  properties:{},
  lastMove:null,
  gameOver:false,
  engineReady:false,
  engine:null,
  engineQueue:[],
  news:[],
  annotations:[],
  annotationStart:null,
  annotationPreview:null,
  annotationPointerId:null,
  dragFrom:null,
  justDragged:0,
  headlineIndex:0,
  headlineTimer:null
};

function init() {
  state.board[7][4] = piece("k","w");
  state.board[0][4] = piece("k","b");
  buildBoard();
  buildShop();
  buildStocks();
  bindControls();
  addNews("시장", "자본주의 체스 거래소가 개장했다. 모두의 통장이 무사하길.");
  log("게임 시작. 양측 킹 1개 + $1,500.","gold");
  initStockfish();
  render();
  showHeadline(0, true);
  state.headlineTimer=setInterval(cycleHeadline, 3600);
}

function piece(type,color){ return {type,color,moved:false,id:crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}; }
function current(){ return state.players[state.turn]; }
function enemyColor(c=state.turn){ return c === "w" ? "b" : "w"; }
function fmt(n){ return "$" + Math.round(n).toLocaleString("ko-KR"); }
function sqName(r,c){ return FILES[c] + (8-r); }
function fromName(s){ return {r:8-Number(s[1]), c:FILES.indexOf(s[0])}; }
function inBounds(r,c){ return r>=0 && r<8 && c>=0 && c<8; }
function cloneBoard(board=state.board){ return board.map(row=>row.map(p=>p?{...p}:null)); }
function countTax(color){
  let n=0;
  for(const row of state.board) for(const p of row) if(p && p.color===color && p.type!=="k") n++;
  return n*CFG.taxPerPiece;
}
function spend(player, amount, reason="지출"){
  if(player.money < amount){ log(`${reason}: 돈 부족 (${fmt(amount)} 필요)`,"bad"); return false; }
  player.money -= amount; return true;
}
function useAP(cost, label){
  const p=current();
  if(p.ap < cost){ log(`${label}: AP 부족 (${cost} 필요)`,"bad"); return false; }
  p.ap -= cost; return true;
}
function payAndAP(amount, apCost, label){
  const p=current();
  if(p.money < amount){ log(`${label}: 돈 부족 (${fmt(amount)} 필요)`,"bad"); return false; }
  if(p.ap < apCost){ log(`${label}: AP 부족 (${apCost} 필요)`,"bad"); return false; }
  p.money -= amount; p.ap -= apCost; return true;
}
function activeInCheck(){ return isKingInCheck(state.turn, state.board); }
function canEconomy(){
  if(activeInCheck()){ log("체크 상태야. 경제질은 나중에 하고 먼저 킹부터 살려ㅋㅋ", "bad"); return false; }
  return true;
}

function buildBoard(){
  const board=document.getElementById("board"); board.innerHTML="";
  document.getElementById("fileLabels").innerHTML=FILES.map(x=>`<span>${x}</span>`).join("");
  document.getElementById("rankLabels").innerHTML=[8,7,6,5,4,3,2,1].map(x=>`<span>${x}</span>`).join("");
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const el=document.createElement("div");
    el.className=`square ${(r+c)%2?"dark":"light"}`;
    el.dataset.r=r; el.dataset.c=c;
    el.addEventListener("click",()=>clickSquare(r,c));
    el.addEventListener("dragstart",e=>dragStartSquare(e,r,c));
    el.addEventListener("dragover",e=>{ if(state.dragFrom) e.preventDefault(); });
    el.addEventListener("drop",e=>dropSquare(e,r,c));
    el.addEventListener("dragend",dragEndSquare);
    board.appendChild(el);
  }
  board.addEventListener("contextmenu",e=>e.preventDefault());
  board.addEventListener("pointerdown",annotationPointerDown);
  board.addEventListener("pointermove",annotationPointerMove);
  board.addEventListener("pointerup",annotationPointerUp);
  board.addEventListener("pointercancel",annotationPointerCancel);
  board.addEventListener("pointerleave",annotationPointerLeave);
}

function squareFromEvent(e){
  const el=e.target.closest?.(".square");
  return el?{r:Number(el.dataset.r),c:Number(el.dataset.c)}:null;
}
function squareFromPoint(clientX,clientY){
  const board=document.getElementById("board");
  if(!board) return null;
  const rect=board.getBoundingClientRect();
  /* Use the rendered board rectangle instead of event.target. This fixes circles
     drifting to the wrong square when the pointer is released near a border. */
  if(clientX<rect.left||clientX>=rect.right||clientY<rect.top||clientY>=rect.bottom) return null;
  const c=Math.max(0,Math.min(7,Math.floor((clientX-rect.left)/(rect.width/8))));
  const r=Math.max(0,Math.min(7,Math.floor((clientY-rect.top)/(rect.height/8))));
  return {r,c};
}
function clearAnnotationHover(){
  document.querySelectorAll(".square.annotation-hover,.square.annotation-origin").forEach(el=>el.classList.remove("annotation-hover","annotation-origin"));
}
function paintAnnotationHover(from,to){
  clearAnnotationHover();
  if(from){
    const idx=from.r*8+from.c,el=document.querySelectorAll(".square")[idx];
    el?.classList.add("annotation-origin");
  }
  if(to){
    const idx=to.r*8+to.c,el=document.querySelectorAll(".square")[idx];
    el?.classList.add("annotation-hover");
  }
}
function annotationPointerDown(e){
  if(e.button!==2) return;
  e.preventDefault();
  const from=squareFromPoint(e.clientX,e.clientY);
  if(!from) return;
  state.annotationStart=from;
  state.annotationPreview={kind:"circle",fr:from.r,fc:from.c,tr:from.r,tc:from.c};
  state.annotationPointerId=e.pointerId;
  try{e.currentTarget.setPointerCapture(e.pointerId)}catch(_){ }
  paintAnnotationHover(from,from);
  renderAnnotations();
}
function annotationPointerMove(e){
  if(state.annotationStart==null || state.annotationPointerId!==e.pointerId) return;
  const to=squareFromPoint(e.clientX,e.clientY);
  if(!to) return;
  const from=state.annotationStart;
  state.annotationPreview={
    kind:(from.r===to.r&&from.c===to.c)?"circle":"arrow",
    fr:from.r,fc:from.c,tr:to.r,tc:to.c
  };
  paintAnnotationHover(from,to);
  renderAnnotations();
}
function annotationPointerUp(e){
  if(e.button!==2 || !state.annotationStart || state.annotationPointerId!==e.pointerId) return;
  e.preventDefault();
  const from=state.annotationStart;
  const to=squareFromPoint(e.clientX,e.clientY) || (state.annotationPreview?{r:state.annotationPreview.tr,c:state.annotationPreview.tc}:null);
  state.annotationStart=null;
  state.annotationPreview=null;
  state.annotationPointerId=null;
  try{e.currentTarget.releasePointerCapture(e.pointerId)}catch(_){ }
  clearAnnotationHover();
  if(!to){renderAnnotations();return;}
  const kind=(from.r===to.r&&from.c===to.c)?"circle":"arrow";
  const idx=state.annotations.findIndex(a=>a.kind===kind&&a.fr===from.r&&a.fc===from.c&&a.tr===to.r&&a.tc===to.c);
  /* Same right-drag gesture toggles exactly this annotation, never clears the rest. */
  if(idx>=0) state.annotations.splice(idx,1);
  else state.annotations.push({kind,fr:from.r,fc:from.c,tr:to.r,tc:to.c});
  renderAnnotations();
}
function annotationPointerCancel(e){
  state.annotationStart=null;state.annotationPreview=null;state.annotationPointerId=null;
  clearAnnotationHover();renderAnnotations();
}
function annotationPointerLeave(e){
  if(state.annotationStart==null) clearAnnotationHover();
}
function annotationSvg(a,preview=false){
  const x1=a.fc*100+50,y1=a.fr*100+50,extra=preview?" annotation-preview":"";
  if(a.kind==="circle") return `<circle class="annotation-circle${extra}" cx="${x1}" cy="${y1}" r="31"></circle>`;
  const x2=a.tc*100+50,y2=a.tr*100+50,dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy)||1;
  /* Keep both ends away from piece centers and use a compact arrow head. */
  const sx=x1+dx/len*22, sy=y1+dy/len*22, ex=x2-dx/len*24, ey=y2-dy/len*24;
  return `<line class="annotation-arrow${extra}" x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}"></line>`;
}
function renderAnnotations(){
  const layer=document.getElementById("annotationLayer");
  if(!layer) return;
  let html=state.annotations.map(a=>annotationSvg(a,false)).join("");
  if(state.annotationPreview) html+=annotationSvg(state.annotationPreview,true);
  layer.innerHTML=html;
}
function dragStartSquare(e,r,c){
  if(state.gameOver || state.mode || current().moveUsed) return e.preventDefault();
  const p=state.board[r][c];
  if(!p || p.color!==state.turn) return e.preventDefault();
  state.dragFrom={r,c}; state.selected={r,c}; state.legalTargets=legalMovesFor(r,c,true);
  e.currentTarget.classList.add("dragging");
  e.dataTransfer.effectAllowed="move";
  e.dataTransfer.setData("text/plain",sqName(r,c));
  render();
}
function dropSquare(e,r,c){
  if(!state.dragFrom) return;
  e.preventDefault();
  const from=state.dragFrom;
  const legal=state.legalTargets.some(x=>x.r===r&&x.c===c);
  state.justDragged=Date.now();
  state.dragFrom=null;
  if(legal) makeMove(from.r,from.c,r,c);
  else { state.selected={r:from.r,c:from.c}; render(); }
}
function dragEndSquare(){
  document.querySelectorAll(".square.dragging").forEach(x=>x.classList.remove("dragging"));
  state.dragFrom=null;
}

function buildShop(){
  const el=document.getElementById("pieceShop"); el.innerHTML="";
  ["p","n","b","r","q"].forEach(t=>{
    const btn=document.createElement("button"); btn.className="shop-item";
    btn.innerHTML=`<span class="shop-piece"><img id="shop-${t}" alt="${PIECES[t].name}"></span><b>${PIECES[t].name}</b><small>${fmt(PIECES[t].price)}</small>`;
    btn.addEventListener("click",()=>startPurchase(t));
    el.appendChild(btn);
  });
}

function buildStocks(){
  const sel=document.getElementById("stockSelect");
  sel.innerHTML=Object.entries(STOCKS).map(([k,s])=>`<option value="${k}">${s.name}</option>`).join("");
}

function bindControls(){
  document.getElementById("endTurnBtn").onclick=endTurn;
  document.getElementById("cancelModeBtn").onclick=clearMode;
  document.getElementById("clearLogBtn").onclick=()=>document.getElementById("log").innerHTML="";
  document.getElementById("jobBtn").onclick=doJob;
  document.getElementById("salaryBtn").onclick=raiseSalary;
  document.getElementById("depositBtn").onclick=makeDeposit;
  document.getElementById("ventureBtn").onclick=makeVenture;
  document.getElementById("promoteBtn").onclick=instantPromote;
  document.getElementById("teleportBtn").onclick=startTeleport;
  document.getElementById("insuranceBtn").onclick=buyInsurance;
  document.getElementById("buyPropertyBtn").onclick=buyProperty;
  document.getElementById("sellPieceBtn").onclick=sellSelectedPiece;
  document.getElementById("stockBuyBtn").onclick=()=>tradeStock(true);
  document.getElementById("stockSellBtn").onclick=()=>tradeStock(false);
}

function clickSquare(r,c){
  if(state.gameOver) return;
  if(Date.now()-state.justDragged<180) return;
  const p=state.board[r][c];
  const key=sqName(r,c);

  if(state.mode === "buy") return finishPurchase(r,c);
  if(state.mode === "teleport") return finishTeleport(r,c);

  const isLegal=state.legalTargets.some(x=>x.r===r&&x.c===c);
  if(state.selected && isLegal) return makeMove(state.selected.r,state.selected.c,r,c);

  state.selected={r,c}; state.legalTargets=[];
  if(p && p.color===state.turn && !current().moveUsed){
    state.legalTargets=legalMovesFor(r,c,true);
  }
  render();
  renderTileInfo(key);
}

function clearMode(){ state.mode=null;state.pendingPiece=null;state.legalTargets=[];state.selected=null;render(); }

function startPurchase(type){
  if(!canEconomy()) return;
  if(current().ap<1) return log("기물 구매: AP 부족","bad");
  if(current().money<PIECES[type].price) return log(`기물 구매: ${fmt(PIECES[type].price)} 필요`,`bad`);
  state.mode="buy"; state.pendingPiece=type; state.selected=null; state.legalTargets=[];
  log(`${PIECES[type].name} 구매 위치를 선택해.`,"gold"); render();
}
function homeZone(color,r){ return color==="w" ? r>=6 : r<=1; }
function finishPurchase(r,c){
  const type=state.pendingPiece;
  if(!homeZone(state.turn,r) || state.board[r][c]) return log("자기 진영의 빈 칸에만 배치 가능해.","bad");
  const price=PIECES[type].price;
  if(!payAndAP(price,1,"기물 구매")) return;
  const before=cloneBoard();
  state.board[r][c]=piece(type,state.turn);
  if(isKingInCheck(state.turn,state.board)){
    state.board=before; current().money+=price; current().ap+=1;
    return log("그 배치는 네 킹을 체크 상태로 남겨서 불가능.","bad");
  }
  log(`${sqName(r,c)}에 ${PIECES[type].name} 채용 -${fmt(price)}`);
  state.mode=null;state.pendingPiece=null;render();
}

function sellSelectedPiece(){
  if(!canEconomy() || !state.selected) return;
  const {r,c}=state.selected, p=state.board[r][c];
  if(!p || p.color!==state.turn || p.type==="k") return log("매각할 자기 기물(킹 제외)을 선택해.","bad");
  if(!useAP(1,"기물 매각")) return;
  const gain=Math.round(PIECES[p.type].price*CFG.sellRatio);
  state.board[r][c]=null;
  if(isKingInCheck(state.turn,state.board)){
    state.board[r][c]=p; current().ap+=1; return log("그 기물을 팔면 킹이 바로 털려. 매각 취소.","bad");
  }
  current().money+=gain; log(`${PIECES[p.type].name} 매각 +${fmt(gain)}`,"good");clearMode();
}

function pseudoMoves(r,c,board=state.board, attackOnly=false){
  const p=board[r][c]; if(!p) return [];
  const out=[]; const add=(rr,cc)=>{ if(inBounds(rr,cc)) out.push({r:rr,c:cc}); };
  const slide=(dirs)=>{ for(const [dr,dc] of dirs){ let rr=r+dr,cc=c+dc; while(inBounds(rr,cc)){ if(board[rr][cc]){ if(board[rr][cc].color!==p.color) add(rr,cc); break; } add(rr,cc); rr+=dr;cc+=dc; } } };
  if(p.type==="n") for(const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]){ const rr=r+dr,cc=c+dc; if(inBounds(rr,cc)&&(!board[rr][cc]||board[rr][cc].color!==p.color)) add(rr,cc); }
  if(p.type==="b") slide([[-1,-1],[-1,1],[1,-1],[1,1]]);
  if(p.type==="r") slide([[-1,0],[1,0],[0,-1],[0,1]]);
  if(p.type==="q") slide([[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]);
  if(p.type==="k") for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) if(dr||dc){const rr=r+dr,cc=c+dc;if(inBounds(rr,cc)&&(!board[rr][cc]||board[rr][cc].color!==p.color))add(rr,cc);}
  if(p.type==="p"){
    const dir=p.color==="w"?-1:1;
    if(attackOnly){ add(r+dir,c-1);add(r+dir,c+1); }
    else {
      if(inBounds(r+dir,c)&&!board[r+dir][c]){
        add(r+dir,c);
        const startRow=p.color==="w"?6:1;
        if(!p.moved && r===startRow && inBounds(r+dir*2,c) && !board[r+dir*2][c]) add(r+dir*2,c);
      }
      for(const dc of [-1,1]){const rr=r+dir,cc=c+dc;if(inBounds(rr,cc)&&board[rr][cc]&&board[rr][cc].color!==p.color)add(rr,cc);}
    }
  }
  return out.filter(x=>inBounds(x.r,x.c));
}

function isSquareAttacked(r,c,byColor,board=state.board){
  for(let rr=0;rr<8;rr++) for(let cc=0;cc<8;cc++){
    const p=board[rr][cc]; if(!p||p.color!==byColor) continue;
    const moves=pseudoMoves(rr,cc,board,p.type==="p");
    if(moves.some(x=>x.r===r&&x.c===c)) return true;
  }
  return false;
}
function findKing(color,board=state.board){
  for(let r=0;r<8;r++) for(let c=0;c<8;c++) if(board[r][c]?.type==="k"&&board[r][c].color===color) return {r,c};
  return null;
}
function isKingInCheck(color,board=state.board){ const k=findKing(color,board); return k ? isSquareAttacked(k.r,k.c,enemyColor(color),board) : true; }
function legalMovesFor(r,c,validateKing=true){
  const p=state.board[r][c]; if(!p) return [];
  return pseudoMoves(r,c,state.board,false).filter(t=>{
    if(!validateKing) return true;
    const b=cloneBoard(); const moving={...b[r][c],moved:true}; b[t.r][t.c]=moving;b[r][c]=null;
    return !isKingInCheck(p.color,b);
  });
}
function allLegalMoves(color){
  const moves=[];
  for(let r=0;r<8;r++) for(let c=0;c<8;c++) if(state.board[r][c]?.color===color){
    for(const t of legalMovesForWithBoard(r,c,state.board)) moves.push({fr:r,fc:c,tr:t.r,tc:t.c});
  }
  return moves;
}
function legalMovesForWithBoard(r,c,board){
  const p=board[r][c]; if(!p) return [];
  const save=state.board; state.board=board;
  const arr=pseudoMoves(r,c,board,false).filter(t=>{const b=cloneBoard(board);b[t.r][t.c]={...b[r][c],moved:true};b[r][c]=null;return !isKingInCheck(p.color,b);});
  state.board=save; return arr;
}

function makeMove(fr,fc,tr,tc){
  const pl=current(); if(pl.moveUsed) return log("일반 체스 이동은 턴당 1번이야.","bad");
  if(pl.ap<1) return log("이동할 AP가 없어.","bad");
  const moving=state.board[fr][fc]; const captured=state.board[tr][tc];
  if(!moving || moving.color!==state.turn) return;
  const beforeFen=fenFor(state.turn);
  const uci=sqName(fr,fc)+sqName(tr,tc)+(moving.type==="p" && (tr===0||tr===7)?"q":"");
  state.board[tr][tc]={...moving,moved:true}; state.board[fr][fc]=null;
  if(isKingInCheck(state.turn,state.board)){ state.board[fr][fc]=moving;state.board[tr][tc]=captured;return log("그 수는 네 킹을 체크에 노출해.","bad"); }
  pl.ap--; pl.moveUsed=true;
  if(captured){ const reward=PIECES[captured.type].price; pl.money+=reward; log(`${PIECES[captured.type].name} 포획! +${fmt(reward)}`,"good"); }
  if(moving.type==="p" && (tr===0||tr===7)){ state.board[tr][tc]={...state.board[tr][tc],type:"q"}; log("폰 승급 → 퀸!","gold"); }
  visitSquare(tr,tc,state.turn);
  state.lastMove={fr,fc,tr,tc,color:state.turn};
  evaluateMoveWithStockfish(beforeFen,uci,{capture:!!captured,check:isKingInCheck(enemyColor(),state.board)},state.turn);
  state.selected={r:tr,c:tc}; state.legalTargets=[];
  checkBankruptcy(); render();
}

function visitSquare(r,c,color){
  const key=sqName(r,c); state.visits[key]=(state.visits[key]||0)+1;
  const owner=state.properties[key];
  if(owner && owner!==color){
    const toll=state.visits[key]*CFG.tollPerVisit;
    const payer=state.players[color], receiver=state.players[owner];
    payer.money-=toll; receiver.money+=toll;
    log(`${key} 통행료: ${color==="w"?"백":"흑"} -${fmt(toll)} → ${owner==="w"?"백":"흑"}`,"bad");
  }
}
function propertyPrice(key){ return CFG.propertyBase + (state.visits[key]||0)*CFG.propertyVisitPrice; }
function propertyToll(key){ return (state.visits[key]||0)*CFG.tollPerVisit; }
function buyProperty(){
  if(!canEconomy()||!state.selected) return;
  const key=sqName(state.selected.r,state.selected.c), visits=state.visits[key]||0;
  if(visits<1) return log("아직 아무도 밟지 않은 허허벌판이야. 가치가 없어ㅋㅋ","bad");
  if(state.properties[key]) return log("이미 주인이 있는 칸이야.","bad");
  const price=propertyPrice(key);
  if(!payAndAP(price,1,"부동산 매입")) return;
  state.properties[key]=state.turn; log(`${key} 매입 -${fmt(price)} (현재 통행료 ${fmt(propertyToll(key))})`,`gold`);render();renderTileInfo(key);
}
function renderTileInfo(key){
  const owner=state.properties[key]; const visits=state.visits[key]||0;
  document.getElementById("tileInfo").innerHTML=`<b>${key}</b> · 방문 ${visits}회 · 가치 ${fmt(propertyPrice(key))} · 통행료 ${fmt(propertyToll(key))}<br>소유자: ${owner?(owner==="w"?"백":"흑"):"없음"}`;
}

function doJob(){ if(!canEconomy()||!useAP(1,"알바"))return;current().money+=CFG.jobPay;log(`알바 완료 +${fmt(CFG.jobPay)} (킹이 알바 뛰는 세계관)`,`good`);render(); }
function salaryCost(p=current()){ return CFG.salaryBaseCost + p.salaryLevel*250; }
function raiseSalary(){
  if(!canEconomy())return; const p=current(),cost=salaryCost(p);
  if(!payAndAP(cost,1,"월급 인상"))return;
  p.salaryLevel++;p.salary+=CFG.salaryRaise;log(`월급 인상! 다음부터 ${fmt(p.salary)}/턴`,`good`);render();
}
function makeDeposit(){
  if(!canEconomy())return;const p=current();
  if(!payAndAP(500,1,"적금"))return;
  p.deposits.push({principal:500,due:p.ownTurns+4});log(`적금 가입 -$500 · ${4}회 내 턴 뒤 만기`,`gold`);render();
}
function makeVenture(){
  if(!canEconomy())return;const p=current();
  if(!payAndAP(300,1,"벤처 투자"))return;
  const mult=+(0.35+Math.random()*1.85).toFixed(2);
  p.ventures.push({principal:300,due:p.ownTurns+3,mult});log(`벤처 투자 -$300 · 결과는 3회 내 턴 뒤 공개`,`gold`);render();
}
function processMaturities(color){
  const p=state.players[color];
  p.deposits=p.deposits.filter(d=>{if(d.due<=p.ownTurns){const ret=Math.round(d.principal*1.12);p.money+=ret;log(`${color==="w"?"백":"흑"} 적금 만기 +${fmt(ret)}`,"good");return false;}return true;});
  p.ventures=p.ventures.filter(v=>{if(v.due<=p.ownTurns){const ret=Math.round(v.principal*v.mult);p.money+=ret;log(`${color==="w"?"백":"흑"} 벤처 회수 ${fmt(ret)} (${v.mult}×)`,ret>=v.principal?"good":"bad");return false;}return true;});
}

function instantPromote(){
  if(!canEconomy()||!state.selected)return log("승급할 자기 폰을 먼저 선택해.","bad");
  const {r,c}=state.selected,p=state.board[r][c];
  if(!p||p.color!==state.turn||p.type!=="p")return log("선택한 게 네 폰이 아님.","bad");
  if(!payAndAP(CFG.promoteCost,1,"즉시 승급"))return;
  state.board[r][c]={...p,type:"q"};log(`${sqName(r,c)} 폰 즉시승급 → 퀸 -${fmt(CFG.promoteCost)}`,"gold");render();
}
function startTeleport(){
  if(!canEconomy()||!state.selected)return log("텔레포트할 자기 기물을 선택해.","bad");
  const p=state.board[state.selected.r][state.selected.c];
  if(!p||p.color!==state.turn||p.type==="k")return log("자기 기물(킹 제외)을 선택해.","bad");
  if(current().money<CFG.teleportCost||current().ap<2)return log(`즉시이동은 ${fmt(CFG.teleportCost)} + 2 AP 필요.`,"bad");
  state.mode="teleport";log("빈 칸을 클릭하면 즉시이동 발동.","gold");render();
}
function finishTeleport(r,c){
  if(state.board[r][c])return log("빈 칸으로만 순간이동 가능.","bad");
  const from={...state.selected},p=state.board[from.r][from.c]; if(!p)return clearMode();
  const before=cloneBoard(); state.board[r][c]={...p,moved:true};state.board[from.r][from.c]=null;
  if(isKingInCheck(state.turn,state.board)){state.board=before;return log("거기로 튀면 킹이 체크 상태야.","bad");}
  if(!spend(current(),CFG.teleportCost,"즉시이동")||!useAP(2,"즉시이동")){state.board=before;return;}
  visitSquare(r,c,state.turn);log(`${sqName(from.r,from.c)} → ${sqName(r,c)} 즉시이동 -${fmt(CFG.teleportCost)}`,"gold");clearMode();checkBankruptcy();
}
function buyInsurance(){
  if(!canEconomy())return;const p=current();if(p.insurance)return log("이미 킹 부활 보험 있어.","bad");
  if(!payAndAP(CFG.insuranceCost,1,"부활 보험"))return;
  p.insurance=true;log("킹 부활 보험 가입 완료. 체크메이트 1회 무효.","gold");render();
}

function tradeStock(isBuy){
  if(!canEconomy())return; const key=document.getElementById("stockSelect").value; const qty=Math.max(1,Math.min(99,Number(document.getElementById("stockQty").value)||1));
  const p=current(), stock=STOCKS[key], total=Math.round(stock.price*qty);
  if(p.ap<1)return log("주식 거래: AP 부족","bad");
  if(isBuy){if(p.money<total)return log("매수 자금 부족","bad");p.money-=total;p.holdings[key]+=qty;log(`${stock.name} ${qty}주 매수 -${fmt(total)}`);} else {if(p.holdings[key]<qty)return log("보유 주식 부족","bad");p.holdings[key]-=qty;p.money+=total;log(`${stock.name} ${qty}주 매도 +${fmt(total)}`,"good");}
  p.ap--;render();
}
function moveMarket(){
  for(const s of Object.values(STOCKS)){s.last=s.price;const drift=(Math.random()-0.5)*0.07;s.price=Math.max(10,+((s.price*(1+drift)).toFixed(2)));}
  if(Math.random()<0.72){const [key,effect,text]=NEWS[Math.floor(Math.random()*NEWS.length)];const s=STOCKS[key];s.price=Math.max(10,+((s.price*(1+effect)).toFixed(2)));addNews(s.name,text);}
}
function addNews(company,text){
  state.news.unshift({company,text});
  state.news=state.news.slice(0,8);
  state.headlineIndex=0;
  showHeadline(0, false);
}
function headlineString(n){return n?`${n.company}  ·  ${n.text}`:"시장 개장 준비 중…";}
function showHeadline(index=0,instant=false){
  const el=document.getElementById("headlineText"); if(!el) return;
  if(!state.news.length){el.textContent="시장 개장 준비 중…";return;}
  state.headlineIndex=((index%state.news.length)+state.news.length)%state.news.length;
  const apply=()=>{el.textContent=headlineString(state.news[state.headlineIndex]);el.classList.remove("slide-out");el.classList.add("slide-in");setTimeout(()=>el.classList.remove("slide-in"),320);};
  if(instant){el.textContent=headlineString(state.news[state.headlineIndex]);return;}
  el.classList.add("slide-out");setTimeout(apply,230);
}
function cycleHeadline(){
  if(!state.news.length) return;
  showHeadline(state.headlineIndex+1,false);
}

function endTurn(){
  if(state.gameOver)return;
  if(activeInCheck()) return log("체크 상태에서 턴 종료 불가. 킹부터 빼!","bad");
  const mover=state.turn, next=enemyColor(mover);
  // 상대 체크메이트 검사. 부활 보험이 있으면 홈존 안전 칸에 재배치.
  if(isKingInCheck(next,state.board) && allLegalMoves(next).length===0){
    if(state.players[next].insurance){
      state.players[next].insurance=false;
      if(!reviveKing(next)) return finishGame(mover,"체크메이트 + 부활 공간 없음");
      log(`${next==="w"?"백":"흑"} 킹 부활 보험 발동! 체크메이트 무효.`,`gold`);
    } else return finishGame(mover,"체크메이트");
  }
  state.turn=next;state.turnNo++;
  const p=current();p.ownTurns++;p.ap=CFG.maxAP;p.moveUsed=false;
  p.money+=p.salary;const tax=countTax(state.turn);p.money-=tax;
  log(`${state.turn==="w"?"백":"흑"} 턴 시작: 월급 +${fmt(p.salary)}, 세금 -${fmt(tax)}`,tax?"":"good");
  processMaturities(state.turn);moveMarket();clearMode();checkBankruptcy();render();
}
function reviveKing(color){
  const k=findKing(color); if(k){ /* 기존 킹은 체크메이트 상태지만 살아있음: 안전 홈칸으로 이동 */ }
  const rows=color==="w"?[7,6]:[0,1];
  const original=k?state.board[k.r][k.c]:piece("k",color); if(k)state.board[k.r][k.c]=null;
  for(const r of rows)for(let c=0;c<8;c++)if(!state.board[r][c]){
    const b=cloneBoard();b[r][c]={...original,moved:true};
    if(!isKingInCheck(color,b)){state.board=b;return true;}
  }
  if(k)state.board[k.r][k.c]=original;return false;
}
function finishGame(winner,reason){
  state.gameOver=true;const name=winner==="w"?"백":"흑";
  document.getElementById("gameOverTitle").textContent=`${name} 승리`;
  document.getElementById("gameOverText").textContent=`${reason}\n최종 자산 — 백 ${fmt(state.players.w.money)} / 흑 ${fmt(state.players.b.money)}`;
  document.getElementById("gameOverModal").classList.remove("hidden");
}
function checkBankruptcy(){
  for(const c of ["w","b"]){if(state.players[c].money<CFG.bankruptcy){finishGame(enemyColor(c),`${c==="w"?"백":"흑"} 파산 (${fmt(state.players[c].money)})`);return true;}}
  return false;
}

function fenFor(side){
  const rows=state.board.map(row=>{let out="",empty=0;for(const p of row){if(!p){empty++;continue;}if(empty){out+=empty;empty=0;}let ch=p.type;if(p.color==="w")ch=ch.toUpperCase();out+=ch;}if(empty)out+=empty;return out;});
  return `${rows.join("/")} ${side} - - 0 1`;
}

function initStockfish(){
  const status=document.getElementById("engineStatus");
  try{
    const worker=new Worker("engine/stockfish-18-lite-single.js");
    state.engine=worker;
    let timer=setTimeout(()=>{if(!state.engineReady){status.textContent="Stockfish: 파일 없음/로드 실패";status.classList.add("offline");worker.terminate();state.engine=null;}},4500);
    worker.onmessage=(e)=>{
      const line=String(e.data||"");
      if(line.includes("uciok")){state.engineReady=true;clearTimeout(timer);status.textContent="Stockfish: ONLINE";status.className="engine-pill online";worker.postMessage("setoption name Hash value 16");}
      if(line.startsWith("info ") && state.engineQueue.length){const q=state.engineQueue[0];const m=line.match(/score (cp|mate) (-?\d+)/);if(m){q.lastScore={type:m[1],value:Number(m[2])};}}
      if(line.startsWith("bestmove") && state.engineQueue.length){const q=state.engineQueue.shift();const best=line.split(/\s+/)[1];q.resolve({best,score:q.lastScore});}
    };
    worker.onerror=()=>{status.textContent="Stockfish: 엔진 파일을 engine/에 넣어줘";status.className="engine-pill offline";};
    worker.postMessage("uci");
  }catch(e){status.textContent="Stockfish: 미탑재 (게임은 정상 플레이 가능)";status.className="engine-pill offline";state.engine=null;}
}
function engineBestMove(fen){
  return new Promise((resolve,reject)=>{
    if(!state.engineReady||!state.engine)return reject(new Error("offline"));
    state.engineQueue.push({resolve,reject,lastScore:null});
    state.engine.postMessage("position fen "+fen);
    state.engine.postMessage("go depth 10");
    setTimeout(()=>{const i=state.engineQueue.findIndex(x=>x.resolve===resolve);if(i>=0){state.engineQueue.splice(i,1);reject(new Error("timeout"));}},5000);
  });
}
async function evaluateMoveWithStockfish(beforeFen,uci,info,mover){
  if(!state.engineReady)return;
  try{
    const res=await engineBestMove(beforeFen);
    if(res.best===uci){
      const tactical=info.capture||info.check;
      const bonus=tactical?CFG.brilliantBonus:CFG.bestBonus;
      state.players[mover].money+=bonus;
      log(`${tactical?"!! 탁월수":"★ 엔진 최선수"} ${uci} · +${fmt(bonus)}`,"gold");render();
    }
  }catch(_){ /* 엔진이 없거나 타임아웃이면 조용히 스킵 */ }
}

function render(){
  document.querySelectorAll(".square").forEach(el=>{
    const r=Number(el.dataset.r),c=Number(el.dataset.c),p=state.board[r][c],key=sqName(r,c);
    el.classList.remove("selected","legal","capture","buy-target","teleport-target","in-check","dragging");
    if(state.selected?.r===r&&state.selected?.c===c)el.classList.add("selected");
    const legal=state.legalTargets.some(x=>x.r===r&&x.c===c);if(legal)el.classList.add(p?"capture":"legal");
    if(state.mode==="buy"&&homeZone(state.turn,r)&&!p)el.classList.add("buy-target");
    if(state.mode==="teleport"&&!p)el.classList.add("teleport-target");
    if(p?.type==="k" && isKingInCheck(p.color,state.board)) el.classList.add("in-check");
    el.draggable=!!(p && p.color===state.turn && !current().moveUsed && !state.mode);
    let html="";
    if(p) html+=pieceImgTag(p.color+p.type,"piece",`${p.color}${p.type}`);
    if(state.visits[key])html+=`<span class="visit-badge">${state.visits[key]}</span>`;
    if(state.properties[key])html+=`<span class="owner-mark ${state.properties[key]}"></span>`;
    el.innerHTML=html;
  });
  for(const t of ["p","n","b","r","q"]){const img=document.getElementById(`shop-${t}`);if(img){const key=state.turn+t;img.src=IMG[key];img.dataset.fallback=IMG_FALLBACK[key];}}
  attachImageFallbacks(document);
  const w=state.players.w,b=state.players.b,p=current();
  document.getElementById("whiteMoney").textContent=fmt(w.money);document.getElementById("blackMoney").textContent=fmt(b.money);
  document.getElementById("whiteSalary").textContent=fmt(w.salary);document.getElementById("blackSalary").textContent=fmt(b.salary);
  document.getElementById("whiteTax").textContent=fmt(countTax("w"));document.getElementById("blackTax").textContent=fmt(countTax("b"));
  document.getElementById("whiteCard").classList.toggle("active",state.turn==="w");document.getElementById("blackCard").classList.toggle("active",state.turn==="b");
  document.getElementById("turnLabel").textContent=`${state.turn==="w"?"백":"흑"}의 턴${activeInCheck()?" — 체크!":""}`;
  document.getElementById("apValue").textContent=`${p.ap} / ${CFG.maxAP}`;
  document.getElementById("moveState").textContent=`체스 수: ${p.moveUsed?"사용 완료":"사용 가능"}`;
  document.getElementById("selectedSquare").textContent=state.selected?sqName(state.selected.r,state.selected.c):"없음";
  document.getElementById("salaryUpgradeText").textContent=`+${fmt(CFG.salaryRaise)}/턴 · 비용 ${fmt(salaryCost(p))} · 1 AP`;
  document.getElementById("insuranceStatus").innerHTML=`백 보험: ${w.insurance?"<strong>보유</strong>":"없음"} · 흑 보험: ${b.insurance?"<strong>보유</strong>":"없음"}`;
  renderMaturities();renderStocks();renderAnnotations();
  document.getElementById("endTurnBtn").disabled=activeInCheck();
}
function renderMaturities(){
  const p=current();const items=[];
  for(const d of p.deposits)items.push(`적금 $500 · ${Math.max(0,d.due-p.ownTurns)}회 내 턴 남음`);
  for(const v of p.ventures)items.push(`벤처 $300 · ${Math.max(0,v.due-p.ownTurns)}회 내 턴 남음`);
  document.getElementById("maturityList").textContent=items.length?items.join(" / "):"진행 중인 적금·투자 없음";
}
function renderStocks(){
  const ticker=document.getElementById("ticker");ticker.innerHTML="";
  for(const [k,s] of Object.entries(STOCKS)){
    const pct=((s.price-s.last)/s.last*100)||0;const cls=pct>=0?"up":"down";const arrow=pct>=0?"▲":"▼";
    ticker.innerHTML+=`<div class="ticker-row"><span>${s.name}</span><span class="price">${fmt(s.price)}</span><span class="delta ${cls}">${arrow} ${Math.abs(pct).toFixed(1)}%</span></div>`;
  }
  const p=current();const portfolio=Object.entries(p.holdings).filter(([,q])=>q>0).map(([k,q])=>`${STOCKS[k].name} ${q}주 (${fmt(STOCKS[k].price*q)})`);
  document.getElementById("portfolio").textContent=portfolio.length?`${state.turn==="w"?"백":"흑"} 보유: `+portfolio.join(" · "):"보유 주식 없음";
  document.getElementById("newsFeed").innerHTML=state.news.map(n=>`<div class="news-item"><b>${n.company}</b> — ${n.text}</div>`).join("");
  document.getElementById("marketTurn").textContent=`T${state.turnNo}`;
}

function log(text,type=""){
  const el=document.getElementById("log");const d=document.createElement("div");d.className=`log-entry ${type}`;d.textContent=`[T${state.turnNo}] ${text}`;el.prepend(d);
}

init();

"use strict";

const FILES = ["a","b","c","d","e","f","g","h"];
const PIECES = {
  p: {name:"폰", price:180, captureReward:140, tax:10},
  n: {name:"나이트", price:520, captureReward:400, tax:28},
  b: {name:"비숍", price:520, captureReward:400, tax:28},
  r: {name:"룩", price:850, captureReward:650, tax:45},
  q: {name:"퀸", price:1500, captureReward:1150, tax:90},
  k: {name:"킹", price:null, captureReward:0, tax:0, purchasable:false}
};
const PIECE_SCORE = {p:1,n:3,b:3,r:5,q:9,k:0};
let DEBUG_STOCKFISH = false;
try{DEBUG_STOCKFISH=localStorage.getItem("capitalistChessStockfishDebug")==="true";}catch(_){ }
window.DEBUG_STOCKFISH=DEBUG_STOCKFISH;
const CFG = {
  startMoney: 1200,
  startSalary: 220,
  maxAP: 3,
  jobPay: 140,
  salaryRaise: 40,
  salaryBaseCost: 500,
  salaryUpgradeMultiplier: 1.45,
  bankruptcy: -1500,
  propertyBase: 180,
  propertyVisitPrice: 75,
  tollBase: 20,
  tollVisitIncrement: 25,
  sellRatio: 0.60,
  brilliantBonus: 350,
  bestBonus: 160,
  promoteCost: 600,
  teleportCost: 800,
  insuranceCost: 1200
};
const CLOCK_INITIAL_SECONDS = 900;
const ENGINE_EVAL_CONFIG = {
  depth: 10,
  confidenceMinimum: 0.6,
  brilliantBonus: 350,
  bestBonus: 160,
  goodBonus: 60,
  brilliantMaxLoss: 25,
  bestMaxLoss: 45,
  goodMaxLoss: 90,
  tacticalGain: 80
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

const NEWS_POOL = [
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
const NEWS = NEWS_POOL.map(([companyId,effect,text],index)=>({id:`market-${index+1}`,companyId,effect,text}));
const NEWS_HISTORY_LIMIT = 8;

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
  pendingSpecialId:null,
  legalTargets:[],
  kingDangerTargets:[],
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
  recentNewsIds:[],
  newsEventSerial:0,
  headlineTimer:null,
  clock:{w:CLOCK_INITIAL_SECONDS,b:CLOCK_INITIAL_SECONDS},
  audio:{sound:true,bgm:true,bgmPlayer:null,bgmIndex:0,bgmLastIndex:-1,started:false},
  turnTimeLeft:CLOCK_INITIAL_SECONDS,
  turnTimerId:null,
  drawOffer:null,
  specialStock:{},
  specialRestockTurn:0,
  engineRevision:0,
  engineMoveSerial:0,
  engineAwarded:new Set()
};

function loadAudioSettings(){
  try{const saved=JSON.parse(localStorage.getItem("capitalistChessAudio")||"{}");if(typeof saved.sound==="boolean")state.audio.sound=saved.sound;if(typeof saved.bgm==="boolean")state.audio.bgm=saved.bgm;}catch(_){ }
}
function saveAudioSettings(){try{localStorage.setItem("capitalistChessAudio",JSON.stringify({sound:state.audio.sound,bgm:state.audio.bgm}));}catch(_){}}
function playSound(name){
  if(!state.audio.sound)return;
  const audio=new Audio(`assets/sounds/${name}.ogg`);audio.volume=.55;audio.play().catch(()=>{});
}
const BGM_TRACKS=["bgm_market_01.ogg","bgm_market_02.ogg","bgm_strategy_01.ogg"];
function playNextBgm(){
  if(!state.audio.bgm)return;
  const choices=BGM_TRACKS.map((_,index)=>index).filter(index=>index!==state.audio.bgmLastIndex);
  const index=choices[Math.floor(Math.random()*choices.length)];
  state.audio.bgmLastIndex=index;
  const track=BGM_TRACKS[index];
  const audio=new Audio(`assets/sounds/${track}`);
  audio.volume=.18;
  audio.onended=()=>{if(state.audio.bgmPlayer===audio){state.audio.bgmPlayer=null;playNextBgm();}};
  state.audio.bgmPlayer=audio;
  audio.play().catch(()=>{if(state.audio.bgmPlayer===audio)state.audio.bgmPlayer=null;});
}
function startBgm(){
  if(!state.audio.bgm||state.audio.bgmPlayer)return;
  playNextBgm();
}
function stopBgm(){if(state.audio.bgmPlayer){state.audio.bgmPlayer.onended=null;state.audio.bgmPlayer.pause();state.audio.bgmPlayer.currentTime=0;state.audio.bgmPlayer=null;}}
function renderAudioControls(){
  const sound=document.getElementById("soundToggleIcon"),bgm=document.getElementById("bgmToggleIcon");
  if(sound){sound.src=`assets/images/sound_${state.audio.sound?"on":"off"}.png`;sound.alt=state.audio.sound?"효과음 켜짐":"효과음 꺼짐";}
  if(bgm){bgm.src=`assets/images/bgm_${state.audio.bgm?"on":"off"}.png`;bgm.alt=state.audio.bgm?"배경음악 켜짐":"배경음악 꺼짐";}
}
function renderStockfishDebugControl(){
  const debug=document.getElementById("stockfishDebugToggle");
  if(!debug)return;
  debug.classList.toggle("active",DEBUG_STOCKFISH);
  debug.setAttribute("aria-pressed",String(DEBUG_STOCKFISH));
  debug.title=`Stockfish DEBUG 로그 ${DEBUG_STOCKFISH?"끄기":"켜기"}`;
}
function setStockfishDebug(enabled){
  DEBUG_STOCKFISH=Boolean(enabled);window.DEBUG_STOCKFISH=DEBUG_STOCKFISH;
  try{localStorage.setItem("capitalistChessStockfishDebug",String(DEBUG_STOCKFISH));}catch(_){ }
  renderAudioControls();renderStockfishDebugControl();
}
function bindAudioControls(){
  loadAudioSettings();renderAudioControls();renderStockfishDebugControl();
  document.getElementById("soundToggle")?.addEventListener("click",()=>{state.audio.sound=!state.audio.sound;saveAudioSettings();renderAudioControls();if(state.audio.sound)playSound("click");});
  document.getElementById("bgmToggle")?.addEventListener("click",()=>{state.audio.bgm=!state.audio.bgm;saveAudioSettings();if(state.audio.bgm)startBgm();else stopBgm();renderAudioControls();});
  document.getElementById("stockfishDebugToggle")?.addEventListener("click",()=>setStockfishDebug(!DEBUG_STOCKFISH));
  document.addEventListener("pointerdown",()=>{state.audio.started=true;startBgm();},{once:true});
}

function cheatPlayer(color){
  const normalized=String(color).toLowerCase();
  if(!state.players[normalized]) throw new Error(`색상은 w 또는 b여야 해: ${color}`);
  return state.players[normalized];
}

window.gameState=state;
function serializeGameState(){
  return JSON.parse(JSON.stringify({
    schemaVersion:1,
    revision:state.engineRevision,
    board:state.board,
    turn:state.turn,
    turnNo:state.turnNo,
    players:state.players,
    visits:state.visits,
    properties:state.properties,
    lastMove:state.lastMove,
    gameOver:state.gameOver,
    specialStock:state.specialStock,
    specialRestockTurn:state.specialRestockTurn,
    clock:state.clock,
    drawOffer:state.drawOffer,
    news:state.news,
    recentNewsIds:state.recentNewsIds
  }));
}
function applyGameState(snapshot){
  if(!snapshot||snapshot.schemaVersion!==1)return false;
  state.board=snapshot.board||state.board;state.turn=snapshot.turn||state.turn;state.turnNo=Number(snapshot.turnNo||state.turnNo);
  state.players=snapshot.players||state.players;state.visits=snapshot.visits||{};state.properties=snapshot.properties||{};state.lastMove=snapshot.lastMove||null;
  state.gameOver=Boolean(snapshot.gameOver);state.specialStock=snapshot.specialStock||{};state.specialRestockTurn=Number(snapshot.specialRestockTurn||0);state.clock=snapshot.clock||state.clock;state.drawOffer=snapshot.drawOffer||null;state.news=snapshot.news||[];state.recentNewsIds=snapshot.recentNewsIds||[];state.engineRevision=Number(snapshot.revision||0);state.engineAwarded=new Set();
  state.selected=null;state.legalTargets=[];state.mode=null;render();renderTurnTimer();return true;
}
window.serializeGameState=serializeGameState;window.applyGameState=applyGameState;
window.handleMultiplayerAction=function(action){
  if(window.multiplayer?.role!=="host"||!action||state.turn!=="b")return;
  if(action.type==="endTurn")return endTurn();
  if(action.type==="draw")return requestDraw();
  if(action.type==="purchase"){
    state.mode=action.specialId?"special-buy":"buy";state.pendingSpecialId=action.specialId||null;state.pendingPiece=action.piece||null;
    return finishPurchase(action.r,action.c);
  }
  if(action.type==="teleport"){
    state.selected=action.selected;return finishTeleport(action.r,action.c);
  }
  if(["job","salary","deposit","venture","insurance","promote","buyProperty","sellPiece","stockBuy","stockSell"].includes(action.type)){
    if(action.selected){state.selected=action.selected;}
    if(action.type==="job")return doJob();
    if(action.type==="salary")return raiseSalary();
    if(action.type==="deposit")return makeDeposit();
    if(action.type==="venture")return makeVenture();
    if(action.type==="insurance")return buyInsurance();
    if(action.type==="promote")return instantPromote();
    if(action.type==="buyProperty")return buyProperty();
    if(action.type==="sellPiece")return sellSelectedPiece();
    if(action.type==="stockBuy"||action.type==="stockSell"){
      const select=document.getElementById("stockSelect"),qty=document.getElementById("stockQty");
      if(select&&action.key)select.value=action.key;if(qty&&action.qty)qty.value=action.qty;
      return tradeStock(action.type==="stockBuy");
    }
  }
  if(action.type!=="move")return;
  const from=fromName(action.from),to=fromName(action.to),legal=legalMovesFor(from.r,from.c).some(cell=>cell.r===to.r&&cell.c===to.c);
  if(!legal)return log("온라인 상대의 불법 이동 요청을 거부했어.","bad");
  makeMove(from.r,from.c,to.r,to.c);
};
function runMultiplayerAction(type,local,payload=()=>({})){
  return (...args)=>{
    if(window.multiplayer?.role==="guest"){window.multiplayer.sendAction({type,...payload(...args)});return;}
    local(...args);
  };
}
window.setStockfishDebug=setStockfishDebug;
window.cheat={
  money(color,amount){
    cheatPlayer(color).money=Number(amount);
    render();
  },
  addMoney(color,amount){
    cheatPlayer(color).money+=Number(amount);
    render();
  },
  ap(color,amount){
    cheatPlayer(color).ap=Number(amount);
    render();
  },
  clock(color,seconds){
    const normalized=String(color).toLowerCase();
    if(!state.clock[normalized])throw new Error(`색상은 w 또는 b여야 해: ${color}`);
    state.clock[normalized]=Math.max(0,Number(seconds)||0);renderTurnTimer();
  },
  addClock(color,seconds){
    const normalized=String(color).toLowerCase();
    if(!state.clock[normalized])throw new Error(`색상은 w 또는 b여야 해: ${color}`);
    state.clock[normalized]=Math.max(0,state.clock[normalized]+(Number(seconds)||0));renderTurnTimer();
  },
  specialStock(id,amount){
    if(!SpecialPieces.get(id))throw new Error(`특수기물 id를 찾을 수 없어: ${id}`);
    state.specialStock[id]=Math.max(0,Math.floor(Number(amount)||0));render();
  },
  restockSpecial(){
    restockSpecialPieces();render();
  },
  fillSpecialStock(amount=null){
    for(const def of SpecialPieces.list()){
      const max=Math.max(0,Math.floor(Number(def.stock?.max)||0));
      const value=amount===null?max:Math.max(0,Math.floor(Number(amount)||0));
      state.specialStock[def.id]=Math.min(max,value);
    }
    render();
  },
  fillStock(amount=null){
    return this.fillSpecialStock(amount);
  },
  effect(grade="brilliant",bonus=null){
    const key=String(grade).toLowerCase();
    const config=MOVE_GRADE_VFX[key]||MOVE_GRADE_VFX.brilliant;
    const value=bonus===null?config.defaultBonus:Number(bonus)||0;
    showMoveGradeEffect({grade:key,bonus:value,square:state.lastMove,moveId:`cheat-${Date.now()}`});
    if(key==="brilliant")playSound("brilliant");
  },
  brilliant(bonus=350){this.effect("brilliant",bonus);},
  best(bonus=160){this.effect("best",bonus);},
  excellent(bonus=0){this.effect("excellent",bonus);},
  good(bonus=60){this.effect("good",bonus);},
  inaccuracy(){this.effect("inaccuracy",0);},
  mistake(){this.effect("mistake",0);},
  blunder(){this.effect("blunder",0);},
  unrated(){this.effect("unrated",0);}
};
window.cheat.clock=(color,seconds)=>{
  const normalized=String(color).toLowerCase();
  if(!["w","b"].includes(normalized))throw new Error("clock color must be w or b");
  state.clock[normalized]=Math.max(0,Number(seconds)||0);renderTurnTimer();
};
window.cheat.addClock=(color,seconds)=>{
  const normalized=String(color).toLowerCase();
  if(!["w","b"].includes(normalized))throw new Error("clock color must be w or b");
  state.clock[normalized]=Math.max(0,state.clock[normalized]+(Number(seconds)||0));renderTurnTimer();
};

async function init() {
  const specialData=await SpecialPieces.load();
  const status=document.getElementById("specialLoadStatus");
  if(!specialData){
    if(status)status.textContent="특수기물 데이터를 불러오지 못했습니다. 일반 게임은 계속할 수 있습니다.";
  }else{
    restockSpecialPieces(true);
    if(status)status.textContent="공유 재고 · 휠클릭으로 상세정보";
  }
  state.board[7][4] = piece("k","w");
  state.board[0][4] = piece("k","b");
  buildBoard();
  buildShop();
  buildStocks();
  bindControls();
  bindAudioControls();
  if(window.multiplayer){window.multiplayer.onAction=action=>window.handleMultiplayerAction(action);window.multiplayer.onState=snapshot=>applyGameState(snapshot);window.multiplayer.bindUI();}
  addNews("시장", "자본주의 체스 거래소가 개장했다. 모두의 통장이 무사하길.");
  log("게임 시작. 양측 킹 1개 + $1,500.","gold");
  initStockfish();
  render();
  startTurnTimer();
  showHeadline(0, true);
  state.headlineTimer=setInterval(cycleHeadline, 3600);
}

function piece(type,color){ return {type,color,moved:false,id:crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}; }
function purchasedPiece(type,color){ return {...piece(type,color),purchaseLocked:true,active:false,activationTurn:state.turnNo+1,attackLockedTurns:3}; }
function specialPiece(id,color){
  const def=SpecialPieces.get(id);
  const abilityCharges=Object.fromEntries((def?.abilities||[]).filter(a=>Number(a.params?.charges)>0).map(a=>[a.id,Number(a.params.charges)]));
  return {type:"special",specialId:id,color,moved:false,purchaseLocked:true,active:false,activationTurn:state.turnNo+1,attackLockedTurns:3,abilityCharges,id:crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)};
}
function specialDef(id){ return SpecialPieces.get(id); }
function specialIcon(def){return def?.icon||def?.emoji||"♟";}
function specialScore(def){return Number(def?.score??def?.pieceScore??0);}
function specialTax(def){return Number(def?.maintenanceTax??def?.tax??0);}
function specialAbilities(def){return def?.abilities||[];}
function specialAbility(def,id){return specialAbilities(def).find(a=>a.id===id);}
function specialDisabledAt(r,c,p,board=state.board){
  if(!p?.specialId)return false;
  for(let rr=0;rr<8;rr++)for(let cc=0;cc<8;cc++){
    const source=board[rr][cc];if(!source?.specialId||source.color===p.color||!source.active)continue;
    const ability=specialAbility(specialDef(source.specialId),"disable_enemy_specials_aura");
    if(ability&&Math.max(Math.abs(rr-r),Math.abs(cc-c))<=Number(ability.params?.radius||0))return true;
  }
  return false;
}
function isFakeKingDef(def){return Boolean(def?.fakeKing||specialAbility(def,"fake_king_identity"));}
function isCountsAsKingDef(def){return Boolean(def?.countsAsKing||specialAbility(def,"royal_unit")?.params?.countsAsKing);}
function fakeKingPenalty(def){const a=specialAbility(def,"fake_king_identity");return Number(def?.captureApPenalty??a?.params?.captureAPPenalty??a?.params?.captureApPenalty??0);}
function pieceDef(p){ return p?.specialId?specialDef(p.specialId):PIECES[p?.type]; }
function pieceName(p,viewerColor=state.turn){
  const def=pieceDef(p); if(!def)return "기물";
  return p?.specialId&&isFakeKingDef(def)&&p.color!==viewerColor?"킹":def.name;
}
function piecePrice(p){return Number(pieceDef(p)?.price||0);}
function pieceCaptureReward(p){return Number(pieceDef(p)?.captureReward??pieceDef(p)?.price??0);}
function pieceScore(p){return p.specialId?specialScore(pieceDef(p)):Number(pieceDef(p)?.score||0);}
function isKingLike(p){const def=p?.specialId?specialDef(p.specialId):null;return p?.type==="k"||Boolean(p?.specialId&&!isFakeKingDef(def)&&isCountsAsKingDef(def));}
function pieceVisual(p){
  const def=pieceDef(p);
  if(p.specialId&&!isFakeKingDef(def)&&!isCountsAsKingDef(def))return `<span class="special-piece-icon" title="${pieceName(p)}">${specialIcon(def)}</span>`;
  const ownerView=p.specialId&&isFakeKingDef(def)&&p.color===state.turn;
  return pieceImgTag(p.color+"k","piece",ownerView?"가짜 킹":`${p.color}k`);
}
function current(){ return state.players[state.turn]; }
function enemyColor(c=state.turn){ return c === "w" ? "b" : "w"; }
function fmt(n){ return "$" + Math.round(n).toLocaleString("ko-KR"); }
function sqName(r,c){ return FILES[c] + (8-r); }
function fromName(s){ return {r:8-Number(s[1]), c:FILES.indexOf(s[0])}; }
function inBounds(r,c){ return r>=0 && r<8 && c>=0 && c<8; }
function cloneBoard(board=state.board){ return board.map(row=>row.map(p=>p?{...p}:null)); }
function countTax(color){
  let n=0;
  for(const row of state.board) for(const p of row) if(p?.color===color) n+=p.specialId?specialTax(pieceDef(p)):Number(PIECES[p.type]?.tax||0);
  return n;
}
function countPieceScore(color){
  let score=0;
  for(const row of state.board) for(const p of row) if(p?.color===color) score+=p.specialId?pieceScore(p):PIECE_SCORE[p.type]||0;
  return score;
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
  return true;
}

function rollSpecialStock(def){
  const stock=def.stock||{};const max=Math.max(0,Number(stock.max)||0);
  if(!max||Math.random()>Number(stock.restockChance||0))return 0;
  if(Math.random()<Number(stock.zeroStockWeight||0))return 0;
  return 1+Math.floor(Math.random()*max);
}
function restockSpecialPieces(initial=false){
  if(!SpecialPieces.data)return;
  for(const def of SpecialPieces.list()){
    const amount=rollSpecialStock(def);state.specialStock[def.id]=amount;
    if(amount>0&&(def.rarity==="신화"||def.rarity==="mythic"))addNews("신화급 입고",`${specialIcon(def)} ${def.name} ${amount}개 입고`);
  }
  for(const def of SpecialPieces.list()){
    if(String(def.rarity).toLowerCase()==="legendary"&&(state.specialStock[def.id]||0)>0){
      addNews("특수기물 입고",`${specialIcon(def)} ${def.name} ${state.specialStock[def.id]}개 입고`);
    }
  }
  const rareRestocked=["black_hole","chaebol_king","mounted_king","mounted_king_mk2"].some(id=>(state.specialStock[id]||0)>0);
  if(rareRestocked)playSound("rare-restock");
  state.specialRestockTurn=state.turnNo;
  if(!initial)log("특수기물 시장 전체 재입고.","gold");
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
    el.addEventListener("mousedown",e=>{if(e.button===1){e.preventDefault();showBoardPieceInfo(r,c);}});
    el.addEventListener("auxclick",e=>{if(e.button===1)e.preventDefault();});
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
    btn.addEventListener("mousedown",e=>{if(e.button===1){e.preventDefault();showPieceInfo(normalPieceInfo({type:t}),null,true,t);}});
    btn.addEventListener("auxclick",e=>{if(e.button===1)e.preventDefault();});
    el.appendChild(btn);
  });
  buildSpecialShop();
}

function buildSpecialShop(){
  const el=document.getElementById("specialPieceShop");if(!el)return;
  el.innerHTML="";
  for(const def of SpecialPieces.list()){
    const btn=document.createElement("button");btn.className="shop-item special-shop-item";btn.dataset.specialId=def.id;
    btn.innerHTML=`<span class="shop-piece special-shop-icon">${specialIcon(def)}</span><b>${def.name}</b><small>${fmt(def.price)} · ${def.buyAP} AP</small><em class="special-stock" id="special-stock-${def.id}">재고 0</em>`;
    btn.addEventListener("click",()=>startSpecialPurchase(def.id));
    btn.addEventListener("mousedown",e=>{if(e.button===1){e.preventDefault();showPieceInfo(def,state.specialStock[def.id]||0,true,def.id,def.id);}});
    btn.addEventListener("auxclick",e=>{if(e.button===1)e.preventDefault();});
    el.appendChild(btn);
  }
}

function buildStocks(){
  const sel=document.getElementById("stockSelect");
  sel.innerHTML=Object.entries(STOCKS).map(([k,s])=>`<option value="${k}">${s.name}</option>`).join("");
}

function bindControls(){
  document.getElementById("endTurnBtn").onclick=runMultiplayerAction("endTurn",endTurn);
  document.getElementById("cancelModeBtn").onclick=clearMode;
  document.getElementById("clearLogBtn").onclick=()=>document.getElementById("log").innerHTML="";
  document.getElementById("jobBtn").onclick=runMultiplayerAction("job",doJob);
  document.getElementById("salaryBtn").onclick=runMultiplayerAction("salary",raiseSalary);
  document.getElementById("depositBtn").onclick=runMultiplayerAction("deposit",makeDeposit);
  document.getElementById("ventureBtn").onclick=runMultiplayerAction("venture",makeVenture);
  document.getElementById("promoteBtn").onclick=runMultiplayerAction("promote",instantPromote,()=>({selected:state.selected}));
  document.getElementById("teleportBtn").onclick=startTeleport;
  document.getElementById("insuranceBtn").onclick=runMultiplayerAction("insurance",buyInsurance);
  document.getElementById("buyPropertyBtn").onclick=runMultiplayerAction("buyProperty",buyProperty,()=>({selected:state.selected}));
  document.getElementById("sellPieceBtn").onclick=runMultiplayerAction("sellPiece",sellSelectedPiece,()=>({selected:state.selected}));
  document.getElementById("stockBuyBtn").onclick=runMultiplayerAction("stockBuy",()=>tradeStock(true),()=>({key:document.getElementById("stockSelect")?.value,qty:document.getElementById("stockQty")?.value}));
  document.getElementById("stockSellBtn").onclick=runMultiplayerAction("stockSell",()=>tradeStock(false),()=>({key:document.getElementById("stockSelect")?.value,qty:document.getElementById("stockQty")?.value}));
  document.getElementById("drawBtn").onclick=runMultiplayerAction("draw",requestDraw);
  ["cancelModeBtn","clearLogBtn","salaryBtn","depositBtn","ventureBtn","promoteBtn","teleportBtn","insuranceBtn","sellPieceBtn","stockBuyBtn","stockSellBtn"].forEach(id=>{
    document.getElementById(id)?.addEventListener("click",()=>playSound("click"));
  });
  document.getElementById("pieceInfoClose").onclick=closePieceInfo;
  document.getElementById("pieceInfoModal").addEventListener("click",e=>{if(e.target.id==="pieceInfoModal")closePieceInfo();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closePieceInfo();});
}

function closePieceInfo(){document.getElementById("pieceInfoModal")?.classList.add("hidden");}
function normalPieceInfo(p){
  const movement={p:"pawn",n:"knight",b:"bishop",r:"rook",q:"queen",k:"king"}[p.type]||"stationary";
  return {name:PIECES[p.type].name,icon:p.type==="k"?"♔":"♟",rarity:"일반",score:PIECE_SCORE[p.type]||0,price:PIECES[p.type].price,captureReward:PIECES[p.type].captureReward,buyAP:1,maintenanceTax:PIECES[p.type].tax,description:"일반 체스 기물",warnings:[],movement:{type:movement,preview:{cells:[]}},abilities:[]};
}
function showBoardPieceInfo(r,c){
  const p=state.board[r][c];if(!p)return;
  const def=p.specialId?specialDef(p.specialId):normalPieceInfo(p);
  const viewerOwns=p.color===state.turn;
  const hiddenFakeId=p.specialId&&isFakeKingDef(def)&&!viewerOwns;
  showPieceInfo(def,p.specialId?state.specialStock[p.specialId]||0:null,viewerOwns,p.id,hiddenFakeId?null:(p.specialId||p.type));
}

function clickSquare(r,c){
  if(state.gameOver) return;
  playSound("click");
  if(Date.now()-state.justDragged<180) return;
  if(state.annotations.length || state.annotationPreview){
    state.annotations=[];
    state.annotationPreview=null;
    clearAnnotationHover();
    renderAnnotations();
  }
  const p=state.board[r][c];
  const key=sqName(r,c);

  if(state.mode === "buy" || state.mode === "special-buy"){
    if(window.multiplayer?.role==="guest"){window.multiplayer.sendAction({type:"purchase",piece:state.pendingPiece,specialId:state.pendingSpecialId,r,c});return;}
    return finishPurchase(r,c);
  }
  if(state.mode === "teleport"){
    if(window.multiplayer?.role==="guest"){window.multiplayer.sendAction({type:"teleport",selected:state.selected,r,c});return;}
    return finishTeleport(r,c);
  }

  const isLegal=state.legalTargets.some(x=>x.r===r&&x.c===c);
  if(state.selected && isLegal){
    if(window.multiplayer?.role==="guest"&&state.turn==="b"){
      window.multiplayer.sendAction({type:"move",from:sqName(state.selected.r,state.selected.c),to:sqName(r,c)});
      return;
    }
    return makeMove(state.selected.r,state.selected.c,r,c);
  }

  state.selected={r,c}; state.legalTargets=[];
  if(p && p.color===state.turn && !current().moveUsed){
    playSound("select");
    state.legalTargets=legalMovesFor(r,c,true);
  }
  render();
  renderTileInfo(key);
}

function clearMode(){ state.mode=null;state.pendingPiece=null;state.pendingSpecialId=null;state.legalTargets=[];state.selected=null;render(); }

function startPurchase(type){
  if(!canEconomy()) return;
  if(current().ap<1) return log("기물 구매: AP 부족","bad");
  if(current().money<PIECES[type].price) return log(`기물 구매: ${fmt(PIECES[type].price)} 필요`,`bad`);
  state.mode="buy"; state.pendingPiece=type; state.selected=null; state.legalTargets=[];
  log(`${PIECES[type].name} 구매 위치를 선택해.`,"gold"); render();
}
function startSpecialPurchase(id){
  const def=specialDef(id),stock=state.specialStock[id]||0;
  if(!def)return log("특수기물 데이터를 찾을 수 없어.","bad");
  if(stock<=0)return log(`${def.name}: 품절`,"bad");
  if(current().money<Number(def.price))return log(`${def.name}: 돈 부족 (${fmt(def.price)} 필요)`,"bad");
  if(current().ap<Number(def.buyAP))return log(`${def.name}: AP 부족 (${def.buyAP} 필요)`,"bad");
  state.mode="special-buy";state.pendingSpecialId=id;state.pendingPiece=null;state.selected=null;state.legalTargets=[];
  log(`${def.name} 구매 위치를 선택해.`,"gold");render();
}
function homeZone(color,r){ return color==="w" ? r>=6 : r<=1; }
function finishPurchase(r,c){
  if(state.mode==="special-buy")return finishSpecialPurchase(r,c);
  const type=state.pendingPiece;
  if(!homeZone(state.turn,r) || state.board[r][c]) return log("자기 진영의 빈 칸에만 배치 가능해.","bad");
  const price=PIECES[type].price;
  if(!payAndAP(price,1,"기물 구매")) return;
  state.board[r][c]=purchasedPiece(type,state.turn);
  playSound("buy");
  log(`${sqName(r,c)}에 ${PIECES[type].name} 채용 -${fmt(price)}`);
  state.mode=null;state.pendingPiece=null;render();
}
function finishSpecialPurchase(r,c){
  const id=state.pendingSpecialId,def=specialDef(id);
  if(!def||!homeZone(state.turn,r)||state.board[r][c])return log("자기 진영의 빈 칸에만 배치 가능해.","bad");
  if((state.specialStock[id]||0)<=0)return log(`${def.name}: 품절`,"bad");
  if(current().money<Number(def.price))return log(`${def.name}: 돈 부족`,"bad");
  if(current().ap<Number(def.buyAP))return log(`${def.name}: AP 부족`,"bad");
  current().money-=Number(def.price);current().ap-=Number(def.buyAP);state.specialStock[id]--;
  if(isCountsAsKingDef(def)&&!isFakeKingDef(def)){
    for(let rr=0;rr<8;rr++)for(let cc=0;cc<8;cc++){
      const existing=state.board[rr][cc];
      if(existing?.color===state.turn&&(existing.type==="k"||isKingLike(existing)))state.board[rr][cc]=null;
    }
    log(`${def.name}이(가) 기존 킹을 대체했어.`,"gold");
  }
  state.board[r][c]=specialPiece(id,state.turn);
  playSound("buy");
  log(`${sqName(r,c)}에 ${def.name} 배치 -${fmt(def.price)} / ${def.buyAP} AP · 다음 자기 턴에 활성화`);
  state.mode=null;state.pendingSpecialId=null;render();
}

function sellSelectedPiece(){
  if(!canEconomy() || !state.selected) return;
  const {r,c}=state.selected, p=state.board[r][c];
  if(!p || p.color!==state.turn || p.type==="k") return log("매각할 자기 기물(킹 제외)을 선택해.","bad");
  if(!useAP(1,"기물 매각")) return;
  const gain=Math.round(piecePrice(p)*CFG.sellRatio);
  state.board[r][c]=null;
  current().money+=gain; log(`${pieceName(p)} 매각 +${fmt(gain)}`,"good");clearMode();
}

function pseudoMoves(r,c,board=state.board, attackOnly=false){
  const p=board[r][c]; if(!p) return [];
  if(p.purchaseLocked&&!p.active)return [];
  if(p.attackLockedTurns>0&&attackOnly)return [];
  if(specialDisabledAt(r,c,p,board))return [];
  if(p.specialId){
    const def=specialDef(p.specialId),ranged=specialAbility(def,"ranged_capture"),movement=ranged?{type:"ranged_capture",...ranged.params}:def?.movement,handler=window.movementHandlers?.[movement?.type];
    return handler?handler({r,c,board,p,attackOnly,movement}):[];
  }
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
  for(let r=0;r<8;r++) for(let c=0;c<8;c++) if(board[r][c]?.specialId&&board[r][c].color===color&&isKingLike(board[r][c])) return {r,c};
  for(let r=0;r<8;r++) for(let c=0;c<8;c++) if(board[r][c]?.type==="k"&&board[r][c].color===color) return {r,c};
  return null;
}
function isKingInCheck(color,board=state.board){ const k=findKing(color,board); return k ? isSquareAttacked(k.r,k.c,enemyColor(color),board) : true; }
function kingDangerTargetsFor(r,c){
  const king=state.board[r][c];
  if(!king||king.color!==state.turn||!isKingLike(king))return [];
  return pseudoMoves(r,c,state.board,false).filter(target=>{
    const board=cloneBoard();
    board[target.r][target.c]={...king,moved:true};
    board[r][c]=null;
    return isSquareAttacked(target.r,target.c,enemyColor(king.color),board);
  });
}
function legalMovesFor(r,c){
  const p=state.board[r][c]; if(!p) return [];
  return pseudoMoves(r,c,state.board,false).filter(target=>!(p.attackLockedTurns>0&&state.board[target.r][target.c]));
}
function tryCaptureDefense(captured,captureSquare,beforeBoard){
  if(!captured?.specialId)return false;
  const def=specialDef(captured.specialId);
  for(const ability of specialAbilities(def)){
    const result=runAbility(ability.id,{state,piece:captured,owner:state.players[captured.color],captured,params:ability.params||{},event:"capture",captureSquare,beforeBoard});
    if(!result?.escapeSquare)continue;
    state.board=beforeBoard;
    state.board[captureSquare.r][captureSquare.c]=null;
    state.board[result.escapeSquare.r][result.escapeSquare.c]=piece("k",captured.color);
    log(`${def.name}이(가) 말을 버리고 ${sqName(result.escapeSquare.r,result.escapeSquare.c)}로 탈출했어.`,"gold");
    return true;
  }
  return false;
}
function tryNearbyCaptureDefense(captured,captureSquare,beforeBoard){
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const defender=state.board[r][c];if(!defender||defender.color!==captured.color||!defender.specialId)continue;
    for(const ability of specialAbilities(specialDef(defender.specialId))){
      const result=runAbility(ability.id,{state,piece:defender,captured,owner:state.players[defender.color],params:ability.params||{},event:"capture",captureSquare,beforeBoard});
      if(result?.defense){
        state.board=beforeBoard;
        if(result.sacrifice){for(const row of state.board)for(const piece of row)if(piece?.id===defender.id){const rr=state.board.indexOf(row),cc=row.indexOf(piece);state.board[rr][cc]=null;}}
        return true;
      }
    }
  }
  return false;
}
function runCaptureAbilityEffects(moving,captured,captureSquare){
  const effects=[];
  for(const ability of specialAbilities(specialDef(moving?.specialId))){
    const result=runAbility(ability.id,{state,piece:moving,captured,owner:state.players[moving.color],params:ability.params||{},event:"capture",captureSquare});
    if(result)effects.push(result);
  }
  return effects;
}
function makeMove(fr,fc,tr,tc){
  const pl=current(); if(pl.moveUsed) return log("일반 체스 이동은 턴당 1번이야.","bad");
  if(pl.ap<1) return log("이동할 AP가 없어.","bad");
  const moving=state.board[fr][fc]; const captured=state.board[tr][tc];
  if(!moving || moving.color!==state.turn) return;
  if(moving.purchaseLocked&&!moving.active)return log("구매한 기물은 다음 자기 턴부터 활성화돼.","bad");
  if(captured&&moving.attackLockedTurns>0)return log("구매한 기물은 2턴 동안 공격할 수 없어.","bad");
  if(moving.specialId&&!moving.active)return log(`${pieceName(moving)}은 다음 자기 턴부터 활성화돼.`,"bad");
  log(`${pieceName(moving,state.turn)} ${sqName(fr,fc)} → ${sqName(tr,tc)}${captured?` × ${pieceName(captured,state.turn)}`:""}`);
  const moveLogEl=log(`${pieceName(moving,state.turn)} ${sqName(fr,fc)} → ${sqName(tr,tc)}${captured?` × ${pieceName(captured,state.turn)}`:""}`);
  playSound(captured?"capture":"move");
  const beforeBoard=cloneBoard();
  const uci=sqName(fr,fc)+sqName(tr,tc)+(moving.type==="p" && (tr===0||tr===7)?"q":"");
  state.board[tr][tc]={...moving,moved:true}; state.board[fr][fc]=null;
  pl.ap--; pl.moveUsed=true;
  if(isKingInCheck(enemyColor(),state.board))playSound("check");
  const revision=++state.engineRevision,moveId=++state.engineMoveSerial;
  if(captured){
    const captureEffects=runCaptureAbilityEffects(moving,captured,{r:tr,c:tc});
    if(tryNearbyCaptureDefense(captured,{r:tr,c:tc},beforeBoard)||tryCaptureDefense(captured,{r:tr,c:tc},beforeBoard)){
      state.selected={r:fr,c:fc};state.legalTargets=[];render();return;
    }
    const stolen=captureEffects.find(effect=>effect.stealFraction);
    if(stolen){const amount=Math.min(stolen.maxSteal,Math.max(0,Math.round(piecePrice(captured)*stolen.stealFraction)));state.players[captured.color].money-=amount;pl.money+=amount;log(`${pieceName(moving)} 현금 강탈 +${fmt(amount)}`,"good");}
    if(captureEffects.some(effect=>effect.explode)){
      const radius=Number(specialAbility(specialDef(moving.specialId),"explode_on_capture")?.params?.radius)||1;
      for(let rr=tr-radius;rr<=tr+radius;rr++)for(let cc=tc-radius;cc<=tc+radius;cc++)if(inBounds(rr,cc)&&!(rr===tr&&cc===tc))state.board[rr][cc]=null;
    }
    if(captureEffects.some(effect=>effect.convert)){
      state.board[tr][tc]={...captured,color:moving.color,moved:true};
      state.board[fr][fc]=null;
      log(`${pieceName(moving)}가 ${pieceName(captured)}를 전환했어.`,"gold");
      state.selected={r:tr,c:tc};state.legalTargets=[];render();return;
    }
    const takeover=captureEffects.find(effect=>effect.takeover);
    if(takeover){const key=sqName(tr,tc),premium=Math.round(piecePrice(captured)*takeover.premiumFraction);state.properties[key]=moving.color;pl.money-=premium;log(`${key} 적대적 인수 · 프리미엄 -${fmt(premium)}`,"gold");}
    if(captureEffects.some(effect=>effect.extraMove))pl.moveUsed=false;
    const reward=pieceCaptureReward(captured);
    if(captured.type==="k"&&state.players[captured.color].insurance){
      state.players[captured.color].insurance=false;
      state.board[fr][fc]=moving;state.board[tr][tc]=captured;pl.money-=reward;
      log(`${captured.color==="w"?"백":"흑"} 킹 포획을 부활 보험이 막았다.`,"gold");
      state.selected={r:fr,c:fc};state.legalTargets=[];render();return;
    }
    pl.money+=reward;
    const capturedName=pieceName(captured,state.turn);
    log(`${capturedName} 포획! +${fmt(reward)}`,"good");
    if(captured.specialId&&isFakeKingDef(specialDef(captured.specialId))){
      const penalty=fakeKingPenalty(specialDef(captured.specialId));
      pl.ap=Math.max(0,pl.ap-penalty);
      log(`포획한 기물은 가짜 킹이었다. 포획자 AP -${penalty}.`,"gold");
    }
    state.lastMove={fr,fc,tr,tc,color:state.turn};
    state.selected={r:tr,c:tc}; state.legalTargets=[];
    if(captured.type==="k"||(captured.specialId&&isCountsAsKingDef(specialDef(captured.specialId))))finishGame(state.turn,`${captured.color==="w"?"백":"흑"} 킹 포획`);
    evaluateMoveWithStockfish({beforeBoard,afterBoard:cloneBoard(),uci,mover:state.turn,revision,moveId,moveLogEl,square:{r:tr,c:tc},info:{capture:true,check:isKingInCheck(enemyColor(),state.board),capturedValue:piecePrice(captured),movingValue:piecePrice(moving),movingIsStandard:!moving.specialId}});
    render();
    if(state.gameOver)return;
    return;
  }
  if(moving.type==="p" && (tr===0||tr===7)){ state.board[tr][tc]={...state.board[tr][tc],type:"q"}; log("폰 승급 → 퀸!","gold"); }
  visitSquare(tr,tc,state.turn);
  state.lastMove={fr,fc,tr,tc,color:state.turn};
  evaluateMoveWithStockfish({beforeBoard,afterBoard:cloneBoard(),uci,mover:state.turn,revision,moveId,moveLogEl,square:{r:tr,c:tc},info:{capture:false,check:isKingInCheck(enemyColor(),state.board),capturedValue:0,movingValue:piecePrice(moving),movingIsStandard:!moving.specialId}});
  state.selected={r:tr,c:tc}; state.legalTargets=[];
  checkBankruptcy(); render();
}

function visitSquare(r,c,color){
  const key=sqName(r,c); state.visits[key]=(state.visits[key]||0)+1;
  const owner=state.properties[key];
  if(owner && owner!==color){
    const toll=propertyToll(key);
    const payer=state.players[color], receiver=state.players[owner];
    payer.money-=toll; receiver.money+=toll;
    log(`${key} 통행료: ${color==="w"?"백":"흑"} -${fmt(toll)} → ${owner==="w"?"백":"흑"}`,"bad");
  }
}
function propertyPrice(key){ return CFG.propertyBase + (state.visits[key]||0)*CFG.propertyVisitPrice; }
function propertyToll(key){ return CFG.tollBase+(state.visits[key]||0)*CFG.tollVisitIncrement; }
function buyProperty(){
  if(!canEconomy()||!state.selected) return;
  const key=sqName(state.selected.r,state.selected.c), visits=state.visits[key]||0;
  if(visits<1) return log("아직 아무도 밟지 않은 허허벌판이야. 가치가 없어ㅋㅋ","bad");
  if(state.properties[key]) return log("이미 주인이 있는 칸이야.","bad");
  const price=propertyPrice(key);
  if(!payAndAP(price,1,"부동산 매입")) return;
  state.properties[key]=state.turn; log(`${key} 매입 -${fmt(price)} (현재 통행료 ${fmt(propertyToll(key))})`,`gold`);playSound("buy");render();renderTileInfo(key);
}
function renderTileInfo(key){
  const owner=state.properties[key]; const visits=state.visits[key]||0;
  document.getElementById("tileInfo").innerHTML=`<b>${key}</b> · 방문 ${visits}회 · 가치 ${fmt(propertyPrice(key))} · 통행료 ${fmt(propertyToll(key))}<br>소유자: ${owner?(owner==="w"?"백":"흑"):"없음"}`;
}

function doJob(){ if(!canEconomy()||!useAP(1,"알바"))return;current().money+=CFG.jobPay;playSound("click");log(`알바 완료 +${fmt(CFG.jobPay)} (킹이 알바 뛰는 세계관)`,`good`);render(); }
function salaryCost(p=current()){ return Math.round(CFG.salaryBaseCost*Math.pow(CFG.salaryUpgradeMultiplier,p.salaryLevel)); }
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
function runTurnAbilities(color){
  for(const row of state.board)for(const p of row)if(p?.color===color&&p.purchaseLocked&&!p.active&&p.activationTurn<=state.turnNo){
    p.active=true;
    if(p.attackLockedTurns>0)p.attackLockedTurns--;
    log(`${pieceName(p,color)} 활성화 · 이동 가능`,"gold");
  }
  for(const row of state.board)for(const p of row)if(p?.color===color&&p.purchaseLocked&&p.active&&p.activationTurn<state.turnNo&&p.attackLockedTurns>0){
    p.attackLockedTurns--;
  }
  for(const row of state.board)for(const p of row)if(p?.color===color&&p.specialId){
    const def=specialDef(p.specialId);
    if(!p.active&&p.activationTurn<=state.turnNo){p.active=true;log(`${def?.name||"특수기물"} 활성화.`,`gold`);}
    if(!p.active)continue;
    for(const ability of specialAbilities(def))runAbility(ability.id,{state,owner:state.players[color],piece:p,params:ability.params||{},event:"turn"});
  }
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
  if(!spend(current(),CFG.teleportCost,"즉시이동")||!useAP(2,"즉시이동")){state.board=before;return;}
  visitSquare(r,c,state.turn);log(`${sqName(from.r,from.c)} → ${sqName(r,c)} 즉시이동 -${fmt(CFG.teleportCost)}`,"gold");clearMode();checkBankruptcy();
}
function buyInsurance(){
  if(!canEconomy())return;const p=current();if(p.insurance)return log("이미 킹 부활 보험 있어.","bad");
  if(!payAndAP(CFG.insuranceCost,1,"부활 보험"))return;
  p.insurance=true;log("킹 포획 방어 보험 가입 완료. 다음 킹 포획 1회 방어.","gold");render();
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
  if(Math.random()<0.72){
    const news=selectNews();
    const s=STOCKS[news.companyId];
    if(s){s.price=Math.max(10,+((s.price*(1+news.effect)).toFixed(2)));}
    addNews({id:news.id,company:s?.name||news.companyId,companyId:news.companyId,text:news.text});
  }
}
function selectNews(){
  let candidates=NEWS.filter(news=>!state.recentNewsIds.includes(news.id));
  const last=state.news[0];
  const differentCompany=candidates.filter(news=>news.companyId!==last?.companyId);
  if(differentCompany.length)candidates=differentCompany;
  if(!candidates.length){
    const oldestId=state.recentNewsIds[0];
    candidates=NEWS.filter(news=>news.id===oldestId);
    if(!candidates.length)candidates=NEWS.slice();
  }
  return candidates[Math.floor(Math.random()*candidates.length)];
}
function addNews(eventOrCompany,text){
  const event=typeof eventOrCompany==="object"?{...eventOrCompany}:{id:`news-${++state.newsEventSerial}`,company:eventOrCompany,text};
  if(!event.id)event.id=`news-${++state.newsEventSerial}`;
  if(state.news.some(news=>news.id===event.id))return state.news.find(news=>news.id===event.id);
  state.recentNewsIds=state.recentNewsIds.filter(id=>id!==event.id);
  state.recentNewsIds.push(event.id);
  if(state.recentNewsIds.length>NEWS_HISTORY_LIMIT)state.recentNewsIds.shift();
  state.news.unshift(event);
  state.news=state.news.slice(0,8);
  state.headlineIndex=0;
  showHeadline(0, false);
  return event;
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

function endTurn(timedOut=false){
  if(state.gameOver)return;
  playSound(timedOut?"error":"click");
  const mover=state.turn, next=enemyColor(mover);
  stopTurnTimer();
  state.turn=next;state.turnNo++;
  const p=current();p.ownTurns++;p.ap=CFG.maxAP;p.moveUsed=false;playSound("select");
  p.money+=p.salary;const tax=countTax(state.turn);p.money-=tax;
  log(`${state.turn==="w"?"백":"흑"} 턴 시작: 월급 +${fmt(p.salary)}, 세금 -${fmt(tax)}`,tax?"":"good");
  processMaturities(state.turn);runTurnAbilities(state.turn);moveMarket();
  if(SpecialPieces.data&&state.turnNo%Number(SpecialPieces.data.restockEveryTurns||3)===0)restockSpecialPieces();
  clearMode();startTurnTimer();render();
}
function finishGame(winner,reason){
  stopTurnTimer();
  state.gameOver=true;const name=winner==="w"?"백":"흑";
  document.getElementById("gameOverTitle").textContent=`${name} 승리`;
  document.getElementById("gameOverText").textContent=`${reason}\n최종 자산 — 백 ${fmt(state.players.w.money)} / 흑 ${fmt(state.players.b.money)}`;
  document.getElementById("gameOverModal").classList.remove("hidden");
}
function checkBankruptcy(){
  for(const color of ["w","b"]){
    if(state.players[color].money<=CFG.bankruptcy){
      finishGame(enemyColor(color),`${color==="w"?"백":"흑"} 자본 파산`);
      return true;
    }
  }
  return false;
}

function renderTurnTimer(){
  const format=seconds=>{const s=Math.max(0,Math.floor(seconds));return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;};
  state.turnTimeLeft=state.clock[state.turn];
  const currentEl=document.getElementById("turnTimer");
  if(currentEl){currentEl.textContent=format(state.turnTimeLeft);currentEl.classList.toggle("warning",state.turnTimeLeft<=10);}
  for(const color of ["w","b"]){const el=document.getElementById(color==="w"?"whiteClock":"blackClock");if(el){el.textContent=format(state.clock[color]);el.classList.toggle("warning",state.clock[color]<=10);}}
}
function startTurnTimer(){
  stopTurnTimer();
  renderTurnTimer();
  state.turnTimerId=setInterval(()=>{
    if(state.gameOver) return stopTurnTimer();
    state.clock[state.turn]=Math.max(0,state.clock[state.turn]-1);
    renderTurnTimer();
    if(state.clock[state.turn]<=0)endTurn(true);
  },1000);
}
function stopTurnTimer(){
  if(state.turnTimerId){clearInterval(state.turnTimerId);state.turnTimerId=null;}
}
function requestDraw(){
  if(state.gameOver)return;
  playSound("select");
  const side=state.turn==="w"?"백":"흑";
  if(!state.drawOffer){
    state.drawOffer=state.turn;
    log(`${side}이 무승부를 요청함. 상대의 승인이 필요해.`,"gold");
  }else if(state.drawOffer===state.turn){
    state.drawOffer=null;
    log(`${side}의 무승부 요청을 취소함.`);
  }else{
    finishDraw();
    return;
  }
  render();
}
function finishDraw(){
  stopTurnTimer();
  state.gameOver=true;
  document.getElementById("gameOverTitle").textContent="무승부";
  document.getElementById("gameOverText").textContent=`백과 흑이 무승부에 합의했습니다.\n최종 자산 — 백 ${fmt(state.players.w.money)} / 흑 ${fmt(state.players.b.money)}`;
  document.getElementById("gameOverModal").classList.remove("hidden");
}

function fenFor(side){
  const rows=state.board.map(row=>{let out="",empty=0;for(const p of row){if(!p){empty++;continue;}if(empty){out+=empty;empty=0;}let ch=p.specialId?(isKingLike(p)?"k":"q"):p.type;if(p.color==="w")ch=ch.toUpperCase();out+=ch;}if(empty)out+=empty;return out;});
  return `${rows.join("/")} ${side} - - 0 1`;
}

function initStockfish(){
  const status=document.getElementById("engineStatus");
  const labels={loading:["○ Stockfish 로딩 중…","engine-pill"],ready:["● Stockfish 준비됨","engine-pill online"],analyzing:["◌ Stockfish 분석 중…","engine-pill online"],error:["⚠ Stockfish 분석 불가","engine-pill offline"],destroyed:["⚠ Stockfish 분석 불가","engine-pill offline"]};
  stockfish.setStatusHandler(({status:engineStatus})=>{const [text,className]=labels[engineStatus]||labels.error;if(status){status.textContent=text;status.className=className;}state.engineReady=engineStatus==="ready";});
  stockfish.init().catch(error=>{
    state.engineReady=false;
    log(`Stockfish 초기화 실패: ${error?.message||"Worker 응답 없음"}`,"bad");
  });
}
window.stockfishTestPositions=[
  {name:"명백한 최선수 후보",fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",move:"e2e4"},
  {name:"평범한 수 후보",fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",move:"d2d3"},
  {name:"폰 공짜 희생 후보",fen:"4k3/8/8/3q4/8/8/4P3/4K3 w - - 0 1",move:"e2e3"},
  {name:"룩 공짜 희생 후보",fen:"4k3/8/8/8/q7/8/8/R3K3 w - - 0 1",move:"a1a2"},
  {name:"퀸 공짜 희생 후보",fen:"3rk3/8/8/8/8/8/8/3QK3 w - - 0 1",move:"d1d2"}
];
window.runStockfishTestPositions=async function(){
  const rows=[];
  for(const test of window.stockfishTestPositions){
    const best=await stockfish.analyze(test.fen,{depth:ENGINE_EVAL_CONFIG.depth,timeout:20000});
    const played=await stockfish.analyze(test.fen,{moves:[test.move],depth:ENGINE_EVAL_CONFIG.depth,timeout:20000});
    const bestScore=normalizeScoreToColor(best.score,"w","w"),playedScore=normalizeScoreToColor(played.score,"b","w");
    rows.push({name:test.name,move:test.move,bestmove:best.bestmove,bestmoveMatch:String(best.bestmove).toLowerCase()===test.move,analysisValid:Boolean(best.valid&&played.valid),bestScoreMoverPOV:bestScore,playedScoreMoverPOV:playedScore,centipawnLoss:bestScore===null||playedScore===null?null:Math.max(0,bestScore-playedScore)});
  }
  console.table(rows);return rows;
};
function normalizeScoreToColor(score,rootSide,targetColor){
  if(!score||!rootSide||!targetColor)return null;
  const raw=score.type==="mate"?(score.value>0?100000-Math.abs(score.value)*100:-100000+Math.abs(score.value)*100):Number(score.value);
  if(!Number.isFinite(raw))return null;
  return rootSide===targetColor?raw:-raw;
}
window.normalizeScoreToColor=normalizeScoreToColor;
function scoreForMover(score,rootSide,mover){return normalizeScoreToColor(score,rootSide,mover);}
function standardLegalUci(board,mover,uci){
  const text=String(uci||"").toLowerCase();
  if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(text))return false;
  const from=fromName(text.slice(0,2)),to=fromName(text.slice(2,4));
  const moving=board?.[from.r]?.[from.c],target=board?.[to.r]?.[to.c];
  if(!moving||moving.color!==mover||target?.color===mover||target?.type==="k")return false;
  if(!pseudoMoves(from.r,from.c,board,false).some(cell=>cell.r===to.r&&cell.c===to.c))return false;
  const hasPromotion=Boolean(text.slice(4));
  if(moving.type==="p"&&((to.r===0||to.r===7)!==hasPromotion))return false;
  if(moving.type!=="p"&&hasPromotion)return false;
  const next=cloneBoard(board);next[to.r][to.c]={...moving,moved:true};next[from.r][from.c]=null;
  return !isKingInCheck(mover,next);
}
function classifyMove(context,before,after){
  const loss=Math.max(0,before-after),gain=after-before,best=after!==null&&String(context.bestmove||"").toLowerCase()===String(context.uci||"").toLowerCase();
  if(context.confidence<ENGINE_EVAL_CONFIG.confidenceMinimum)return {key:"low-confidence",bonus:0,label:"분석 신뢰도 낮음"};
  if(isBrilliantMove({context,before,after,loss,gain,best}))return {key:"brilliant",bonus:ENGINE_EVAL_CONFIG.brilliantBonus,label:"!! 탁월수"};
  if(best)return {key:"best",bonus:ENGINE_EVAL_CONFIG.bestBonus,label:"! 최선수"};
  if(loss<=ENGINE_EVAL_CONFIG.bestMaxLoss)return {key:"good",bonus:ENGINE_EVAL_CONFIG.goodBonus,label:"좋은 수"};
  if(loss<=ENGINE_EVAL_CONFIG.goodMaxLoss)return {key:"good",bonus:ENGINE_EVAL_CONFIG.goodBonus,label:"✓ 좋은 수"};
  return {key:"normal",bonus:0,label:"일반 수"};
}
function isBrilliantMove({context,after,gain,best}){
  const sacrifice=context.moverMaterialDelta<0&&context.movingMaterial>context.capturedMaterial&&!context.freeCapture;
  return context.confidence>=.75&&(best||context.centipawnLoss<=10)&&sacrifice&&gain>=ENGINE_EVAL_CONFIG.tacticalGain;
}
function stockfishGrade(result,context,loss){
  const best=String(context.bestmove||"").toLowerCase()===String(context.uci||"").toLowerCase();
  if(result.key==="brilliant")return {label:"Brilliant",annotation:"!!"};
  if(best)return {label:"Great",annotation:"!"};
  if(result.key==="best")return {label:loss<=25?"Best":"Excellent",annotation:""};
  if(result.key==="good")return {label:"Good",annotation:""};
  if(loss<=150)return {label:"Inaccuracy",annotation:"?!"};
  if(loss<=300)return {label:"Mistake",annotation:"?"};
  return {label:"Blunder",annotation:"??"};
}
function annotateMoveLog(context,symbol){
  if(!context.moveLogEl||!symbol)return;
  if(!context.moveLogEl.textContent.endsWith(` ${symbol}`))context.moveLogEl.textContent+=` ${symbol}`;
}
const MOVE_GRADE_VFX={
  brilliant:{className:"brilliant",title:"BRILLIANT",symbol:"!!",duration:1800,particles:20,defaultBonus:350,variants:["sunburst","slash","crown"]},
  best:{className:"best",title:"BEST MOVE",symbol:"",duration:1400,particles:9,defaultBonus:160,variants:["ripple","sweep"]},
  excellent:{className:"excellent",title:"EXCELLENT",symbol:"",duration:1100,particles:5,defaultBonus:0,variants:["sweep"]},
  good:{className:"good",title:"GOOD",symbol:"",duration:900,particles:3,defaultBonus:60,variants:["pulse"]},
  inaccuracy:{className:"inaccuracy",title:"INACCURACY",symbol:"?!",duration:850,particles:0,defaultBonus:0,variants:["wobble"]},
  mistake:{className:"mistake",title:"MISTAKE",symbol:"?",duration:1000,particles:0,defaultBonus:0,variants:["drop"]},
  blunder:{className:"blunder",title:"BLUNDER",symbol:"??",duration:1200,particles:0,defaultBonus:0,variants:["impact"]},
  unrated:{className:"unrated",title:"UNRATED",symbol:"",duration:850,particles:0,defaultBonus:0,variants:["scan"]}
};
function vfxGradeKey(grade){
  const value=String(grade||"").toLowerCase();
  if(value==="great"||value==="best")return "best";
  if(value==="excellent")return "excellent";
  if(value==="brilliant")return "brilliant";
  return MOVE_GRADE_VFX[value]?value:"unrated";
}
function vfxTargetPosition(square){
  if(!square)return null;
  const r=typeof square.r==="number"?square.r:typeof square.tr==="number"?square.tr:8-Number(String(square).slice(1));
  const c=typeof square.c==="number"?square.c:typeof square.tc==="number"?square.tc:FILES.indexOf(String(square).slice(0,1));
  const el=document.querySelector(`.square[data-r="${r}"][data-c="${c}"]`);
  if(!el)return null;
  const rect=el.getBoundingClientRect();
  return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
}
function showMoveGradeEffect({grade,bonus=0,square=null,moveId=null}={}){
  const overlay=document.getElementById("moveGradeOverlay");
  if(!overlay)return;
  const key=vfxGradeKey(grade),config=MOVE_GRADE_VFX[key];
  const variant=config.variants[Math.floor(Math.random()*config.variants.length)];
  const target=vfxTargetPosition(square);
  clearTimeout(overlay._hideTimer);
  overlay._vfxToken=(overlay._vfxToken||0)+1;
  overlay._vfxMoveId=moveId;
  overlay.className=`move-grade-overlay cinematic grade-${config.className} variant-${variant}`;
  overlay.setAttribute("aria-hidden","false");
  const targetStyle=target?`style="--target-x:${target.x}px;--target-y:${target.y}px"`:"";
  const particles=Array.from({length:Math.min(24,Math.max(0,config.particles))},(_,index)=>{
    const angle=Math.random()*Math.PI*2, distance=70+Math.random()*230;
    const x=Math.cos(angle)*distance,y=Math.sin(angle)*distance,delay=Math.random()*.18,rotate=Math.random()*360,scale=.5+Math.random()*.9;
    return `<i class="vfx-particle" style="--x:${x}px;--y:${y}px;--delay:${delay}s;--rotate:${rotate}deg;--scale:${scale};--index:${index}"></i>`;
  }).join("");
  overlay.innerHTML=`<div class="vfx-backdrop"></div><div class="vfx-target" ${targetStyle}><span class="vfx-ring"></span><span class="vfx-ring"></span></div><div class="vfx-streaks"></div><div class="vfx-particles">${particles}</div><div class="vfx-copy"><b class="vfx-symbol">${config.symbol}</b><strong class="vfx-title">${config.title}</strong>${Number(bonus)>0?`<span class="vfx-bonus">+$${Math.round(Number(bonus)).toLocaleString("ko-KR")}</span>`:""}</div>`;
  void overlay.offsetWidth;
  overlay.classList.add("show");
  const token=overlay._vfxToken;
  overlay._hideTimer=setTimeout(()=>{if(overlay._vfxToken!==token)return;overlay.className="move-grade-overlay";overlay.innerHTML="";overlay.setAttribute("aria-hidden","true");},config.duration);
}
function stockfishMaterial(board){
  const value={w:0,b:0};
  for(const row of board)for(const p of row)if(p?.color)value[p.color]+=PIECE_SCORE[p.type]||0;
  return value;
}
function stockfishPieceLabel(p){
  if(!p)return "none";
  return p.specialId?`${p.specialId}(${p.type})`:p.type;
}
function debugStockfishMoveEval(data){
  if(!DEBUG_STOCKFISH)return;
  const materialBefore=data.materialBefore||{w:null,b:null};
  const materialAfter=data.materialAfter||{w:null,b:null};
  const materialDelta={w:materialBefore.w===null||materialAfter.w===null?null:materialAfter.w-materialBefore.w,b:materialBefore.b===null||materialAfter.b===null?null:materialAfter.b-materialBefore.b};
  console.log("========== STOCKFISH MOVE EVAL ==========");
  console.log("beforeFen",data.beforeFen);
  console.log("playerUci",data.playerUci);
  console.log("stockfishBestmove",data.stockfishBestmove);
  console.log("bestmoveMatch",data.bestmoveMatch);
  console.log("rawBestScore",data.rawBestScore);
  console.log("rawPlayedScore",data.rawPlayedScore);
  console.log("rootSideBefore",data.rootSideBefore);
  console.log("rootSidePlayed",data.rootSidePlayed);
  console.log("normalizedBestScore",data.normalizedBestScore);
  console.log("normalizedPlayedScore",data.normalizedPlayedScore);
  console.log("moverColor",data.moverColor);
  console.log("bestScoreMoverPOV",data.bestScoreMoverPOV);
  console.log("playedScoreMoverPOV",data.playedScoreMoverPOV);
  console.log("centipawnLoss",data.centipawnLoss);
  console.log("movingPiece",data.movingPiece);
  console.log("capturedPiece",data.capturedPiece);
  console.log("materialBefore",materialBefore);
  console.log("materialAfter",materialAfter);
  console.log("materialDelta",materialDelta);
  console.log("confidence",data.confidence);
  console.log("analysisValid",data.analysisValid);
  console.log("invalidReason",data.invalidReason);
  console.log("standardLegal",data.standardLegal);
  console.log("bonusEligible",data.bonusEligible);
  console.log("classification",data.classification);
  console.log("bonus",data.bonus);
  console.log("==========================================");
  if(data.bestmoveMatch&&materialDelta[data.moverColor]<0&&data.centipawnLoss<=0){
    console.warn("[SF WARNING] 큰 기물 손실인데 BEST 경로로 판정됨",data);
  }
}
async function evaluateMoveWithStockfish(context){
  const playerUci=String(context.uci||"").toLowerCase();
  const from=fromName(playerUci.slice(0,2)),to=fromName(playerUci.slice(2,4));
  const movingPiece=context.beforeBoard?.[from.r]?.[from.c]||null;
  const capturedPiece=context.beforeBoard?.[to.r]?.[to.c]||null;
  const materialBefore=context.beforeBoard?stockfishMaterial(context.beforeBoard):null;
  const materialAfter=context.afterBoard?stockfishMaterial(context.afterBoard):null;
  const standardLegal=standardLegalUci(context.beforeBoard,context.mover,playerUci);
  const debugSkipped=(classification,extra={})=>debugStockfishMoveEval({beforeFen:"unavailable",playerUci,stockfishBestmove:null,bestmoveMatch:false,rawBestScore:null,rawPlayedScore:null,rootSideBefore:context.mover,rootSidePlayed:enemyColor(context.mover),normalizedBestScore:null,normalizedPlayedScore:null,moverColor:context.mover,bestScoreMoverPOV:null,playedScoreMoverPOV:null,centipawnLoss:null,movingPiece:stockfishPieceLabel(movingPiece),capturedPiece:stockfishPieceLabel(capturedPiece),materialBefore,materialAfter,confidence:context.confidence??null,analysisValid:false,invalidReason:classification,standardLegal:extra.standardLegal??standardLegal,bonusEligible:false,classification:"Unrated",bonus:0});
  if(!context.info.movingIsStandard||!window.stockfishPositionAdapter){debugSkipped("skipped: non-standard or adapter unavailable");annotateMoveLog(context,"?");return;}
  const beforePosition=stockfishPositionAdapter.fromBoard(context.beforeBoard,context.mover);
  const afterPosition=stockfishPositionAdapter.fromBoard(context.afterBoard,enemyColor(context.mover));
  context.confidence=Math.min(beforePosition.confidence,afterPosition.confidence);
  if(!standardLegal){debugSkipped("playerUci is not standard-legal",{standardLegal:false});annotateMoveLog(context,"Unrated");log("⚠ Stockfish 평가 제외 · 표준 체스 불법 수","bad");return;}
  if(context.confidence<ENGINE_EVAL_CONFIG.confidenceMinimum){debugSkipped("skipped: low confidence");log(`Stockfish 분석 신뢰도 낮음 (${stockfishPositionAdapter.confidenceLabel(context.confidence)}) · 보너스 없음`);return;}
  try{
    const beforeResult=await stockfish.analyze(beforePosition.fen,{depth:ENGINE_EVAL_CONFIG.depth,timeout:20000}).catch(error=>{debugSkipped(`failed: before analysis (${error?.message||"unknown"})`);annotateMoveLog(context,"?");log(`Stockfish 분석 실패: ${error?.message||"Worker 응답 없음"}`,"bad");return null;});
    if(!beforeResult)return;
    if(!beforeResult.valid){debugSkipped(beforeResult.invalidReason||"invalid before analysis");annotateMoveLog(context,"Unrated");log("⚠ Stockfish 평가 제외","bad");return;}
    if(state.engineRevision!==context.revision){debugSkipped("skipped: stale move revision");return;}
    const playedResult=await stockfish.analyze(beforePosition.fen,{moves:[context.uci],depth:ENGINE_EVAL_CONFIG.depth,timeout:20000}).catch(error=>{debugSkipped(`failed: played analysis (${error?.message||"unknown"})`);annotateMoveLog(context,"?");log(`Stockfish 분석 실패: ${error?.message||"Worker 응답 없음"}`,"bad");return null;});
    if(!playedResult)return;
    if(!playedResult.valid){debugSkipped(playedResult.invalidReason||"invalid played analysis");annotateMoveLog(context,"Unrated");log("⚠ Stockfish 평가 제외","bad");return;}
    if(state.engineRevision!==context.revision||state.engineAwarded.has(context.moveId)){debugSkipped("skipped: stale or already awarded");return;}
    const rootSideBefore=context.mover,rootSidePlayed=enemyColor(context.mover);
    const before=normalizeScoreToColor(beforeResult.score,rootSideBefore,context.mover),after=normalizeScoreToColor(playedResult.score,rootSidePlayed,context.mover);
    if(before===null||after===null){debugSkipped("invalid normalized score");annotateMoveLog(context,"Unrated");log("⚠ Stockfish 평가 제외","bad");return;}
    context.bestmove=beforeResult.bestmove;
    context.centipawnLoss=Math.max(0,before-after);
    context.movingMaterial=PIECE_SCORE[movingPiece?.type]||0;
    context.capturedMaterial=PIECE_SCORE[capturedPiece?.type]||0;
    context.moverMaterialDelta=materialAfter[context.mover]-materialBefore[context.mover];
    context.freeCapture=materialAfter[enemyColor(context.mover)]<materialBefore[enemyColor(context.mover)]&&context.moverMaterialDelta>=0;
    const nonKingPieces=Object.values(materialBefore).reduce((sum,value)=>sum+value,0);
    context.bonusEligible=nonKingPieces>=3||context.info.capture||context.info.check;
    const result=classifyMove(context,before,after);
    const grade=stockfishGrade(result,context,Math.max(0,before-after));
    result.label=grade.label;
    const stockfishBestmove=String(context.bestmove||"").toLowerCase();
    const bestmoveMatch=Boolean(playerUci&&stockfishBestmove===playerUci);
    if(!context.bonusEligible)result.bonus=0;
    debugStockfishMoveEval({beforeFen:beforePosition.fen,playerUci,stockfishBestmove,bestmoveMatch,rawBestScore:beforeResult.score,rawPlayedScore:playedResult.score,rootSideBefore,rootSidePlayed,normalizedBestScore:before,normalizedPlayedScore:after,moverColor:context.mover,bestScoreMoverPOV:before,playedScoreMoverPOV:after,centipawnLoss:context.centipawnLoss,movingPiece:stockfishPieceLabel(movingPiece),capturedPiece:stockfishPieceLabel(capturedPiece),materialBefore,materialAfter,confidence:context.confidence,analysisValid:true,invalidReason:null,standardLegal,bonusEligible:context.bonusEligible,classification:grade.label,bonus:result.bonus});
    if(grade.label==="Brilliant")playSound("brilliant");
    showMoveGradeEffect({grade:grade.label,bonus:result.bonus,square:context.square,moveId:context.moveId});
    annotateMoveLog(context,`${grade.label}${grade.annotation?` ${grade.annotation}`:""}`);
    if(!result.bonus){
      log(`Stockfish 판정: ${result.label} · ${stockfishPositionAdapter.confidenceLabel(context.confidence)}`);
      return;
    }
    state.engineAwarded.add(context.moveId);state.players[context.mover].money+=result.bonus;
    log(`${result.label} — +${fmt(result.bonus)} · 신뢰도 ${stockfishPositionAdapter.confidenceLabel(context.confidence)}`,"gold");render();
  }catch(error){debugSkipped(`failed: evaluation pipeline (${error?.message||"unknown"})`);}
}

function render(){
  state.kingDangerTargets=state.selected?kingDangerTargetsFor(state.selected.r,state.selected.c):[];
  document.querySelectorAll(".square").forEach(el=>{
    const r=Number(el.dataset.r),c=Number(el.dataset.c),p=state.board[r][c],key=sqName(r,c);
    el.classList.remove("selected","legal","capture","buy-target","teleport-target","in-check","king-danger","dragging");
    if(state.selected?.r===r&&state.selected?.c===c)el.classList.add("selected");
    const legal=state.legalTargets.some(x=>x.r===r&&x.c===c);if(legal)el.classList.add(p?"capture":"legal");
    if(state.kingDangerTargets.some(x=>x.r===r&&x.c===c))el.classList.add("king-danger");
    if((state.mode==="buy"||state.mode==="special-buy")&&homeZone(state.turn,r)&&!p)el.classList.add("buy-target");
    if(state.mode==="teleport"&&!p)el.classList.add("teleport-target");
    if(isKingLike(p) && isKingInCheck(p.color,state.board)) el.classList.add("in-check");
    el.draggable=!!(p && p.color===state.turn && !current().moveUsed && !state.mode && (!p.purchaseLocked||p.active));
    let html="";
    if(p) html+=p.specialId?pieceVisual(p):pieceImgTag(p.color+p.type,"piece",`${p.color}${p.type}`);
    if(state.visits[key])html+=`<span class="visit-badge">${state.visits[key]}</span>`;
    if(state.properties[key])html+=`<span class="owner-mark ${state.properties[key]}"></span>`;
    el.innerHTML=html;
  });
  for(const t of ["p","n","b","r","q"]){const img=document.getElementById(`shop-${t}`);if(img){const key=state.turn+t;img.src=IMG[key];img.dataset.fallback=IMG_FALLBACK[key];}}
  for(const def of SpecialPieces.list()){
    const stockEl=document.getElementById(`special-stock-${def.id}`),button=document.querySelector(`[data-special-id="${def.id}"]`),stock=state.specialStock[def.id]||0;
    if(stockEl)stockEl.textContent=stock?`재고 ${stock}`:"품절";
    if(button)button.classList.toggle("sold-out",stock<=0);
  }
  attachImageFallbacks(document);
  const w=state.players.w,b=state.players.b,p=current();
  document.getElementById("whiteMoney").textContent=fmt(w.money);document.getElementById("blackMoney").textContent=fmt(b.money);
  document.getElementById("whiteSalary").textContent=fmt(w.salary);document.getElementById("blackSalary").textContent=fmt(b.salary);
  document.getElementById("whiteTax").textContent=fmt(countTax("w"));document.getElementById("blackTax").textContent=fmt(countTax("b"));
  document.getElementById("whitePieceScore").textContent=`${countPieceScore("w")}점`;
  document.getElementById("blackPieceScore").textContent=`${countPieceScore("b")}점`;
  document.getElementById("whiteCard").classList.toggle("active",state.turn==="w");document.getElementById("blackCard").classList.toggle("active",state.turn==="b");
  document.getElementById("turnLabel").textContent=`${state.turn==="w"?"백":"흑"}의 턴${activeInCheck()?" — 체크!":""}`;
  document.getElementById("apValue").textContent=`${p.ap} / ${CFG.maxAP}`;
  document.getElementById("moveState").textContent=`체스 수: ${p.moveUsed?"사용 완료":"사용 가능"}`;
  document.getElementById("selectedSquare").textContent=state.selected?sqName(state.selected.r,state.selected.c):"없음";
  document.getElementById("salaryUpgradeText").textContent=`+${fmt(CFG.salaryRaise)}/턴 · 비용 ${fmt(salaryCost(p))} · 1 AP`;
  document.getElementById("insuranceStatus").innerHTML=`백 보험: ${w.insurance?"<strong>보유</strong>":"없음"} · 흑 보험: ${b.insurance?"<strong>보유</strong>":"없음"}`;
  const drawBtn=document.getElementById("drawBtn");
  if(drawBtn){
    drawBtn.textContent=!state.drawOffer?"무승부 요청":state.drawOffer===state.turn?"요청 취소":"무승부 승인";
    drawBtn.disabled=state.gameOver;
  }
  renderMaturities();renderStocks();renderAnnotations();
  document.getElementById("endTurnBtn").disabled=state.gameOver;
  if(window.multiplayer?.role==="host")window.multiplayer.sendState(serializeGameState());
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
  if(String(text).includes("Analysis cancelled"))return null;
  if(type==="bad")playSound("error");
  const el=document.getElementById("log");
  const message=`[T${state.turnNo}] ${text}`;
  if(el.firstElementChild?.textContent===message)return el.firstElementChild;
  const d=document.createElement("div");d.className=`log-entry ${type}`;d.textContent=message;el.prepend(d);return d;
}

init();

// 실행: node --test --test-isolation=none tests/chess-rules.test.cjs
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const C=require('../js/chessRules.js'),E=require('../js/setupEditor.js');
const definitions=JSON.parse(read('data/special-pieces.json')).pieces;
function env(){
  let serial=0;const nodes=new Map(),document={getElementById(id){if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',matches:()=>true,classList:{add(){},remove(){},toggle(){}}});return nodes.get(id);},querySelector:()=>null,querySelectorAll:()=>[]};
  const window={EconomyRules:require('../js/economyRules.js'),ChessRules:C,SetupEditor:E,EconomyUI:{t:key=>key,render(){},initialAutomation:()=>({}),send(){}},GameLanguage:{text:(_,fallback)=>fallback}};
  const SpecialPieces={get:id=>definitions[id],list:()=>Object.values(definitions),data:{restockEveryTurns:3}};window.SpecialPieces=SpecialPieces;
  const sandbox={window,document,SpecialPieces,localStorage:{getItem:()=>null},crypto:{randomUUID:()=>String(++serial)},console,setInterval:()=>1,clearInterval(){}};
  vm.createContext(sandbox);
  for(const p of ['js/movementHandlers.js','js/abilityHandlers.js','js/stockfishPositionAdapter.js'])vm.runInContext(read(p),sandbox);
  sandbox.runAbility=window.runAbility;
  vm.runInContext(read('game.js').replace(/init\(\);\s*$/,''),sandbox);
  vm.runInContext('render=()=>{};log=()=>({});playSound=()=>{};evaluateMoveWithStockfish=()=>{};startTurnTimer=()=>{};stopTurnTimer=()=>{};moveMarket=()=>{};restockSpecialPieces=()=>{};',sandbox);
  const state=window.gameState;state.started=true;state.board=C.initialBoard(false,sandbox.piece);
  return {s:sandbox,state,window,unit:(type,color='w')=>sandbox.piece(type,color),special:(id,color='w')=>({...sandbox.specialPiece(id,color),active:true,purchaseLocked:false,attackLockedTurns:0})};
}
const contains=(moves,r,c)=>moves.some(move=>move.r===r&&move.c===c);
test('흡혈귀의 실제 포획 후 판 위 기물이 나이트→룩→퀸으로 성장',()=>{
  const {s,state,special,unit}=env();state.board[4][4]=special('vampire');
  for(const [index,[r,c]] of [[4,5],[2,4],[2,5],[5,5]].entries()){
    state.board[r][c]=unit('p','b');const from=index===0?[4,4]:[[4,5],[2,4],[2,5]][index-1];
    state.players.w.moveUsed=false;state.players.w.ap=3;
    assert.ok(contains(s.legalMovesFor(...from),r,c));s.makeMove(...from,r,c);
    const live=state.board[r][c];assert.equal(live.growthCaptures,index+1);assert.equal(live.growMovement.type,['knight','rook','rook','queen'][index]);
  }
  assert.ok(contains(s.legalMovesFor(5,5),3,3));
});
test('방어된 포획은 흡혈귀 성장 횟수에 포함하지 않음',()=>{
  const {s,state,special,unit}=env();state.board[4][4]=special('vampire');state.board[4][5]=unit('p','b');
  vm.runInContext('tryNearbyCaptureDefense=(captured,square,before)=>{state.board=before;return true;};',s);
  s.makeMove(4,4,4,5);assert.equal(state.board[4][4].growthCaptures,undefined);
});
test('벤처 나이트는 구매 때 한 번 추첨하고 세 결과의 행마가 실제 적용됨',()=>{
  for(const [roll,type,score,target] of [[.1,'pawn',1,[3,4]],[.6,'knight_bishop',5,[2,3]],[.99,'queen',9,[4,0]]]){
    const {s,state,special}=env();vm.runInContext(`Math.random=()=>${roll};`,s);const unit=special('venture_knight');state.board[4][4]=unit;
    assert.equal(unit.ventureMovement.type,type);assert.equal(unit.ventureScore,score);assert.ok(contains(s.legalMovesFor(4,4),...target));
    vm.runInContext('Math.random=()=>{throw Error("unexpected reroll")};',s);
    s.window.runAbility('venture_roll',{event:'turn',piece:unit,params:definitions.venture_knight.abilities[0].params});assert.equal(unit.ventureScore,score);
  }
});
test('이전 저장 데이터의 문자열 행마도 이동과 공격 판정에 반영',()=>{
  const {s,state,special}=env();const p=special('vampire');p.growMovement='rook';state.board[4][4]=p;
  assert.ok(contains(s.legalMovesFor(4,4),4,0));assert.equal(s.isSquareAttacked(4,0,'w'),true);
});
for(const color of ['w','b'])test(`${color} 폰 앙파상: 빈 목적지로 이동·옆 폰 제거·포획 보상`,()=>{
  const {s,state,unit}=env(),enemy=color==='w'?'b':'w',row=color==='w'?3:4,enemyStart=color==='w'?1:6,target=color==='w'?2:5;
  state.board[row][4]=unit('p',color);state.board[enemyStart][3]=unit('p',enemy);state.turn=enemy;
  s.makeMove(enemyStart,3,row,3);state.turn=color;state.turnNo++;
  assert.ok(contains(s.legalMovesFor(row,4),target,3));const before=state.players[color].money;
  s.makeMove(row,4,target,3);assert.equal(state.board[row][3],null);assert.equal(state.board[row][4],null);assert.equal(state.board[target][3].color,color);
  assert.equal(state.players[color].money-before,140);assert.equal(state.enPassant,null);
});
test('앙파상은 다음 턴이 지나거나 해당 폰이 바뀌면 만료',()=>{
  const {state,unit}=env();const p=unit('p','b');state.board[3][3]=p;state.board[3][4]=unit('p');state.turnNo=2;
  state.enPassant=C.nextEnPassant(p,{r:1,c:3},{r:3,c:3},1);assert.ok(C.enPassant(state,3,4));
  state.board[3][3]=unit('p','b');assert.equal(C.enPassant(state,3,4),null);state.board[3][3]=p;
  state.turnNo=3;assert.equal(C.enPassant(state,3,4),null);
});
test('킹 이외의 기물도 절대적 핀을 풀면 위험 칸을 표시하되 이동은 허용',()=>{
  const {s,state,unit}=env();state.board[0][4]=null;state.board[0][0]=unit('k','b');state.board[0][4]=unit('r','b');state.board[6][4]=unit('r');
  assert.ok(contains(s.kingDangerTargetsFor(6,4),6,3));assert.equal(contains(s.kingDangerTargetsFor(6,4),5,4),false);
  assert.ok(contains(s.legalMovesFor(6,4),6,3));
});
test('앙파상으로 가로 공격선이 열리는 경우도 위험 표시',()=>{
  const {s,state,unit}=env();state.board[7][4]=null;state.board[3][7]=unit('k');state.board[3][0]=unit('r','b');state.board[3][4]=unit('p');
  const pawn=unit('p','b');state.board[3][3]=pawn;state.turnNo=2;state.enPassant=C.nextEnPassant(pawn,{r:1,c:3},{r:3,c:3},1);
  assert.ok(contains(s.kingDangerTargetsFor(3,4),2,3));assert.ok(contains(s.legalMovesFor(3,4),2,3));
});
test('기본 배치 32기물·킹 단독 배치 및 좌우 캐슬링 실제 실행',()=>{
  const {s,state,unit}=env();assert.equal(C.initialBoard(true,unit).flat().filter(Boolean).length,32);assert.equal(C.initialBoard(false,unit).flat().filter(Boolean).length,2);
  for(const side of [2,6]){
    state.board=C.initialBoard(true,unit);state.standardSetup=true;state.players.w.moveUsed=false;state.players.w.ap=3;
    for(const c of [1,2,3,5,6])state.board[7][c]=null;
    assert.ok(contains(s.legalMovesFor(7,4),7,side));s.makeMove(7,4,7,side);
    assert.equal(state.board[7][side].type,'k');assert.equal(state.board[7][side===6?5:3].type,'r');assert.equal(state.board[7][side===6?7:0],null);assert.equal(state.players.w.ap,2);
  }
});
test('체크·통과 칸 공격·이동 이력·구매 룩·경로 장애물은 캐슬링 차단',()=>{
  for(const variant of ['check','transit','destination','moved','purchased','blocked','off']){
    const {s,state,unit}=env();state.board=C.initialBoard(false,unit);state.standardSetup=true;state.board[7][4].castleEligible=true;state.board[7][7]={...unit('r'),castleEligible:true};
    if(['check','transit','destination'].includes(variant))state.board[4][{check:4,transit:5,destination:6}[variant]]=unit('r','b');
    if(variant==='moved')state.board[7][7].moved=true;if(variant==='purchased')state.board[7][7].purchaseLocked=true;
    if(variant==='blocked')state.board[7][5]=unit('b');if(variant==='off')state.standardSetup=false;
    assert.equal(contains(s.legalMovesFor(7,4),7,6),false,variant);
  }
});
test('커스텀 배치는 일반·특수기물과 진영별 자금을 검증하고 초기 능력·캐슬링 정보를 보존',()=>{
  const {unit,special}=env();
  const config={pieces:[{r:7,c:4,type:'k',color:'w'},{r:0,c:4,type:'k',color:'b'},{r:7,c:7,type:'r',color:'w'},{r:5,c:1,type:'special',specialId:'venture_knight',color:'w'}],money:{w:12000,b:300},castling:true};
  assert.ok(E.normalize(config,definitions));const board=E.initialBoard(config,unit,special);
  assert.equal(board[5][1].active,true);assert.equal(board[5][1].purchaseLocked,false);assert.ok(board[5][1].ventureMovement);assert.equal(board[7][7].castleEligible,true);
  assert.equal(E.normalize({...config,money:{w:-1,b:300}},definitions),null);
  assert.equal(E.normalize({...config,pieces:[...config.pieces,{r:6,c:1,type:'k',color:'w'}]},definitions),null);
  assert.equal(E.normalize({...config,pieces:config.pieces.filter(p=>p.color!=='b')},definitions),null);
});
test('Stockfish에 변경 행마·캐슬링 권리·앙파상 목표를 전달',()=>{
  const {state,unit,window,special}=env();state.board=C.initialBoard(true,unit);state.standardSetup=true;
  assert.match(window.stockfishPositionAdapter.fromBoard(state.board,'w',state).fen,/ w KQkq - /);
  const pawn=state.board[6][4];state.board[6][4]=null;state.board[4][4]=pawn;
  state.enPassant=C.nextEnPassant(pawn,{r:6,c:4},{r:4,c:4},1);
  assert.match(window.stockfishPositionAdapter.fromBoard(state.board,'b',state).fen,/ b KQkq e3 /);
  const vampire=special('vampire');vampire.growMovement={type:'rook'};assert.equal(window.stockfishPositionAdapter.equivalentFor(vampire),'r');
});
test('실제 턴 전환에서 앙파상 기회는 상대의 한 턴만 유지',()=>{
  const {s,state,unit}=env();const pawn=unit('p');state.board[4][4]=pawn;
  state.enPassant=C.nextEnPassant(pawn,{r:6,c:4},{r:4,c:4},1);
  s.endTurn();assert.equal(state.turn,'b');assert.ok(state.enPassant);
  s.endTurn();assert.equal(state.turn,'w');assert.equal(state.enPassant,null);
});
test('커스텀 가상판은 특수기물·색상·자금 편집 후 저장하고 실제 판은 시작 전까지 보존',()=>{
  const {s,state,window}=env();state.started=false;
  class Element{
    constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.classList={toggle(){}};this.value='';}
    appendChild(child){child.parent=this;this.children.push(child);return child;}
    replaceChildren(){this.children=[];}
    setAttribute(key,value){this[key]=value;}
    addEventListener(key,fn){this['on'+key]=fn;}
    removeEventListener(key){delete this['on'+key];}
    focus(){}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
    all(){return this.children.flatMap(child=>[child,...child.all()]);}
    querySelector(selector){return this.querySelectorAll(selector)[0];}
    querySelectorAll(selector){return this.all().filter(el=>selector.startsWith('.')?el.className?.split(' ').includes(selector.slice(1)):selector==='[data-setup-piece]'?el.dataset.setupPiece!==undefined:el.tagName===selector);}
  }
  const body=new Element('body'),edit=new Element('button'),select=new Element('select');edit.id='editCustomSetup';select.id='lobbyBoardSetup';select.value='kings';body.appendChild(edit);body.appendChild(select);
  const document={body,createElement:tag=>new Element(tag),getElementById:id=>body.all().find(el=>el.id===id),addEventListener(){},removeEventListener(){}};
  const stored=new Map();s.document=document;s.localStorage={getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)};
  vm.runInContext(read('js/setupEditor.js'),s);const api=window.SetupEditor;
  let published=0,role=null;api.init({state,role:()=>role,publish:()=>published++,sideName:color=>color,standardName:type=>type,specialName:def=>def.id,image:p=>p.specialId||p.type,setMode:mode=>{state.setupMode=mode;select.value=mode;}});
  const before=JSON.stringify(state.board);api.open();let modal=body.children.at(-1);
  assert.equal(modal.querySelector('.setup-board').children.length,64);assert.equal(modal.querySelector('.setup-palette').children.length,36);
  modal.querySelectorAll('[data-setup-piece]').find(el=>el.dataset.setupPiece==='vampire').onclick();
  modal.querySelector('.setup-board').children[35].onclick();
  const side=modal.querySelector('.setup-tools').querySelector('select');side.value='b';side.onchange();
  modal.querySelectorAll('[data-setup-piece]').find(el=>el.dataset.setupPiece==='credit_card_knight').onclick();modal.querySelector('.setup-board').children[20].onclick();
  const money=modal.querySelector('.setup-tools').querySelectorAll('input').filter(el=>el.type==='number');money[0].value='12000';money[0].oninput();money[1].value='700';money[1].oninput();
  modal.querySelectorAll('button').find(el=>el.textContent===api.labels.save).onclick();
  assert.equal(state.setupMode,'custom');assert.equal(state.customSetup.money.w,12000);assert.equal(state.customSetup.money.b,700);
  assert.ok(state.customSetup.pieces.some(p=>p.specialId==='vampire'&&p.color==='w'&&p.r===4&&p.c===3));
  assert.ok(state.customSetup.pieces.some(p=>p.specialId==='credit_card_knight'&&p.color==='b'));
  assert.equal(JSON.stringify(state.board),before);assert.equal(published,1);assert.ok(stored.has('capitalistChessCustomBoard'));assert.equal(edit.inert,undefined);
  role='guest';api.open();assert.equal(body.children.length,2);
});
test('로비 적용 단계에서 기본 배치와 커스텀 진영별 자금이 실제 게임에 반영',()=>{
  for(const mode of ['standard','custom']){
    const {s,state}=env();state.started=false;s.mode='single';
    s.document.getElementById('lobbyBoardSetup').value=mode;
    for(const [id,value] of Object.entries({lobbyMoney:'1600',lobbySalary:'190',lobbyAP:'3',lobbyClock:'15'}))s.document.getElementById(id).value=value;
    state.customSetup={pieces:[{r:7,c:4,type:'k',color:'w'},{r:0,c:4,type:'k',color:'b'},{r:3,c:2,type:'special',specialId:'vampire',color:'w'}],money:{w:9000,b:700},castling:false};
    s.window.EconomyUI.lobbyRules=()=>state.economyRules;
    vm.runInContext('buildShop=()=>{};',s);
    const source=read('game.js');const start=source.indexOf('  const apply=()=>{',source.indexOf('function setupLobby'));
    const end=source.indexOf('\n  const begin=()=>{',start);const body=source.slice(start,end).replace('  const apply=()=>{','function applyLobbyForTest(){').replace(/};\s*$/,'}');
    vm.runInContext(body,s);s.applyLobbyForTest();
    assert.equal(state.board.flat().filter(Boolean).length,mode==='standard'?32:3);
    assert.equal(state.standardSetup,mode==='standard');
    assert.equal(state.players.w.money,mode==='standard'?1600:9000);assert.equal(state.players.b.money,mode==='standard'?1600:700);
    if(mode==='custom'){assert.equal(state.board[3][2].specialId,'vampire');assert.equal(state.board[3][2].active,true);}
  }
});
test('멀티 스냅샷에 커스텀 자금·배치·변경 행마·앙파상·캐슬링 이력을 보존',()=>{
  const first=env();first.state.board=C.initialBoard(true,first.unit);first.state.standardSetup=true;first.state.setupMode='custom';
  first.state.customSetup={pieces:[{r:7,c:4,type:'k',color:'w'},{r:0,c:4,type:'k',color:'b'}],money:{w:9000,b:300},castling:true};
  first.state.players.w.money=9000;first.state.players.b.money=300;
  const p=first.state.board[6][4];first.state.board[6][4]=null;first.state.board[4][4]=p;first.state.enPassant=C.nextEnPassant(p,{r:6,c:4},{r:4,c:4},1);
  first.state.board[3][3]={...first.special('vampire'),growMovement:{type:'rook'},growthCaptures:2};
  const snapshot=first.window.serializeGameState(),second=env();second.window.applyGameState(JSON.parse(JSON.stringify(snapshot)));
  assert.equal(second.state.setupMode,'custom');assert.equal(second.state.standardSetup,true);assert.equal(second.state.players.b.money,300);
  assert.equal(JSON.stringify(second.state.customSetup),JSON.stringify(snapshot.customSetup));assert.equal(JSON.stringify(second.state.enPassant),JSON.stringify(snapshot.enPassant));
  assert.equal(second.state.board[7][7].castleEligible,true);assert.equal(second.state.board[3][3].growMovement.type,'rook');
});

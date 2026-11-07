// 실행: node --test --test-isolation=none tests/economy.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const R=require('../js/economyRules.js');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
function player(){return R.player({money:2000,ap:3,salary:190,creditDebt:0,ownTurns:0,deposits:[],ventures:[]});}
function game(){return {started:true,gameOver:false,turn:'w',turnNo:1,economyRules:R.preset('full'),board:Array.from({length:8},()=>Array(8).fill(null)),players:{w:player(),b:player()},auctions:[]};}
const isKing=p=>p.type==='k'||p.kingLike;
const value=()=>1000;
function list(s){s.board[7][0]={id:'unit',type:'r',color:'w',moved:true};assert.equal(R.list(s,'w',{r:7,c:0},undefined,value,isKing),true);return s.auctions[0];}

test('프리셋·사용자 규칙 정규화 및 가격 배율',()=>{
  assert.equal(R.preset('casual').features.stocks,false);
  assert.equal(R.preset('casual').features.labor,true);
  assert.equal(R.preset('standard').features.automation,true);
  assert.equal(R.preset('standard').features.auction,false);
  assert.ok(Object.values(R.preset('full').features).every(Boolean));
  const rules=R.normalize({preset:'custom',priceMultiplier:999,features:{auction:true,tax:false,stocks:'false',unknown:true}});
  assert.equal(rules.priceMultiplier,4);assert.equal(rules.features.tax,false);assert.equal(rules.features.stocks,true);
  assert.equal(R.price({economyRules:{...rules,priceMultiplier:1.5}},181),272);
});
test('비킹 기물 등록·AP·가격·기간 및 무효 요청 원자성',()=>{
  const s=game();const auction=list(s);
  assert.equal(auction.startPrice,500);assert.equal(auction.endsAt,5);assert.equal(s.players.w.ap,2);
  assert.equal(s.board[7][0],null);assert.equal(auction.piece.id,'unit');
  s.board[7][4]={type:'k',color:'w'};s.board[7][5]={type:'special',color:'w',kingLike:true};
  const before=JSON.stringify(s);
  assert.equal(R.list(s,'w',{r:7,c:4},10,value,isKing),false);
  assert.equal(R.list(s,'w',{r:7,c:5},10,value,isKing),false);
  assert.equal(R.list(s,'b',{r:7,c:4},10,value,isKing),false);
  assert.equal(JSON.stringify(s),before);
});
test('예치·다른 입찰자 반환·낙찰 정산에서 총현금 보존',()=>{
  const s=game();const auction=list(s);s.players.c=player();s.turn='b';
  assert.equal(R.bid(s,'b',auction.id,500),true);assert.equal(s.players.b.money,1500);
  assert.equal(R.minimumBid(auction),550);s.turn='c';
  assert.equal(R.bid(s,'c',auction.id,549),false);
  assert.equal(R.bid(s,'c',auction.id,550),true);
  assert.equal(s.players.b.money,2000);assert.equal(s.players.c.money,1450);
  s.turnNo=4;assert.equal(R.settleAuctions(s).length,0);
  s.turnNo=5;assert.equal(R.settleAuctions(s).length,1);
  assert.equal(s.players.w.money,2550);assert.equal(s.players.c.warehouse.length,1);
  assert.equal(s.players.c.warehouse[0].piece.color,'c');
  assert.equal(Object.values(s.players).reduce((sum,p)=>sum+p.money,0),6000);
  assert.equal(R.settleAuctions(s).length,0);
});
test('인상액은 $50 또는 10%의 큰 값이고 부족한 AP·자금은 거절',()=>{
  assert.equal(R.minimumBid({bidder:'b',bid:2000}),2200);
  assert.equal(R.minimumBid({bidder:'b',bid:501}),552);
  const s=game(),auction=list(s);s.turn='b';s.players.b.ap=0;
  assert.equal(R.bid(s,'b',auction.id,500),false);s.players.b.ap=3;
  assert.equal(R.bid(s,'b',auction.id,2001),false);
  assert.equal(R.bid(s,'b',auction.id,Infinity),false);
  s.turnNo=5;assert.equal(R.bid(s,'b',auction.id,500),false);
  assert.equal(s.players.b.money,2000);assert.equal(s.players.b.ap,3);
});
test('유찰·창고 배치 범위·중복 배치 방지 및 기물 상태 보존',()=>{
  const s=game(),auction=list(s);s.turnNo=5;R.settleAuctions(s);
  assert.equal(s.players.w.warehouse[0].piece.id,'unit');
  assert.equal(R.deploy(s,'w',auction.id,{r:0,c:0}),false);
  assert.equal(R.deploy(s,'w',auction.id,{r:4,c:0}),false);
  assert.equal(R.deploy(s,'w',auction.id,{r:7,c:0}),true);
  assert.equal(s.board[7][0].moved,true);assert.equal(s.players.w.warehouse.length,0);
  assert.equal(R.deploy(s,'w',auction.id,{r:7,c:1}),false);
});
test('특수기물은 충전 상태를 보존하고 다음 자기 턴에 활성화',()=>{
  const s=game();s.players.b.warehouse.push({id:1,piece:{id:'special',specialId:'test',color:'w',abilityCharges:{shot:0},active:true,moved:false}});
  s.turn='b';assert.equal(R.deploy(s,'b',1,{r:1,c:2}),true);
  const piece=s.board[1][2];assert.equal(piece.color,'b');assert.equal(piece.active,false);
  assert.equal(piece.activationTurn,2);assert.equal(piece.abilityCharges.shot,0);assert.equal(piece.moved,true);
});
test('게임 종료 시 예치금 반환·판매자 창고 반환은 한 번만 실행',()=>{
  const s=game(),auction=list(s);s.turn='b';R.bid(s,'b',auction.id,500);
  R.closeAuctions(s);R.closeAuctions(s);
  assert.equal(s.players.b.money,2000);assert.equal(s.players.w.warehouse.length,1);assert.equal(s.auctions.length,0);
});
test('이자 자동 정산을 꺼도 복리 누적, 상환 설정과 독립',()=>{
  const p=player();p.creditDebt=1000;p.automation={repay:false,interest:false,maturity:false,warning:true};
  R.creditTurn(p,.1);assert.equal(p.creditDebt,1000);assert.equal(p.pendingInterest,100);
  R.creditTurn(p,.1);assert.equal(p.pendingInterest,210);
  R.settleInterest(p);assert.equal(p.creditDebt,1210);assert.equal(p.pendingInterest,0);
  R.settleInterest(p);assert.equal(p.creditDebt,1210);
  p.automation.interest=false;p.automation.repay=true;R.creditTurn(p,.1);
  assert.equal(p.pendingInterest,121);assert.equal(p.creditDebt,1172);assert.equal(p.money,1962);
});
test('자동 상환은 월급 20%·보유현금 이하, 직접 상환은 잔액 전체',()=>{
  const p=player();p.creditDebt=1000;p.money=12;
  R.creditTurn(p,.08);assert.equal(p.money,0);assert.equal(p.creditDebt,1068);
  p.money=2000;assert.equal(R.repay(p),1068);assert.equal(p.money,932);
  assert.equal(R.repay(p),0);
});
test('만기 자동 지급 OFF: 금액 확정·중복 적립 방지·직접 수령',()=>{
  const p=player();p.ownTurns=4;p.deposits=[{principal:500,due:4}];p.ventures=[{principal:300,due:3,mult:.5}];
  assert.equal(R.mature(p,1.1,1.2,false),0);assert.equal(p.money,2000);
  assert.equal(p.receivables.reduce((sum,item)=>sum+item.amount,0),810);
  R.mature(p,9,9,false);assert.equal(p.receivables.length,2);
  assert.equal(R.claim(p),810);assert.equal(p.money,2810);assert.equal(R.claim(p),0);
});
test('자동 지급 재활성화는 기존 대기금도 한 번만 지급',()=>{
  const p=player();p.ownTurns=4;p.deposits=[{principal:500,due:4}];R.mature(p,1.1,1,false);
  assert.equal(R.mature(p,1.1,1,true),550);assert.equal(p.money,2550);
  assert.equal(R.mature(p,1.1,1,true),0);
});

function gameVM(){
  const inputs=new Map();const node=()=>({value:'',checked:false,matches:()=>true,classList:{add(){},remove(){},toggle(){}},textContent:''});
  const document={getElementById(id){if(!inputs.has(id))inputs.set(id,node());return inputs.get(id);},querySelector:()=>node(),querySelectorAll:()=>[]};
  const window={EconomyRules:R,EconomyUI:{t:key=>key,saveAutomation(){},initialAutomation:()=>R.DEFAULT_AUTOMATION},GameLanguage:{text:(_,fallback)=>fallback},multiplayer:{socket:{readyState:1},code:'ROOM',token:'token',role:'host',sendState(){},sendAction(){}}};
  const sandbox={window,document,localStorage:{getItem:()=>null},console,SpecialPieces:{get:()=>null,list:()=>[]}};
  vm.createContext(sandbox);vm.runInContext(read('game.js').replace(/init\(\);\s*$/,''),sandbox);
  vm.runInContext('render=()=>{};log=()=>{};renderTurnTimer=()=>{};buildShop=()=>{};startTurnTimer=()=>{};',sandbox);
  return {sandbox,window,inputs,state:window.gameState};
}
test('멀티 호스트는 게스트 색으로만 새 행동을 검증하며 상대 턴 입찰 차단',()=>{
  const {window,state}=gameVM();Object.assign(state,game());state.turn='b';
  state.board[0][0]={type:'r',color:'b'};state.board[7][0]={type:'r',color:'w'};
  window.handleMultiplayerAction({type:'economyExpansion',op:'list',color:'w',square:{r:7,c:0}});
  assert.equal(state.auctions.length,0);
  window.handleMultiplayerAction({type:'economyExpansion',op:'list',square:{r:0,c:0}});
  assert.equal(state.auctions.length,1);assert.equal(state.auctions[0].seller,'b');
  state.turn='w';window.handleMultiplayerAction({type:'economyExpansion',op:'bid',id:1,amount:500});
  assert.equal(state.auctions[0].bidder,null);
  window.handleMultiplayerAction({type:'economyExpansion',op:'automation',key:'repay',value:false});
  assert.equal(state.players.b.automation.repay,false);assert.equal(state.players.w.automation.repay,true);
});
test('스냅샷은 규칙·경매·창고·예치·개별 자동화·AP 설정을 양측에 보존',()=>{
  const first=gameVM();Object.assign(first.state,game());list(first.state);first.state.turn='b';R.bid(first.state,'b',1,500);
  first.state.economyRules.priceMultiplier=1.75;first.state.players.b.automation.maturity=false;
  first.sandbox.applyEconomySettings({maxAP:5});
  const snapshot=first.window.serializeGameState(),second=gameVM();
  assert.equal(second.window.applyGameState(snapshot),true);
  const restored=second.window.serializeGameState();
  assert.equal(JSON.stringify(restored.auctions),JSON.stringify(snapshot.auctions));
  assert.equal(JSON.stringify(restored.economyRules),JSON.stringify(snapshot.economyRules));
  assert.equal(restored.players.b.money,1500);assert.equal(restored.players.b.automation.maturity,false);
  assert.equal(restored.economySettings.maxAP,5);
});
test('실제 턴 전환은 4회 후 낙찰 및 대기 만기금을 한 번만 처리',()=>{
  const {sandbox,state}=gameVM();Object.assign(state,game());list(state);
  state.turn='b';R.bid(state,'b',1,500);state.turn='w';
  state.players.b.automation.maturity=false;state.players.b.deposits=[{principal:500,due:1}];
  vm.runInContext('playSound=()=>{};stopTurnTimer=()=>{};countTax=()=>0;creditTerms=()=>({});runTurnAbilities=()=>{};moveMarket=()=>{};checkBankruptcy=()=>false;clearMode=()=>{};',sandbox);
  for(let i=0;i<4;i++)sandbox.endTurn();
  assert.equal(state.turnNo,5);assert.equal(state.auctions.length,0);assert.equal(state.players.b.warehouse.length,1);
  assert.equal(state.players.b.receivables.length,1);
  assert.equal(state.players.b.money,1500+190*2);
  assert.equal(state.players.w.money,2000+500+190*2);
});

function uiVM(storage={}){
  const elements=[];
  class Element{
    constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.events={};this.value='';this.checked=false;this.disabled=false;this.classList={toggle(){}};elements.push(this);}
    appendChild(child){child.parent=this;this.children.push(child);return child;}
    replaceChildren(){this.children=[];}
    setAttribute(key,value){this[key]=value;}
    addEventListener(key,fn){this.events[key]=fn;}
    matches(){return true;}
    querySelectorAll(selector){const all=[];const visit=element=>{for(const child of element.children){if(selector==='input'&&child.tagName==='input')all.push(child);visit(child);}};visit(this);return all;}
  }
  for(const id of ['economyPresetPanel','auctionPanel','financePanel','financeRisk','jobBtn','salaryBtn','depositBtn','ventureBtn','buyPropertyBtn'])Object.assign(new Element(),{id});
  const find=id=>elements.find(element=>element.id===id);
  find('auctionPanel').appendChild(Object.assign(new Element(),{id:'auctionContent'}));
  find('financePanel').appendChild(Object.assign(new Element(),{id:'financeContent'}));
  const document={createElement:tag=>new Element(tag),getElementById:find,querySelector:()=>null,
    querySelectorAll:selector=>selector==='[data-economy-custom]'?elements.filter(element=>Object.hasOwn(element.dataset,'economyCustom')):[]};
  let role=null;const state=game(),published=[],actions=[],logs=[];state.started=false;
  const en=JSON.parse(read('data/en_us.json'));
  const window={EconomyRules:R,GameLanguage:{text:(key,fallback)=>en[key]??fallback},addEventListener(){},multiplayer:{sendAction:action=>actions.push(action)}};
  const sandbox={window,document,localStorage:{getItem:key=>storage[key]??null,setItem:(key,value)=>{storage[key]=value;}},console};
  vm.createContext(sandbox);vm.runInContext(read('js/economyUI.js'),sandbox);
  const adapter={state,role:()=>role,publish:()=>published.push(JSON.stringify(state.economyRules)),log:message=>logs.push(message),pieceName:piece=>piece.type,sideName:color=>color,money:value=>'$'+value,tax:()=>0,bankruptcy:-900,action:(color,action)=>actions.push({color,...action})};
  window.EconomyUI.init(adapter);
  return {window,document,state,find,storage,actions,published,logs,setRole:value=>{role=value;}};
}
test('로비 사용자 저장·재로드와 게스트 읽기 전용 표시',()=>{
  const env=uiVM();const preset=env.find('economyPreset');preset.value='custom';preset.events.change();
  env.find('economyFeature-auction').checked=true;env.find('economyPriceMultiplier').value='1.5';
  env.find('economySave').events.click();
  const saved=JSON.parse(env.storage.capitalistChessEconomyCustom);
  assert.equal(saved.rules.preset,'custom');assert.equal(saved.rules.priceMultiplier,1.5);assert.equal(saved.rules.features.auction,true);
  const next=uiVM(env.storage);assert.equal(next.find('economyPriceMultiplier').value,1.5);
  next.setRole('guest');next.state.economyRules=R.preset('casual');next.window.EconomyUI.render();
  assert.equal(next.find('economyPreset').disabled,true);assert.equal(next.find('economyFeature-auction').checked,false);
  next.setRole(null);next.window.EconomyUI.render();assert.equal(next.find('economyPreset').disabled,false);
});
test('접이식 패널의 영어 표시·기능 ON/OFF 및 게스트 요청 전송',()=>{
  const env=uiVM();env.state.started=true;list(env.state);env.state.turn='b';env.setRole('guest');env.window.EconomyUI.render();
  assert.equal(env.find('auctionPanel').hidden,false);assert.equal(env.find('financePanel').hidden,false);
  const content=[];const visit=element=>{if(element.textContent)content.push(element.textContent);element.children.forEach(visit);};
  visit(env.find('auctionPanel'));visit(env.find('financePanel'));
  assert.doesNotMatch(content.join(' '),/[\uac00-\ud7a3]/);
  env.window.EconomyUI.send('bid',{id:1,amount:500});assert.equal(env.actions[0].type,'economyExpansion');
  assert.equal(env.actions[0].op,'bid');assert.equal(env.actions[0].id,1);
  env.state.economyRules=R.preset('casual');env.window.EconomyUI.render();
  assert.equal(env.find('auctionPanel').hidden,true);assert.equal(env.find('financePanel').hidden,true);
  assert.equal(env.find('depositBtn').hidden,true);assert.equal(env.find('jobBtn').hidden,false);
});
test('자동화 선호는 백·흑별로 저장',()=>{
  const env=uiVM();
  env.window.EconomyUI.saveAutomation({color:'w',automation:{repay:false,interest:true,maturity:false,warning:true}});
  env.window.EconomyUI.saveAutomation({color:'b',automation:{repay:true,interest:false,maturity:true,warning:false}});
  assert.equal(env.window.EconomyUI.initialAutomation('w').maturity,false);
  assert.equal(env.window.EconomyUI.initialAutomation('b').maturity,true);
  const next=uiVM(env.storage);assert.equal(next.window.EconomyUI.initialAutomation('b').warning,false);
});
test('비활성 기능의 실제 게임 행동을 차단하고 구매·가치에 가격 배율 적용',()=>{
  const {sandbox,state}=gameVM();Object.assign(state,game());state.economyRules=R.preset('casual');
  const before=state.players.w.money;
  sandbox.makeDeposit();sandbox.makeVenture();sandbox.tradeStock(true);sandbox.buyProperty();
  assert.equal(state.players.w.money,before);assert.equal(state.players.w.ap,3);
  assert.equal(sandbox.countTax('w'),0);assert.equal(sandbox.hasCreditLine('w'),false);
  sandbox.playSound=()=>{};sandbox.doJob();assert.equal(state.players.w.money,before+100);assert.equal(state.players.w.ap,2);
  state.economyRules={...R.preset('full'),priceMultiplier:1.5};
  assert.equal(sandbox.piecePrice({type:'r'}),1275);
  assert.equal(sandbox.propertyPrice('a1'),210);
});

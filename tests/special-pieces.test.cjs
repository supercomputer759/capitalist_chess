// 실제 게임 함수를 격리 실행하여 특수기물의 행마와 능력을 검증합니다.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {env,definitions,vm}=require('./gameHarness.cjs');
const excluded=new Set(['mounted_king','black_hole','suicide_pawn','fake_king','wall','bankrupt_queen','taxi','mounted_king_mk2']);
const has=(moves,r,c)=>moves.some(p=>p.r===r&&p.c===c);
const reset=e=>{e.state.players.w.ap=3;e.state.players.w.moveUsed=false;};
const roll=(e,value)=>vm.runInContext(`Math.random=()=>${value}`,e.s);
function place(e,id,r=4,c=4,color='w'){return e.state.board[r][c]=e.special(id,color);}
function capture(e,id,target='p',r=4,c=5){place(e,id);e.state.board[r][c]=e.unit(target,'b');e.s.makeMove(4,4,r,c);}
for(const [id,definition] of Object.entries(definitions)){
  if(excluded.has(id))continue;
  test(`${definition.name}: 생성·행마·능력 레지스트리 연결`,()=>{
    const e=env();roll(e,.1);const p=place(e,id);
    assert.equal(p.specialId,id);assert.ok(p.id);
    const moves=e.s.legalMovesFor(4,4);
    assert.equal(moves.length===0,definition.movement.type==='stationary');
    for(const ability of definition.abilities)assert.equal(typeof e.window.abilityHandlers[ability.id],'function');
    for(const target of moves)assert.ok(target.r>=0&&target.r<8&&target.c>=0&&target.c<8);
  });
  test(`${definition.name}: 백·흑 실제 구매·비용 차감·다음 자기 턴 활성화`,()=>{
    for(const color of ['w','b']){
      const e=env();roll(e,.1);e.state.turn=color;e.state.players[color].money=100000;e.state.specialStock[id]=1;e.state.pendingSpecialId=id;
      const r=color==='w'?6:1;e.s.finishSpecialPurchase(r,0);const p=e.state.board[r][0];
      assert.equal(p.specialId,id);assert.equal(p.active,false);assert.equal(e.state.players[color].money,100000-definition.price);assert.equal(e.state.players[color].ap,3-definition.buyAP);assert.equal(e.state.specialStock[id],0);assert.equal(e.s.legalMovesFor(r,0).length,0);
      e.state.turnNo+=2;e.s.runTurnAbilities(color);const position=e.s.findPiecePosition(p);assert.ok(position);assert.equal(e.state.board[position.r][position.c].active,true);
    }
  });
}
test('황금 폰: 이동당 $120, 후퇴 불가, 포획 현상금',()=>{
  const e=env();place(e,'golden_pawn');const before=e.state.players.w.money;
  assert.equal(has(e.s.legalMovesFor(4,4),5,4),false);e.s.makeMove(4,4,3,4);
  assert.equal(e.state.players.w.money-before,120);
  const f=env();f.state.board[4][0]=f.unit('r');place(f,'golden_pawn',4,4,'b');
  const money=f.state.players.w.money;f.s.makeMove(4,0,4,4);assert.equal(f.state.players.w.money-money,700);
});
test('은행가: 만기 보너스, 포획 시 예금 15% 손실',()=>{
  const e=env();place(e,'banker');const p=e.state.players.w;p.ownTurns=5;p.deposits=[{principal:1000,due:5}];
  const before=p.money;e.s.processMaturities('w');
  assert.equal(p.money-before,vm.runInContext('Math.round(1000*CFG.depositReturn*1.35)',e.s));
  p.deposits=[{principal:1000,due:9}];e.state.turn='b';e.state.board[4][0]=e.unit('r','b');e.s.makeMove(4,0,4,4);
  assert.equal(p.deposits[0].principal,850);
  const f=env();const inactive=place(f,'banker',4,4,'b');inactive.active=false;f.state.players.b.deposits=[{principal:1000,due:9}];f.state.board[4][0]=f.unit('r');f.s.makeMove(4,0,4,4);assert.equal(f.state.players.b.deposits[0].principal,1000);
});
test('세무사: 유지세 30% 할인, 판사 봉인 시 할인 중단',()=>{
  const e=env();place(e,'tax_accountant');const raw=definitions.tax_accountant.tax;
  assert.equal(e.s.countTax('w'),Math.round(raw*.7));place(e,'judge',3,3,'b');
  assert.equal(e.s.countTax('w'),raw);
});
test('주식 중개인: 인접 아군 포획만 35% 추가, 자기 포획 제외',()=>{
  for(const [near,expected] of [[true,189],[false,140]]){
    const e=env();place(e,'stock_broker',near?3:1,4);e.state.board[4][0]=e.unit('r');e.state.board[4][4]=e.unit('p','b');
    const before=e.state.players.w.money;e.s.makeMove(4,0,4,4);assert.equal(e.state.players.w.money-before,expected);
  }
  const e=env();const before=e.state.players.w.money;capture(e,'stock_broker');assert.equal(e.state.players.w.money-before,140);
});
test('공장: 자기 턴 3회마다 생산, 중복 생산 방지',()=>{
  const e=env();const factory=place(e,'factory');
  for(let i=1;i<=3;i++){e.state.turnNo=i*2;e.s.runTurnAbilities('w');assert.equal(e.state.board.flat().filter(p=>p?.type==='p').length,i===3?1:0);}
  e.window.runAbility('produce_pawn',{state:e.state,piece:factory,params:{intervalTurns:3},event:'turn'});
  assert.equal(e.state.board.flat().filter(p=>p?.type==='p').length,1);
});
test('공장: 점령 분기에서는 공장만 소유권 변경, 파괴 분기는 보상 지급',()=>{
  for(const occupation of [true,false]){
    const e=env();roll(e,occupation?.1:.9);place(e,'factory',4,4,'b');const attacker=e.state.board[4][0]=e.unit('r');
    const before=e.state.players.w.money;e.s.makeMove(4,0,4,4);
    assert.equal(e.state.board[4][4].color,'w');assert.equal(e.state.players.w.ap,2);
    if(occupation){assert.equal(e.state.board[4][0].id,attacker.id);assert.equal(e.state.board[4][4].specialId,'factory');assert.equal(e.state.board[4][4].active,false);assert.equal(e.state.players.w.money,before);}
    else{assert.equal(e.state.board[4][0],null);assert.equal(e.state.board[4][4].id,attacker.id);assert.equal(e.state.players.w.money-before,e.s.pieceCaptureReward(e.special('factory','b')));}
  }
});
test('경호원: 킹 주변 순간이동, 킹만 대신 희생',()=>{
  const e=env();place(e,'bodyguard',6,3);assert.ok(has(e.s.legalMovesFor(6,3),6,5));assert.equal(has(e.s.legalMovesFor(6,3),5,3),false);
  e.state.turn='b';e.state.board[7][0]=e.unit('r','b');e.s.makeMove(7,0,7,4);
  assert.equal(e.state.board[7][4].type,'k');assert.equal(e.state.board[6][3],null);
  const f=env();place(f,'bodyguard',5,4);f.state.board[4][4]=f.unit('p');f.state.turn='b';f.state.board[4][0]=f.unit('r','b');f.s.makeMove(4,0,4,4);
  assert.equal(f.state.board[4][4].color,'b');assert.ok(f.state.board[5][4]);
});
test('유령: 기물 관통, 아군 착지 불가, 50% 포획 양쪽 분기',()=>{
  for(const success of [true,false]){
    const e=env();roll(e,success?.1:.9);place(e,'ghost');e.state.board[4][3]=e.unit('p');e.state.board[4][1]=e.unit('p','b');
    assert.ok(has(e.s.legalMovesFor(4,4),4,1));assert.equal(has(e.s.legalMovesFor(4,4),4,3),false);
    e.s.makeMove(4,4,4,1);assert.equal(e.state.board[4][1].color,success?'w':'b');assert.equal(e.state.players.w.ap,2);
  }
});
test('유령의 포획 확률은 주변 아군 방어로 발동하지 않음',()=>{
  const e=env();roll(e,.99);place(e,'ghost',3,4,'b');e.state.board[4][0]=e.unit('r');e.state.board[4][4]=e.unit('p','b');e.s.makeMove(4,0,4,4);assert.equal(e.state.board[4][4].color,'w');
});
test('자석: 이동 후 아군과 적군 모두 무작위 이동 대상',()=>{
  for(const color of ['w','b']){const e=env();roll(e,0);place(e,'magnet');const p=e.state.board[2][3]=e.unit('p',color);e.s.makeMove(4,4,3,4);const location=e.s.findPiecePosition(p);assert.ok(location);assert.notDeepEqual({...location},{r:2,c:3});assert.equal(e.state.board[location.r][location.c].moved,true);}
});
test('워프 비숍: 같은 색 빈칸·$450/1AP, 반대 색과 자금 부족 거부',()=>{
  const e=env();place(e,'warp_bishop');e.state.players.w.money=1000;
  e.s.executePieceAbility('paid_same_color_warp',{r:4,c:4},{r:0,c:1});assert.ok(e.state.board[4][4]);assert.equal(e.state.players.w.money,1000);
  e.s.executePieceAbility('paid_same_color_warp',{r:4,c:4},{r:0,c:0});assert.equal(e.state.board[0][0].specialId,'warp_bishop');assert.equal(e.state.players.w.money,550);assert.equal(e.state.players.w.ap,2);
  e.state.players.w.money=0;e.s.executePieceAbility('paid_same_color_warp',{r:0,c:0},{r:4,c:4});assert.ok(e.state.board[0][0]);
});
test('저격수: 빈칸 일반 이동과 제자리 3칸 저격, 장애물 차단',()=>{
  const e=env();place(e,'sniper');e.s.makeMove(4,4,4,5);assert.equal(e.state.board[4][5].specialId,'sniper');assert.equal(e.state.board[4][4],null);
  reset(e);e.state.board[1][5]=e.unit('p','b');e.s.makeMove(4,5,1,5);assert.ok(e.state.board[4][5]);assert.equal(e.state.board[1][5],null);
  e.state.board[3][5]=e.unit('p');e.state.board[2][5]=e.unit('p','b');assert.equal(has(e.s.legalMovesFor(4,5),2,5),false);
});
test('기병: 같은 기물만 0AP 연쇄 포획, 빈칸 이동 후 종료',()=>{
  const e=env();place(e,'cavalry');e.state.players.w.ap=1;e.state.board[2][3]=e.unit('p','b');e.state.board[4][2]=e.unit('p','b');
  e.s.makeMove(4,4,2,3);assert.equal(e.state.players.w.ap,0);assert.equal(e.state.players.w.moveUsed,false);
  e.s.makeMove(7,4,6,4);assert.ok(e.state.board[7][4]);
  e.s.makeMove(2,3,4,2);assert.equal(e.state.board[4][2].specialId,'cavalry');assert.equal(e.state.players.w.ap,0);
  e.s.makeMove(4,2,2,1);assert.equal(e.state.players.w.moveUsed,true);assert.equal(e.state.players.w.extraMovePieceId,null);
});
test('요새: 킹 주둔·보호 1회·퇴거 후 요새와 소모 횟수 유지',()=>{
  const e=env();place(e,'fortress',6,4);assert.ok(has(e.s.legalMovesFor(7,4),6,4));e.s.makeMove(7,4,6,4);
  assert.equal(e.state.board[6][4].shelterFortress.specialId,'fortress');e.state.turn='b';e.state.board[6][0]=e.unit('r','b');e.s.makeMove(6,0,6,4);
  assert.equal(e.state.board[6][4].type,'k');assert.equal(e.state.board[6][4].shelterFortress.abilityCharges.king_shelter,0);
  e.state.turn='w';reset(e);e.s.makeMove(6,4,7,4);assert.equal(e.state.board[6][4].specialId,'fortress');assert.equal(e.state.board[6][4].abilityCharges.king_shelter,0);assert.equal(e.state.board[7][4].shelterFortress,undefined);
  const f=env();const king=place(f,'chaebol_king',7,4);king.attackLockedTurns=1;place(f,'fortress',6,4);assert.ok(has(f.s.legalMovesFor(7,4),6,4));f.s.makeMove(7,4,6,4);assert.equal(f.state.board[6][4].shelterFortress.specialId,'fortress');
});
test('요새: 주변 일반 아군 보호, 주변 킹은 무제한 보호하지 않음',()=>{
  const e=env();place(e,'fortress',5,4,'b');e.state.board[4][0]=e.unit('r');e.state.board[4][4]=e.unit('p','b');e.s.makeMove(4,0,4,4);assert.equal(e.state.board[4][4].color,'b');
  e.state.board[4][4]=e.unit('k','b');reset(e);e.s.makeMove(4,0,4,4);assert.equal(e.state.board[4][4].color,'w');
});
test('판사: 기본 행마 유지·이동 수익 및 유료 능력 봉인',()=>{
  const e=env();place(e,'golden_pawn');place(e,'judge',3,3,'b');const before=e.state.players.w.money;e.s.makeMove(4,4,3,4);assert.ok(e.state.board[3][4]);assert.equal(e.state.players.w.money,before);
  const f=env();place(f,'warp_bishop');place(f,'judge',3,3,'b');f.s.executePieceAbility('paid_same_color_warp',{r:4,c:4},{r:0,c:0});assert.ok(f.state.board[4][4]);
});
test('해적: 룩 4칸 제한, 포획금 외 35% 강탈·상한 $700',()=>{
  const e=env();place(e,'pirate');assert.equal(has(e.s.legalMovesFor(4,4),4,0),true);assert.equal(has(e.s.legalMovesFor(4,4),0,0),false);
  e.state.board[4][5]=e.unit('q','b');const w=e.state.players.w.money,b=e.state.players.b.money;e.s.makeMove(4,4,4,5);
  const stolen=Math.min(700,Math.round(e.s.piecePrice(e.unit('q'))*.35));assert.equal(b-e.state.players.b.money,stolen);assert.equal(e.state.players.w.money-w,e.s.pieceCaptureReward(e.unit('q'))+stolen);
  const f=env();place(f,'pirate');place(f,'tax_accountant',4,5,'b');const cash=f.state.players.b.money;f.s.makeMove(4,4,4,5);assert.equal(cash-f.state.players.b.money,700);
});
test('흡혈귀: 포획 누적 성장과 봉인 중 성장 금지',()=>{
  const e=env();capture(e,'vampire');assert.equal(e.state.board[4][5].growthCaptures,1);assert.equal(e.state.board[4][5].growMovement.type,'knight');
  const f=env();place(f,'judge',3,3,'b');capture(f,'vampire');assert.equal(f.state.board[4][5].growthCaptures,undefined);
});
test('스와퍼: 아군 교환·$350/1AP, 킹 및 적군 교환 거부',()=>{
  const e=env();place(e,'swapper');e.state.players.w.money=1000;const target=e.state.board[1][1]=e.unit('r');
  e.s.executePieceAbility('paid_friendly_swap',{r:4,c:4},{r:7,c:4});assert.ok(e.state.board[4][4]);
  e.state.board[3][3]=e.unit('p','b');e.s.executePieceAbility('paid_friendly_swap',{r:4,c:4},{r:3,c:3});assert.equal(e.state.board[3][3].color,'b');assert.equal(e.state.players.w.money,1000);
  e.s.executePieceAbility('paid_friendly_swap',{r:4,c:4},{r:1,c:1});assert.equal(e.state.board[4][4].id,target.id);assert.equal(e.state.players.w.money,650);assert.equal(e.state.players.w.ap,2);
});
test('거울: 첫 공격만 방어, 두 번째는 포획',()=>{
  const e=env();place(e,'mirror',4,4,'b');e.state.board[4][0]=e.unit('r');e.s.makeMove(4,0,4,4);assert.equal(e.state.board[4][4].mirrorUsed,true);
  reset(e);e.s.makeMove(4,0,4,4);assert.equal(e.state.board[4][4].color,'w');
});
test('임대주택: 인접 소유 칸 통행료 1.8배',()=>{
  const e=env();place(e,'rental_house',3,4,'b');e.state.properties.e4='b';const before=e.state.players.b.money;
  e.s.visitSquare(4,4,'w');assert.equal(e.state.players.b.money-before,Math.round(e.s.propertyToll('e4')*1.8));assert.equal(e.s.legalMovesFor(3,4).length,0);
});
test('신용카드 기사: 외상 한도·이자, 사망 후 부채 유지',()=>{
  const e=env();place(e,'credit_card_knight');assert.equal(e.s.creditTerms().creditLimit,3500);assert.equal(e.s.creditTerms().interestPerTurn,.08);
  e.state.players.w.money=0;assert.equal(e.s.purchaseAndAP(1000,1,'test'),true);assert.equal(e.state.players.w.creditDebt,1000);
  assert.equal(e.s.purchaseAndAP(2501,1,'test'),false);
  e.state.turn='b';e.state.board[4][0]=e.unit('r','b');e.s.makeMove(4,0,4,4);assert.equal(e.state.players.w.creditDebt,1000);assert.equal(e.s.creditTerms('w').creditLimit,undefined);
  e.s.endTurn();assert.equal(e.state.players.w.creditDebt,1042);assert.equal(e.state.players.w.money,152);
});
test('벤처 나이트: 구매 시 세 확률 결과, 이동 중 재추첨 금지',()=>{
  for(const [value,type] of [[.1,'pawn'],[.6,'knight_bishop'],[.99,'queen']]){const e=env();roll(e,value);const p=place(e,'venture_knight');assert.equal(p.ventureMovement.type,type);roll(e,0);e.s.runTurnAbilities('w');assert.equal(p.ventureMovement.type,type);}
});
test('공매도꾼: 상대 손실 0·10·25%별 범위와 추가 보상',()=>{
  for(const [basis,range,bonus] of [[100,1,0],[112,2,.2],[140,3,.5]]){
    const e=env();place(e,'short_seller');e.state.players.b.holdings={pastry:1};e.state.players.b.stockBasis={pastry:basis};
    const target=4-range;e.state.board[4][target]=e.unit('p','b');assert.ok(has(e.s.legalMovesFor(4,4),4,target));assert.equal(has(e.s.legalMovesFor(4,4),0,4),false);
    const before=e.state.players.w.money;e.s.makeMove(4,4,4,target);assert.equal(e.state.players.w.money-before,140+Math.round(140*bonus));
  }
});
test('재벌 킹: 인접 적 비킹 인수·135% 가격/2AP, 킹 인수 불가',()=>{
  const e=env();place(e,'chaebol_king');e.state.players.w.money=10000;const target=e.state.board[4][5]=e.unit('p','b');const cost=Math.ceil(e.s.piecePrice(target)*1.35);
  e.s.executePieceAbility('hostile_takeover',{r:4,c:4},{r:4,c:5});assert.equal(e.state.board[4][5].color,'w');assert.equal(e.state.players.w.money,10000-cost);assert.equal(e.state.players.w.ap,1);
  e.state.board[3][4]=e.unit('k','b');e.s.executePieceAbility('hostile_takeover',{r:4,c:4},{r:3,c:4});assert.equal(e.state.board[3][4].color,'b');
});
test('재벌 킹: 구매 시 기존 킹 대체, 포획되면 패배',()=>{
  const e=env();e.state.players.w.money=20000;e.state.specialStock.chaebol_king=1;e.state.pendingSpecialId='chaebol_king';e.s.finishSpecialPurchase(6,4);
  assert.equal(e.state.board[7][4],null);assert.equal(e.s.isKingLike(e.state.board[6][4]),true);
  e.state.turn='b';e.state.board[6][0]=e.unit('r','b');e.s.makeMove(6,0,6,4);assert.equal(e.state.gameOver,true);assert.equal(e.state.gameResult.winner,'b');
});
test('재벌 킹: 커스텀 배치에서 진짜 킹 역할로 검증',()=>{
  const e=env(),config={pieces:[{r:7,c:4,color:'w',specialId:'chaebol_king'},{r:0,c:4,color:'b',type:'k'}],money:{w:1600,b:1600}};
  assert.ok(e.window.SetupEditor.normalize(config,definitions));
});
test('킹 보험으로 취소된 포획은 현금·성장·기병 연쇄 이동을 주지 않음',()=>{
  for(const id of ['cavalry','vampire']){
    const e=env();place(e,id);const target=id==='cavalry'?{r:2,c:3}:{r:4,c:5};
    e.state.board[target.r][target.c]=e.unit('k','b');e.state.players.b.insurance=true;const before=e.state.players.w.money;
    e.s.makeMove(4,4,target.r,target.c);assert.equal(e.state.players.w.money,before);assert.equal(e.state.players.w.moveUsed,true);assert.equal(e.state.players.w.extraMovePieceId,null);assert.equal(e.state.board[4][4].growthCaptures,undefined);
  }
});
test('요새: 보호 소모 뒤 다음 공격은 승패 처리, 주둔 중 세금과 가치 유지',()=>{
  const e=env();place(e,'fortress',6,4);const tax=e.s.countTax('w'),score=e.s.countPieceScore('w');e.s.makeMove(7,4,6,4);
  assert.equal(e.s.countTax('w'),tax);assert.equal(e.s.countPieceScore('w'),score);
  e.state.turn='b';e.state.board[6][0]=e.unit('r','b');e.s.makeMove(6,0,6,4);e.state.players.b.moveUsed=false;e.s.makeMove(6,0,6,4);assert.equal(e.state.gameResult.winner,'b');
});
test('요새: 주둔 중에도 주변 일반 아군 보호 유지',()=>{
  const e=env();place(e,'fortress',6,4);e.s.makeMove(7,4,6,4);e.state.board[5][4]=e.unit('p');e.state.board[5][0]=e.unit('r','b');e.state.turn='b';e.s.makeMove(5,0,5,4);assert.equal(e.state.board[5][4].color,'w');
});
test('판사: 저격 범위·방어·생산·신용 한도 봉인',()=>{
  for(const id of ['sniper','factory','credit_card_knight','mirror']){
    const e=env();place(e,id);place(e,'judge',3,3,'b');
    if(id==='sniper'){e.state.board[4][1]=e.unit('p','b');assert.equal(has(e.s.legalMovesFor(4,4),4,1),false);assert.ok(has(e.s.legalMovesFor(4,4),4,3));}
    if(id==='factory'){for(let i=0;i<3;i++)e.s.runTurnAbilities('w');assert.equal(e.state.board.flat().filter(p=>p?.type==='p').length,0);}
    if(id==='credit_card_knight')assert.equal(e.s.hasCreditLine(),false);
    if(id==='mirror'){e.state.turn='b';e.state.board[4][0]=e.unit('r','b');e.s.makeMove(4,0,4,4);assert.equal(e.state.board[4][4].color,'b');}
  }
});
test('게스트의 유료 특수행동: 호스트가 흑 소유 기물만 실행',()=>{
  const e=env();e.window.multiplayer={socket:{readyState:1},code:'room',token:'token',role:'host'};e.state.turn='b';place(e,'warp_bishop',4,4,'b');
  e.window.handleMultiplayerAction({type:'pieceAbility',id:'paid_same_color_warp',source:{r:4,c:4},target:{r:2,c:2}});assert.equal(e.state.board[2][2].color,'b');assert.equal(e.state.players.b.ap,2);
  place(e,'warp_bishop',4,4,'w');e.window.handleMultiplayerAction({type:'pieceAbility',id:'paid_same_color_warp',source:{r:4,c:4},target:{r:3,c:3}});assert.ok(e.state.board[4][4]);assert.equal(e.state.board[3][3],null);
});

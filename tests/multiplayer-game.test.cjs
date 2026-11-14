const {test}=require('node:test'),assert=require('node:assert/strict');
const {env,vm}=require('./gameHarness.cjs');
function multiplayer(e,role){
  const actions=[];e.window.multiplayer={socket:{readyState:1},code:'ABCDEF',token:'token',role,sendAction:action=>actions.push(action)};return actions;
}
test('무승부 버튼: 자기 턴만 활성화, 관전·시작 전·종료 후 비활성화',()=>{
  for(const role of ['host','guest','spectator'])for(const turn of ['w','b']){
    const e=env();multiplayer(e,role);e.state.turn=turn;e.s.updateDrawButton();
    assert.equal(e.s.document.getElementById('drawBtn').disabled,!(role==='host'&&turn==='w'||role==='guest'&&turn==='b'));
    e.state.started=false;e.s.updateDrawButton();assert.equal(e.s.document.getElementById('drawBtn').disabled,true);
    e.state.started=true;e.state.gameOver=true;e.s.updateDrawButton();assert.equal(e.s.document.getElementById('drawBtn').disabled,true);
  }
});
test('무승부 직접 실행·클릭 경로 모두 상대 턴에서 상태 변경·전송 금지',()=>{
  for(const role of ['host','guest','spectator']){
    const e=env(),sent=multiplayer(e,role);e.state.turn=role==='host'?'b':'w';
    e.s.requestDraw();e.s.runMultiplayerAction('draw',e.s.requestDraw)({type:'click'});
    assert.equal(e.state.drawOffer,null);assert.equal(sent.length,0);
  }
});
test('흑의 자기 턴 클릭은 호스트에게 무승부 요청 전달',()=>{
  const e=env(),sent=multiplayer(e,'guest');e.state.turn='b';e.s.runMultiplayerAction('draw',e.s.requestDraw)({type:'click'});assert.equal(sent[0].type,'draw');assert.equal(e.state.drawOffer,null);
});
test('무승부 요청·취소·상대 승인, 호스트가 받은 흑 요청은 흑으로 처리',()=>{
  const e=env();multiplayer(e,'host');e.s.requestDraw();assert.equal(e.state.drawOffer,'w');e.s.requestDraw();assert.equal(e.state.drawOffer,null);
  e.s.requestDraw();e.state.turn='b';e.s.requestDraw();assert.equal(e.state.gameOver,false);assert.equal(e.state.drawOffer,'w');
  e.window.handleMultiplayerAction({type:'draw'});assert.equal(e.state.gameOver,true);assert.equal(e.state.gameResult.winner,null);
  const f=env();multiplayer(f,'host');f.window.handleMultiplayerAction({type:'draw'});assert.equal(f.state.drawOffer,null);f.state.turn='b';f.window.handleMultiplayerAction({type:'draw'});assert.equal(f.state.drawOffer,'b');
});
test('무승부 문구는 접속한 진영 기준으로 표시',()=>{
  const e=env();multiplayer(e,'host');e.state.drawOffer='w';e.state.turn='b';e.s.updateDrawButton();assert.equal(e.s.document.getElementById('drawBtn').textContent,'요청 취소');assert.equal(e.s.document.getElementById('drawBtn').disabled,true);
});
test('이미 다른 게임을 시작한 상태에서도 관전 스냅샷이 로비를 닫음',()=>{
  const e=env();multiplayer(e,'spectator');const hidden=[];e.s.document.getElementById('lobbyScreen').classList.add=name=>hidden.push(name);vm.runInContext('renderTurnTimer=()=>{};',e.s);
  const snapshot=e.s.serializeGameState();assert.equal(e.state.started,true);assert.equal(e.s.applyGameState(snapshot),true);assert.ok(hidden.includes('hidden'));
});

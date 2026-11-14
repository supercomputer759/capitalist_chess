// 실행 중인 Wrangler 또는 배포된 Workers에 실제 HTTP·WebSocket으로 접속합니다.
const {test}=require('node:test'),assert=require('node:assert/strict');
const WebSocket=require('../server/node_modules/ws');
const base=(process.env.CHESS_TEST_SERVER_URL||'http://127.0.0.1:8787').replace(/\/$/,'');
async function socket(t,code){
  const ws=new WebSocket(base.replace(/^http/,'ws')+'/rooms/'+code),queue=[],waiters=[];
  ws.on('message',raw=>{
    const data=JSON.parse(String(raw)),index=waiters.findIndex(w=>w.type===data.type);
    if(index<0)queue.push(data);else{const [waiter]=waiters.splice(index,1);clearTimeout(waiter.timer);waiter.resolve(data);}
  });
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  t.after(()=>{ws.terminate();for(const w of waiters)clearTimeout(w.timer);});
  return {ws,send(data){ws.send(JSON.stringify(data));},next(type){
    const index=queue.findIndex(m=>m.type===type);if(index>=0)return Promise.resolve(queue.splice(index,1)[0]);
    return new Promise((resolve,reject)=>{const waiter={type,resolve};waiter.timer=setTimeout(()=>{waiters.splice(waiters.indexOf(waiter),1);reject(Error(`Timed out: ${type}`));},8000);waiters.push(waiter);});
  }};
}
async function hosted(t){
  const response=await fetch(base+'/rooms',{method:'POST'});assert.equal(response.status,201);const reservation=await response.json();
  const host=await socket(t,reservation.code);host.send({type:'create',createToken:reservation.createToken,state:{turn:'w'},revision:1});const session=await host.next('roomCreated');
  t.after(()=>{if(host.ws.readyState===1)host.send({type:'closeRoom',token:session.token});});return {...reservation,host,session};
}
test('Workers HTTP: 상태 확인·CORS·잘못된 경로 거부',async()=>{
  const health=await fetch(base+'/health');assert.equal((await health.json()).placement,'automatic');assert.equal(health.headers.get('access-control-allow-origin'),'*');
  assert.equal((await fetch(base+'/rooms',{method:'OPTIONS'})).status,204);assert.equal((await fetch(base+'/reserve',{method:'POST'})).status,404);
});
test('실제 연결 4개: 정원 초과 관전·명시적 관전·상태·행동·채팅 중계',async t=>{
  const {code,host}=await hosted(t),guest=await socket(t,code),watcher=await socket(t,code);
  guest.send({type:'join',code});assert.equal((await guest.next('joined')).state.turn,'w');await host.next('guestJoined');
  watcher.send({type:'join',code});assert.equal((await watcher.next('watched')).role,'spectator');assert.equal((await host.next('spectatorCount')).count,1);
  const explicit=await socket(t,code);explicit.send({type:'watch',code});assert.equal((await explicit.next('watched')).role,'spectator');assert.equal((await host.next('spectatorCount')).count,2);
  host.send({type:'state',state:{turn:'b',king:'chaebol_king'},revision:2});assert.equal((await guest.next('state')).state.king,'chaebol_king');assert.equal((await watcher.next('state')).revision,2);
  guest.send({type:'action',action:{type:'pieceAbility',id:'paid_same_color_warp'}});assert.equal((await host.next('action')).action.id,'paid_same_color_warp');
  watcher.send({type:'chat',text:'hello'});assert.equal((await guest.next('chat')).from,'spectator');
  host.send({type:'orbitalStrikeResult',result:{target:'e4'}});assert.equal((await guest.next('orbitalStrikeResult')).result.target,'e4');
  guest.send({type:'heartbeat'});assert.equal((await guest.next('heartbeatAck')).type,'heartbeatAck');
  host.send({type:'closeRoom'});await watcher.next('roomClosed');await guest.next('roomClosed');
});
test('실제 게스트 연결 종료·토큰 재접속·최신 상태 복원',async t=>{
  const {code,host}=await hosted(t),guest=await socket(t,code);guest.send({type:'join',code});const session=await guest.next('joined');await host.next('guestJoined');
  guest.ws.close();await host.next('guestDisconnected');
  const rejoined=await socket(t,code);rejoined.send({type:'reconnect',code,token:session.token});const restored=await rejoined.next('reconnected');assert.equal(restored.role,'guest');assert.equal(restored.state.turn,'w');await host.next('guestReconnected');
  rejoined.send({type:'leave',token:session.token});await host.next('guestLeft');
  const replacement=await socket(t,code);replacement.send({type:'join',code});assert.equal((await replacement.next('joined')).role,'guest');
});
test('다른 방의 상태·세션은 섞이지 않음',async t=>{
  const first=await hosted(t),second=await hosted(t);assert.notEqual(first.code,second.code);
  const outsider=await socket(t,second.code);outsider.send({type:'reconnect',token:first.session.token,code:second.code});assert.equal((await outsider.next('error')).message,'Reconnect session not found');
});
test('게임의 실제 MultiplayerClient 소스로 방 생성·참가·행동 전달',async t=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const source=fs.readFileSync(path.join(__dirname,'../js/multiplayer.js'),'utf8');
  function client(){
    const window={MULTIPLAYER_CONFIG:{url:base.replace(/^http/,'ws'),transport:'cloudflare'},serializeGameState:()=>({turn:'w',test:true})},saved=new Map();
    const sandbox={window,URL,WebSocket,fetch,document:{getElementById:()=>null},location:{hostname:'localhost'},localStorage:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)},setInterval,clearInterval,setTimeout,clearTimeout};
    vm.createContext(sandbox);vm.runInContext(source,sandbox);t.after(()=>window.multiplayer.leave());return window.multiplayer;
  }
  function roomReady(client){return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Client room timeout')),15000);client.onStatus=status=>{if(status.status==='room'){clearTimeout(timer);resolve();}else if(status.status==='error'){clearTimeout(timer);reject(Error(status.detail));}};
  });}
  const host=client(),guest=client(),watcher=client();const created=roomReady(host);await host.createRoom();await created;assert.equal(host.role,'host');
  const joined=roomReady(guest);await guest.joinRoom(host.code);await joined;assert.equal(guest.role,'guest');
  const watching=roomReady(watcher);await watcher.joinRoom(host.code);await watching;assert.equal(watcher.role,'spectator');assert.equal(watcher.sendAction({type:'draw'}),false);
  const received=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Action timeout')),8000);host.onAction=action=>{clearTimeout(timer);resolve(action);};});
  guest.sendAction({type:'move',from:'e2',to:'e4'});assert.equal((await received).to,'e4');
});

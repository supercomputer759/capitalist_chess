// 브라우저 클라이언트의 URL 선택·방 전환·재접속 메시지를 실제 소스로 검사합니다.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/multiplayer.js'),'utf8');
function environment(options={}){
  const sockets=[],requests=[],stored=new Map(Object.entries(options.stored||{})),intervals=new Map();let serial=0;
  class Socket{
    constructor(url){this.url=url;this.readyState=0;this.sent=[];sockets.push(this);queueMicrotask(()=>{this.readyState=1;this.onopen?.();});}
    send(raw){this.sent.push(JSON.parse(raw));}close(){this.readyState=3;this.onclose?.();}
  }
  const window={MULTIPLAYER_CONFIG:{url:'wss://chess.example',transport:'cloudflare'},...options.window};
  const sandbox={window,URL,WebSocket:Socket,document:{getElementById:()=>null},location:{hostname:options.hostname||'game.example'},localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},setInterval(fn){const id=++serial;intervals.set(id,fn);return id;},clearInterval(id){intervals.delete(id);},setTimeout:()=>++serial,clearTimeout(){},fetch:async(url,init)=>{requests.push({url,init});return {ok:true,json:async()=>({code:'ABCDEF',createToken:'reservation'})};}};
  vm.createContext(sandbox);vm.runInContext(source,sandbox);
  return {client:window.multiplayer,window,stored,sockets,requests,intervals};
}
test('생성: HTTP 예약 후 방 전용 WebSocket으로 연결',async()=>{
  const e=environment();await e.client.createRoom();assert.equal(e.requests[0].url,'https://chess.example/rooms');assert.equal(e.requests[0].init.method,'POST');assert.equal(e.sockets[0].url,'wss://chess.example/rooms/ABCDEF');assert.equal(e.sockets[0].sent[0].createToken,'reservation');
});
test('다른 방 입장: 기존 소켓을 닫고 새 코드 경로로 연결',async()=>{
  const e=environment();await e.client.joinRoom('abcdef');const old=e.sockets[0];await e.client.watchRoom('ghjkmn');assert.equal(old.readyState,3);assert.equal(e.sockets[1].url,'wss://chess.example/rooms/GHJKMN');assert.equal(e.sockets[1].sent[0].type,'watch');
});
test('새 서버로 전환 시 Render 주소·예전 방 세션 무시',async()=>{
  const e=environment({stored:{capitalistChessMultiplayerUrl:'wss://capitalist-chess.onrender.com',capitalistChessMultiplayerSession:JSON.stringify({code:'OLDOLD',token:'old',role:'host'})}});
  assert.equal(e.client.code,'');await e.client.joinRoom('ABCDEF');assert.equal(e.sockets[0].url,'wss://chess.example/rooms/ABCDEF');
});
test('로컬 게임도 배포된 클플 서버 사용, 명시적 서버 주소는 우선 적용',async()=>{
  const local=environment({hostname:'localhost'});await local.client.joinRoom('ABCDEF');assert.equal(local.sockets[0].url,'wss://chess.example/rooms/ABCDEF');
  const development=environment({hostname:'localhost',window:{MULTIPLAYER_CONFIG:{url:'',transport:'cloudflare'}}});await development.client.joinRoom('ABCDEF');assert.equal(development.sockets[0].url,'ws://localhost:8080/rooms/ABCDEF');
  const custom=environment({window:{MULTIPLAYER_SERVER_URL:'https://custom.example'}});await custom.client.joinRoom('ABCDEF');assert.equal(custom.sockets[0].url,'wss://custom.example/rooms/ABCDEF');
});
test('생존 확인 메시지는 토큰 없는 정확한 자동 응답 형식',async()=>{
  const e=environment();await e.client.joinRoom('ABCDEF');e.client.token='secret';for(const fn of e.intervals.values())fn();const heartbeat=e.sockets[0].sent.at(-1);assert.equal(JSON.stringify(heartbeat),'\u007b"type":"heartbeat"\u007d');
});
test('같은 서버 세션은 재접속, 관전자는 새 관전 세션으로 복원',async()=>{
  for(const [role,type] of [['host','reconnect'],['spectator','watch']]){
    const e=environment({stored:{capitalistChessMultiplayerSession:JSON.stringify({serverUrl:'wss://chess.example',transport:'cloudflare',code:'ABCDEF',token:'token',role,lastRevision:3})}});
    await e.client.connect();assert.equal(e.sockets[0].sent[0].type,type);assert.equal(e.sockets[0].sent[0].lastRevision,3);
  }
});
test('게스트가 나가도 호스트 세션은 유지',()=>{
  const e=environment();Object.assign(e.client,{code:'ABCDEF',role:'host',token:'host'});e.client.receive(JSON.stringify({type:'guestLeft'}));assert.equal(e.client.role,'host');assert.equal(e.client.token,'host');assert.equal(e.client.status,'waiting');
});
test('기존 Node 서버는 명시적 전송 설정으로 계속 실행 가능',async()=>{
  const e=environment({window:{MULTIPLAYER_SERVER_URL:'ws://localhost:8081',MULTIPLAYER_SERVER_TRANSPORT:'node'}});await e.client.createRoom();assert.equal(e.requests.length,0);assert.equal(e.sockets[0].url,'ws://localhost:8081/');assert.equal(e.sockets[0].sent[0].type,'create');
});
test('만료된 방 재접속은 무한 재시도하지 않고 세션 정리',async()=>{
  const e=environment();await e.client.joinRoom('ABCDEF');Object.assign(e.client,{reconnecting:true,token:'expired',role:'host'});e.client.receive(JSON.stringify({type:'error',message:'Reconnect session not found'}));assert.equal(e.client.token,'');assert.equal(e.client.reconnecting,false);assert.equal(e.client.intentionalDisconnect,true);assert.equal(e.client.status,'error');
});
test('이전 서버의 정원 초과 응답도 같은 연결에서 관전으로 전환',async()=>{
  const e=environment();await e.client.joinRoom('ABCDEF');e.client.receive(JSON.stringify({type:'error',message:'Room is full or waiting for reconnect'}));assert.equal(e.sockets.length,1);assert.equal(e.sockets[0].sent.at(-1).type,'watch');
  e.client.receive(JSON.stringify({type:'watched',code:'ABCDEF',token:'watch-token',role:'spectator'}));assert.equal(e.client.role,'spectator');assert.equal(e.client.pendingEntry,null);
});

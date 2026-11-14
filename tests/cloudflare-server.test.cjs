// 저장 상태·알람·세션 권한을 검사합니다. 실제 런타임 검사는 별도 통합 검사로 실행합니다.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../server/worker.mjs'),'utf8')
  .replace('import { DurableObject } from "cloudflare:workers";','')
  .replace('export default {','globalThis.router = {').replace('export class ChessRoom','class ChessRoom')+'\nglobalThis.ChessRoom=ChessRoom;';
function environment(){
  let now=1000000,serial=0;const saved=new Map(),sockets=[];
  const storage={async get(key){return structuredClone(saved.get(key));},async put(key,value){saved.set(key,structuredClone(value));},async setAlarm(value){this.alarm=value;},async deleteAlarm(){this.alarm=null;},async deleteAll(){saved.clear();}};
  const ctx={storage,blockConcurrencyWhile(fn){return this.ready=fn();},getWebSockets(){return sockets;},setWebSocketAutoResponse(pair){this.autoResponse=pair;}};
  const globals={URL,Response,Request,Headers,TextEncoder,structuredClone,DurableObject:class{},WebSocketRequestResponsePair:class{constructor(request,response){Object.assign(this,{request,response});}},crypto:{randomUUID:()=>`token-${++serial}`},Date:{now:()=>now}};
  vm.createContext(globals);vm.runInContext(source,globals);
  const create=async()=>{const room=new globals.ChessRoom(ctx,{});await ctx.ready;return room;};
  const socket=()=>{let data={connection:`socket-${++serial}`,role:null,token:null};const ws={readyState:1,messages:[],send(raw){this.messages.push(JSON.parse(raw));},close(){this.readyState=3;},serializeAttachment(value){data=structuredClone(value);},deserializeAttachment(){return structuredClone(data);}};sockets.push(ws);return ws;};
  return {ctx,storage,saved,globals,create,socket,advance(ms){now+=ms;}};
}
async function hosted(){
  const e=environment(),room=await e.create();await room.fetch(new Request('https://room.internal/reserve',{method:'POST',body:JSON.stringify({code:'ABCDEF'})}));
  const host=e.socket();await room.handleMessage(host,{type:'create',createToken:room.room.createToken,state:{turn:'w'},revision:1});
  return {...e,room,host};
}
test('리전 고정 없이 Smart Placement와 SQLite Durable Object 설정',()=>{
  const raw=fs.readFileSync(path.join(__dirname,'../server/wrangler.jsonc'),'utf8').replace(/\/\/[^\n]*/g,'');
  const config=JSON.parse(raw);assert.equal(config.placement.mode,'smart');assert.equal(config.placement.region,undefined);assert.deepEqual(config.migrations[0].new_sqlite_classes,['ChessRoom']);
  assert.equal(source.includes('locationHint:'),false);assert.equal(source.includes('.jurisdiction('),false);
});
test('예약 토큰이 있어야 생성 가능, 이미 생성한 방은 덮어쓰지 못함',async()=>{
  const e=await hosted(),other=e.socket();await e.room.handleMessage(other,{type:'create',createToken:'wrong'});assert.equal(other.messages.at(-1).type,'error');assert.equal(e.room.room.state.turn,'w');
});
test('휴면 후 재생성: 저장된 상태·역할·WebSocket attachment 복원',async()=>{
  const e=await hosted(),guest=e.socket();await e.room.handleMessage(guest,{type:'join',code:'ABCDEF'});
  await e.room.handleMessage(e.host,{type:'state',state:{turn:'b',board:['vampire']},revision:2});
  const restored=await e.create();assert.equal(restored.room.revision,2);assert.equal(restored.peer('host'),e.host);
  await restored.handleMessage(guest,{type:'sync'});assert.deepEqual(guest.messages.at(-1).state,{turn:'b',board:['vampire']});
  assert.equal(e.ctx.autoResponse.request,JSON.stringify({type:'heartbeat'}));
});
test('게스트 재접속 유예·만료·슬롯 재사용, 이전 토큰 거부',async()=>{
  const e=await hosted(),guest=e.socket();await e.room.handleMessage(guest,{type:'join'});const token=e.room.room.guestToken;
  guest.close();await e.room.disconnected(guest);assert.equal(e.storage.alarm,1120000);
  const reconnect=e.socket();await e.room.handleMessage(reconnect,{type:'reconnect',token});assert.equal(reconnect.messages.at(-1).type,'reconnected');assert.equal(e.storage.alarm,null);
  reconnect.close();await e.room.disconnected(reconnect);e.advance(120001);await e.room.alarm();assert.equal(e.room.room.guestToken,null);
  const late=e.socket();await e.room.handleMessage(late,{type:'reconnect',token});assert.equal(late.messages.at(-1).type,'error');
  await e.room.handleMessage(late,{type:'join'});assert.equal(late.messages.at(-1).type,'joined');
});
test('호스트 유예 만료: 관전자 포함 방 종료·저장소 정리',async()=>{
  const e=await hosted(),spectator=e.socket();await e.room.handleMessage(spectator,{type:'watch'});e.host.close();await e.room.disconnected(e.host);
  e.advance(120001);const restored=await e.create();await restored.alarm();assert.equal(restored.room,null);assert.equal(e.saved.size,0);assert.equal(e.storage.alarm,null);assert.equal(spectator.messages.at(-1).reason,'hostTimeout');
});
test('방 생성 예약도 만료되면 정리',async()=>{
  const e=environment(),room=await e.create();await room.fetch(new Request('https://room.internal/reserve',{method:'POST',body:JSON.stringify({code:'ABCDEF'})}));e.advance(120001);await room.alarm();assert.equal(room.room,null);
});
test('관전자·게스트의 상태 변경 차단, 다른 세션 토큰 도용 차단',async()=>{
  const e=await hosted(),guest=e.socket();await e.room.handleMessage(guest,{type:'join'});
  await e.room.handleMessage(guest,{type:'state',state:{bad:true},revision:9});assert.equal(e.room.room.revision,1);
  await e.room.handleMessage(guest,{type:'chat',token:e.room.room.hostToken,text:'spoof'});assert.equal(guest.messages.at(-1).type,'error');
  const spectator=e.socket();await e.room.handleMessage(spectator,{type:'watch'});await e.room.handleMessage(spectator,{type:'closeRoom'});assert.ok(e.room.room);
});
test('지연된 이전 소켓 종료가 재접속한 세션을 끊지 않음',async()=>{
  const e=await hosted(),token=e.room.room.hostToken;e.host.close();await e.room.disconnected(e.host);
  const ws=e.socket();await e.room.handleMessage(ws,{type:'reconnect',token});await e.room.disconnected(e.host);assert.equal(e.room.peer('host'),ws);assert.equal(e.room.room.hostDisconnectedAt,null);
});
test('잘못된 JSON·과대 메시지는 방을 깨뜨리지 않고 거부',async()=>{
  const e=await hosted();await e.room.webSocketMessage(e.host,'{');assert.equal(e.host.messages.at(-1).message,'Invalid JSON');
  await e.room.webSocketMessage(e.host,'a'.repeat(524289));assert.match(e.host.messages.at(-1).message,/large/);assert.equal(e.room.room.revision,1);
});
test('참가자가 찬 방·재접속 대기 방은 추가 입장을 관전으로 전환',async()=>{
  const e=await hosted(),guest=e.socket();await e.room.handleMessage(guest,{type:'join'});const token=e.room.room.guestToken;
  for(const disconnected of [false,true]){
    if(disconnected){guest.close();await e.room.disconnected(guest);}
    const watcher=e.socket();await e.room.handleMessage(watcher,{type:'join'});assert.equal(watcher.messages.at(-1).type,'watched');assert.equal(watcher.messages.at(-1).role,'spectator');assert.equal(e.room.room.guestToken,token);
    const explicit=e.socket();await e.room.handleMessage(explicit,{type:'watch'});assert.equal(explicit.messages.at(-1).type,'watched');
  }
});

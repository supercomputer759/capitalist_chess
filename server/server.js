const http=require("http");
const crypto=require("crypto");
const {WebSocketServer}=require("ws");

const PORT=Number(process.env.PORT||8080);
const HEARTBEAT_MS=25_000;
const RECONNECT_GRACE_MS=120_000;
const CODE_CHARS="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const rooms=new Map();
const tokens=new Map();

function roomCode(){let code="";do{code=Array.from({length:6},()=>CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)]).join("");}while(rooms.has(code));return code;}
function send(ws,message){if(ws?.readyState===1)ws.send(JSON.stringify(message));}
function closeRoom(room){
  if(room.graceTimer)clearTimeout(room.graceTimer);
  rooms.delete(room.code);
  for(const token of [room.hostToken,room.guestToken])if(token)tokens.delete(token);
}
function scheduleHostGrace(room){
  if(room.graceTimer)clearTimeout(room.graceTimer);
  room.graceTimer=setTimeout(()=>{if(!room.host)closeRoom(room);},RECONNECT_GRACE_MS);
}
function markDisconnected(room,role,ws){
  if(role==="host"&&room.host===ws){room.host=null;room.hostDisconnectedAt=Date.now();send(room.guest,{type:"hostDisconnected",graceMs:RECONNECT_GRACE_MS});scheduleHostGrace(room);}
  if(role==="guest"&&room.guest===ws){room.guest=null;room.guestDisconnectedAt=Date.now();send(room.host,{type:"guestDisconnected",graceMs:RECONNECT_GRACE_MS});if(room.guestGraceTimer)clearTimeout(room.guestGraceTimer);room.guestGraceTimer=setTimeout(()=>{if(!room.guest&&room.guestToken){tokens.delete(room.guestToken);room.guestToken=null;}},RECONNECT_GRACE_MS);}
}
function attachSocket(ws,room,role,token){
  ws.room=room;ws.role=role;ws.token=token;tokens.set(token,{room,role});
}
function handleMessage(ws,message){
  if(!message||typeof message.type!=="string")return;
  if(message.type==="create"){
    const code=roomCode(),token=crypto.randomUUID(),room={code,host:ws,guest:null,hostToken:token,guestToken:null,createdAt:Date.now(),lastActivity:Date.now(),state:message.state||null,revision:Number(message.revision||0),graceTimer:null};
    rooms.set(code,room);attachSocket(ws,room,"host",token);return send(ws,{type:"roomCreated",code,token,role:"host",revision:room.revision});
  }
  if(message.type==="join"){
    const code=String(message.code||"").toUpperCase(),room=rooms.get(code);
    if(!room)return send(ws,{type:"error",message:"Room not found"});
    if(room.guest||room.guestToken)return send(ws,{type:"error",message:"Room is full or waiting for reconnect"});
    const token=crypto.randomUUID();if(room.guestGraceTimer)clearTimeout(room.guestGraceTimer);room.guestGraceTimer=null;room.guest=ws;room.guestToken=token;room.guestDisconnectedAt=null;room.lastActivity=Date.now();attachSocket(ws,room,"guest",token);
    send(ws,{type:"joined",code,token,role:"guest",state:room.state,revision:room.revision});send(room.host,{type:"guestJoined"});return;
  }
  if(message.type==="reconnect"){
    const code=String(message.code||"").toUpperCase(),session=tokens.get(String(message.token||"")),room=rooms.get(code);
    if(!room||!session||session.room!==room)return send(ws,{type:"error",message:"Reconnect session not found"});
    const role=session.role,slot=role==="host"?"host":"guest";
    if(room[slot])return send(ws,{type:"error",message:"Player slot is already connected"});
    attachSocket(ws,room,role,message.token);room.lastActivity=Date.now();room[slot]=ws;
    if(role==="host"){if(room.graceTimer)clearTimeout(room.graceTimer);room.graceTimer=null;room.hostDisconnectedAt=null;send(room.guest,{type:"hostReconnected"});}
    else{room.guestDisconnectedAt=null;send(room.host,{type:"guestReconnected"});}
    return send(ws,{type:"reconnected",code,token:message.token,role,state:room.state,revision:room.revision,lastRevision:Number(message.lastRevision||0)});
  }
  const session=tokens.get(String(message.token||ws.token||"")),room=session?.room;
  if(!room||session.role!==ws.role)return send(ws,{type:"error",message:"Not connected to a room"});
  room.lastActivity=Date.now();
  if(message.type==="heartbeat")return send(ws,{type:"heartbeatAck",at:Date.now()});
  if(message.type==="leave"){
    const role=session.role;ws.explicitLeave=true;tokens.delete(ws.token);if(role==="host"){send(room.guest,{type:"hostLeft"});closeRoom(room);}else{room.guest=null;room.guestToken=null;send(room.host,{type:"guestLeft"});}return ws.close();
  }
  if(message.type==="state"&&session.role==="host"){
    room.state=message.state;room.revision=Number(message.revision||room.revision);return send(room.guest,{type:"state",revision:room.revision,state:room.state});
  }
  if(message.type==="action"&&session.role==="guest")return send(room.host,{type:"action",action:message.action,token:ws.token});
  if(message.type==="sync")return send(ws,{type:"state",revision:room.revision,state:room.state});
}
function setupSocket(ws){
  ws.isAlive=true;ws.on("pong",()=>{ws.isAlive=true;});
  ws.on("message",raw=>{let message;try{message=JSON.parse(String(raw));}catch(_){return send(ws,{type:"error",message:"Invalid JSON"});}try{handleMessage(ws,message);}catch(error){send(ws,{type:"error",message:error.message||"Server error"});}});
  ws.on("close",()=>{if(ws.room&&!ws.explicitLeave)markDisconnected(ws.room,ws.role,ws);});
}
const httpServer=http.createServer((req,res)=>{res.writeHead(200,{"content-type":"text/plain; charset=utf-8"});res.end("Capitalist Chess room server\n");});
const wss=new WebSocketServer({server:httpServer});wss.on("connection",setupSocket);
setInterval(()=>{for(const ws of wss.clients){if(ws.isAlive===false){ws.terminate();continue;}ws.isAlive=false;ws.ping();}},HEARTBEAT_MS);
httpServer.listen(PORT,()=>console.log(`[MP] room server listening on ws://localhost:${PORT}`));

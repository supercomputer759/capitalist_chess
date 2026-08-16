const http=require("http");
const crypto=require("crypto");
const {WebSocketServer}=require("ws");

const PORT=Number(process.env.PORT||8080);
const CODE_CHARS="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const rooms=new Map();
const tokens=new Map();

function roomCode(){
  let code="";
  do{code=Array.from({length:6},()=>CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)]).join("");}while(rooms.has(code));
  return code;
}
function send(ws,message){if(ws?.readyState===1)ws.send(JSON.stringify(message));}
function closeRoom(room){rooms.delete(room.code);for(const token of [room.hostToken,room.guestToken])if(token)tokens.delete(token);}
function safeMessage(ws){
  ws.on("message",raw=>{
    let message;try{message=JSON.parse(String(raw));}catch(_){return send(ws,{type:"error",message:"Invalid JSON"});}
    if(!message||typeof message.type!=="string")return;
    if(message.type==="create"){
      const code=roomCode(),token=crypto.randomUUID(),room={code,host:ws,guest:null,hostToken:token,guestToken:null,createdAt:Date.now(),lastActivity:Date.now(),state:null};
      rooms.set(code,room);tokens.set(token,{room,role:"host"});ws.room=room;ws.token=token;
      if(message.state)room.state=message.state;
      return send(ws,{type:"roomCreated",code,token,role:"host"});
    }
    if(message.type==="join"){
      const code=String(message.code||"").toUpperCase(),room=rooms.get(code);
      if(!room)return send(ws,{type:"error",message:"Room not found"});
      if(room.guest)return send(ws,{type:"error",message:"Room is full"});
      const token=crypto.randomUUID();room.guest=ws;room.guestToken=token;room.lastActivity=Date.now();tokens.set(token,{room,role:"guest"});ws.room=room;ws.token=token;
      send(ws,{type:"joined",code,token,role:"guest",state:room.state});send(room.host,{type:"guestJoined"});
      return;
    }
    const session=tokens.get(message.token||ws.token),room=session?.room;
    if(!room)return send(ws,{type:"error",message:"Not connected to a room"});
    room.lastActivity=Date.now();
    if(message.type==="state"&&session.role==="host"){
      room.state=message.state;return send(room.guest,{type:"state",revision:message.revision,state:room.state});
    }
    if(message.type==="action"&&session.role==="guest")return send(room.host,{type:"action",action:message.action,token:ws.token});
    if(message.type==="sync")return send(ws,{type:"state",revision:message.revision,state:room.state});
  });
  ws.on("close",()=>{
    const room=ws.room;if(!room)return;
    if(room.host===ws){send(room.guest,{type:"hostDisconnected"});closeRoom(room);}
    else if(room.guest===ws){room.guest=null;room.guestToken=null;send(room.host,{type:"guestDisconnected"});}
  });
}
const httpServer=http.createServer((req,res)=>{res.writeHead(200,{"content-type":"text/plain; charset=utf-8"});res.end("Capitalist Chess room server\n");});
const wss=new WebSocketServer({server:httpServer});wss.on("connection",safeMessage);
httpServer.listen(PORT,()=>console.log(`[MP] room server listening on ws://localhost:${PORT}`));

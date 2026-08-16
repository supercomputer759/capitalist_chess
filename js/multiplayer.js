(function(){
  "use strict";
  const DEFAULT_URL=window.MULTIPLAYER_SERVER_URL||((location.protocol==="https:"?"wss://":"ws://")+location.hostname+":8080");
  class MultiplayerClient{
    constructor(){this.socket=null;this.role=null;this.code="";this.token="";this.status="offline";this.stateRevision=0;this.onStatus=null;this.onAction=null;this.onState=null;}
    setStatus(status,detail=""){this.status=status;this.onStatus?.({status,detail});this.renderStatus(status,detail);}
    connect(){
      if(this.socket?.readyState===1)return Promise.resolve();
      return new Promise((resolve,reject)=>{
        const socket=new WebSocket(DEFAULT_URL);this.socket=socket;
        socket.onopen=()=>{this.setStatus("connected");resolve();};
        socket.onerror=()=>{this.setStatus("error","서버 연결 실패");reject(new Error("Multiplayer server connection failed"));};
        socket.onclose=()=>{this.setStatus("offline","연결 종료");};
        socket.onmessage=e=>this.receive(e.data);
      });
    }
    send(message){if(this.socket?.readyState!==1)throw new Error("멀티플레이 서버에 연결되지 않았어.");this.socket.send(JSON.stringify({...message,token:this.token}));}
    async createRoom(){await this.connect();this.send({type:"create",state:window.serializeGameState?.()||null});}
    async joinRoom(code){await this.connect();this.send({type:"join",code:String(code||"").trim().toUpperCase()});}
    sendAction(action){if(this.role!=="guest")return false;this.send({type:"action",action});return true;}
    sendState(state){if(this.role!=="host")return false;this.send({type:"state",revision:state?.revision||0,state});return true;}
    requestSync(){this.send({type:"sync",revision:this.stateRevision});}
    receive(raw){
      let message;try{message=JSON.parse(raw);}catch(_){return;}
      if(message.type==="roomCreated"||message.type==="joined"){
        this.code=message.code;this.token=message.token;this.role=message.role;this.setStatus("room",`${this.code} · ${this.role}`);
        if(message.state&&this.onState)this.onState(message.state,message.revision||0);this.updateRoomUI();return;
      }
      if(message.type==="guestJoined")return this.setStatus("room","상대방 연결됨");
      if(message.type==="guestDisconnected")return this.setStatus("room","상대방 연결 종료");
      if(message.type==="hostDisconnected")return this.setStatus("error","호스트 연결 종료");
      if(message.type==="state"){this.stateRevision=Number(message.revision||0);this.onState?.(message.state,this.stateRevision);return;}
      if(message.type==="action"){this.onAction?.(message.action,message.token);return;}
      if(message.type==="error")this.setStatus("error",message.message||"멀티플레이 오류");
    }
    renderStatus(status,detail){const el=document.getElementById("multiplayerStatus");if(el)el.textContent=detail||({offline:"오프라인",connected:"서버 연결됨",room:"방 연결됨",error:"연결 오류"}[status]||status);}
    updateRoomUI(){const code=document.getElementById("roomCodeValue");if(code)code.textContent=this.code||"-";const role=document.getElementById("multiplayerRole");if(role)role.textContent=this.role==="host"?"Host · 백":"Guest · 흑";}
    bindUI(){
      const modal=document.getElementById("multiplayerModal");
      document.getElementById("multiplayerOpenBtn")?.addEventListener("click",()=>modal?.classList.remove("hidden"));
      document.getElementById("multiplayerCloseBtn")?.addEventListener("click",()=>modal?.classList.add("hidden"));
      modal?.addEventListener("click",event=>{if(event.target===modal)modal.classList.add("hidden");});
      document.getElementById("createRoomBtn")?.addEventListener("click",()=>this.createRoom().catch(error=>this.setStatus("error",error.message)));
      document.getElementById("joinRoomBtn")?.addEventListener("click",()=>this.joinRoom(document.getElementById("roomCodeInput")?.value).catch(error=>this.setStatus("error",error.message)));
      document.getElementById("copyRoomCodeBtn")?.addEventListener("click",()=>{if(this.code)navigator.clipboard?.writeText(this.code);});
      this.renderStatus(this.status);this.updateRoomUI();
    }
  }
  window.MultiplayerClient=MultiplayerClient;window.multiplayer=new MultiplayerClient();
})();

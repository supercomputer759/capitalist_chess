(function(){
  "use strict";
  function text(key,fallback,values={}){return window.GameLanguage?.text(key,fallback,values)??fallback;}
  let savedUrl="";try{savedUrl=localStorage.getItem("capitalistChessMultiplayerUrl")||"";}catch(_){ }
  const isLocalHost=["localhost","127.0.0.1","::1"].includes(location.hostname);
  const SERVER_URL=window.MULTIPLAYER_SERVER_URL||(savedUrl||(isLocalHost?"ws://localhost:8080":"wss://capitalist-chess.onrender.com"));
  const SESSION_KEY="capitalistChessMultiplayerSession";
  class MultiplayerClient{
    constructor(){
      this.socket=null;this.role=null;this.code="";this.token="";this.status="offline";this.stateRevision=0;
      this.onStatus=null;this.onAction=null;this.onState=null;this.onChat=null;this.reconnectTimer=null;this.reconnectAttempt=0;this.intentionalDisconnect=false;this.reconnecting=false;this.heartbeatTimer=null;this.lastHeartbeatAck=0;
      this.restoreSession();
    }
    restoreSession(){try{const saved=JSON.parse(localStorage.getItem(SESSION_KEY)||"{}");this.code=saved.code||"";this.token=saved.token||"";this.role=saved.role||null;this.stateRevision=Number(saved.lastRevision||0);}catch(_){this.clearSession();}}
    saveSession(){try{localStorage.setItem(SESSION_KEY,JSON.stringify({code:this.code,token:this.token,role:this.role,lastRevision:this.stateRevision}));}catch(_){}}
    clearSession(){this.code="";this.token="";this.role=null;this.stateRevision=0;try{localStorage.removeItem(SESSION_KEY);}catch(_){}this.updateRoomUI();}
    setStatus(status,detail=""){this.status=status;this.onStatus?.({status,detail});this.renderStatus(status,detail);this.updateChatUI();}
    connect(){
      if(this.socket?.readyState===1)return Promise.resolve();
      if(this.socket?.readyState===0)return this._connectPromise;
      if(!SERVER_URL){const error=new Error(text("network.noServer","배포 사이트에 WebSocket 서버 주소가 설정되지 않았어."));this.setStatus("error",error.message);return Promise.reject(error);}
      this.intentionalDisconnect=false;this.setStatus(this.reconnecting?"reconnecting":"connecting",this.reconnecting?text("network.reconnectingDetail","재연결 중..."):text("network.connectingDetail","서버 연결 중..."));
      this._connectPromise=new Promise((resolve,reject)=>{
        const socket=new WebSocket(SERVER_URL);this.socket=socket;let opened=false;
        socket.onopen=()=>{opened=true;this.startHeartbeat();this.reconnectAttempt=0;this.setStatus("connected");
          if(this.code&&this.token){this.setStatus("reconnecting",text("network.reconnectingDetail","재연결 중..."));this.sendRaw({type:"reconnect",code:this.code,token:this.token,lastRevision:this.stateRevision});}
          resolve();
        };
        socket.onerror=()=>{if(!opened)reject(new Error("Multiplayer server connection failed"));if(!this.intentionalDisconnect&&this.code&&this.token)this.setStatus("booting",text("network.bootingDetail","서버 부팅 중…"));else this.setStatus("error",text("network.failed","서버 연결 실패"));};
        socket.onclose=()=>{this.stopHeartbeat();this.socket=null;if(!this.intentionalDisconnect&&this.code&&this.token){this.setStatus("booting",text("network.bootingDetail","서버 부팅 중…"));this.scheduleReconnect();}else this.setStatus("offline",text("network.closed","방 연결이 종료됐어."));};
        socket.onmessage=e=>this.receive(e.data);
      }).finally(()=>{this._connectPromise=null;});
      return this._connectPromise;
    }
    sendRaw(message){if(this.socket?.readyState===1)this.socket.send(JSON.stringify({...message,token:this.token}));}
    send(message){if(this.socket?.readyState!==1)throw new Error(text("network.notConnected","멀티플레이 서버에 연결되지 않았어."));this.sendRaw(message);}
    startHeartbeat(){this.stopHeartbeat();this.heartbeatTimer=setInterval(()=>{if(this.socket?.readyState===1)this.sendRaw({type:"heartbeat"});},25_000);}
    stopHeartbeat(){if(this.heartbeatTimer){clearInterval(this.heartbeatTimer);this.heartbeatTimer=null;}}
    scheduleReconnect(){
      if(this.intentionalDisconnect||this.reconnectTimer||!this.code||!this.token)return;
      const delay=Math.min(10000,1000*Math.pow(2,this.reconnectAttempt++));
      this.reconnecting=true;this.setStatus("connecting",text("network.connectingDetail","서버에 연결 중…"));
      this.reconnectTimer=setTimeout(()=>{this.reconnectTimer=null;this.connect().catch(()=>this.scheduleReconnect());},delay);
    }
    async createRoom(){this.cancelReconnect();this.clearSession();await this.connect();this.send({type:"create",state:window.serializeGameState?.()||null,revision:window.gameState?.engineRevision||0});}
    async joinRoom(code){this.cancelReconnect();this.clearSession();this.code=String(code||"").trim().toUpperCase();if(!this.code)throw new Error(text("network.codeRequired","방 코드를 입력해줘."));await this.connect();this.send({type:"join",code:this.code});}
    async watchRoom(code){this.cancelReconnect();this.clearSession();this.code=String(code||"").trim().toUpperCase();if(!this.code)throw new Error(text("network.codeRequired","방 코드를 입력해줘."));await this.connect();this.send({type:"watch",code:this.code});}
    sendAction(action){if(this.role!=="guest")return false;this.send({type:"action",action});return true;}
    sendChat(text){const value=String(text||"").trim().slice(0,200);if(!value||!this.code||!this.token||this.socket?.readyState!==1)return false;this.send({type:"chat",text:value});return true;}
    resign(){if(this.role!=="host"&&this.role!=="guest")return false;this.sendAction({type:"resign"});return true;}
    closeRoom(){if(this.role!=="host"||this.socket?.readyState!==1)return false;this.send({type:"closeRoom"});return true;}
    sendState(state){if(this.role!=="host")return false;this.stateRevision=Number(state?.revision||0);this.saveSession();this.send({type:"state",revision:this.stateRevision,state});return true;}
    sendOrbitalStrikeResult(result){if(this.role!=="host")return false;this.send({type:"orbitalStrikeResult",result});return true;}
    requestSync(){this.send({type:"sync",revision:this.stateRevision});}
    cancelReconnect(){if(this.reconnectTimer){clearTimeout(this.reconnectTimer);this.reconnectTimer=null;}this.reconnectAttempt=0;this.reconnecting=false;}
    leave(){this.intentionalDisconnect=true;this.cancelReconnect();try{this.send({type:"leave"});}catch(_){}this.stopHeartbeat();this.socket?.close();this.socket=null;this.clearSession();this.setStatus("offline",text("network.left","방 나감"));}
    receive(raw){
      let message;try{message=JSON.parse(raw);}catch(_){return;}
      if(message.type==="heartbeatAck"){this.lastHeartbeatAck=Number(message.at||Date.now());return;}
      if(message.type==="roomCreated"||message.type==="joined"||message.type==="watched"||message.type==="reconnected"){
        this.code=message.code||this.code;this.token=message.token||this.token;this.role=message.role||this.role;this.stateRevision=Number(message.revision||this.stateRevision);this.reconnecting=false;this.reconnectAttempt=0;this.saveSession();this.setStatus("room",`${this.code} · ${this.role}`);this.updateRoomUI();
        if(message.state)this.onState?.(message.state,this.stateRevision);
        return;
      }
      if(message.type==="guestJoined")return this.setStatus("room",text("network.opponentConnected","상대방 연결됨"));
      if(message.type==="hostReconnected")return this.setStatus("room",text("network.opponentConnected","상대방 연결됨"));
      if(message.type==="guestReconnected")return this.setStatus("room",text("network.opponentConnected","상대방 연결됨"));
      if(message.type==="guestDisconnected")return this.setStatus("waiting",text("network.waitingOpponent","상대 재접속 기다리는 중..."));
      if(message.type==="hostDisconnected")return this.setStatus("waiting",text("network.waitingOpponent","상대 재접속 기다리는 중..."));
      if(message.type==="hostLeft"||message.type==="guestLeft"){this.clearSession();return this.setStatus("offline",text("network.opponentLeft","상대가 방을 나갔어."));}
      if(message.type==="roomClosed"){this.intentionalDisconnect=true;this.cancelReconnect();this.socket?.close();this.clearSession();return this.setStatus("offline",message.reason==="hostTimeout"?text("network.hostTimeout","방장이 돌아오지 않아 방이 종료됐어."):text("network.roomClosed","방이 종료됐어."));}
      if(message.type==="state"){this.stateRevision=Number(message.revision||0);this.saveSession();this.onState?.(message.state,this.stateRevision);return;}
      if(message.type==="orbitalStrikeResult"){window.handleOrbitalStrikeResult?.(message.result);return;}
      if(message.type==="action"){this.onAction?.(message.action,message.token);return;}
      if(message.type==="chat"){this.onChat?.(message);return;}
      if(message.type==="spectatorCount"){this.setStatus("room",text("network.spectatorCount","관전자 {count}명",{count:message.count||0}));return;}
      if(message.type==="error"){this.setStatus("error",message.message||text("network.multiplayerError","멀티플레이 오류"));if(this.reconnecting){this.intentionalDisconnect=false;this.socket?.close();}}
    }
    renderStatus(status){const el=document.getElementById("lobbyInternetStatus");if(el)el.textContent=({offline:text("network.offline","인터넷: 오프라인"),booting:text("network.booting","인터넷: 서버 부팅 중…"),connecting:text("network.connecting","인터넷: 서버에 연결 중…"),connected:text("network.connected","인터넷: 연결됨"),reconnecting:text("network.reconnecting","인터넷: 재연결 중…"),waiting:text("network.connected","인터넷: 연결됨"),room:text("network.connected","인터넷: 연결됨"),error:text("network.error","인터넷: 연결 오류")}[status]||`인터넷: ${status||"확인 중"}`);}
    updateRoomUI(){const roleLabel=this.role==="host"?text("network.hostLabel","Host · 백"):this.role==="guest"?text("network.guestLabel","Guest · 흑"):this.role==="spectator"?text("network.spectatorLabel","Spectator · 관전자"):text("lobby.localGame","로컬 게임");const active=Boolean(this.code&&this.token&&this.role);const status=document.getElementById("lobbyRoomStatus");if(status)status.textContent=active?`${this.code} · ${roleLabel}`:text("network.roomPrompt","방을 만들거나 코드를 입력해 입장해.");const resign=document.getElementById("resignBtn"),close=document.getElementById("closeRoomBtn");if(resign)resign.disabled=!active||this.role==="spectator";if(close)close.disabled=!active||this.role!=="host";}
    appendChatMessage(message){const list=document.getElementById("chatMessages");if(!list)return;const item=document.createElement("div");item.className=`chat-message ${message.from===this.role?"mine":"theirs"}`;const name=document.createElement("b");name.textContent=message.from==="host"?text("game.white","백"):message.from==="guest"?text("game.black","흑"):text("chat.spectator","관전자");name.dataset.i18n=message.from==="host"?"game.white":message.from==="guest"?"game.black":"chat.spectator";const content=document.createElement("span");content.textContent=message.text;item.append(name,content);list.appendChild(item);list.scrollTop=list.scrollHeight;}
    bindUI(){
      document.getElementById("chatForm")?.addEventListener("submit",event=>{event.preventDefault();const input=document.getElementById("chatInput");if(this.sendChat(input?.value)){input.value="";input.focus();}});
      this.onChat=message=>this.appendChatMessage(message);
      this.renderStatus(this.status);this.updateRoomUI();
    }
    updateChatUI(){const active=Boolean(this.code&&this.token&&this.role);const input=document.getElementById("chatInput"),button=document.getElementById("chatSendBtn"),state=document.getElementById("chatState");if(input)input.disabled=!active;if(button)button.disabled=!active;if(state)state.textContent=active?(this.status==="waiting"?text("chat.waiting","상대 재접속 대기 중"):text("chat.online","온라인 방 채팅")):(this.status==="offline"?text("chat.afterConnect","방 연결 후 사용"):"서버 연결 중…");}
  }
  window.MultiplayerClient=MultiplayerClient;window.multiplayer=new MultiplayerClient();
  window.setMultiplayerServerUrl=url=>{try{localStorage.setItem("capitalistChessMultiplayerUrl",String(url||""));}catch(_){ }location.reload();};
})();

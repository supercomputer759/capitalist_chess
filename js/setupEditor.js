(function(root){
  "use strict";
  const STORAGE="capitalistChessCustomBoard";
  const labels={edit:"배치 편집",title:"커스텀 시작 배치",whiteMoney:"백 초기 자금",blackMoney:"흑 초기 자금",color:"배치할 진영",erase:"지우개",clear:"모두 지우기",standard:"기본 배치 불러오기",save:"배치 적용",cancel:"취소",castling:"초기 킹·룩의 캐슬링 허용",invalid:"각 진영에 진짜 킹 역할 기물이 정확히 1개씩 있어야 합니다. 초기 자금은 0~1,000,000 사이의 정수로 입력해 주세요.",hint:"기물을 고른 뒤 칸을 클릭하면 배치됩니다. 지우개를 고르거나 칸을 우클릭하면 제거됩니다."};
  const text=key=>root.GameLanguage?.text(`setup.${key}`,labels[key])??labels[key];
  const royal=(piece,definitions)=>piece.type==="k"||Boolean(piece.specialId&&(definitions[piece.specialId]?.countsAsKing||definitions[piece.specialId]?.abilities?.some(a=>a.id==="royal_unit"&&a.params?.countsAsKing)));
  function normalize(input,definitions){
    if(!input||!Array.isArray(input.pieces)||input.pieces.length>64)return null;
    const used=new Set(),pieces=[];
    for(const p of input.pieces){
      if(!["w","b"].includes(p.color)||!Number.isInteger(p.r)||!Number.isInteger(p.c)||p.r<0||p.r>7||p.c<0||p.c>7)return null;
      if(p.specialId?!Object.hasOwn(definitions,p.specialId):!["p","n","b","r","q","k"].includes(p.type))return null;
      const key=p.r*8+p.c;if(used.has(key))return null;used.add(key);
      pieces.push({r:p.r,c:p.c,color:p.color,type:p.specialId?"special":p.type,...(p.specialId?{specialId:p.specialId}:{})});
    }
    for(const color of ["w","b"])if(pieces.filter(p=>p.color===color&&royal(p,definitions)).length!==1)return null;
    const money={};for(const color of ["w","b"]){const n=input.money?.[color];if(!Number.isSafeInteger(n)||n<0||n>1000000)return null;money[color]=n;}
    return {pieces,money,castling:input.castling===true};
  }
  let host,modal,draft,background=[],selection={type:"p"},color="w";
  const definitions=()=>Object.fromEntries(root.SpecialPieces.list().map(def=>[def.id,def]));
  function defaults(){return {pieces:[{r:7,c:4,type:"k",color:"w"},{r:0,c:4,type:"k",color:"b"}],money:{w:1600,b:1600},castling:true};}
  function saved(){try{return normalize(JSON.parse(localStorage.getItem(STORAGE)),definitions())||defaults();}catch(_){return defaults();}}
  function initialBoard(config,createStandard,createSpecial){
    const board=Array.from({length:8},()=>Array(8).fill(null));
    for(const p of config.pieces){
      const unit=p.specialId?createSpecial(p.specialId,p.color):createStandard(p.type,p.color);
      board[p.r][p.c]={...unit,moved:false,purchaseLocked:false,active:true,attackLockedTurns:0,
        castleEligible:!p.specialId&&["r","k"].includes(p.type)&&config.castling};
    }
    return board;
  }
  function node(tag,parent,value){const el=document.createElement(tag);if(value!==undefined)el.textContent=value;parent?.appendChild(el);return el;}
  function button(parent,label,handler){const el=node("button",parent,label);el.type="button";el.onclick=handler;return el;}
  function close(){modal?.remove();modal=null;background.forEach(([element,inert])=>{element.inert=inert;});background=[];document.removeEventListener("keydown",onKey);document.getElementById("editCustomSetup")?.focus();}
  function onKey(event){if(event.key==="Escape")close();}
  function paint(){
    const board=modal.querySelector(".setup-board");board.replaceChildren();
    for(let r=0;r<8;r++)for(let c=0;c<8;c++){
      const square=button(board,"",()=>{
        draft.pieces=draft.pieces.filter(p=>p.r!==r||p.c!==c);
        if(selection)draft.pieces.push({r,c,color,...selection});paint();
      });
      square.className=`setup-square ${(r+c)%2?"dark":"light"}`;
      square.setAttribute("aria-label",`${"abcdefgh"[c]}${8-r}`);
      const unit=draft.pieces.find(p=>p.r===r&&p.c===c);if(unit)square.innerHTML=host.image(unit);
      square.oncontextmenu=event=>{event.preventDefault();draft.pieces=draft.pieces.filter(p=>p.r!==r||p.c!==c);paint();};
    }
    modal.querySelectorAll("[data-setup-piece]").forEach(el=>el.classList.toggle("active",el.dataset.setupPiece===(selection?.specialId||selection?.type||"erase")));
    host.fallbacks?.(modal);
  }
  function open(){
    if(host.state.started||["guest","spectator"].includes(host.role()))return;
    close();draft=JSON.parse(JSON.stringify(host.state.customSetup||saved()));
    background=[...document.body.children].map(element=>[element,element.inert]);background.forEach(([element])=>{element.inert=true;});
    modal=node("div",document.body);modal.className="setup-editor-overlay";modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.setAttribute("aria-label",text("title"));
    const card=node("div",modal);card.className="setup-editor-card";node("h2",card,text("title"));node("p",card,text("hint"));
    const body=node("div",card);body.className="setup-editor-body";
    node("div",body).className="setup-board";
    const controls=node("div",body);controls.className="setup-tools";
    const sideLabel=node("label",controls,text("color")),side=node("select",sideLabel);
    for(const value of ["w","b"]){const option=node("option",side,host.sideName(value));option.value=value;}side.value=color;side.onchange=()=>{color=side.value;};
    for(const side of ["w","b"]){const label=node("label",controls,text(side==="w"?"whiteMoney":"blackMoney"));const input=node("input",label);input.type="number";input.min="0";input.max="1000000";input.step="100";input.value=draft.money[side];input.oninput=()=>{draft.money[side]=Number(input.value);};}
    const castleLabel=node("label",controls),castle=node("input",castleLabel);castle.type="checkbox";castle.checked=draft.castling;castle.onchange=()=>{draft.castling=castle.checked;};node("span",castleLabel,text("castling"));
    const palette=node("div",controls);palette.className="setup-palette";
    for(const type of ["p","n","b","r","q","k"]){const el=button(palette,"",()=>{selection={type};paint();});el.dataset.setupPiece=type;el.innerHTML=host.image({type,color:"w"});el.title=host.standardName(type);el.setAttribute("aria-label",el.title);}
    for(const def of root.SpecialPieces.list()){const el=button(palette,"",()=>{selection={type:"special",specialId:def.id};paint();});el.dataset.setupPiece=def.id;el.innerHTML=host.image({type:"special",specialId:def.id,color:"w"});el.title=host.specialName(def);el.setAttribute("aria-label",el.title);}
    const erase=button(controls,text("erase"),()=>{selection=null;paint();});erase.dataset.setupPiece="erase";
    button(controls,text("clear"),()=>{draft.pieces=[];paint();});
    button(controls,text("standard"),()=>{const board=root.ChessRules.initialBoard(true,(type,color)=>({type,color}));draft.pieces=board.flatMap((row,r)=>row.flatMap((p,c)=>p?[{r,c,type:p.type,color:p.color}]:[]));paint();});
    const status=node("p",card);status.setAttribute("role","status");
    const actions=node("div",card);actions.className="setup-editor-actions";
    button(actions,text("cancel"),close);
    button(actions,text("save"),()=>{
      const config=normalize(draft,definitions());if(!config){status.textContent=text("invalid");return;}
      host.state.customSetup=config;host.setMode("custom");
      try{localStorage.setItem(STORAGE,JSON.stringify(config));localStorage.setItem("capitalistChessStartMode","custom");}catch(_){}
      close();host.publish();
    });
    document.addEventListener("keydown",onKey);paint();side.focus();
  }
  function init(adapter){
    host=adapter;document.getElementById("editCustomSetup").addEventListener("click",open);
    const select=document.getElementById("lobbyBoardSetup");
    if(!host.state.started&&!["guest","spectator"].includes(host.role()))try{
      const mode=localStorage.getItem("capitalistChessStartMode");
      if(["kings","standard","custom"].includes(mode)){select.value=mode;host.state.setupMode=mode;host.state.customSetup||=saved();}
    }catch(_){}
    select.addEventListener("change",()=>{if(!host.state.started&&!["guest","spectator"].includes(host.role()))try{localStorage.setItem("capitalistChessStartMode",select.value);}catch(_){}});
  }
  const api={init,open,normalize,initialBoard,saved,labels};root.SetupEditor=api;
  if(typeof module!=="undefined")module.exports=api;
})(typeof window==="undefined"?globalThis:window);

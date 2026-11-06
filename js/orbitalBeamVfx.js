(function(){
  "use strict";
  const files="abcdefgh";
  let movedStage=null,stageParent=null,stageNext=null;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function makeHud(){
    const el=document.createElement("div");el.className="orbital-overlay";el.innerHTML=`<div class="orbital-board-viewport"></div><div class="orbital-noise"></div><div class="orbital-hud"><b>ORBITAL PLATFORM // ONLINE</b><span>ALT 327.4 KM · LINK ██████████</span><span>POWER <strong data-power>0%</strong> · WEAPON ARMED</span></div><div class="orbital-target-readout">TARGET <strong data-target>--</strong><span data-lock>LOCK READY</span></div><div class="orbital-scope"><i></i><b></b><span data-scope-label></span></div><div class="orbital-reticle"></div><div class="orbital-beam orbital-charge-beam"></div><div class="orbital-orbs"></div><div class="orbital-static">SIGNAL STABLE</div>`;document.body.appendChild(el);return el;
  }
  function mountBoard(overlay){
    const stage=document.querySelector(".board-stage"),viewport=overlay.querySelector(".orbital-board-viewport");if(!stage||!viewport)return;
    stageParent=stage.parentNode;stageNext=stage.nextSibling;movedStage=stage;stage.classList.add("orbital-live-board");viewport.appendChild(stage);
  }
  function restoreBoard(){
    if(!movedStage||!stageParent)return;movedStage.classList.remove("orbital-live-board");stageParent.insertBefore(movedStage,stageNext);movedStage=null;stageParent=null;stageNext=null;
  }
  function squareAtPoint(x,y){
    for(const square of document.querySelectorAll(".orbital-live-board .square")){const r=square.getBoundingClientRect();if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom)return {r:Number(square.dataset.r),c:Number(square.dataset.c),key:`${files[Number(square.dataset.c)]}${8-Number(square.dataset.r)}`,element:square};}return null;
  }
  function centerOf(square){const el=square?.element||document.querySelector(`.orbital-live-board .square[data-r="${square.r}"][data-c="${square.c}"]`);if(!el)return null;const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};}
  function drawRange(overlay,target){overlay.querySelectorAll(".orbital-target-cell").forEach(el=>el.remove());for(let r=target.r-1;r<=target.r+1;r++)for(let c=target.c-1;c<=target.c+1;c++){const el=document.querySelector(`.orbital-live-board .square[data-r="${r}"][data-c="${c}"]`);if(!el)continue;const rect=el.getBoundingClientRect(),mark=document.createElement("i");mark.className=`orbital-target-cell${r===target.r&&c===target.c?" center":""}`;mark.style.left=`${rect.left}px`;mark.style.top=`${rect.top}px`;mark.style.width=`${rect.width}px`;mark.style.height=`${rect.height}px`;mark.dataset.key=`${files[c]}${8-r}`;overlay.appendChild(mark);}}
  function placeScope(overlay,target){const point=centerOf(target),scope=overlay.querySelector(".orbital-scope");if(!point||!scope)return;scope.style.left=`${point.x}px`;scope.style.top=`${point.y}px`;scope.querySelector("[data-scope-label]").textContent=`TARGET ${target.key.toUpperCase()}`;drawRange(overlay,target);}
  function startTargeting({onConfirm,onCancel}){
    const overlay=makeHud();mountBoard(overlay);let target=null,locked=false;const targetEl=overlay.querySelector("[data-target]"),lockEl=overlay.querySelector("[data-lock]");
    const update=e=>{if(locked)return;const next=squareAtPoint(e.clientX,e.clientY);if(!next){target=null;targetEl.textContent="--";overlay.querySelector(".orbital-scope").classList.remove("visible");overlay.querySelectorAll(".orbital-target-cell").forEach(el=>el.remove());return;}target=next;targetEl.textContent=next.key.toUpperCase();overlay.querySelector(".orbital-scope").classList.add("visible");placeScope(overlay,next);};
    const resize=()=>{if(target&&!locked)placeScope(overlay,target);};
    const cleanup=()=>{overlay.removeEventListener("mousemove",update);overlay.removeEventListener("click",confirm);overlay.removeEventListener("contextmenu",cancel);document.removeEventListener("keydown",key);window.removeEventListener("resize",resize);restoreBoard();overlay.remove();};
    const confirm=e=>{e.preventDefault();const clicked=squareAtPoint(e.clientX,e.clientY);if(!clicked)return;target=clicked;locked=true;placeScope(overlay,target);lockEl.textContent="TARGET LOCKED";overlay.classList.add("locked");setTimeout(()=>{cleanup();onConfirm(target);},260);};
    const cancel=e=>{e?.preventDefault();cleanup();onCancel?.();};const key=e=>{if(e.key==="Escape")cancel(e);};
    overlay.addEventListener("mousemove",update);overlay.addEventListener("click",confirm);overlay.addEventListener("contextmenu",cancel);document.addEventListener("keydown",key);window.addEventListener("resize",resize);return cancel;
  }
  function showResult(result){const destroyed=result.destroyedPieces||[],friendly=destroyed.filter(p=>p.color===result.shooter),enemy=destroyed.filter(p=>p.color!==result.shooter),ratio=result.friendlyDamage?`${(result.enemyDamage/result.friendlyDamage).toFixed(1)} : 1`:"∞ PERFECT STRIKE";const panel=document.createElement("div");panel.className="orbital-result";panel.innerHTML=`<button type="button" aria-label="결과 닫기">×</button><b>☢ ORBITAL NUCLEAR BEAM</b><strong>궤도 타격 완료</strong><span>파괴된 기물　${destroyed.length}개</span><span>아군 손실　${friendly.length}개　/　적군 손실　${enemy.length}개</span><span>아군 피해액　$${Number(result.friendlyDamage||0).toLocaleString()}　/　적군 피해액　$${Number(result.enemyDamage||0).toLocaleString()}</span><span>피해 교환비　${ratio}</span><em>${result.kingDestroyed?.w||result.kingDestroyed?.b?"KING DESTROYED":"TARGET NEUTRALIZED"}</em>`;document.body.appendChild(panel);const close=()=>panel.remove();panel.querySelector("button").onclick=close;setTimeout(close,6500);}
  function play(result){
    const overlay=makeHud();overlay.classList.add("strike-sequence");mountBoard(overlay);const target=overlay.querySelector("[data-target]"),power=overlay.querySelector("[data-power]"),targetPoint=fromKey(result.target);target.textContent=(result.target||"--").toUpperCase();if(targetPoint)placeScope(overlay,targetPoint);
    const count=Math.min(18,Math.max(8,Number(result.affectedSquares?.length||0)+6));for(let i=0;i<count;i++){const orb=document.createElement("i");orb.className="orbital-orb";orb.style.setProperty("--i",i);overlay.querySelector(".orbital-orbs").appendChild(orb);}
    const board=document.querySelector(".orbital-live-board"),rect=board?.querySelector(".square")?.getBoundingClientRect();if(rect)for(const cell of result.destroyedPieces||[]){const point=centerOf({r:cell.r,c:cell.c}),debris=document.createElement("i");if(point){debris.className="orbital-debris";debris.style.left=`${point.x}px`;debris.style.top=`${point.y}px`;document.body.appendChild(debris);setTimeout(()=>debris.remove(),1800);}}
    const start=performance.now(),duration=6200,resultTimer=setTimeout(()=>showResult(result),5000);let raf=0;const tick=now=>{const t=clamp((now-start)/duration,0,1);power.textContent=`${Math.round(t<.78?t/.78*99:t<.86?99+(t-.78)/.08:100)}%`;overlay.style.setProperty("--progress",t);if(t<1)raf=requestAnimationFrame(tick);else{restoreBoard();overlay.remove();}};raf=requestAnimationFrame(tick);return ()=>{cancelAnimationFrame(raf);clearTimeout(resultTimer);restoreBoard();overlay.remove();};
  }
  function fromKey(key){const text=String(key||"").toLowerCase(),c=files.indexOf(text[0]),r=8-Number(text[1]);return c>=0&&r>=0&&r<8?{r,c,key:`${files[c]}${8-r}`} : null;}
  window.OrbitalBeamVfx={startTargeting,play};window.debugOrbitalBeam=key=>play({target:key,affectedSquares:[]});
})();

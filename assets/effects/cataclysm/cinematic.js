
(()=>{
const root=document.getElementById('meltdown7');if(!root||root.dataset.active)return;root.dataset.active='1';
const $=s=>root.querySelector(s),cv=$('canvas'),ctx=cv.getContext('2d'),fire=$('.fire'),sound=$('.sound'),cameraBtn=$('.camera'),skip=$('.skip'),ringSkip=$('.ringskip'),deploySkip=$('.deployskip'),chargeSkip=$('.chargeskip'),beamSkip=$('.beamSkip'),afterSkip=$('.afterskip'),reset=$('.reset');
const settingsBtn=$('.settingsBtn'),settingsPanel=$('.settingsPanel'),settingsClose=$('.settingsClose'),qualitySelect=$('.qualityMode'),resolutionSelect=$('#resolutionScale'),fpsLimitSelect=$('#fpsLimit'),showFpsCheck=$('#showFps'),fpsHud=$('.perfHUD'),fpsValue=$('.fpsValue'),frameMs=$('.frameMs'),budgetLine=$('.budgetLine');
const replayBtn=$('.replayBtn'),replayLabel=$('.replayLabel'),criticalHUD=$('.criticalHUD'),coreTempEl=$('.coreTemp'),tempFill=$('.tempFill'),outputValueEl=$('.outputValue'),outputFill=$('.outputFill'),beamStabilityEl=$('.beamStability'),coilRpmEl=$('.coilRpm'),etaEl=$('.etaToImpact'),coolantStateEl=$('.coolantState'),coolantPctEl=$('.coolantPct');
const directorHUD=$('.directorHUD'),directorShotEl=$('.directorShot'),timeDilationHUD=$('.timeDilationHUD'),timeDilationValue=$('.timeDilationValue');
const damageReport=$('.damageReport'),reportTargetName=$('.reportTargetName'),reportCells=$('.reportCells'),reportPieces=$('.reportPieces'),reportSides=$('.reportSides'),reportAssetValue=$('.reportAssetValue'),reportAssessment=$('.reportAssessment'),reportReplayBtn=$('.reportReplay'),reportCloseBtn=$('.reportClose'),reportCoverage=$('.reportCoverage'),reportDensity=$('.reportDensity'),reportIndex=$('.reportIndex'),reportCoverageFill=$('.reportCoverageFill'),reportDensityFill=$('.reportDensityFill'),reportIndexFill=$('.reportIndexFill'),reportVerdictText=$('.reportVerdictText');
let liveBattleReport=null,lastDirectorLabel='',lastDirectorUpdate=0;let integrationMode=false,parentNotified=false,weaponCost=50000,weaponCurrency='USD';

let replayView=-1,lastReplayView=-1,lastCriticalUpdate=0;
let qualityMode='HIGH',resolutionScale=1,fpsLimit=0,showFps=true,detailScale=1,fpsFrames=0,fpsWindowStart=0,measuredFps=0,lastRenderedAt=0;
const ui={chapter:$('.chapter'),headline:$('.headline'),description:$('.description'),warning:$('.warning'),system:$('.system'),timer:$('.timer'),ground:$('.ground'),nodes:$('.nodes'),reactor:$('.reactor'),target:$('.target'),fill:$('.fill'),glint:$('.glint'),shotfade:$('.shotfade')};
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t,smooth=x=>{x=clamp(x);return x*x*(3-2*x)},fract=x=>x-Math.floor(x),rnd=x=>fract(Math.sin(x*127.1+13.7)*43758.5453123);
const DUR=45,PI=Math.PI,TAU=PI*2;
// V3 uses the original V2 timeline and target coordinate system; visual layers never alter the 5-node timing.

// One timeline drives BOTH visual creation and its exact-onset sound.
const NODE_START=7.45,NODE_GAP=1.05,NODE_OPEN=.53;
const nodeBirth=i=>NODE_START+i*NODE_GAP;
const nodeProgress=(i,t)=>smooth((t-nodeBirth(i))/NODE_OPEN);
const deployedNodes=t=>Array.from({length:5},(_,i)=>t>=nodeBirth(i)?1:0).reduce((a,b)=>a+b,0);
let w=600,h=700,dpr=1,clock=0,startTime=0,status='idle',stageIndex=-1,locked={c:4,r:0},hover=null,muted=false,cameraEnabled=true,ac=null,sources=[],nextCrackle=0,triggered=new Set(),lastClockTick=0,visualClock=0;
let hit={x:0,y:0},origin={x:0,y:0},muzzle={x:0,y:0},angle=0;
const stars=Array.from({length:170},(_,i)=>({x:rnd(i*4.3+.1),y:rnd(i*5.7+1.3),size:.3+rnd(i+31)*1.3,phase:rnd(i+53)*TAU}));
const dust=Array.from({length:320},(_,i)=>{const a=i*2.399963;return {a,c:Math.cos(a),s:Math.sin(a),v:30+rnd(i+2)*280,life:1.4+rnd(i+7)*7,rad:.6+rnd(i+11)*2.3,lift:rnd(i+14)*110,color:i%2?'#ffb678':'#b6e6ff'}});
const shrapnel=Array.from({length:250},(_,i)=>{const a=i*2.399963;return {a,c:Math.cos(a),s:Math.sin(a),v:46+rnd(i+3)*280,d:1.2+rnd(i+15)*5.5,r:1+rnd(i+43)*2.8,color:a%4>2?'#ffffff':a%3>1?'#fff2bb':'#ffb273'}});
const troops=[['♜',0,0,0],['♞',1,0,0],['♝',2,0,0],['♛',3,0,0],['♚',4,0,0],['♝',5,0,0],['♞',6,0,0],['♜',7,0,0],['♟',0,1,0],['♟',1,1,0],['♟',3,1,0],['♟',4,1,0],['♟',6,1,0],['♟',7,1,0],['♘',5,3,1],['♗',2,4,1],['♙',2,6,1],['♙',4,6,1],['♙',5,6,1],['♖',0,7,1],['♕',3,7,1],['♔',4,7,1],['♖',7,7,1]];

const COS_LUT=Array.from({length:720},(_,i)=>Math.cos(i/720*TAU));
const SIN_LUT=Array.from({length:720},(_,i)=>Math.sin(i/720*TAU));
// 양수·음수 각도를 모두 조회표의 유효 범위로 정규화한다.
const lutIndex=a=>((Math.floor(a/TAU*720)%720)+720)%720;
const lutCos=a=>COS_LUT[lutIndex(a)];
const lutSin=a=>SIN_LUT[lutIndex(a)];
const distortionSeeds=Array.from({length:20},(_,i)=>({phase:i*TAU/20,amp:.65+rnd(91+i)*.85,offset:rnd(121+i),twist:rnd(151+i)*TAU}));
const shockfrontSeeds=Array.from({length:26},(_,i)=>({phase:i*TAU/26,arc:.35+rnd(211+i)*.75,reach:.72+rnd(241+i)*.58,drift:(rnd(271+i)-.5)*.22}));
const smokeSeeds=Array.from({length:22},(_,i)=>({phase:rnd(311+i)*TAU,dist:16+rnd(331+i)*72,lift:18+rnd(351+i)*72,size:18+rnd(371+i)*26,sway:.35+rnd(391+i)*.95}));
const emberSeeds=Array.from({length:20},(_,i)=>({phase:rnd(411+i)*TAU,dist:8+rnd(431+i)*66,seed:rnd(451+i)}));
let battleDamageCache=null,battleDamageCtx=null,battleDamageCacheDirty=true,battleDamageCacheKey='',chosenCacheScale=1;
let perfSectionState={camera:0,battleDamage:0,atmo:0,frame:0,impact:0};
let perfBudgetTick=0,perfBudgetFrames=0,perfSectionAccum={camera:0,battleDamage:0,atmo:0,frame:0,impact:0};

let perfHistory=[],frameIntervals=[];
let animationFrame=0,disposed=false,adaptiveQuality=false,slowFrames=0,lastQualityChange=0;
const observers=[];
function scheduleRender(){
 if(!disposed&&!document.hidden&&!animationFrame)animationFrame=requestAnimationFrame(now=>{
  animationFrame=0;
  try{render(now);}catch(error){
   console.error('궤도 연출 렌더링 실패',error);
   sendParent('CATACLYSM:ERROR');window.CATACLYSM.destroy();
  }
 });
}
function onVisibilityChange(){lastClockTick=performance.now();lastFrame=0;if(document.hidden){cancelAnimationFrame(animationFrame);animationFrame=0;stopSounds();}else scheduleRender();}
document.addEventListener('visibilitychange',onVisibilityChange);
let backdropCache=null,boardCache=null,damagedBoardCache=null,boardCacheDirty=true;
let perfEventDurations=[],perfLongTaskCount=0,perfLongTaskTotalMs=0,perfLongTaskMaxMs=0;
try{
 if('PerformanceObserver' in window){
  const eventObserver=new PerformanceObserver(list=>{for(const e of list.getEntries()){if(['click','pointerdown','pointerup','keydown','keyup','wheel'].includes(e.name)){perfEventDurations.push(e.duration);if(perfEventDurations.length>160)perfEventDurations.shift()}}});
  eventObserver.observe({type:'event',buffered:true,durationThreshold:16});observers.push(eventObserver);
  const taskObserver=new PerformanceObserver(list=>{for(const e of list.getEntries()){perfLongTaskCount++;perfLongTaskTotalMs+=e.duration;perfLongTaskMaxMs=Math.max(perfLongTaskMaxMs,e.duration)}});
  taskObserver.observe({type:'longtask',buffered:true});observers.push(taskObserver);
 }
}catch(_){ }
const impactBladeSeeds=Array.from({length:22},(_,i)=>{const a=i*2.399963+Math.sin(i*9.1)*.1;return {c:Math.cos(a),s:Math.sin(a),speed:.63+rnd(i*4.9)*1.4,spread:.08+rnd(i+11)*.13,cs:Math.cos(.08+rnd(i+11)*.13),ss:Math.sin(.08+rnd(i+11)*.13),alpha:.35+rnd(i+22)*.48}});
const impactCrackSeeds=Array.from({length:32},(_,i)=>{const a=i*2.399963;return {c:Math.cos(a),s:Math.sin(a),c2:Math.cos(a+.055),s2:Math.sin(a+.055),offset:Math.sin(i*7)*10,mid:.57,reachAdd:22+i%8*9,hot:i%4===0}});
const impactShardSeeds=Array.from({length:40},(_,i)=>{const a=i*2.399963;return {c:Math.cos(a),s:Math.sin(a),duration:1.9+rnd(i+9)*4.3,velocity:42+rnd(i+2)*260,size:3+rnd(i+37)*12,rot:(i%2?1:-1)*(1+i%7),palette:i%3}});
const plumeSeeds=Array.from({length:55},(_,i)=>{const a=i*2.399963;return {c:Math.cos(a),s:Math.sin(a),r:8+i%9*7,lift:10+i%4*2,smoke:i%6===0,fire:i%7===0}});
const cloudSeeds=Array.from({length:22},(_,i)=>({side:Math.sin(i*2.3999),height:.2+(i%9)/9,wiggle:Math.sin(i*4.6),size:5+i%4,hot:i%5===0}));
const cloudRingSeeds=Array.from({length:16},(_,i)=>({c:Math.cos(i*TAU/16),s:Math.sin(i*TAU/16),drift:Math.sin(i*5),hot:i%4===0}));
const aftershockSeeds=Array.from({length:21},(_,i)=>{const a=i*2.4;return {c:Math.cos(a),s:Math.sin(a),c2:Math.cos(a+.48),s2:Math.sin(a+.48),rad:28+i%6*22,seed:i*15,active:rnd(i)>.76}});
const ruptureSeeds=Array.from({length:71},(_,i)=>{const a=i*TAU/70,j=.83+rnd(i*17)*.29;return {c:Math.cos(a),s:Math.sin(a),j}});
const ruptureSpokes=Array.from({length:60},(_,i)=>{const a=i*TAU/60;return {c:Math.cos(a),s:Math.sin(a),c2:Math.cos(a+(.02+i%3*.014)),s2:Math.sin(a+(.02+i%3*.014)),a:i,aa:.92+rnd(i+13)*.26,shadow:1+.6*rnd(i+37)}});
const ruptureGlows=Array.from({length:35},(_,i)=>{const a=i*2.4;return {c:Math.cos(a),s:Math.sin(a),r:.13+.69*rnd(i+111),size:7+12*rnd(i+42),alpha:.13+.12*rnd(i),hot:i%4===0}});
const worldRendSeeds=Array.from({length:55},(_,i)=>{const a=i*2.399963;return {c:Math.cos(a),s:Math.sin(a),vel:65+rnd(i*23)*210,life:2.5+rnd(i+18)*4,hot:i%4===0}});
const worldShockDelays=[0,.22,.49,.91,1.45,2.1,2.85];
const meltdownSeeds=Array.from({length:36},(_,i)=>{const a=i*2.399;return {c:Math.cos(a),s:Math.sin(a),r:35+i%7*3,dy:i%4*3,color:i%3===0?'255,190,105':'155,206,225'}});
const ventSeeds=Array.from({length:36},(_,i)=>({u:i/36,speed:56+i%7*10,y:-12-(i%9)*3,hot:i%4===0}));
const scarSeeds=Array.from({length:20},(_,i)=>{const a=i*2.4;return {c:Math.cos(a),s:Math.sin(a),r:40+i%5*19,color:i%3?'255,132,52':'122,222,255'}});
const coolGasSeeds=Array.from({length:28},(_,i)=>{const a=i*2.4;return {c:Math.cos(a),s:Math.sin(a),distBase:18+i%5*3}});
const dustBatch=Array.from({length:64},()=>({x:new Float32Array(320),y:new Float32Array(320),r:new Float32Array(320),n:0,alpha:0,color:''}));
function markBattleDamageDirty(){battleDamageCacheDirty=true;}
function markBoardCacheDirty(){boardCacheDirty=true;}

function resize(){const b=cv.getBoundingClientRect();w=Math.max(1,b.width);h=Math.max(1,b.height);const nativeDpr=Math.min(devicePixelRatio||1,2);dpr=Math.max(.5,Math.min(3,nativeDpr*resolutionScale));cv.width=Math.max(1,Math.round(w*dpr));cv.height=Math.max(1,Math.round(h*dpr));cv.style.imageRendering=resolutionScale<=.5?'pixelated':'auto';ctx.setTransform(dpr,0,0,dpr,0,0);markBattleDamageDirty();markBoardCacheDirty();rebuildBackdropCache();rebuildBoardCache();rebuildBattleDamageCache()}resize();window.addEventListener('resize',resize);
function applyQuality(){detailScale=qualityMode==='ULDM'?.30:qualityMode==='LDM'?.68:1;resize();root.dataset.quality=qualityMode;}
applyQuality();fpsHud.style.display='block';

function rebuildBackdropCache(){
 const c=document.createElement('canvas');c.width=Math.max(1,Math.ceil(w));c.height=Math.max(1,Math.ceil(h));const g=c.getContext('2d');
 const grad=g.createRadialGradient(w*.65,h*.26,0,w*.5,h*.5,w*.86);grad.addColorStop(0,'#163253');grad.addColorStop(.5,'#08192c');grad.addColorStop(1,'#01040b');g.fillStyle=grad;g.fillRect(0,0,w,h);
 for(let j=0;j<12;j++){g.beginPath();g.moveTo(0,h*(.16+j*.06));g.lineTo(w,h*(.16+j*.06));g.strokeStyle='rgba(110,179,223,.032)';g.lineWidth=1;g.stroke()}
 const neb=g.createRadialGradient(w*.72,h*.31,0,w*.72,h*.31,w*.55);neb.addColorStop(0,'rgba(32,126,198,.09)');neb.addColorStop(1,'transparent');g.fillStyle=neb;g.fillRect(0,0,w,h);backdropCache=c;
}
function rebuildBoardCache(broken=false){
 const c=document.createElement('canvas'),scale=Math.max(.5,Math.min(3,dpr));c.width=Math.max(1,Math.ceil(w*scale));c.height=Math.max(1,Math.ceil(h*scale));const g=c.getContext('2d');g.setTransform(scale,0,0,scale,0,0);
 const poly=(pts,fill,edge,thick)=>{g.beginPath();for(let i=0;i<pts.length;i++){const p=pts[i];if(i)g.lineTo(p.x,p.y);else g.moveTo(p.x,p.y)}g.closePath();g.fillStyle=fill;g.fill();if(edge){g.lineWidth=thick;g.strokeStyle=edge;g.stroke()}};
 const p=(x,y)=>square(x,y,1);poly([p(0,0),p(8,0),p(8,8),p(0,8)],'#071624','#68badf',2);
 for(let r=0;r<8;r++)for(let col=0;col<8;col++){const cc=(col+r)%2?'#1d4058':'#102a40';poly([p(col,r),p(col+1,r),p(col+1,r+1),p(col,r+1)],cc,'rgba(133,202,234,.10)',.55)}
 for(const [glyph,col,r,white] of troops){if(broken&&Math.abs(col-locked.c)<=1&&Math.abs(r-locked.r)<=1)continue;const P=p(col+.5,r+.61);g.save();g.font=`${Math.max(11,16+r*1.5)}px Georgia,serif`;g.textAlign='center';g.textBaseline='middle';g.fillStyle=white?'#e7f5ff':'#07121d';g.strokeStyle=white?'#6297b7':'#acd3eb';g.lineWidth=1.3;g.shadowColor=white?'#a7dfff':'#000';g.shadowBlur=4;g.strokeText(glyph,P.x,P.y);g.fillText(glyph,P.x,P.y);g.restore()}
 if(broken){damagedBoardCache=c;boardCacheDirty=false;}else{boardCache=c;rebuildBoardCache(true);}
}

function line(x,y,X,Y,c,width=1){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(X,Y);ctx.lineWidth=width;ctx.strokeStyle=c;ctx.stroke()}
function dot(x,y,r,c){ctx.beginPath();ctx.arc(x,y,Math.max(.001,r),0,TAU);ctx.fillStyle=c;ctx.fill()}
function ellipse(x,y,rx,ry,c,width=1,a=1,rot=0){ctx.save();ctx.globalAlpha=clamp(a);ctx.beginPath();ctx.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),rot,0,TAU);ctx.strokeStyle=c;ctx.lineWidth=width;ctx.stroke();ctx.restore()}
function arc(x,y,r,from,to,c,width=1,a=1){ctx.save();ctx.globalAlpha=clamp(a);ctx.beginPath();ctx.arc(x,y,Math.max(.01,r),from,to);ctx.strokeStyle=c;ctx.lineWidth=width;ctx.stroke();ctx.restore()}
function polygon(pts,fill,edge=null,thick=1){ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(edge){ctx.lineWidth=thick;ctx.strokeStyle=edge;ctx.stroke()}}

const glowSpriteCache=new Map();
function glowSprite(color){
 let m=String(color).match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i),rgb,alpha=1;
 if(m){rgb=[Math.max(0,Math.min(255,Math.round(+m[1]))),Math.max(0,Math.min(255,Math.round(+m[2]))),Math.max(0,Math.min(255,Math.round(+m[3])))];alpha=m[4]===undefined?1:Math.max(0,Math.min(1,+m[4]))}
 else {const h=String(color).match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);if(!h)return null;rgb=h[1].length===3?h[1].split('').map(x=>parseInt(x+x,16)):h[1].match(/../g).map(x=>parseInt(x,16))}
 const key=rgb.join(',');let sprite=glowSpriteCache.get(key);
 if(!sprite){sprite=document.createElement('canvas');sprite.width=sprite.height=192;const g=sprite.getContext('2d'),gr=g.createRadialGradient(96,96,0,96,96,95);gr.addColorStop(0,`rgba(${key},1)`);gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,192,192);glowSpriteCache.set(key,sprite);if(glowSpriteCache.size>128)glowSpriteCache.delete(glowSpriteCache.keys().next().value)}
 return {sprite,alpha};
}
function glow(x,y,r,color){if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(r)||r<=0)return;const cached=glowSprite(color);if(cached){const old=ctx.globalAlpha;ctx.globalAlpha=old*cached.alpha;ctx.drawImage(cached.sprite,x-r,y-r,r*2,r*2);ctx.globalAlpha=old;return}const grad=ctx.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,color);grad.addColorStop(1,'rgba(0,0,0,0)');dot(x,y,r,grad)}
const glowPrewarmPalette=['#ffffff','#130e19','#ffcd77','#ff4b21','#c5eaff','#ff8b4a','#ffb56f','#9cecff','#a5f2ff','#64dfff','rgba(255,78,27,1)','rgba(255,163,55,1)','rgba(255,243,164,1)','rgba(255,255,245,1)','rgba(255,180,76,1)','rgba(255,235,173,1)','rgba(255,255,242,1)','rgba(255,91,48,1)','rgba(255,246,203,1)','rgba(165,123,115,1)','rgba(87,103,126,1)','rgba(255,126,70,1)','rgba(255,154,83,1)','rgba(91,106,127,1)','rgba(255,162,102,1)','rgba(108,114,136,1)','rgba(141,127,124,1)','rgba(255,190,105,1)','rgba(155,206,225,1)','rgba(184,215,232,1)','rgba(122,222,255,1)','rgba(175,216,235,1)','rgba(115,214,255,1)','rgba(255,96,49,1)','rgba(255,135,64,1)','rgba(255,139,82,1)','rgba(92,211,255,1)','rgba(255,122,62,1)','rgba(255,116,54,1)'];
for(let i=0;i<glowPrewarmPalette.length;i++)glowSprite(glowPrewarmPalette[i]);
function type(t,x,y,size=11,color='#dff9ff',align='center'){ctx.save();ctx.font=`bold ${size}px Consolas,monospace`;ctx.fillStyle=color;ctx.textAlign=align;ctx.shadowBlur=8;ctx.shadowColor='#001223';ctx.fillText(t,x,y);ctx.restore()}
function square(c,r,z=1,out){const t=r/8,top=h*(.495-(z-1)*.07),height=h*(.265+(z-1)*.045),width=mix(w*.43,w*.89,t)*z,p=out||{x:0,y:0};p.x=w*.5-width*.5+width*c/8;p.y=top+height*t;return p}
function targetPoint(z=1,out){return square(locked.c+.5,locked.r+.5,z,out)}
function name(){return String.fromCharCode(65+locked.c)+(8-locked.r)}
function orbit(out){const p=out||{x:0,y:0};p.x=w*(w<470?.665:.68);p.y=h*.245;return p}
function syncAim(t,recoil=0){targetPoint(1,hit);orbit(origin);angle=Math.atan2(hit.y-origin.y,hit.x-origin.x);const dx=Math.cos(angle),dy=Math.sin(angle);origin.x-=dx*recoil;origin.y-=dy*recoil;const scale=Math.min(.87,w/920+.12);muzzle.x=origin.x+dx*113*scale;muzzle.y=origin.y+dy*113*scale}

function backdrop(t){
 if(!backdropCache)rebuildBackdropCache();ctx.drawImage(backdropCache,0,0,w,h);
 const starStep=qualityMode==='ULDM'?4:qualityMode==='LDM'?2:1;
 for(let si=0;si<stars.length;si+=starStep){const st=stars[si];ctx.globalAlpha=.17+.46*(.5+.5*lutSin(t*.0007+st.phase));dot(st.x*w,st.y*h,st.size,'#c5eaff')}ctx.globalAlpha=1;
}
function board(t,z,broken=false){
 if(Math.abs(z-1)<.0001){if(boardCacheDirty||!boardCache)rebuildBoardCache();ctx.drawImage(broken?damagedBoardCache:boardCache,0,0,w,h)}
 else{
  const p=(c,r)=>square(c,r,z);polygon([p(0,0),p(8,0),p(8,8),p(0,8)],'#071624','#68badf',2);
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){let cc=(c+r)%2?'#1d4058':'#102a40';if(broken&&c===locked.c&&r===locked.r)cc='#172b35';polygon([p(c,r),p(c+1,r),p(c+1,r+1),p(c,r+1)],cc,'rgba(133,202,234,.10)',.55)}
  for(const [glyph,c,r,white] of troops){if(broken&&Math.abs(c-locked.c)<=1&&Math.abs(r-locked.r)<=1)continue;const P=p(c+.5,r+.61);ctx.save();ctx.font=`${Math.max(11,16+r*1.5)*z}px Georgia,serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=white?'#e7f5ff':'#07121d';ctx.strokeStyle=white?'#6297b7':'#acd3eb';ctx.lineWidth=1.3;ctx.shadowColor=white?'#a7dfff':'#000';ctx.shadowBlur=4;ctx.strokeText(glyph,P.x,P.y);ctx.fillText(glyph,P.x,P.y);ctx.restore()}
 }
 const p=(c,r)=>square(c,r,z);
 if(broken&&Math.abs(z-1)<.0001){const a=p(locked.c,locked.r),b=p(locked.c+1,locked.r),d=p(locked.c+1,locked.r+1),e=p(locked.c,locked.r+1);polygon([a,b,d,e],'#172b35','rgba(133,202,234,.22)',.75)}
 const A=p(locked.c+.5,locked.r+.5);if(!broken){let pulse=.5+.5*Math.sin(t*.006);ellipse(A.x,A.y,20+pulse*6,10+pulse*2,'#ffb66e',2,.85);ellipse(A.x,A.y,28+pulse*6,15+pulse*2,'#ff825e',1,.5);line(A.x-37,A.y,A.x+37,A.y,'rgba(255,161,100,.55)');line(A.x,A.y-24,A.x,A.y+24,'rgba(255,161,100,.55)')}
 if(hover&&status!=='running'){polygon([p(hover.c,hover.r),p(hover.c+1,hover.r),p(hover.c+1,hover.r+1),p(hover.c,hover.r+1)],'rgba(92,232,255,.21)','#9cefff',1.6)}
 return A;
}
function targetHUD(t){const p=targetPoint(),r=43+5*Math.sin(t*.003),spin=t*.0006;for(let i=0;i<4;i++)arc(p.x,p.y,r,spin+i*PI/2,spin+i*PI/2+.53,'#9bfaff',2,.65);ellipse(p.x,p.y,r*.8,r*.33,'#6addff',1,.55);line(p.x-62,p.y-33,p.x-35,p.y-33,'rgba(132,240,255,.38)');line(p.x+35,p.y+33,p.x+62,p.y+33,'rgba(132,240,255,.38)')}
function beam(A,B,wide,opacity,warm=false,progress=1){const X=mix(A.x,B.x,clamp(progress)),Y=mix(A.y,B.y,clamp(progress)),g=ctx.createLinearGradient(A.x,A.y,X+(A.x===X?.001:0),Y+(A.y===Y?.001:0));const c=warm?['255,54,28','255,119,34','255,244,214']:['29,107,255','81,215,255','221,252,255'];g.addColorStop(0,`rgba(${c[1]},.09)`);g.addColorStop(.08,`rgba(${c[1]},.55)`);g.addColorStop(.33,`rgba(${c[1]},.92)`);g.addColorStop(.75,`rgba(${c[2]},.92)`);g.addColorStop(.93,`rgba(${c[1]},.5)`);g.addColorStop(1,`rgba(${c[1]},.035)`);
ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=clamp(opacity);for(let i=0;i<4;i++){ctx.globalAlpha=clamp(opacity)*[.06,.18,.75,1][i];ctx.shadowColor=`rgb(${c[1]})`;ctx.shadowBlur=[38,20,9,3][i];line(A.x,A.y,X,Y,g,wide*[5.4,2.5,.95,.23][i])}ctx.restore()}
function beamParticles(t,A,B,rate,size,opacity,warm=false){rate=Math.max(5,Math.round(rate*detailScale));ctx.save();ctx.globalCompositeOperation='screen';for(let j=0;j<rate;j++){let u=fract((t*.00035)*(1+j%5*.09)+j*2.399/6),s=Math.sin(u*PI),x=mix(A.x,B.x,u),y=mix(A.y,B.y,u),off=Math.sin(u*19+t*.007+j)*((j%9)+2)*s;
const dx=B.x-A.x,dy=B.y-A.y,len=Math.hypot(dx,dy)||1;x+=-dy/len*off;y+=dx/len*off;
glow(x,y,size*(1+j%3*.4),`rgba(${warm?'255,193,120':'135,234,255'},${opacity*(.3+.5*s)})`)}ctx.restore()}
function dischargeBeamDetails(t,A,B,opacity,launch){
 // V7 thermal palette: preserve white-hot highlights while shifting the old blue/cyan detailing to orange-red.
 if(opacity<=.005||launch<=.005)return;
 ctx.save();ctx.filter='none';
 // Rebuilt MAXIMUM DISCHARGE: volumetric sheath, hot central lance, helical plasma, moving compression fronts.
 const E={x:mix(A.x,B.x,clamp(launch)),y:mix(A.y,B.y,clamp(launch))},dx=E.x-A.x,dy=E.y-A.y,len=Math.hypot(dx,dy)||1;
 const tx=dx/len,ty=dy/len,nx=-ty,ny=tx,ang=Math.atan2(dy,dx),heat=.5+.5*Math.sin(t*.019);
 ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=opacity;
 // Soft volumetric envelope and two hot, tapered shoulders.
 const sheath=ctx.createLinearGradient(A.x,A.y,E.x,E.y);sheath.addColorStop(0,'rgba(255,55,22,.10)');sheath.addColorStop(.10,'rgba(255,65,20,.62)');sheath.addColorStop(.42,'rgba(255,104,35,.48)');sheath.addColorStop(.78,'rgba(255,196,112,.86)');sheath.addColorStop(.96,'rgba(255,255,255,.98)');sheath.addColorStop(1,'rgba(255,65,28,.15)');
 ctx.shadowColor='#7beaff';ctx.shadowBlur=46;line(A.x,A.y,E.x,E.y,sheath,53+heat*15);
 // Asymmetric energy ribbons spiral along the beam and continuously change their radius.
 for(let arm=0;arm<5;arm++){
   ctx.beginPath();
   for(let k=0;k<=76;k++){
     const u=k/76,phase=u*TAU*(6.5+arm%3*1.7)+t*(arm%2?-.006:.008)+arm*TAU/5;
     const envelope=Math.pow(Math.sin(u*PI),.35),r=(8+arm*2.8+heat*7)*envelope;
     const side=Math.sin(phase)*r,depth=Math.cos(phase)*r*.34;
     const x=A.x+dx*u+nx*side+tx*depth,y=A.y+dy*u+ny*side+ty*depth;
     if(k===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
   }
   ctx.strokeStyle=arm===0?'rgba(255,255,255,.99)':arm%2?'rgba(255,173,75,.96)':'rgba(255,67,31,.88)';ctx.lineWidth=arm===0?2.9:1.5+(arm%2)*.5;ctx.shadowBlur=arm===0?15:9;ctx.shadowColor='#70eaff';ctx.stroke();
 }
 // Moving transverse compression rings travel down the lance; each ring has a bright leading edge.
 for(let i=0;i<9;i++){
   const u=fract(t*.00052+i*.137);if(u>launch)continue;
   const x=mix(A.x,E.x,u),y=mix(A.y,E.y,u),r=10+(i%4)*4+heat*4,alpha=(.28+.52*Math.sin(u*PI))*opacity;
   ellipse(x,y,r*.34,r, i%3===0?'#ffffff':i%2?'#8aeaff':'#438dff',i%3===0?3:1.8,alpha,ang);
   glow(x,y,r*1.7,`rgba(255,106,39,${alpha*.27})`);
   if(i%3===0){line(x-nx*r*1.35,y-ny*r*1.35,x+nx*r*1.35,y+ny*r*1.35,`rgba(229,255,255,${alpha*.8})`,1.7)}
 }
 // Fast traveling white-hot packets inside the core.
 for(let i=0;i<23;i++){
   const u=fract(t*.00105+i*.096);if(u>launch)continue;
   const side=Math.sin(u*27+t*.009+i)* (4+Math.sin(u*PI)*7),x=mix(A.x,E.x,u)+nx*side,y=mix(A.y,E.y,u)+ny*side;
   const r=1.2+(i%4)*.8;glow(x,y,r*4,`rgba(${i%4===0?'255,255,255':'138,240,255'},${opacity*.62})`);dot(x,y,r,'rgba(255,255,255,.94)');
 }
 // Violent side arcs break out of the sheath in irregular bursts.
 const seed=Math.floor(t/72);
 for(let i=0;i<6;i++){
   if(rnd(seed*17+i*13)>.70)continue;
   const u=.08+rnd(seed*31+i*5)*.84,x=mix(A.x,E.x,u),y=mix(A.y,E.y,u),side=(rnd(seed*9+i*7)>.5?1:-1),reach=15+rnd(seed*19+i)*50;
   lightning({x,y},{x:nx*reach*side+x+tx*(rnd(i+seed)*18-9),y:ny*reach*side+y+ty*(rnd(i+seed)*18-9)},seed*11+i*29,.25+heat*.22);
 }
 ctx.restore();
 // Muzzle bloom: layered concentric field gates and radial discharge blades.
 const muzzlePulse=.65+.35*Math.sin(t*.034);
 glow(A.x,A.y,48+heat*35,`rgba(255,78,28,${opacity*(.48+muzzlePulse*.28)})`);glow(A.x,A.y,25+heat*15,`rgba(255,208,145,${opacity*(.36+muzzlePulse*.25)})`);
 for(let i=0;i<6;i++)ellipse(A.x,A.y,12+i*13,7+i*5,i%2?'#68dfff':'#f2ffff',i===0?3.2:1.8,opacity*(.82-i*.105),ang+t*.0018*(i%2?1:-1));
 for(let i=0;i<16;i++){
   const a=ang+i*TAU/16+t*.0007,inner=9+heat*5,outer=25+(i%5)*9+heat*20;
   line(A.x+Math.cos(a)*inner,A.y+Math.sin(a)*inner,A.x+Math.cos(a)*outer,A.y+Math.sin(a)*outer,`rgba(${i%3===0?'255,255,255':'83,221,255'},${opacity*(.35+.4*muzzlePulse)})`,i%4===0?2.1:1.1);
 }
 // Target-side convergence funnel and plasma crown, attached exactly to the selected square.
 const rr=21+heat*10;
 polygon([{x:B.x-tx*105+nx*rr*1.7,y:B.y-ty*105+ny*rr*1.7},{x:B.x+nx*rr,y:B.y+ny*rr},{x:B.x-nx*rr,y:B.y-ny*rr}],`rgba(255,105,38,${opacity*.18})`);
 polygon([{x:B.x-tx*77+nx*rr,y:B.y-ty*77+ny*rr},{x:B.x+nx*rr*.44,y:B.y+ny*rr*.44},{x:B.x-nx*rr*.44,y:B.y-ny*rr*.44}],`rgba(246,255,255,${opacity*.22})`);
 glow(B.x,B.y,44+heat*38,`rgba(255,112,40,${opacity*(.3+heat*.3)})`);
 for(let i=0;i<5;i++){
   const u=fract(t*.0014+i*.19),r=12+u*(30+heat*20);
   ellipse(B.x,B.y,r,r*.4,i%2?'#ffffff':'#79e8ff',i%2?2.1:1.4,opacity*(1-u)*.76,ang+PI/2);
 }
 for(let i=0;i<18;i++){
   const a=i*TAU/18+t*.001,inner=6,outer=18+(i%4)*9+heat*16;
   line(B.x+Math.cos(a)*inner,B.y+Math.sin(a)*inner,B.x+Math.cos(a)*outer,B.y+Math.sin(a)*outer,`rgba(${i%3===0?'255,255,255':'95,224,255'},${opacity*(.24+heat*.3)})`,i%3===0?1.8:1);
 }
 ctx.restore();
}


function maximumDischargeLance(t,A,B,opacity,launch){
 // V7: hot orange-red thermal lance, white-hot inner core, moving plasma, compression rings and branching arcs.
 if(opacity<.008||launch<.015)return;
 ctx.save();ctx.filter='none';
 const E={x:mix(A.x,B.x,clamp(launch)),y:mix(A.y,B.y,clamp(launch))};
 const dx=E.x-A.x,dy=E.y-A.y,len=Math.hypot(dx,dy)||1,tx=dx/len,ty=dy/len,nx=-ty,ny=tx;
 const pulse=.5+.5*Math.sin(t*.052),heat=clamp((clock-29)/2.4),ang=Math.atan2(dy,dx);
 ctx.save();ctx.globalCompositeOperation='screen';
 // A wide translucent sheath gives the lance a real volume, not a flat line.
 const sheath=ctx.createLinearGradient(A.x,A.y,E.x,E.y);
 sheath.addColorStop(0,'rgba(255,55,18,.10)');sheath.addColorStop(.09,'rgba(255,67,21,.42)');
 sheath.addColorStop(.3,'rgba(255,111,35,.31)');sheath.addColorStop(.68,'rgba(255,151,58,.48)');
 sheath.addColorStop(.91,'rgba(255,216,150,.82)');sheath.addColorStop(1,'rgba(255,69,25,.16)');
 ctx.globalAlpha=opacity;ctx.shadowColor='#ff5b22';ctx.shadowBlur=58+heat*20;line(A.x,A.y,E.x,E.y,sheath,74+12*pulse);
 ctx.shadowColor='#ff8b35';ctx.shadowBlur=32;line(A.x,A.y,E.x,E.y,'rgba(255,72,24,.48)',42+8*pulse);
 ctx.shadowColor='#ffc06a';ctx.shadowBlur=24;line(A.x,A.y,E.x,E.y,'rgba(255,111,38,.72)',22+5*pulse);
 ctx.shadowColor='#ffffff';ctx.shadowBlur=18;line(A.x,A.y,E.x,E.y,'rgba(255,218,155,.98)',8+2*pulse);
 ctx.shadowBlur=5;line(A.x,A.y,E.x,E.y,'rgba(255,255,255,.98)',2.3);
 // Four fast, uneven helical filaments wrap around the beam core.
 for(let arm=0;arm<4;arm++){
   ctx.beginPath();
   for(let i=0;i<=78;i++){
     const u=i/78,phase=u*TAU*(8.5+arm*1.8)+t*(arm%2?-.014:.012)+arm*TAU/4;
     const env=Math.pow(Math.sin(u*PI),.28),rad=(12+arm*4+heat*7)*env;
     const side=Math.sin(phase)*rad,depth=Math.cos(phase)*rad*.22;
     const x=A.x+dx*u+nx*side+tx*depth,y=A.y+dy*u+ny*side+ty*depth;
     if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
   }
   ctx.strokeStyle=arm===0?'rgba(255,255,255,.98)':arm%2?'rgba(255,163,67,.95)':'rgba(255,66,30,.92)';
   ctx.lineWidth=arm===0?2.5:1.6;ctx.shadowColor='#ff8d3a';ctx.shadowBlur=13;ctx.stroke();
 }
 // Traveling compression collars and wavefronts race from the muzzle toward the target.
 for(let i=0;i<9;i++){
   const u=fract(t*.00078+i*.119);if(u>launch)continue;
   const x=mix(A.x,E.x,u),y=mix(A.y,E.y,u),r=13+(i%4)*5+heat*4;
   ellipse(x,y,r*.28,r*1.45,i%4===0?'#ffffff':i%2?'#ffbd70':'#ff4d24',i%4===0?3:1.6,opacity*(.38+.5*Math.sin(u*PI)),ang);
   if(i%3===0){line(x-nx*r*1.7,y-ny*r*1.7,x+nx*r*1.7,y+ny*r*1.7,`rgba(220,253,255,${opacity*.7})`,1.8);glow(x,y,r*1.8,`rgba(88,220,255,${opacity*.24})`)}
 }
 // Bright current packets travel inside the core with visible directionality.
 for(let i=0;i<25;i++){
   const u=fract(t*.0016+i*.096);if(u>launch)continue;
   const side=Math.sin(u*33-t*.016+i)*Math.sin(u*PI)*(5+(i%5)*2);
   const x=mix(A.x,E.x,u)+nx*side,y=mix(A.y,E.y,u)+ny*side,r=1+(i%4)*.55;
   glow(x,y,r*5,`rgba(${i%5===0?'255,255,255':'255,143,53'},${opacity*.65})`);dot(x,y,r,'rgba(255,255,255,.98)');
 }
 // Repeated irregular electrical forks escape from both edges of the beam.
 const seed=Math.floor(t/54);
 for(let i=0;i<7;i++){
   const gate=rnd(seed*19+i*13.7);if(gate<.19)continue;
   const u=.055+rnd(seed*31+i*7.1)*.89,x=mix(A.x,E.x,u),y=mix(A.y,E.y,u);
   const side=(i%2?1:-1),reach=18+rnd(seed*11+i*17)*64+heat*18;
   const ex=x+nx*side*reach+tx*(rnd(i+seed*3)-.5)*24,ey=y+ny*side*reach+ty*(rnd(i+seed*3)-.5)*24;
   thermalLightning({x,y},{x:ex,y:ey},seed*43+i*23,.32+heat*.38);
   if(i%4===0)thermalLightning({x,y},{x:x+tx*(24+rnd(i+seed)*42)+nx*side*reach*.45,y:y+ty*(24+rnd(i+seed)*42)+ny*side*reach*.45},seed*59+i*7,.22+heat*.22);
 }
 ctx.restore();
 // Muzzle: bright containment iris, spinning rings and a radial electric crown.
 glow(A.x,A.y,100+heat*35,`rgba(255,60,22,${opacity*(.35+pulse*.18)})`);
 glow(A.x,A.y,52+heat*20,`rgba(255,133,42,${opacity*(.48+pulse*.2)})`);
 glow(A.x,A.y,24+heat*12,`rgba(255,255,255,${opacity*(.55+pulse*.25)})`);
 for(let i=0;i<8;i++){
   const rr=18+i*9+Math.sin(t*.025+i)*3,rot=t*.002*(i%2?1:-1)+i*.12;
   ellipse(A.x,A.y,rr,rr*.66,i%3===0?'#ffffff':i%2?'#ffb45f':'#ff4c24',i%3===0?2.6:1.5,opacity*(.62-i*.045),rot);
 }
 for(let i=0;i<18;i++){
   const a=i*TAU/18+t*.0018*(i%2?1:-1),inner=17+heat*7,outer=40+(i%6)*9+heat*17;
   line(A.x+Math.cos(a)*inner,A.y+Math.sin(a)*inner,A.x+Math.cos(a)*outer,A.y+Math.sin(a)*outer,`rgba(${i%4===0?'255,255,255':'87,222,255'},${opacity*(.36+.38*pulse)})`,i%4===0?2.5:1.3);
 }
 // Impact end: energy converges into a brilliant crown, then throws radial arcs outward.
 glow(E.x,E.y,78+heat*42,`rgba(255,66,22,${opacity*(.34+pulse*.2)})`);
 glow(E.x,E.y,43+heat*25,`rgba(255,143,51,${opacity*(.52+pulse*.2)})`);
 glow(E.x,E.y,18+heat*15,`rgba(255,255,255,${opacity*(.78+pulse*.18)})`);
 for(let i=0;i<7;i++){
   const r=18+i*12+Math.sin(t*.028+i)*5;
   ellipse(E.x,E.y,r,r*.42,i%2?'#ffffff':'#ffad5d',i%3===0?2.5:1.5,opacity*(.8-i*.075),ang+PI/2+t*.001*(i%2?1:-1));
 }
 for(let i=0;i<14;i++){
   const a=i*TAU/14+t*.0013,inner=8,outer=30+(i%5)*12+heat*17;
   line(E.x+Math.cos(a)*inner,E.y+Math.sin(a)*inner,E.x+Math.cos(a)*outer,E.y+Math.sin(a)*outer,`rgba(${i%3===0?'255,255,255':'93,225,255'},${opacity*(.3+.4*pulse)})`,i%3===0?2.1:1.1);
 }
 ctx.restore();
}

function thermalLightning(A,B,seed,power=1){
 const dx=B.x-A.x,dy=B.y-A.y,len=Math.hypot(dx,dy),nx=-dy/(len||1),ny=dx/(len||1),steps=Math.max(5,Math.ceil(len/18));
 ctx.save();ctx.globalCompositeOperation='screen';
 for(let pass=0;pass<3;pass++){
  ctx.beginPath();for(let i=0;i<=steps;i++){const u=i/steps,j=(rnd(seed*7+i*17)-.5)*Math.sin(PI*u)*len*.23,x=mix(A.x,B.x,u)+nx*j,y=mix(A.y,B.y,u)+ny*j;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}
  ctx.strokeStyle=['rgba(255,48,16,.24)','rgba(255,104,31,.78)','rgba(255,232,177,.98)'][pass];ctx.lineWidth=[10,3.5,1.2][pass]*power;ctx.shadowColor='#ff6a27';ctx.shadowBlur=[17,9,3][pass];ctx.stroke();
 }
 ctx.restore();
}
const lightningX=new Float32Array(1024),lightningY=new Float32Array(1024),lightningScratchA={x:0,y:0},lightningScratchB={x:0,y:0};
function lightning(A,B,seed,power=1){const dx=B.x-A.x,dy=B.y-A.y,len=Math.hypot(dx,dy),nx=-dy/(len||1),ny=dx/(len||1),steps=Math.min(1022,Math.max(7,Math.ceil(len/14)));for(let i=0;i<=steps;i++){const u=i/steps,j=(rnd(seed*7+i*17)-.5)*Math.sin(PI*u)*len*.28;lightningX[i]=mix(A.x,B.x,u)+nx*j;lightningY[i]=mix(A.y,B.y,u)+ny*j}
ctx.save();ctx.globalCompositeOperation='screen';for(let pass=0;pass<3;pass++){ctx.beginPath();ctx.moveTo(lightningX[0],lightningY[0]);for(let i=1;i<=steps;i++)ctx.lineTo(lightningX[i],lightningY[i]);ctx.strokeStyle=pass===0?'rgba(32,122,255,.24)':pass===1?'rgba(70,203,255,.63)':'rgba(237,254,255,.95)';ctx.lineWidth=(pass===0?12:pass===1?4:1.25)*power;ctx.shadowColor='#92ecff';ctx.shadowBlur=pass===0?20:pass===1?11:3;ctx.stroke()}ctx.restore();for(let k=2;k<steps-2;k+=3){const px=lightningX[k],py=lightningY[k],ang=rnd(seed+k)*TAU,length=(8+rnd(seed+k+13)*25)*power;line(px,py,px+Math.cos(ang)*length,py+Math.sin(ang)*length,'rgba(129,230,255,.58)',.85)}}
function reactorCore(t,energy,heat){
 // A layered electromagnetic heart: fast counter-rotating cages around a turbulent white-hot plasma.
 const p=.5+.5*Math.sin(t*(.0038+energy*.003)+Math.sin(t*.0017)*.7),spin=t*(.0017+energy*.0025+heat*.0038);
 ctx.save();ctx.globalCompositeOperation='screen';
 glow(0,0,54+energy*55,`rgba(26,130,255,${.16+energy*.15+heat*.12})`);
 // Alternating magnetic cages with deliberately different axes and angular velocities.
 for(let j=0;j<7;j++){
   const rx=18+j*5.4+energy*4,ry=rx*(.43+.12*Math.sin(j*2.1));
   ellipse(0,0,rx,ry,j%3===0?'#ffffff':j%2?'#55caff':'#8cf4ff',j%3===0?2.5:1.35,.30+energy*.43+heat*.12,spin*(j%2?1:-1)*(1+j*.13)+j*.41);
 }
 for(let j=0;j<16;j++){
   const a=j*TAU/16-spin*(j%2?1:-1)*(.35+energy*.75),r1=13+energy*5,r2=31+energy*17+heat*8;
   line(Math.cos(a)*r1,Math.sin(a)*r1,Math.cos(a+.12*Math.sin(t*.006+j))*r2,Math.sin(a+.12*Math.sin(t*.006+j))*r2,`rgba(${j%4===0?'255,255,255':j%2?'93,221,255':'35,142,255'},${.22+energy*.48+heat*.12})`,j%4===0?2.2:1.05);
 }
 // Three luminous plasma filaments spiral through the core rather than orbiting as flat rings.
 for(let arm=0;arm<3;arm++){
   ctx.beginPath();
   for(let k=0;k<=64;k++){
     const u=k/64,a=u*TAU*(2.5+energy*2.5)+spin*(arm%2?-.8:1)+arm*TAU/3;
     const r=(3+u*(20+energy*13))*(.78+.22*Math.sin(t*.008+u*TAU*3+arm));
     const x=Math.cos(a)*r,y=Math.sin(a)*r*.68;
     if(k===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
   }
   ctx.strokeStyle=arm===0?'rgba(255,255,255,.82)':arm===1?'rgba(105,228,255,.78)':'rgba(37,135,255,.74)';ctx.lineWidth=arm===0?2.3:1.6;ctx.shadowColor='#8deaff';ctx.shadowBlur=10+energy*15;ctx.stroke();
 }
 // The core compresses and pulses as charge rises; short radial flares keep its silhouette sharp.
 const radius=10+energy*8+heat*2.5;
 glow(0,0,30+energy*25,`rgba(94,223,255,${.28+p*.22+heat*.1})`);
 ctx.save();ctx.shadowColor='#d9fbff';ctx.shadowBlur=20+energy*35+heat*12;
 dot(0,0,radius*(.84+p*.22),`rgba(226,253,255,${.68+energy*.28})`);
 dot(0,0,radius*.54,heat>.82&&Math.sin(t*.035)>-.1?'#ffffff':'#a7f2ff');ctx.restore();
 for(let j=0;j<12;j++){
   const a=j*TAU/12+spin*(j%2?1:-1)*.7,rr=38+energy*17+Math.sin(t*.012+j*2)*heat*9;
   const x=Math.cos(a)*rr,y=Math.sin(a)*rr*.72;
   if(j%2===0)glow(x,y,6+heat*5,`rgba(144,238,255,${.25+energy*.25+heat*.2})`);
   if(heat>.15&&j%3===0){const b=a+.35*Math.sin(t*.02+j);line(x,y,x+Math.cos(b)*(12+heat*17),y+Math.sin(b)*(9+heat*12),`rgba(228,254,255,${heat*(.3+.4*p)})`,1.4)}
 }
 ctx.restore();
}

function satellite(t,energy,heat=0,recoil=0){const o=origin,scale=Math.min(.87,w/920+.12);ctx.save();ctx.translate(o.x,o.y);ctx.scale(scale,scale);
// External slowly rotating high-frequency antenna and nested gyroscopes
ellipse(0,0,213,78,'#6a9bba',1,.24,t*.00009);for(let k=0;k<4;k++){let a=t*.00021+k*PI/2;arc(0,0,108+k*17,a,a+.45,'#9cdcf0',1,.2)}
let deploy=smooth((clock-12.5)/4);
for(let s of [-1,1]){ctx.save();ctx.scale(s,1);let x=40+deploy*24;line(19,0,x+7,0,'#9dbccc',7);polygon([{x:x,y:-25},{x:182+deploy*38,y:-29},{x:191+deploy*38,y:-18},{x:191+deploy*38,y:18},{x:182+deploy*38,y:29},{x:x,y:25}],'#143652','#87c1e1',1.8);for(let j=0;j<12;j++){let px=x+8+j*(11.1+deploy*2.2);polygon([{x:px,y:-23},{x:px+8,y:-23},{x:px+8,y:23},{x:px,y:23}],j%3===0?'#307ba2':'#1a4c70','#79acd2',.6)}line(x+12,0,x+111,-48-deploy*38,'#729ab7',3);line(x+12,0,x+111,48+deploy*38,'#729ab7',3);
polygon([{x:x+92,y:-48-deploy*38},{x:x+135,y:-58-deploy*38},{x:x+156,y:-46-deploy*38},{x:x+116,y:-37-deploy*38}],'#375c79','#b2d9ed');polygon([{x:x+92,y:48+deploy*38},{x:x+135,y:58+deploy*38},{x:x+156,y:46+deploy*38},{x:x+116,y:37+deploy*38}],'#375c79','#b2d9ed');ctx.restore()}

// V3 MECHANICAL DEPLOYMENT: independent iris armor, articulated bay doors, telescoping accelerator rings.
let mech=smooth((clock-12.9)/4.5),overdrive=smooth((clock-18)/6);
if(mech>.001){
  for(let k=0;k<8;k++){
    let a=k*TAU/8+t*.00007*(k%2?1:-1),rad=60+mech*46;
    ctx.save();ctx.rotate(a);
    polygon([{x:rad-17,y:-7},{x:rad+13+mech*7,y:-13},{x:rad+24+mech*10,y:0},{x:rad+13+mech*7,y:13},{x:rad-17,y:7}],
     k%2?'#244861':'#345d78','#a5d9ee',1.4);
    line(rad-10,0,rad+18,0,`rgba(90,228,255,${.2+.65*overdrive})`,2);
    ctx.restore();
  }
  for(let k=0;k<7;k++){
    let a=k*TAU/7+t*.00012,open=smooth((clock-13-k*.2)/1.8);
    ctx.save();ctx.rotate(a);ctx.translate(44+open*21,0);
    polygon([{x:0,y:-14},{x:30,y:-10},{x:42,y:0},{x:30,y:10},{x:0,y:14}], '#0c2339','#8ad1ed',1.3);
    line(8,-7,32,-5,`rgba(126,236,255,${open*.6})`,1.5);ctx.restore();
  }
  for(let j=0;j<9;j++){
    let spinRate=.00135+overdrive*.0048, r=55+j*6+mech*35,phi=t*spinRate*(j%2?1:-1)+j*.53+Math.sin(t*.004+j)*overdrive*.12;
    arc(0,0,r,phi,phi+.3,j%3?'#a4e9ff':'#fff2c3',j%4===0?2.8:1.4,mech*(.14+overdrive*.4));
  }
}

// Satellite hull and engine modules
polygon([{x:-48,y:-41},{x:-11,y:-52},{x:43,y:-41},{x:57,y:-11},{x:52,y:31},{x:9,y:49},{x:-42,y:37},{x:-58,y:0}],'#122b42','#c2deeb',2.1);
for(let i=0;i<7;i++){let a=i*TAU/7;let X=Math.cos(a)*40,Y=Math.sin(a)*32;dot(X,Y,3,'#87d4f0')}
reactorCore(t,energy,heat);
// Directable armored barrel, independent of spacecraft body
const aimed=Math.atan2(hit.y-o.y,hit.x-o.x),aimEase=smooth(clock/2.8),current=mix(PI*.68,aimed,aimEase);
ctx.save();ctx.rotate(current);
polygon([{x:20,y:-20},{x:43,y:-21},{x:83,y:-13},{x:100,y:-11},{x:100,y:11},{x:83,y:13},{x:43,y:21},{x:20,y:20}],'#193952','#b6d5e5',2);for(let j=0;j<4;j++){line(35+j*16,-17+j*1.2,35+j*16,17-j*1.2,'#83c6e0',2)}
polygon([{x:91,y:-17},{x:112,y:-13},{x:117,y:-5},{x:117,y:5},{x:112,y:13},{x:91,y:17}],'#233d56','#addbee',2);dot(113,0,9,energy>.9?'#fffdf0':'#8de9ff');
for(let j=0;j<4;j++){let a=j*PI/2+t*.0018;arc(113,0,17,a,a+.65,'#96f7ff',1.3,.4+energy*.6)}ctx.restore();
// Overload self-illuminating coils
if(heat>0){for(let j=0;j<16;j++){let a=j*2.39996+t*.0014,r=40+(j%6)*12;dot(Math.cos(a)*r,Math.sin(a)*r*.75,1.5+(j%3),'#c9faff')}}
if(recoil>0){for(let i=0;i<6;i++){let p=fract(t*.001+i/6),ax=-Math.cos(current),ay=-Math.sin(current);glow(ax*(50+90*p),ay*(50+90*p),20*(1-p),`rgba(177,222,249,${recoil*(1-p)*.2})`)}}
ctx.restore()}
function lens(t,p){let o=origin;glow(o.x,o.y,105+p*135,`rgba(126,236,255,${.06+p*.22})`);line(o.x-190*p,o.y,o.x+190*p,o.y,`rgba(177,249,255,${p*.26})`,1.2);line(o.x,o.y-75*p,o.x,o.y+75*p,`rgba(177,249,255,${p*.26})`,1);for(let i=0;i<6;i++){let a=i*TAU/6+t*.00012;arc(o.x,o.y,42+p*48,a,a+.42,'#d5feff',2,p*.48)}}
// Five discrete switches: each circle arrives on its own beat; no overlapping spawns.
function rings(t){
 const a=hit,o=origin,spin=t*.0012,rx=Math.min(w*.19,145),ry=h*.072;let active=0;
 const heat=clamp((clock-20)/6);
 for(let i=0;i<5;i++){
  let age=clock-nodeBirth(i),spawn=nodeProgress(i,clock);
  if(age<0)continue;
  let absorption=clock<25?0:smooth((clock-(25+i*.48))/.55),unabsorbed=1-absorption;
  if(absorption<.999)active++;
  let theta=spin*(1+i*.035)+i*TAU/5;
  let base={x:a.x+Math.cos(theta)*rx,y:a.y+Math.sin(theta)*ry};
  let q={x:mix(base.x,o.x,absorption),y:mix(base.y,o.y,absorption)};
  let r=(22+heat*6)*spawn*(1-absorption*.9),rot=t*.00185*(i%2?1:-1);
  // In its own <0.53-second window each node erupts, then remains in orbit.
  if(age<NODE_OPEN+.27){
    let burst=clamp(age/.018)*(1-smooth((age-.07)/(NODE_OPEN+.18)));
    let outward=Math.pow(clamp(age/(NODE_OPEN+.27)),.68);
    ctx.save();ctx.globalCompositeOperation='screen';
    glow(q.x,q.y,25+110*outward,`rgba(111,235,255,${burst*.42})`);
    ellipse(q.x,q.y,9+outward*86,(9+outward*86)*.59,'#d5ffff',5*(1-outward)+.3,burst*.87,rot*.2);
    ellipse(q.x,q.y,10+outward*62,(10+outward*62)*.59,'#52d7ff',3*(1-outward)+.4,burst*.66,-rot*.3);
    for(let j=0;j<13;j++){
      let th=j*TAU/13+i*.18,dist=(13+outward*(60+rnd(j+i*13)*38));
      line(q.x+Math.cos(th)*9,q.y+Math.sin(th)*6,q.x+Math.cos(th)*dist,q.y+Math.sin(th)*dist*.69,
          `rgba(185,253,255,${burst*.7})`,j%4===0?2.3:1.1);
      if(j%4===0)glow(q.x+Math.cos(th)*dist,q.y+Math.sin(th)*dist*.69,12,`rgba(119,234,255,${burst*.43})`);
    }
    ctx.restore();
  }
  // Two *counter-rotating* mechanical crowns, segmented flux gates, core and sparks.
  ctx.save();ctx.translate(q.x,q.y);ctx.rotate(rot);
  ctx.globalCompositeOperation='screen';
  glow(0,0,55+heat*25,`rgba(39,155,255,${spawn*.17*unabsorbed})`);
  ellipse(0,0,r*1.38,r*.94,'#1270e0',5,spawn*.3*unabsorbed,-rot*.44);
  ellipse(0,0,r,r*.65,'#70eeff',4.2,spawn*unabsorbed);
  ellipse(0,0,r*.71,r*.45,'#efffff',1.8,spawn*unabsorbed);
  for(let k=0;k<9;k++){
    let ph=k*TAU/9+t*.0018*(i%2?1:-1);
    ctx.save();ctx.scale(1,.65);arc(0,0,r*1.31,ph,ph+.34,k%3===0?'#ffffff':'#86dfff',k%3===0?3:1.9,spawn*unabsorbed);ctx.restore();
  }
  for(let k=0;k<7;k++){
    let ph=k*TAU/7-t*.0022;
    ctx.save();ctx.scale(1,.7);arc(0,0,r*.72,ph,ph+.36,'#c9ffff',1.6,spawn*unabsorbed);ctx.restore();
  }
  for(let k=0;k<15;k++){
    let ph=k*TAU/15+t*.0018,dist=r*(.8+.18*Math.sin(k*13+t*.01));
    dot(Math.cos(ph)*dist,Math.sin(ph)*dist*.64,1.25+(k%4)*.45,k%3?'#91eaff':'#ffffff');
  }
  glow(0,0,13+heat*9,`rgba(205,253,255,${spawn*(.43+heat*.3)*unabsorbed})`);
  ctx.restore();
  if(clock>=9&&clock<28){
    // Data line and paired phased streams: lit AFTER the node is born.
    let pathAlpha=spawn*unabsorbed;
    line(q.x,q.y,o.x,o.y,`rgba(36,135,255,${pathAlpha*.18})`,3);
    line(q.x,q.y,o.x,o.y,`rgba(130,237,255,${pathAlpha*.19})`,1);
    for(let j=0;j<7;j++){
      let u=fract(t*.00040*(1+(j%3)*.1)+j/7+i/5);
      let X=mix(q.x,o.x,u),Y=mix(q.y,o.y,u);
      let rad=3+Math.sin(u*PI)*4;
      glow(X,Y,rad*2.3,`rgba(65,189,255,${pathAlpha*.35})`);
      dot(X,Y,1.2+j%3*.45,`rgba(218,255,255,${pathAlpha*.75})`);
    }
    // Pulsating electrical traces from node toward the ground uplink.
    if(clock>=14&&clock<25){
      for(let k=0;k<3;k++){
        let u=fract((t*.00024+k/3+i*.16));
        let X=mix(q.x,a.x,u),Y=mix(q.y,a.y,u);
        let nx=-(a.y-q.y)/(Math.hypot(a.x-q.x,a.y-q.y)||1),ny=(a.x-q.x)/(Math.hypot(a.x-q.x,a.y-q.y)||1);
        line(X-nx*6,Y-ny*6,X+nx*6,Y+ny*6,`rgba(150,246,255,${(1-u)*pathAlpha*.6})`,1.8);
      }
    }
  }
  if(absorption>.05&&absorption<1){beam(q,o,3.3,spawn*.72,false);lightning(q,o,Math.floor(t/125)+i*37,unabsorbed*.55)}
 }
 if(clock>=NODE_START&&clock<26.8){
   let aura=clamp((clock-NODE_START)/2),fade=clamp((27-clock)/2);
   ellipse(hit.x,hit.y,rx,ry,'#67cffe',2,aura*fade*.38,Math.sin(t*.0004)*.15);
   ellipse(hit.x,hit.y,rx*1.14,ry*1.14,'#2a9cff',1.6,aura*fade*.19,-Math.sin(t*.0002)*.15);
   for(let k=0;k<70;k++){let ang=spin+k*TAU/70;dot(hit.x+Math.cos(ang)*rx,hit.y+Math.sin(ang)*ry,1.0+(k%7===0?1.5:0),`rgba(137,243,255,${fade*.49})`)}
 }
 return active;
}
function charging(t,energy,heat){const o=origin;
for(let k=0;k<15;k++){let rad=34+k*11,spin=t*.00015*(k%2?1:-1);ellipse(o.x,o.y,rad,rad*(.49+.12*Math.sin(k)),k%3?'#62d6ff':'#e4faff',1.2,energy*(.08+k%4*.044),spin)}
for(let i=0;i<225;i++){let a=i*2.3999+t*(.00008+(i%7)*.00009),r=(30+i%13*12)*(1-energy*.52),x=o.x+Math.cos(a)*r,y=o.y+Math.sin(a)*r*.58;dot(x,y,.5+(i%5)*.34,`rgba(151,233,255,${energy*(.22+i%3*.1)})`)}
for(let i=0;i<8;i++){let phase=t*.0004+i*PI/4,r=52+energy*30;line(o.x+Math.cos(phase)*r,o.y+Math.sin(phase)*r*.62,o.x+Math.cos(phase+.7)*15,o.y+Math.sin(phase+.7)*12,`rgba(159,246,255,${energy*.24})`,1)}
if(heat>0){let ticks=Math.floor(t/75),count=Math.floor(5+heat*18);for(let i=0;i<count;i++){if(rnd(ticks*4+i*29)>.2+heat*.7)continue;let a=(i*2.399+ticks*.08),r=39+i%5*11,len=100+heat*170*rnd(i*13+ticks*2);let A={x:o.x+Math.cos(a)*r,y:o.y+Math.sin(a)*r*.7},B={x:o.x+Math.cos(a+.26)*len,y:o.y+Math.sin(a+.26)*len*.68};lightning(A,B,ticks*19+i*5,.3+heat*.75);glow(B.x,B.y,10,`rgba(156,247,255,${heat*.5})`)}
for(let j=0;j<12;j++){let a=j*2.399+t*.0006,rad=60+j%5*22;dot(o.x+Math.cos(a)*rad,o.y+Math.sin(a)*rad*.72,2,'#c1faff')}
}}
function helices(t,A,B,heat){const dx=B.x-A.x,dy=B.y-A.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;ctx.save();ctx.globalCompositeOperation='screen';for(let arm=0;arm<3;arm++){ctx.beginPath();for(let k=0;k<=85;k++){let u=k/85,a=u*TAU*8+t*.002*(arm%2?1:-1)+arm*TAU/3,rad=(5+20*Math.sin(u*PI))*(1+heat*.45),x=mix(A.x,B.x,u)+nx*Math.sin(a)*rad,y=mix(A.y,B.y,u)+ny*Math.sin(a)*rad;if(k===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.strokeStyle=arm===0?'rgba(150,250,255,.32)':'rgba(59,187,255,.34)';ctx.lineWidth=arm===0?2.6:1.4;ctx.shadowBlur=8;ctx.shadowColor='#59dfff';ctx.stroke()}ctx.restore()}
function highVoltage(t,heat){const o=origin,a=hit,tick=Math.floor(t/100);
for(let i=0;i<10;i++){let u=.1+i*.082,x=mix(a.x,o.x,u),y=mix(a.y,o.y,u);if(rnd(i*9+tick*7)<heat*.8){let off=8+rnd(i+tick)*32*heat,ang=i*2.4;lightning({x,y},{x:x+Math.cos(ang)*off*2,y:y+Math.sin(ang)*off},tick*13+i*31,.3+heat*.4)}}
}
// The ground end of the uplink is a whole capacitor assembly, not a laser dot.
function groundLattice(t,power){
 const a=hit,heat=clamp((clock-20)/7),born=smooth((clock-3)/1.3)*clamp((28-clock)/1.4);
 if(!born)return;
 const radius=34+power*30,spin=t*.00072;
 ctx.save();ctx.globalCompositeOperation='screen';
 glow(a.x,a.y,75+power*80,`rgba(22,116,255,${born*(.12+power*.14)})`);
 for(let i=0;i<5;i++){
   let theta=i*TAU/5,rx=radius+i*12,ry=rx*.42;
   ellipse(a.x,a.y,rx,ry,i%2?'#2779ff':'#86edff',i%2?2.4:1.4,born*(.28+power*.43),spin*(i%2?1:-1));
 }
 for(let i=0;i<24;i++){
   const th=spin*(i%2?1:-1)+i*TAU/24;
   const r=radius*(1.18+(i%4)*.17),x=a.x+Math.cos(th)*r,y=a.y+Math.sin(th)*r*.42;
   const toR=r*(1.27+power*.15),xx=a.x+Math.cos(th)*toR,yy=a.y+Math.sin(th)*toR*.42;
   line(x,y,xx,yy,`rgba(${i%4===0?'245,255,255':'98,216,255'},${born*(.23+power*.55)})`,i%4===0?2.6:1.3);
   if(i%3===0)glow(xx,yy,10+power*5,`rgba(94,216,255,${born*.23})`);
 }
 for(let j=0;j<8;j++){
   let th=j*TAU/8+t*.00037,rx=radius*1.45;
   let x=a.x+Math.cos(th)*rx,y=a.y+Math.sin(th)*rx*.48;
   ellipse(x,y,4+3*power,2+2*power,'#a2f6ff',1.4,born*.4);
   for(let k=0;k<2;k++){
     const u=fract(t*.00042+j*.19+k*.5),X=mix(x,a.x,u),Y=mix(y,a.y,u);
     glow(X,Y,6+power*8,`rgba(158,243,255,${born*(1-u)*.43})`);
   }
 }
 if(power>.7){
   for(let j=0;j<8;j++){
     let phase=j*TAU/8+t*.00095,rad=15+(j%4)*10;
     glow(a.x+Math.cos(phase)*rad,a.y+Math.sin(phase)*rad*.5,13+power*10,`rgba(128,237,255,${heat*.2})`);
   }
 }
 ctx.restore();
}

// Massive streaming sheath around the *existing* directed beam: coils, filaments,
// transverse compression rings, diamond sparks, conduction bursts, and traveling wavefronts.
function uplinkOverdrive(t,power,heat){
 const A=hit,B=origin,dx=B.x-A.x,dy=B.y-A.y,len=Math.hypot(dx,dy)||1;
 const nx=-dy/len,ny=dx/len,tx=dx/len,ty=dy/len;
 const fade=smooth((clock-4)/1.0)*(1-smooth((clock-26.8)/1.2));
 if(fade<=.001)return;
 ctx.save();ctx.globalCompositeOperation='screen';
 // Deep blue plasma confinement cylinder, bright centered, no hard rectangular edge.
 const v=ctx.createLinearGradient(A.x,A.y,B.x,B.y);
 v.addColorStop(0,'rgba(18,98,255,0)');v.addColorStop(.14,`rgba(37,142,255,${fade*.12})`);
 v.addColorStop(.65,`rgba(56,193,255,${fade*.18})`);v.addColorStop(1,'rgba(175,244,255,0)');
 line(A.x,A.y,B.x,B.y,v,24+power*25);
 // Three dissimilar helices, beating at different velocities and amplitudes.
 for(let arm=0;arm<5;arm++){
   ctx.beginPath();
   for(let k=0;k<=150;k++){
     let u=k/150,ph=u*TAU*(arm%2?8:11)+t*(arm%2?-.0026:.0034)+arm*TAU/5;
     let taper=Math.pow(Math.sin(u*PI),.48),r=(10+power*13+heat*11)*taper;
     let offset=Math.sin(ph)*r, drift=Math.cos(ph)*r*.27;
     let x=mix(A.x,B.x,u)+nx*offset+tx*drift,y=mix(A.y,B.y,u)+ny*offset+ty*drift;
     if(k===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
   }
   ctx.shadowBlur=arm%2?12:21;ctx.shadowColor=arm%2?'#7bdcff':'#168aff';
   ctx.strokeStyle=arm%2?`rgba(160,248,255,${fade*.55})`:`rgba(55,141,255,${fade*.48})`;
   ctx.lineWidth=arm%2?1.5:2.5;ctx.stroke();
 }
 ctx.shadowBlur=0;
 // Compression toroids move UP the beam toward the satellite.
 for(let j=0;j<15;j++){
   let u=fract(t*.00022*(1+j%3*.07)+j/15),s=Math.sin(u*PI),radius=(7+power*22+heat*15)*Math.pow(s,.5);
   let x=mix(A.x,B.x,u),y=mix(A.y,B.y,u),angle=Math.atan2(dy,dx);
   let tangent=angle+PI/2;
   line(x-nx*radius,y-ny*radius,x+nx*radius,y+ny*radius,
        `rgba(165,246,255,${fade*s*(.23+power*.45)})`,j%4===0?3.4:1.4);
   if(j%3===0){
     glow(x-nx*radius,y-ny*radius,8+power*9,`rgba(87,206,255,${fade*s*.39})`);
     glow(x+nx*radius,y+ny*radius,8+power*9,`rgba(195,248,255,${fade*s*.35})`);
   }
 }
 // Directional streaks, each composed of a hot head and continuous tapered tail.
 for(let j=0;j<135;j++){
   let u=fract(t*.00023*(1+(j%7)*.06)+rnd(j+31));
   let dir=(j%2?1:-1),offset=(10+rnd(j+15)*45)*(1+.55*heat)*Math.sin(u*PI);
   const wobble=Math.sin(u*20+t*.006+j)*4;
   let x=mix(A.x,B.x,u)+nx*(offset*dir+wobble),y=mix(A.y,B.y,u)+ny*(offset*dir+wobble);
   let tail=5+(j%4)*6+power*7,a=fade*(.17+.55*Math.sin(u*PI));
   line(x-tx*tail,y-ty*tail,x,y,`rgba(${j%5===0?'250,255,255':'86,204,255'},${a})`,j%5===0?1.8:.9);
   if(j%5===0)dot(x,y,1.3+power*.8,`rgba(220,252,255,${a})`);
 }
 // Local electrical forks escaping from the beam itself as it overloads.
 if(heat>.08){
   let tick=Math.floor(t/100);
   for(let j=0;j<12;j++){
     if(rnd(tick*9+j*23)>heat*.8)continue;
     let u=.11+j*.069,P={x:mix(A.x,B.x,u),y:mix(A.y,B.y,u)};
     let dir=j%2?1:-1,ext=(16+heat*47)*(.6+rnd(j+tick)*.7);
     let Q={x:P.x+nx*ext*dir+tx*11,y:P.y+ny*ext*dir+ty*11};
     lightning(P,Q,tick*17+j*11,.3+heat*.4);
   }
 }
 ctx.restore();
}

// Node-field braids tie the five orbital rings back to the ground emitter.
function resonanceWeb(t){
 if(clock<NODE_START||clock>=25)return;
 const center=hit,rx=Math.min(w*.19,145),ry=h*.072,spin=t*.0012;
 const pct=deployedNodes(clock)/5,brightness=smooth((clock-NODE_START)/3.8);
 ctx.save();ctx.globalCompositeOperation='screen';
 for(let i=0;i<5;i++){
   let life=nodeProgress(i,clock);if(!life)continue;
   let ang=spin*(1+i*.035)+i*TAU/5;
   let x=center.x+Math.cos(ang)*rx,y=center.y+Math.sin(ang)*ry;
   const dist=Math.hypot(center.x-x,center.y-y)||1,nx=-(center.y-y)/dist,ny=(center.x-x)/dist;
   for(let strand=0;strand<3;strand++){
     ctx.beginPath();
     for(let k=0;k<=34;k++){
       let u=k/34,s=Math.sin(u*PI),phi=u*TAU*4+t*.0035+strand*TAU/3;
       let b=8*s*Math.sin(phi),X=mix(x,center.x,u)+nx*b,Y=mix(y,center.y,u)+ny*b;
       if(!k)ctx.moveTo(X,Y);else ctx.lineTo(X,Y);
     }
     ctx.strokeStyle=`rgba(${strand?'89,214,255':'218,254,255'},${brightness*life*.36})`;
     ctx.lineWidth=strand?1.3:2.3;ctx.stroke();
   }
   for(let s=0;s<4;s++){
     let u=fract(t*.00032+s*.25+i*.27),X=mix(x,center.x,u),Y=mix(y,center.y,u);
     glow(X,Y,11+8*(1-u),`rgba(166,245,255,${life*brightness*(1-u)*.27})`);
   }
 }
 if(pct>=1){
   for(let j=0;j<15;j++){
     let ph=j*TAU/15+t*.00044,r=rx*(.82+.18*Math.sin(t*.0009+j));
     let x=center.x+Math.cos(ph)*r,y=center.y+Math.sin(ph)*r*(ry/rx);
     line(x,y,center.x,center.y,`rgba(42,145,255,${brightness*.08})`,1);
   }
 }
 ctx.restore();
}

function lockVisual(t){let o=origin,a=hit;let p=smooth(clock/3);for(let i=0;i<3;i++){let r=35+i*23-p*14;ellipse(a.x,a.y,r,r*.37,'#6ce8ff',1.3,(1-p*.6)*.7)}line(o.x,o.y,a.x,a.y,'rgba(101,218,254,.1)',1);for(let i=0;i<12;i++){let y=h*.17+i*h*.043+.03*Math.sin(t*.001);line(0,y,w,y,'rgba(126,229,255,.038)',1)} }
// Physically staged impact: hard flash, compression bloom, crater tear, successive
// pressure waves, coherent fragments and residual plasma. All target-centered.

function buildImpact(t,age){
 const a=hit,seed=Math.floor(t/78),early=clamp(1-age/2.3),mid=clamp(1-age/5.7);
 ctx.save();ctx.globalCompositeOperation='screen';
 if(age<2.4){
  const size=(18+Math.pow(age,.47)*165)*(.93+.07*Math.sin(t*.031));
  glow(a.x,a.y,size*2.9,`rgba(255,78,27,${.4*early})`);glow(a.x,a.y,size*2.05,`rgba(255,163,55,${.57*early})`);glow(a.x,a.y,size*1.38,`rgba(255,243,164,${.86*early})`);glow(a.x,a.y,size*.87,`rgba(255,255,245,${.96*Math.pow(early,.45)})`);
  ctx.globalAlpha=Math.pow(early,.65);dot(a.x,a.y,size*.36,'#ffffff');ctx.globalAlpha=1;
  for(let j=0;j<impactBladeSeeds.length;j++){
   const d=impactBladeSeeds[j],rad=(30+age*(165+d.speed*100))*(1+.1*Math.sin(t*.019+j)),inn=12+age*24,spread=d.spread*clamp(1-age/2.7),x0=a.x+d.c*d.cs*inn-d.s*d.ss*inn,y0=a.y+d.s*d.cs*inn*.48+d.c*d.ss*inn*.48;
   const x1=a.x+d.c*rad,y1=a.y+d.s*rad*.54,x2=a.x+d.c*d.cs*inn+d.s*d.ss*inn,y2=a.y+d.s*d.cs*inn*.48-d.c*d.ss*inn*.48;
   ctx.globalAlpha=Math.pow(early,.83)*d.alpha;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.lineTo(x2,y2);ctx.closePath();ctx.fillStyle=j%4===0?'#ffffff':j%2===0?'#ffd094':'#ff7c48';ctx.fill();
  }
 }
 for(let i=0;i<10;i++){
  const delay=i<4?i*.12:.34+(i-5)*.30,u=(age-delay)/(2.5+i*.075);if(u<0||u>1)continue;
  const rr=13+Math.pow(u,.68)*(w*.56+i%4*.15*w),alpha=Math.pow(1-u,1.4);
  ellipse(a.x,a.y,rr,rr*.43,i%4===0?'#ffffff':i%3===0?'#ffa45a':'#8aeaff',9*alpha+1.2,alpha*(i%3===0?.94:.76),Math.sin(i)*.016);ellipse(a.x,a.y,rr*.92,rr*.35,'#fff6ca',2.5*alpha+.5,alpha*.37);
 }
 for(let i=0;i<5;i++){const u=age-(.19+i*.30);if(u<0||u>2.4)continue;const X=a.x+Math.sin(i*2.4)*Math.min(64,age*25),Y=a.y-u*(72+i*18);glow(X,Y,30+u*72,`rgba(${i%2?'255,180,76':'255,235,173'},${clamp(1-u/2.4)*.38})`);if(u<1.1)glow(X,Y,15+u*34,`rgba(255,255,242,${clamp(1-u/1.1)*.63})`)}
 if(age>.40){const open=smooth((age-.4)/1.4)*clamp((17-age)/3),craterR=16+open*65;glow(a.x,a.y,craterR*2.3,`rgba(255,84,39,${open*.29})`);ctx.save();ctx.globalAlpha=open*.83;ellipse(a.x,a.y,craterR*1.11,craterR*.40,'#ffcd77',7,1);ellipse(a.x,a.y,craterR*.90,craterR*.35,'#ff4b21',3,1);dot(a.x,a.y,Math.max(2,craterR*.20),'#130e19');ctx.restore()}
 ctx.restore();
 const remain=smooth(age/.16)*clamp((17-age)/5);
 if(remain>.001){
  const p1=ctx,p2=ctx;p1.save();p1.globalAlpha=remain*.85;p1.strokeStyle='#060911';p1.lineWidth=3.7;p1.beginPath();
  for(let j=0;j<impactCrackSeeds.length;j++){const d=impactCrackSeeds[j],reach=22+Math.min(age,5)*d.reachAdd,midR=.57*reach,x0=a.x+d.c*4,y0=a.y+d.s*2,x1=a.x+d.c*midR+d.offset,y1=a.y+d.s*midR*.47;p1.moveTo(x0,y0);p1.lineTo(x1,y1)}p1.stroke();
  p1.lineWidth=3;p1.beginPath();for(let j=0;j<impactCrackSeeds.length;j++){const d=impactCrackSeeds[j],reach=22+Math.min(age,5)*d.reachAdd,midR=.57*reach,x1=a.x+d.c*midR+d.offset,y1=a.y+d.s*midR*.47,x2=a.x+d.c2*reach,y2=a.y+d.s2*reach*.48;p1.moveTo(x1,y1);p1.lineTo(x2,y2)}p1.stroke();
  p1.globalAlpha=remain*.92;p1.strokeStyle='#ff743b';p1.lineWidth=1.5;p1.beginPath();for(let j=0;j<impactCrackSeeds.length;j++){const d=impactCrackSeeds[j],reach=22+Math.min(age,5)*d.reachAdd,midR=.57*reach,x0=a.x+d.c*4,y0=a.y+d.s*2,x1=a.x+d.c*midR+d.offset,y1=a.y+d.s*midR*.47;p1.moveTo(x0,y0);p1.lineTo(x1,y1)}p1.stroke();
  p1.globalAlpha=remain*.7;p1.strokeStyle='#ffac5d';p1.lineWidth=1.2;p1.beginPath();for(let j=0;j<impactCrackSeeds.length;j++){const d=impactCrackSeeds[j],reach=22+Math.min(age,5)*d.reachAdd,midR=.57*reach,x1=a.x+d.c*midR+d.offset,y1=a.y+d.s*midR*.47,x2=a.x+d.c2*reach,y2=a.y+d.s2*reach*.48;p1.moveTo(x1,y1);p1.lineTo(x2,y2)}p1.stroke();p1.restore();
  for(let j=0;j<impactCrackSeeds.length;j+=4){const d=impactCrackSeeds[j],reach=22+Math.min(age,5)*d.reachAdd;glow(a.x+d.c2*reach,a.y+d.s2*reach*.48,14,`rgba(255,91,48,${remain*.19})`)}
 }
 for(let i=0;i<impactShardSeeds.length;i++){
  const d=impactShardSeeds[i],p=age/d.duration;if(p>=1)continue;const x=a.x+d.c*d.velocity*age*.72,y=a.y+d.s*d.velocity*age*.31-Math.sin(Math.min(p,1)*PI)*70,size=d.size*(1-.35*p),rot=age*d.rot,cr=lutCos(rot),sr=lutSin(rot);
  const x1=x+(-size)*cr-(-size*.4)*sr,y1=y+(-size)*sr+(-size*.4)*cr,x2=x+(size*.7)*cr-(-size*.8)*sr,y2=y+(size*.7)*sr+(-size*.8)*cr,x3=x+size*cr-(size*.6)*sr,y3=y+size*sr+(size*.6)*cr,x4=x+(-size*.6)*cr-(size*.7)*sr,y4=y+(-size*.6)*sr+(size*.7)*cr;
  ctx.globalAlpha=(1-p)*.93;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);ctx.lineTo(x4,y4);ctx.closePath();ctx.fillStyle=d.palette?'#2e4854':'#ae8868';ctx.fill();ctx.strokeStyle=d.palette?'#a5d9e8':'#ffd0a3';ctx.lineWidth=1.2;ctx.stroke();
 }
 ctx.globalAlpha=1;ctx.globalCompositeOperation='screen';
 for(let i=0;i<shrapnel.length;i++){const d=shrapnel[i],p=age/d.d;if(p>=1)continue;const v=d.v*(1+early*.78),X=a.x+d.c*v*age,Y=a.y+d.s*v*age*.55+age*age*8,tail=Math.max(5,52*(1-p)*(1+early*.5));ctx.globalAlpha=Math.pow(1-p,1.4)*.95;line(X,Y,X-d.c*tail,Y-d.s*tail*.56,d.color,d.r*(1+early));if(d.r>2.2)glow(X,Y,6+d.r*2,'rgba(255,246,203,.36)')}
 // All 320 dust motes are retained. Batch arcs by color and opacity band to avoid hundreds of path/state changes.
 for(let b=0;b<dustBatch.length;b++)dustBatch[b].n=0;
 for(let i=0;i<dust.length;i++){const d=dust[i],p=age/d.life;if(p>=1)continue;const alpha=(1-p)*(.73+early*.21),colorIndex=i%2,bucket=Math.min(31,Math.max(0,Math.round(alpha*31))),slot=colorIndex*32+bucket,b=dustBatch[slot],n=b.n++;b.x[n]=a.x+d.c*d.v*age*.58;b.y[n]=a.y+d.s*d.v*age*.30-d.lift*lutSin(p*PI)+age*age*6;b.r[n]=d.rad*(1-p*.35);b.alpha=bucket/31;b.color=d.color}
 for(let b=0;b<dustBatch.length;b++){const q=dustBatch[b];if(!q.n)continue;ctx.globalAlpha=q.alpha;ctx.fillStyle=q.color;ctx.beginPath();for(let j=0;j<q.n;j++){ctx.moveTo(q.x[j]+q.r[j],q.y[j]);ctx.arc(q.x[j],q.y[j],q.r[j],0,TAU)}ctx.fill()}ctx.globalAlpha=1;
 // 55 smoke pockets + 8 hot pockets remain at full density; cached radial sprites remove per-frame gradient allocation.
 const smokeAlpha=clamp(1-age/13)*.082;
 for(let j=0;j<plumeSeeds.length;j++){const d=plumeSeeds[j],r=12+age*d.r,X=a.x+d.c*r,Y=a.y-15-Math.abs(d.s)*r*.57-age*d.lift;glow(X,Y,28+age*(7+j%4),`rgba(${d.smoke?'165,123,115':'87,103,126'},${smokeAlpha})`);if(d.fire&&age<7)glow(X,Y,17+age*4,`rgba(255,126,70,${(1-age/7)*.21})`)}
 if(age>1.1&&age<11.8){const rise=age-1.1,strength=clamp((age-1.1)/1.7)*clamp((12-age)/5),top=a.y-36-rise*23;ctx.save();ctx.globalCompositeOperation='screen';for(let j=0;j<cloudSeeds.length;j++){const d=cloudSeeds[j],x=a.x+d.side*(18+rise*16)*(1.3-d.height*.35),y=mix(a.y-16,top,d.height)+Math.sin(j*4.6+age*.24)*10,R=(23+rise*(d.size))*(.7+.25*Math.sin(j));glow(x,y,R,`rgba(${d.hot?'255,154,83':'91,106,127'},${strength*(d.hot?.18:.13)})`)}for(let j=0;j<cloudRingSeeds.length;j++){const d=cloudRingSeeds[j],dr=(35+rise*19)*(1+.12*Math.sin(j*5+age)),x=a.x+d.c*dr,y=top+d.s*dr*.36;glow(x,y,33+rise*6,`rgba(${d.hot?'255,162,102':'108,114,136'},${strength*.18})`)}glow(a.x,top,55+rise*22,`rgba(141,127,124,${strength*.14})`);ctx.restore()}
 if(age>.25&&age<12){const power=(1-age/12)*.65;for(let j=0;j<aftershockSeeds.length;j++){const d=aftershockSeeds[j];if(rnd(j+seed*11)>.76)continue;const rad=d.rad+Math.min(age,5)*12;lightningScratchA.x=a.x+d.c*rad*.34;lightningScratchA.y=a.y+d.s*rad*.18;lightningScratchB.x=a.x+d.c2*rad;lightningScratchB.y=a.y+d.s2*rad*.53;lightning(lightningScratchA,lightningScratchB,seed+d.seed,power)}}
}

function boardRupture(age){
 if(age<.22)return;const a=hit,grow=smooth((age-.22)/1.35),cool=clamp((17-age)/7),R=(38+grow*89)*(1+.02*Math.sin(age*7));
 ctx.save();ctx.translate(a.x,a.y);ctx.scale(1,.41);ctx.globalAlpha=grow;
 ctx.beginPath();for(let i=0;i<ruptureSeeds.length;i++){const d=ruptureSeeds[i],x=d.c*R*1.23*d.j,y=d.s*R*1.23*d.j;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.closePath();ctx.fillStyle='#263441';ctx.fill();ctx.lineWidth=2.2;ctx.strokeStyle='#ff925c';ctx.stroke();
 const crater=ctx.createRadialGradient(0,0,7,0,0,R*1.02);crater.addColorStop(0,'#0a090e');crater.addColorStop(.49,'#130d12');crater.addColorStop(.78,'#652a21');crater.addColorStop(.94,'#ff8b43');crater.addColorStop(1,'#26313d');
 ctx.beginPath();for(let i=0;i<ruptureSeeds.length;i++){const d=ruptureSeeds[i],x=d.c*R*.89*d.j,y=d.s*R*.89*d.j;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.closePath();ctx.fillStyle=crater;ctx.fill();ctx.lineWidth=3.5;ctx.strokeStyle='#fbc484';ctx.stroke();
 ctx.globalAlpha=grow*cool;ctx.lineWidth=1.2;ctx.beginPath();for(let i=0;i<ruptureSpokes.length;i++){const d=ruptureSpokes[i],aa=d.aa,x1=d.c*R*.88*aa,y1=d.s*R*.88*aa,x2=d.c2*R*1.30*aa,y2=d.s2*R*1.30*aa;ctx.moveTo(x1,y1);ctx.lineTo(x2,y2)}ctx.strokeStyle='#ffd08b';ctx.stroke();
 for(let k=0;k<ruptureGlows.length;k++){const d=ruptureGlows[k],r=R*d.r;glow(d.c*r,d.s*r, d.size,`rgba(255,${d.hot?201:111},61,${cool*(d.alpha)})`)}
 ctx.restore();
 ctx.save();ctx.globalAlpha=grow*.8*cool;ctx.strokeStyle='#070c13';ctx.lineWidth=3.5;ctx.beginPath();for(let i=0;i<16;i++){const d=ruptureSpokes[i],a2=i*2.399,r=(R+age*13)*d.shadow;ctx.moveTo(a.x+Math.cos(a2)*R*.5,a.y+Math.sin(a2)*R*.2);ctx.lineTo(a.x+Math.cos(a2)*r*1.6,a.y+Math.sin(a2)*r*.6)}ctx.stroke();ctx.restore();
}
function collisionWarning(t){
  const age=t-32;if(age<0||age>2.5)return;
  ctx.save();ctx.globalAlpha=clamp((2.5-age)/2.5);
  let pulse=age<.30?1:(.5+.5*Math.sin(t*24));
  ctx.textAlign='center';ctx.shadowColor='#ff5125';ctx.shadowBlur=28;
  ctx.font=`900 ${Math.max(22,Math.min(52,w*.075))}px Consolas,monospace`;
  ctx.fillStyle=`rgba(255,245,221,${pulse})`;ctx.fillText(age<.45?'DIRECT IMPACT':'STRUCTURAL FAILURE',hit.x,hit.y-105-Math.min(40,age*38));
  ctx.restore();
}
function chargeDecorations(t,energy,heat){
 const o=origin,sec=clock;
 if(sec<13||sec>=28)return;
 let p=smooth((sec-13)/7),r=60+p*80;
 // Multiple overlapping plasma coils and broken containment arcs.
 ctx.save();ctx.globalCompositeOperation='screen';
 for(let k=0;k<10;k++){
   let phase=t*.0009*(k%2?1:-1)+k*TAU/10;
   let x=o.x+Math.cos(phase)*r,y=o.y+Math.sin(phase)*r*.55;
   let rr=14+p*7;
   arc(x,y,rr,phase,phase+PI*1.5,'#a7f5ff',1.5,p*.58);
   glow(x,y,17+p*15,`rgba(91,230,255,${p*.21})`);
   if(sec>=21&&rnd(k*14+Math.floor(t/90)*7)<heat*.67){
     lightning({x,y},o,Math.floor(t/85)+k*31,heat*.57)
   }
 }
 // Fast streaks inside the orbital core, especially during final absorption.
 for(let k=0;k<60;k++){
   let q=fract((t*.00028)*(1+(k%4)*.15)+k*.137),th=k*2.399+t*.0004;
   let rad=(160-130*q)*(1-.3*heat),x=o.x+Math.cos(th)*rad,y=o.y+Math.sin(th)*rad*.62;
   let alpha=(.1+.5*p)*Math.pow(q,.7);
   line(x,y,x-Math.cos(th)*12,y-Math.sin(th)*8,`rgba(175,247,255,${alpha})`,.7+k%3*.5)
 }
 ctx.restore();
}
function beamPhaseTransition(now,A,B,progress){
 const p=clamp(progress),dx=B.x-A.x,dy=B.y-A.y,len=Math.hypot(dx,dy)||1,ang=Math.atan2(dy,dx),tx=dx/len,ty=dy/len,nx=-ty,ny=tx;
 ctx.save();ctx.globalCompositeOperation='screen';
 // Phase 1: thin white seed lance, then a rapidly expanding hot sheath.
 const seed=clamp(p/.16),sheath=clamp((p-.12)/.28),arcPower=clamp((p-.25)/.35),ringsPower=clamp((p-.42)/.4);
 line(A.x,A.y,mix(A.x,B.x,p),mix(A.y,B.y,p),`rgba(255,255,238,${.95*(1-sheath*.25)})`,1.5+seed*3);
 if(sheath>0){const e={x:mix(A.x,B.x,p),y:mix(A.y,B.y,p)};line(A.x,A.y,e.x,e.y,`rgba(255,92,25,${.18+.2*sheath})`,7+sheath*15);line(A.x,A.y,e.x,e.y,`rgba(255,191,105,${.4+.4*sheath})`,2+sheath*4)}
 // Rotating arcs travel with the leading edge instead of sitting as static decoration.
 if(arcPower>.02){for(let i=0;i<7;i++){const u=fract(p*1.25+i/7),x=mix(A.x,B.x,u),y=mix(A.y,B.y,u),r=(5+arcPower*10)*(0.65+.35*Math.sin(now*.04+i));ctx.save();ctx.translate(x,y);ctx.rotate(ang+now*.003+i);arc(0,0,r,-.9,.9,i%2?'#ff5128':'#ffe0a2',1.2+arcPower,arcPower*.8);ctx.restore()}}
 // Compression fronts race down the lance; keep count modest for the low-detail path.
 const count=qualityMode==='ULDM'?3:qualityMode==='LDM'?5:9;
 if(ringsPower>.02){for(let i=0;i<count;i++){const u=fract(p*1.55+i/count),x=mix(A.x,B.x,u),y=mix(A.y,B.y,u),r=4+ringsPower*(qualityMode==='ULDM'?4:10);ctx.save();ctx.translate(x,y);ctx.rotate(ang);ellipse(0,0,r*1.9,r*.48,i%2?'#ff5128':'#fff0be',1.2,ringsPower*.76,now*.001+i);ctx.restore()}}
 ctx.restore();
}
function overloadDynamics(t,heat){
 if(heat<=.01)return;
 const o=origin,seed=Math.floor(t/82),pulse=.5+.5*Math.sin(t*.028);
 ctx.save();ctx.globalCompositeOperation='screen';
 // Violent, nonuniform magnetic pressure waves around the reactor.
 for(let i=0;i<5;i++){
   const u=fract(t*.00072+i*.21),r=28+u*(75+heat*80);
   ellipse(o.x,o.y,r,r*(.48+.08*Math.sin(t*.006+i)),'#79eaff',i===0?2.6:1.3,heat*(1-u)*(.22+pulse*.22),t*.0008*(i%2?1:-1));
 }
 // Discharges snap from the satellite into the surrounding field; the pattern changes rapidly.
 for(let i=0;i<9;i++){
   if(rnd(seed*11+i*19)>.30+heat*.62)continue;
   const a=i*TAU/9+t*.0008*(i%2?1:-1),r=75+rnd(seed+i*7)*105*heat;
   const A={x:o.x+Math.cos(a)*22,y:o.y+Math.sin(a)*17},B={x:o.x+Math.cos(a+.15)*r,y:o.y+Math.sin(a+.15)*r*.68};
   lightning(A,B,seed*17+i*23,.22+heat*.42);
 }
 // Energy streaks whip outward on each saturation pulse.
 if(pulse>.72){for(let i=0;i<18;i++){
   const a=i*TAU/18+t*.0012,r1=34+heat*14,r2=70+heat*110;
   line(o.x+Math.cos(a)*r1,o.y+Math.sin(a)*r1*.68,o.x+Math.cos(a+.05)*r2,o.y+Math.sin(a+.05)*r2*.68,`rgba(190,249,255,${heat*(pulse-.72)*1.7})`,i%4===0?2.2:1);
 }}
 glow(o.x,o.y,95+heat*95,`rgba(64,191,255,${heat*(.07+pulse*.1)})`);
 ctx.restore();
}

function preFireCompression(t){const o=muzzle;
 if(clock<27||clock>=29)return;
 let p=clock<28?clamp(clock-27):clamp((29-clock));
 let radius=15+90*p;
 glow(o.x,o.y,110*p,`rgba(164,241,255,${p*.34})`);
 for(let i=0;i<11;i++){
   let theta=i*2.399963+t*.002,r=radius*(1+.2*Math.sin(i+t*.002));
   let X=o.x+Math.cos(theta)*r,Y=o.y+Math.sin(theta)*r*.64;
   line(X,Y,o.x,o.y,`rgba(177,245,255,${.15+.36*p})`,1.5);
   glow(X,Y,13,`rgba(209,255,255,${p*.31})`)
 }
}
function coolGas(t){const p=smooth((clock-36)/2);if(!p)return;const o=origin,age=clock-36,alpha=p*clamp((45-clock)/9)*.035;for(let i=0;i<coolGasSeeds.length;i++){const d=coolGasSeeds[i],dist=18+age*(8+i%5*3),Y=o.y-Math.abs(d.s)*dist*.6;glow(o.x+d.c*dist,Y,24+age*2,`rgba(175,216,235,${alpha})`)}}

// V3 VISUAL LAYERS: still target-anchored and timeline-driven.
function v3MechGantry(t){
 if(clock<12.9||clock>=28)return;
 const p=smooth((clock-12.9)/4.1),o=origin,from=muzzle;
 const dx=hit.x-o.x,dy=hit.y-o.y,len=Math.hypot(dx,dy)||1,tx=dx/len,ty=dy/len,nx=-ty,ny=tx;
 ctx.save();ctx.globalCompositeOperation='screen';
 // Coils advance outwards from the muzzle, respecting target direction.
 for(let i=0;i<11;i++){
   let pop=smooth((clock-13.2-i*.23)/.7)*p;
   let q={x:o.x+tx*(15+i*10),y:o.y+ty*(15+i*10)};
   let r=(11+i*1.1)*pop;
   if(pop<.01)continue;
   ellipse(q.x,q.y,r*.74,r*.74,'#7bdfff',i%3===0?3:1.4,pop*(.3+.27*Math.sin(t*.002+i)),Math.atan2(ty,tx));
   let j=Math.sin(t*.0024+i)*r;
   line(q.x+nx*j,q.y+ny*j,q.x-nx*j,q.y-ny*j,`rgba(150,250,255,${pop*.3})`,1.5);
   if(i%2===0)glow(q.x+nx*j,q.y+ny*j,9,`rgba(120,230,255,${pop*.24})`);
 }
 // Two large retracting armatures and angular locking clamps.
 for(let k of [-1,1]){
   let A={x:o.x+nx*k*29,y:o.y+ny*k*29};
   let B={x:o.x+nx*k*(69+28*p)+tx*53,y:o.y+ny*k*(69+28*p)+ty*53};
   let C={x:o.x+tx*103+nx*k*18,y:o.y+ty*103+ny*k*18};
   line(A.x,A.y,B.x,B.y,'rgba(130,174,205,.64)',6);
   line(B.x,B.y,C.x,C.y,'rgba(120,203,238,.7)',4);
   glow(B.x,B.y,9,`rgba(157,247,255,${p*.6})`);
   if(p>.95){let h=fract(t*.00033+k);glow(mix(B.x,C.x,h),mix(B.y,C.y,h),10,'rgba(103,219,255,.4)')}
 }
 for(let k=0;k<8;k++){
   let ang=k*TAU/8+t*.00017,rad=104+36*p;
   let x=o.x+Math.cos(ang)*rad,y=o.y+Math.sin(ang)*rad*.58;
   glow(x,y,7,`rgba(80,216,255,${p*.34})`);
 }
 ctx.restore();
}
function v3FluxGates(t){
 if(clock<8||clock>=28)return;
 const a=hit,o=origin,fade=smooth((clock-8)/2.8)*(1-smooth((clock-26.5)/1.45));
 const heat=clamp((clock-19)/5),dx=o.x-a.x,dy=o.y-a.y,dist=Math.hypot(dx,dy)||1,nx=-dy/dist,ny=dx/dist;
 ctx.save();ctx.globalCompositeOperation='screen';
 // Concentric ellipsoids / opposing spiral envelopes traveling from the ground toward the orbital receiver.
 for(let j=0;j<18;j++){
   let u=fract(t*.00021+j/18),env=Math.sin(u*PI),X=mix(a.x,o.x,u),Y=mix(a.y,o.y,u);
   let rad=(10+22*env+heat*20)*fade;
   let zz=Math.atan2(dy,dx);
   ellipse(X,Y,rad*1.16,rad*.48, j%3===0?'#daffff':'#3baaff',j%3===0?2.4:1.3,fade*env*(.21+heat*.25),zz+.5);
   if(j%3===0){glow(X+nx*rad,Y+ny*rad,9+heat*10,`rgba(120,237,255,${fade*env*.5})`);
   glow(X-nx*rad,Y-ny*rad,9+heat*10,`rgba(37,131,255,${fade*env*.34})`)}
 }
 // Energy feeders flare in from the outer ground-lattice corners at different rates.
 for(let arm=0;arm<12;arm++){
   let angle=arm*TAU/12+t*(arm%2?.00043:-.00062),radius=90+(arm%3)*15;
   let A={x:a.x+Math.cos(angle)*radius,y:a.y+Math.sin(angle)*radius*.47};
   let level=fract(t*.00042+arm/12),X=mix(A.x,a.x,level),Y=mix(A.y,a.y,level);
   line(A.x,A.y,a.x,a.y,`rgba(32,119,255,${fade*.10})`,1);
   glow(X,Y,6+heat*9,`rgba(${arm%2?'98,220,255':'220,252,255'},${fade*(1-level)*(.33+heat*.25)})`);
   if(heat>.1&&arm%3===0&&Math.floor(t/110+arm)%3===0){lightning(A,{x:mix(A.x,a.x,.5),y:mix(A.y,a.y,.5)},Math.floor(t/100)+arm*7,.3+heat*.24)}
 }
 // An alternating magnetic crossbar periodically constricts the beam envelope.
 for(let i=0;i<30;i++){
   let u=fract((t*.0001)*(1+i%4*.15)+i/30),x=mix(a.x,o.x,u),y=mix(a.y,o.y,u);
   let v=Math.sin(u*PI),width=(4+Math.abs(Math.sin(t*.005+i))*24)*(1+heat*.35)*v;
   line(x-nx*width,y-ny*width,x+nx*width,y+ny*width,`rgba(159,248,255,${fade*v*(.14+heat*.29)})`,i%5===0?3:1.1);
 }
 ctx.restore();
}
function v3PlasmaCatastrophe(t){
 if(clock<18||clock>=28)return;
 const p=smooth((clock-18)/5)*(1-smooth((clock-26.5)/1.5));
 const a=hit,o=origin,heat=clamp((clock-21)/3);
 ctx.save();ctx.globalCompositeOperation='screen';
 // Large orbital toroid field with deliberately broken segments instead of a flat halo.
 for(let ring=0;ring<11;ring++){
   let radius=65+ring*16+p*ring*2,rotation=t*.0003*(ring%2?1:-1)+ring*.3;
   for(let k=0;k<8;k++){
     let th=rotation+k*TAU/8,alpha=p*(.08+.2*heat)*(1+.3*Math.sin(t*.005+ring+k));
     ctx.save();ctx.translate(o.x,o.y);ctx.scale(1,.52);
     arc(0,0,radius,th,th+.18+heat*.11,ring%3===0?'#c6ffff':'#238be9',ring%4===0?3.1:1.4,alpha);
     ctx.restore();
   }
 }
 // Rapid large-area flux arcs centered on uplink at charge saturation.
 for(let j=0;j<45;j++){
   let th=j*2.39996+t*.0003*(j%3?1:-1),rx=70+(j%11)*12;
   let x=a.x+Math.cos(th)*rx,y=a.y+Math.sin(th)*rx*.46;
   let bright=Math.max(0,Math.sin(t*.008+j*1.23));
   if(j%4===0)glow(x,y,13+heat*22,`rgba(92,209,255,${p*.10+p*bright*.16})`);
   if(heat>.2&&j%7===0&&Math.floor(t/130+j)%3===0){lightning({x,y},{x:mix(x,a.x,.4),y:mix(y,a.y,.4)},Math.floor(t/120)+j*17,.21+heat*.25)}
 }
 // 5 luminous moire-like phase-wave discs, each distinct and counter-rotating.
 for(let i=0;i<5;i++){
   let s=i*TAU/5+t*.00055*(i%2?1:-1),r=62+i*22;
   ellipse(a.x,a.y,r,r*.42,i%2?'#d3f9ff':'#397fff',1.6,p*(.16+heat*.12),s*.3);
   for(let k=0;k<5;k++){
     let th=s+k*TAU/5,x=a.x+Math.cos(th)*r,y=a.y+Math.sin(th)*r*.42;
     glow(x,y,7+heat*8,`rgba(158,244,255,${p*(.18+heat*.19)})`);
   }
 }
 ctx.restore();
}

function v3WorldRend(t,age){
 if(age<0||age>10)return;const a=hit,dim=clamp((10-age)/5);ctx.save();ctx.globalCompositeOperation='screen';
 const next=age-.42;if(next>=0&&next<2.1){const vol=smooth(next/.22)*(1-smooth((next-1.1)/1)),height=200+next*150,grad=ctx.createLinearGradient(a.x,a.y-height,a.x,a.y+15);grad.addColorStop(0,'rgba(48,167,255,0)');grad.addColorStop(.42,`rgba(109,224,255,${vol*.08})`);grad.addColorStop(.85,`rgba(255,186,102,${vol*.19})`);grad.addColorStop(1,'rgba(255,255,224,0)');ctx.beginPath();ctx.moveTo(a.x-10-next*32,a.y+10);ctx.lineTo(a.x-35-next*64,a.y-height);ctx.lineTo(a.x+35+next*64,a.y-height);ctx.lineTo(a.x+10+next*32,a.y+10);ctx.closePath();ctx.fillStyle=grad;ctx.fill();glow(a.x,a.y-height*.58,70+next*40,`rgba(174,237,255,${vol*.2})`)}
 for(let i=0;i<7;i++){const delay=worldShockDelays[i],v=age-delay;if(v<0||v>5.6)continue;const progress=Math.pow(v/5.6,.65),radius=24+progress*(w*1.15+150),fade=(1-progress)*dim;ellipse(a.x,a.y,radius,radius*.37,i%2?'#fa9f66':'#b8eaff',5*(1-progress)+.6,fade*(i%2?.52:.7),i*.013);ellipse(a.x,a.y,radius*.92,radius*.35,'#fff0cb',1.5,fade*.25);for(let k=0;k<16;k+=2){const th=k*TAU/16+t*.00002*i,x=a.x+lutCos(th)*radius,y=a.y+lutSin(th)*radius*.37;glow(x,y,9+15*(1-progress),`rgba(${i%2?'255,160,98':'165,234,255'},${fade*.19})`)}}
 if(age<5.5){const alt=age*age*15;for(let j=0;j<worldRendSeeds.length;j++){const d=worldRendSeeds[j],dist=age*d.vel*.7,y=a.y+d.s*dist*.44+alt,x=a.x+d.c*dist,alpha=Math.pow(clamp(1-age/d.life),2);if(alpha<.01)continue;ctx.globalAlpha=alpha*.55;line(x,y,x-d.c*(5+age*6),y-d.s*(5+age*6)*.5,d.hot?'#b2efff':'#ff9d5f',d.hot?3.1:1.4)}ctx.globalAlpha=1;}
 ctx.restore();
}
function v3Meltdown(t){
 if(clock<35)return;const age=clock-35,heat=smooth(age/1.1)*(1-smooth((age-7)/3)),o=origin,a=hit;ctx.save();ctx.globalCompositeOperation='screen';
 for(let i=0;i<5;i++){const R=35+i*17+age*5;ellipse(o.x,o.y,R,R*.57,i%2?'#ff6b40':'#ffc47f',2.5,heat*(.45-i*.045),t*.0003*(i%2?-1:1))}glow(o.x,o.y,80+age*10,`rgba(255,90,30,${heat*.25})`);
 const rot=t*.00012,cr=Math.cos(rot),sr=Math.sin(rot);for(let j=0;j<meltdownSeeds.length;j++){const d=meltdownSeeds[j],r=d.r+age*(5+j%7*3),x=o.x+(d.c*cr-d.s*sr)*r,y=o.y+(d.s*cr+d.c*sr)*r*.6-age*d.dy;glow(x,y,8+lutSin(age+j)*3,`rgba(${d.color},${heat*.12})`)}
 if(age>=1){const vent=smooth((age-1)/1.1)*(1-smooth((age-6.6)/3));for(let dir of [-1,1])for(let j=0;j<ventSeeds.length;j++){const d=ventSeeds[j],tt=fract((age-1)*.18+d.u),x=o.x+dir*(45+tt*d.speed*2),y=o.y+d.y+lutSin(t*.001+j)*tt*23,R=7+tt*31;glow(x,y,R,`rgba(184,215,232,${vent*(1-tt)*.17})`);if(d.hot)dot(x,y,1.5,`rgba(244,250,255,${vent*(1-tt)*.45})`)}}
 const scar=clamp((age-1)/1.3)*clamp((11-age)/3),scarRot=t*.00017,scr=Math.cos(scarRot),srs=Math.sin(scarRot);for(let j=0;j<scarSeeds.length;j++){const d=scarSeeds[j],r=d.r;glow(a.x+(d.c*scr-d.s*srs)*r,a.y+(d.s*scr+d.c*srs)*r*.38,6+(j%3)*4,`rgba(${d.color},${scar*.15})`)}ctx.restore();
}
function stopSounds(){sources.forEach(s=>{try{s.stop()}catch(_){}});sources=[]}
function tone(freq,dur,vol=.06,end=freq,type='sine',delay=0){if(muted)return;try{ac=ac||new(window.AudioContext||window.webkitAudioContext)();ac.resume();const osc=ac.createOscillator(),amp=ac.createGain(),now=ac.currentTime+delay;osc.type=type;osc.frequency.setValueAtTime(Math.max(20,freq),now);osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),now+dur);amp.gain.setValueAtTime(.0001,now);amp.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),now+Math.min(.045,dur*.25));amp.gain.exponentialRampToValueAtTime(.0001,now+dur);osc.connect(amp);amp.connect(ac.destination);osc.start(now);osc.stop(now+dur+.02);sources.push(osc);osc.onended=()=>sources=sources.filter(x=>x!==osc)}catch(_){}}
function noise(dur=.18,vol=.07,high=true,delay=0){if(muted)return;try{ac=ac||new(window.AudioContext||window.webkitAudioContext)();ac.resume();const length=Math.round(ac.sampleRate*dur),b=ac.createBuffer(1,length,ac.sampleRate),arr=b.getChannelData(0);for(let i=0;i<length;i++){let fade=Math.pow(1-i/length,.75);arr[i]=(Math.random()*2-1)*fade*(Math.random()>.67?1:.2)}const src=ac.createBufferSource(),filter=ac.createBiquadFilter(),gain=ac.createGain();src.buffer=b;filter.type=high?'highpass':'lowpass';filter.frequency.value=high?700:500;gain.gain.value=vol;src.connect(filter);filter.connect(gain);gain.connect(ac.destination);src.start(ac.currentTime+delay);sources.push(src);src.onended=()=>sources=sources.filter(x=>x!==src)}catch(_){}}
function nodeChime(i){
 if(muted)return;
 try{
  ac=ac||new(window.AudioContext||window.webkitAudioContext)();ac.resume();
  // A precise 4 ms attack; no old 45 ms lag, no queued 0.45 s unsynced sequence.
  const now=ac.currentTime,base=410+i*108;
  for(let harmonic=0;harmonic<3;harmonic++){
    const osc=ac.createOscillator(),gain=ac.createGain();
    osc.type=harmonic===2?'triangle':'sine';
    let f=base*(harmonic===0?1:harmonic===1?1.51:2.01);
    osc.frequency.setValueAtTime(f,now);
    osc.frequency.exponentialRampToValueAtTime(f*1.43,now+.27);
    let peak=[.11,.053,.025][harmonic];
    gain.gain.setValueAtTime(.0001,now);
    gain.gain.linearRampToValueAtTime(peak,now+.004);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.33);
    osc.connect(gain);gain.connect(ac.destination);osc.start(now);osc.stop(now+.34);
    sources.push(osc);osc.onended=()=>sources=sources.filter(x=>x!==osc);
  }
  noise(.09,.055,true);
 }catch(_){}
}
function synchronizeNodeBirths(t){
 if(status!=='running'||t<NODE_START||t>=13)return;
 for(let i=0;i<5;i++)if(t>=nodeBirth(i))once('node-'+i,()=>nodeChime(i));
}
function impactSounds(){
 // Three separate transients: initial metal-tearing crack, enormous bass drop,
 // and two delayed secondary impacts. Kept separate from sustained charge SFX.
 noise(2.7,.31,false);noise(.34,.23,true);tone(130,2.8,.25,24,'sawtooth');
 tone(72,3.5,.26,21,'triangle');tone(980,.38,.095,53,'sawtooth');
 for(let k=0;k<4;k++){let delay=[.19,.53,.96,1.48][k];
   noise(.6+ k*.2,.18-k*.023,false,delay);
   tone(125-k*16,.85+k*.22,.14-k*.015,26,'sawtooth',delay);
   tone(620-k*70,.23,.07,75,'square',delay)}
}
function once(id,fn){if(triggered.has(id))return;triggered.add(id);fn()}
function emergencyRearm(now){
 const age=Math.max(0,clock-37),cool=clamp(age/6),o=origin;
 ctx.save();ctx.globalCompositeOperation='screen';
 const blue=1-smooth((age-1)/5);
 for(let i=0;i<5;i++){const r=42+i*19+Math.sin(now*.0015+i)*3;ellipse(o.x,o.y,r,r*.58,i%2?'#64dfff':'#b5f6ff',1.6,blue*(.26-i*.025),now*.00015*(i%2?-1:1))}
 // Coolant vents switch from hot amber to blue-white as the core stabilizes.
 for(let side of [-1,1]){const x=o.x+side*93,y=o.y+10;for(let j=0;j<7;j++){const u=fract(age*.16+j/7),xx=x+side*u*(32+cool*42),yy=y-10-u*34+Math.sin(now*.004+j)*3;glow(xx,yy,5+u*10,`rgba(${age<2?'255,147,74':'105,220,255'},${(1-u)*.22})`) }}
 const ready=smooth((age-4.5)/1.2);glow(o.x,o.y,55+Math.sin(now*.002)*5,`rgba(111,226,255,${.12+ready*.18})`);
 if(age>4.2){for(let i=0;i<4;i++){const a=now*.00025+i*PI/2;arc(o.x,o.y,92+i*8,a,a+.32,ready>.5?'#a5f2ff':'#ffb477',1.5,.25+ready*.3)}}
 ctx.restore();
 if(age>5.2&&Math.floor(now/450)%2===0)type('WEAPON READY',o.x,o.y-104,10,'#a5f2ff');
}
const stages=[
[0,'01 / TARGET ACQUISITION','OPTICAL LOCK','MULTI-SPECTRAL TARGETING · PRECISION ZOOM','TRACKING ONLINE'],
[3,'02 / CAPACITOR INITIALIZATION','PRIMARY UPLINK','GROUND CAPACITOR → SATELLITE RECEIVER','GROUND UPLINK'],
[7,'03 / RESONANCE NETWORK','DEPLOYING FIVE NODES','ROTATING FIELD COILS · ORBITAL DATA SIGNALS','FIVE-NODE SYNC'],
[13,'04 / ORBITAL DEPLOYMENT','ACCELERATOR UNFOLDING','IRIS ARMOR · FIELD RINGS · BARREL ALIGNMENT','DEPLOYMENT ACTIVE'],
[18,'05 / REACTOR CRITICAL','FIELD SATURATION','CORE TEMPERATURE · OUTPUT · COIL RPM CLIMBING','CRITICAL CHARGE'],
[21,'06 / CONTAINMENT FAILURE','CORE OVERHEATING','⚡ ARC FAULTS · COOLING LIMIT EXCEEDED · SHIELD FLICKER','FAILURE CASCADE'],
[23,'07 / REACTOR SATURATION','MAXIMUM CAPACITY','⚡ SAFETY LIMITERS OVERRIDDEN · CORE AT 100%','CRITICAL OUTPUT'],
[25,'08 / FINAL ENERGY RECAPTURE','FIVE-STAGE ABSORPTION','RESONANCE RINGS CONVERGING INTO SATELLITE','CORE RECAPTURE'],
[28,'09 / FINAL RELEASE INTERLOCK','ONE SECOND OF SILENCE','ALL FIELDS FROZEN · FIRING CIRCUIT ARMED','AWAITING RELEASE'],
[29,'10 / MUZZLE DISCHARGE','PLASMA THROAT IGNITION','COMPRESSION SPHERE · THERMAL RINGS · MAIN LANCE PRIMING','BARREL DISCHARGE'],
[32,'11 / MULTI-STAGE IMPACT','DIRECT HIT / CASCADE','WHITE FLASH · SHOCK CORE · CONCENTRIC WAVES · GROUND FRACTURE','TARGET DESTROYED'],
[37,'12 / POST-STRIKE MELTDOWN','EMERGENCY CORE PURGE','ARMOR OVERHEAT · VENTING GAS · RESIDUAL ARCS','EMERGENCY COOLING'],
[43,'13 / EMERGENCY REARM','WEAPON READY','COILS SPINNING DOWN · CORE STABILIZED · SYSTEM REARMED','WEAPON READY']
];
function stageChanged(idx){const x=stages[idx];ui.chapter.textContent=x[1];ui.headline.textContent=x[2];ui.description.textContent=x[3];ui.system.textContent=x[4];if(status!=='running')return;
switch(idx){case 0:tone(560,2.4,.06,1050);tone(95,2.4,.04,155,'sawtooth');break;case 1:tone(140,3.7,.075,750,'sawtooth');tone(410,4,.045,1200);break;case 2:break; /* Onset sounds issued by synchronizeNodeBirths(). */case 3:tone(80,5,.065,320,'sawtooth');tone(330,5,.045,850);for(let j=0;j<5;j++)tone(155+j*36,.7,.021,300+j*48,'triangle',j*.48);break;case 4:tone(165,5,.07,850,'sawtooth');tone(1200,4,.045,1900);tone(58,4.7,.045,190,'sawtooth');break;case 5:tone(870,1.5,.04,150,'sawtooth');noise(.3,.08);break;case 6:tone(680,1.7,.085,1350);noise(.32,.08);break;case 7:tone(1350,2.6,.1,115,'sawtooth');noise(.8,.1);break;case 8:stopSounds();break;case 9:tone(1300,2.8,.13,33,'sawtooth');tone(125,2.7,.14,25,'sawtooth');noise(2.2,.22,false);break;case 10:impactSounds();tone(2680,.92,.042,2520,'sine',.045);break;case 11:tone(280,3.5,.045,80);noise(.65,.12,false);tone(90,1.6,.10,32,'triangle');break;case 12:tone(680,1.8,.025,1220,'sine');tone(180,.9,.025,540,'triangle');break;case 13:tone(880,1.2,.03,1320,'sine');break;}}
function beginAt(sec=0,playStageSound=true){
  parentNotified=false;
 replayView=-1;replayLabel.style.display='none';damageReport.classList.remove('open');stopSounds();triggered.clear();clock=sec;startTime=performance.now()-sec*1000;lastClockTick=performance.now();visualClock=lastClockTick-sec*1000;status='running';fire.disabled=true;fire.textContent='SEQUENCE IN PROGRESS';ui.warning.textContent='';
 // A seek is not a time machine for old one-shots: only events after the selected point may fire.
 for(let i=0;i<5;i++)if(sec>=nodeBirth(i))triggered.add('node-'+i);
 for(let i=0;i<5;i++)if(sec>=25.25+i*.48)triggered.add('absorb-'+i);
 const idx=stages.reduce((n,st,i)=>sec>=st[0]?i:n,0),st=stages[idx];
 ui.chapter.textContent=st[1];ui.headline.textContent=st[2];ui.description.textContent=st[3];ui.system.textContent=st[4];
 stageIndex=playStageSound?idx-1:idx;
 ui.glint.style.opacity='0';ui.shotfade.style.opacity='0';
}
function start(){beginAt(0,true);if(!muted)tone(65,.04,.003,62,'sine');sendParent('CATACLYSM:STARTED',{target:name()})}
function resetAll(){replayView=-1;replayLabel.style.display='none';criticalHUD.style.display='none';damageReport.classList.remove('open');timeDilationHUD.classList.remove('active');directorHUD.style.display='none';lastClockTick=performance.now();visualClock=lastClockTick;stopSounds();triggered.clear();stageIndex=-1;clock=0;startTime=0;status='idle';hover=null;fire.disabled=false;fire.innerHTML='☢ AUTHORIZE <span class="weaponCostButton">'+moneyLabel(weaponCost,weaponCurrency)+'</span> STRIKE';ui.chapter.textContent='00 // STANDBY';ui.headline.textContent='ORBITAL ARRAY READY';ui.description.textContent='SELECT ANY SQUARE ON THE BOARD, THEN AUTHORIZE THE STRIKE. TOTAL ANNIHILATION · THERMAL SHOCKFRONT · PERSISTENT PLASMA SCARS · TIME DILATION.';ui.warning.textContent='';ui.system.textContent='AWAITING AUTHORIZATION';ui.timer.textContent='T+ 00.0 s';ui.ground.textContent='0%';ui.nodes.textContent='0 / 5';ui.reactor.textContent='0%';ui.target.textContent=name();ui.fill.style.width='0%';ui.glint.style.opacity='0';ui.shotfade.style.opacity='0';updateBattleReport()}
fire.addEventListener('click',start);reset.addEventListener('click',resetAll);sound.addEventListener('click',()=>{muted=!muted;sound.textContent=muted?'SFX OFF':'SFX ON';if(!muted)tone(480,.16,.045,860)});cameraBtn.addEventListener('click',()=>{cameraEnabled=!cameraEnabled;cameraBtn.textContent=cameraEnabled?'CAM ON':'CAM OFF';cameraBtn.style.background=cameraEnabled?'#10253a':'#29313a';cameraBtn.style.color=cameraEnabled?'#b9ddef':'#a5acb4'});
settingsBtn.addEventListener('click',()=>settingsPanel.classList.toggle('open'));
settingsClose.addEventListener('click',()=>settingsPanel.classList.remove('open'));
qualitySelect.addEventListener('change',()=>{adaptiveQuality=false;qualityMode=qualitySelect.value;applyQuality();tone(520,.08,.025,qualityMode==='HIGH'?920:qualityMode==='LDM'?720:560)});
resolutionSelect.addEventListener('change',()=>{adaptiveQuality=false;resolutionScale=Number(resolutionSelect.value)||1;resize();tone(620,.07,.02,820)});
fpsLimitSelect.addEventListener('change',()=>{fpsLimit=Number(fpsLimitSelect.value)||0;lastFrame=0;fpsFrames=0;fpsWindowStart=0;fpsValue.textContent='--';frameMs.textContent='--';});
showFpsCheck.addEventListener('change',()=>{showFps=showFpsCheck.checked;fpsHud.style.display=showFps?'block':'none';});

replayBtn.addEventListener('click',()=>{const next=(lastReplayView+1)%3;beginAt(29,true);replayView=next;lastReplayView=next;const labels=['REPLAY CAM · MUZZLE','REPLAY CAM · BEAM TRACK','REPLAY CAM · IMPACT'];replayBtn.textContent=labels[next];replayLabel.textContent=labels[next];replayLabel.style.display='block';});
reportCloseBtn.addEventListener('click',()=>damageReport.classList.remove('open'));
reportReplayBtn.addEventListener('click',()=>{damageReport.classList.remove('open');beginAt(0,true)});
ringSkip.addEventListener('click',()=>beginAt(7,true));skip.addEventListener('click',()=>beginAt(30.9,true));
function jumpTo(sec,playStageSound=true){beginAt(sec,playStageSound)}
deploySkip.addEventListener('click',()=>jumpTo(13.1,true));chargeSkip.addEventListener('click',()=>jumpTo(20.8,true));beamSkip.addEventListener('click',()=>jumpTo(29.25,true));afterSkip.addEventListener('click',()=>jumpTo(35.5,false));
function inside(P,pts){let sign=null;for(let j=0;j<pts.length;j++){let a=pts[j],b=pts[(j+1)%pts.length],cross=(b.x-a.x)*(P.y-a.y)-(b.y-a.y)*(P.x-a.x);if(Math.abs(cross)<.001)continue;let s=cross>0;if(sign===null)sign=s;else if(sign!==s)return false}return true}
function locate(ev){const b=cv.getBoundingClientRect(),sx=ev.clientX-b.left-w*.5,sy=ev.clientY-b.top-h*.5,camTime=clock,camNow=visualClock;syncAim(camNow,0);const cam=applyCameraDirector(camTime,camNow,cinematicCamera(camTime,camNow)),inv=1/(cam.z||1),cs=Math.cos(cam.roll),sn=Math.sin(cam.roll),px=cam.x+(sx*cs+sy*sn)*inv,py=cam.y+(-sx*sn+sy*cs)*inv,z=clock<3?mix(.83,1,smooth(clock/3)):1,top=h*(.495-(z-1)*.07),height=h*(.265+(z-1)*.045);if(py<top||py>top+height)return null;const u=clamp((py-top)/height),width=mix(w*.43,w*.89,u)*z,left=w*.5-width*.5;if(px<left||px>left+width)return null;const c=Math.max(0,Math.min(7,Math.floor((px-left)/(width/8)))),r=Math.max(0,Math.min(7,Math.floor(u*8)));return {c,r}}
cv.addEventListener('pointermove',ev=>{hover=(status==='running'||integrationMode)?null:locate(ev)});cv.addEventListener('pointerleave',()=>hover=null);cv.addEventListener('click',ev=>{if(status==='running'||integrationMode)return;let s=locate(ev);if(!s)return;locked=s;markBattleDamageDirty();markBoardCacheDirty();rebuildBoardCache();rebuildBattleDamageCache();if(status==='done')resetAll();ui.target.textContent=name();updateBattleReport();tone(480,.12,.04,740)});
// Cinematic camera timeline. Camera transforms affect the rendered world only;
// the HTML HUD remains stable and readable above it.
const cameraCenter={x:0,y:0},cameraTarget={x:0,y:0},cameraOrbit={x:0,y:0},cameraPoint={x:0,y:0},cameraC1={x:0,y:0},cameraC2={x:0,y:0},cameraResult={x:0,y:0,z:1,roll:0},cameraDirectorResult={x:0,y:0,z:1,roll:0};
function cubicPoint(a,b,c,d,u,out=cameraPoint){const v=1-u;out.x=v*v*v*a.x+3*v*v*u*b.x+3*v*u*u*c.x+u*u*u*d.x;out.y=v*v*v*a.y+3*v*v*u*b.y+3*v*u*u*c.y+u*u*u*d.y;return out}
function curvedFocus(a,b,u,bend=0,out=cameraPoint){const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;cameraC1.x=a.x+dx*.25+nx*bend;cameraC1.y=a.y+dy*.25+ny*bend;cameraC2.x=a.x+dx*.75+nx*bend;cameraC2.y=a.y+dy*.75+ny*bend;return cubicPoint(a,cameraC1,cameraC2,b,smooth(u),out)}
function cinematicCamera(t,now){
 const T=targetPoint(1,cameraTarget),O=orbit(cameraOrbit),C=cameraCenter,M=muzzle,HIT=hit;C.x=w*.5;C.y=h*.5;let p=cameraPoint,z=.94,roll=0;
 if(replayView>=0&&t>=29&&t<37){const age=t-29;if(replayView===0){if(age<2.6)curvedFocus(C,M,.72,-w*.015,p);else curvedFocus(M,HIT,clamp((age-2.6)/4.4),w*.015,p);z=age<2.6?1.48:mix(1.48,1.2,smooth((age-2.6)/4.4));roll=Math.sin(now*.008)*.003}else if(replayView===1){const u=clamp(age/3.15);curvedFocus(M,HIT,u,-w*.018,p);z=mix(1.2,1.42,smooth(u));roll=Math.sin(now*.006)*.002}else{p.x=HIT.x;p.y=HIT.y;z=age<3?1.52:mix(1.52,1.28,smooth((age-3)/4));roll=Math.sin(Math.max(0,age-3)*11)*.012*Math.exp(-Math.max(0,age-3)*1.2)}cameraResult.x=p.x;cameraResult.y=p.y;cameraResult.z=z;cameraResult.roll=roll;return cameraResult}
 if(t<3){curvedFocus(C,T,t/3,w*.035,p);z=mix(.94,1.18,smooth(t/3))}
 else if(t<7){curvedFocus(T,O,(t-3)/4,-w*.025,p);z=mix(1.18,.94,smooth((t-3)/4))}
 else if(t<7.48){const u=(t-7)/.48;curvedFocus(O,T,u,w*.02,p);z=mix(.94,1.14,smooth(u))}
 else if(t<12.85){p.x=T.x+Math.sin(now*.002)*1.2;p.y=T.y+Math.cos(now*.0023)*.8;z=1.14+.015*Math.sin(now*.0018)}
 else if(t<13.55){const u=(t-12.85)/.7;curvedFocus(T,O,u,w*.025,p);z=mix(1.14,1.18,smooth(u))}
 else if(t<18){p.x=O.x;p.y=O.y;z=1.18}
 else if(t<24.68){const heat=clamp((t-21)/3.68);p.x=O.x+Math.sin(now*.018)*heat*1.15;p.y=O.y+Math.cos(now*.021)*heat*.85;z=mix(1.18,1.36,smooth((t-18)/6.68));roll=Math.sin(now*.018)*heat*.003}
 else if(t<25.18){const u=(t-24.68)/.5;curvedFocus(O,T,u,w*.055,p);z=mix(1.36,1.02,smooth(u))}
 else if(t<28){const u=(t-25.18)/2.82;curvedFocus(T,O,u,w*.10,p);z=mix(1.02,1.17,smooth(u))}
 else if(t<29){const u=t-28;curvedFocus(O,M,u,w*.025,p);z=mix(1.17,1.15,smooth(u))}
 else if(t<32){const u=(t-29)/3;curvedFocus(M,HIT,u,w*.018,p);z=mix(1.15,1.43,smooth(u))}
 else if(t<37){p.x=HIT.x;p.y=HIT.y;z=1.43;const age=t-32;roll=Math.sin(age*13)*.028*Math.exp(-age*1.4)}
 else if(t<43){curvedFocus(HIT,C,(t-37)/6,-w*.045,p);z=mix(1.43,.93,smooth((t-37)/6))}
 else{p.x=C.x;p.y=C.y;z=mix(.93,.86,smooth((t-43)/2))}
 cameraResult.x=p.x;cameraResult.y=p.y;cameraResult.z=z;cameraResult.roll=roll;return cameraResult;
}

function cameraCutFade(t){return 0;} // V7: no black screen overlay; camera changes are continuous curved moves.



function strikeFootprint(now,t){
 // The game weapon covers a 3x3 area around the selected square. Show that footprint before and during impact.
 const active=(t>=26.65&&t<35.2);if(!active)return;
 const p=clamp((t-26.65)/.45)*(1-smooth((t-34.1)/1.1));if(p<=0)return;
 const pulse=.5+.5*Math.sin(now*.018),z=1;
 ctx.save();ctx.globalCompositeOperation='screen';
 for(let r=Math.max(0,locked.r-1);r<=Math.min(7,locked.r+1);r++)for(let c=Math.max(0,locked.c-1);c<=Math.min(7,locked.c+1);c++){
   const a=square(c,r,z),b=square(c+1,r,z),d=square(c+1,r+1,z),e=square(c,r+1,z);
   const center=(c===locked.c&&r===locked.r),alpha=p*(center ? .19 : .075)*(0.78+pulse*.22);
   polygon([a,b,d,e],`rgba(${center?'255,92,35':'255,111,54'},${alpha})`,center?'rgba(255,210,154,.96)':'rgba(255,112,62,.62)',center?2.4:1.2);
   if(!center){const q=square(c+.5,r+.5,z);glow(q.x,q.y,10+pulse*7,`rgba(255,111,54,${alpha*.65})`)}
 }
 const center=square(locked.c+.5,locked.r+.5,z),rad=26+pulse*8;
 for(let i=0;i<3;i++)ellipse(center.x,center.y,rad+i*14,(rad+i*14)*.42,'#ff8b4a',1.4,p*(.58-i*.13),now*.0005+i*.5);
 ctx.restore();
}



function drawCachedBattleDamage(){
 if(!battleDamageCache||!battleDamageCache.width)return;
 const P=targetPoint(1),cw=battleDamageCache.width/chosenCacheScale, ch=battleDamageCache.height/chosenCacheScale;
 ctx.drawImage(battleDamageCache,P.x-cw*.5,P.y-ch*.39,cw,ch);
}
function rebuildBattleDamageCache(){
 const base=qualityMode==='ULDM'?180:qualityMode==='LDM'?240:320;
 chosenCacheScale=Math.max(.85,Math.min(1.35,w/760));
 const W=Math.round(base*chosenCacheScale),H=Math.round(base*.62*chosenCacheScale);
 battleDamageCache=document.createElement('canvas');battleDamageCache.width=W;battleDamageCache.height=H;battleDamageCtx=battleDamageCache.getContext('2d');
 const g=battleDamageCtx,cx=W*.5,cy=H*.39;
 g.clearRect(0,0,W,H);g.save();g.translate(cx,cy);g.scale(1,.39);
 const rg=g.createRadialGradient(0,0,12,0,0,W*.22);rg.addColorStop(0,'rgba(8,10,14,.92)');rg.addColorStop(.62,'rgba(6,9,14,.86)');rg.addColorStop(1,'rgba(0,0,0,0)');
 g.fillStyle=rg;g.beginPath();g.ellipse(0,0,W*.17,H*.17,0,0,TAU);g.fill();
 g.globalCompositeOperation='screen';
 g.strokeStyle='rgba(255,108,58,.72)';g.lineWidth=Math.max(1.6,W*.008);
 g.beginPath();g.ellipse(0,0,W*.165,H*.13,0,0,TAU);g.stroke();
 g.strokeStyle='rgba(255,198,123,.34)';g.lineWidth=Math.max(1.1,W*.0046);g.beginPath();g.ellipse(0,0,W*.115,H*.082,0,0,TAU);g.stroke();
 const cracks=qualityMode==='ULDM'?7:qualityMode==='LDM'?11:17;
 for(let i=0;i<cracks;i++){
   const a=i*TAU/cracks+Math.sin(i*9.3)*.12,bend=Math.sin(i*4.7)*.18;
   const inner=W*(.06+(i%4)*.014),mid=W*(.12+(i%5)*.024),outer=W*(.2+(i%5)*.04);
   g.beginPath();g.moveTo(lutCos(a)*inner,lutSin(a)*inner);g.lineTo(lutCos(a+bend)*mid,lutSin(a+bend)*mid);g.lineTo(lutCos(a-bend*.45)*outer,lutSin(a-bend*.45)*outer);
   g.strokeStyle=i%3===0?'rgba(255,147,82,.46)':'rgba(10,12,18,.72)';g.lineWidth=i%4===0?2.2:1.2;g.stroke();
 }
 g.restore();
 battleDamageCacheDirty=false;battleDamageCacheKey=`${qualityMode}:${w|0}:${h|0}:${locked.c}:${locked.r}`;
}
function ensureBattleDamageCache(){
 const key=`${qualityMode}:${w|0}:${h|0}:${locked.c}:${locked.r}`;
 if(battleDamageCacheDirty||!battleDamageCache||battleDamageCacheKey!==key)rebuildBattleDamageCache();
}
function atmosphericShockfront(now,t){
 if(t<32||t>39.2)return; const age=t-32,power=1-smooth((t-37.7)/1.5); if(power<=.001)return;
 const base=18+age*(85+age*22),waveAlpha=.22*power;
 ctx.save();ctx.globalCompositeOperation='screen';
 for(let i=0;i<3;i++){
   const r=base*(1+i*.2),alpha=waveAlpha*(1-i*.24),rot=now*.00018*(i%2?1:-1);
   ctx.save();ctx.translate(hit.x,hit.y);ctx.scale(1,.41+i*.02);ellipse(0,0,r*1.28,r,i===0?'#ffdfb0':i===1?'#8edfff':'#6bb7ff',i===0?2.4:1.35,alpha,rot);ctx.restore();
 }
 const n=qualityMode==='ULDM'?8:qualityMode==='LDM'?14:22;
 for(let i=0;i<n;i++){
   const s=shockfrontSeeds[i],a=s.phase+age*(.55+s.drift),r=base*(.68+s.reach*.52),x=hit.x+lutCos(a)*r,y=hit.y+lutSin(a)*r*.42;
   glow(x,y,8+s.arc*10,`rgba(${i%3===0?'255,226,171':'122,214,255'},${power*(.08+s.arc*.09)})`);
   if(i%2===0)line(x-lutCos(a)*7,y-lutSin(a)*4,x+lutCos(a)*10,y+lutSin(a)*6,`rgba(255,218,150,${power*.18})`,1.1);
 }
 const haze=ctx.createRadialGradient(hit.x,hit.y,base*.25,hit.x,hit.y,base*1.45);haze.addColorStop(0,`rgba(255,194,136,${power*.08})`);haze.addColorStop(.55,`rgba(97,196,255,${power*.05})`);haze.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=haze;ctx.fillRect(hit.x-base*1.6,hit.y-base*.9,base*3.2,base*1.8);
 ctx.restore();
}
function atmosphericDistortion(now,t){
 const beamActive=t>=29&&t<33.9,impactActive=t>=31.9&&t<38;
 if(!beamActive&&!impactActive)return;
 const power=beamActive?clamp((t-29)/.32)*(1-smooth((t-33.1)/.8)):clamp((t-31.9)/.22)*(1-smooth((t-36.8)/1.2));
 if(power<=.001)return;
 const dx=hit.x-muzzle.x,dy=hit.y-muzzle.y,len=Math.hypot(dx,dy)||1,angle=Math.atan2(dy,dx),nx=-dy/len,ny=dx/len;
 const count=qualityMode==='ULDM'?5:qualityMode==='LDM'?10:18;
 ctx.save();ctx.globalCompositeOperation='screen';
 if(beamActive){
  for(let i=0;i<count;i++){
   const s=distortionSeeds[i],u=fract(now*.00011*s.amp+s.offset),x=mix(muzzle.x,hit.x,u),y=mix(muzzle.y,hit.y,u),wav=.5+.5*Math.sin(now*.006+s.phase*2.1),r=(7+18*Math.sin(u*PI))*(.72+.28*Math.sin(now*.004+s.phase));
   ctx.save();ctx.translate(x+lutCos(now*.003+s.twist)*r*.35,y+lutSin(now*.004+s.twist*1.7)*r*.5);ctx.rotate(angle);
   ellipse(0,0,r*1.8,r*.46,i%2?'#ff9a54':'#b9f7ff',1.05,power*(.13+.18*wav),now*.00008);
   line(-r*1.7,-r*.28,r*1.7,r*.28,`rgba(255,211,159,${power*.13})`,1);ctx.restore();
  }
 }
 if(impactActive){
  const age=Math.max(0,t-32),ringsN=qualityMode==='ULDM'?3:qualityMode==='LDM'?5:8;
  for(let i=0;i<ringsN;i++){
   const phase=fract(age*.72+i/ringsN),radius=18+phase*(90+age*24);
   ctx.save();ctx.translate(hit.x,hit.y);ctx.scale(1,.39);
   ellipse(0,0,radius*1.35,radius,'#ffb56f',1.2,power*(1-phase)*.24,now*.0003+i*.18);
   ellipse(0,0,radius*1.12,radius*.82,'#9cecff',.8,power*(1-phase)*.13,-now*.0002);ctx.restore();
  }
  const n=qualityMode==='ULDM'?5:qualityMode==='LDM'?9:16;
  for(let i=0;i<n;i++){const a=i*TAU/n+now*.00018,rr=30+((i*37)%61)+Math.sin(now*.004+i)*8,x=hit.x+lutCos(a)*rr,y=hit.y+lutSin(a)*rr*.43;line(x-8,y-4,x+10,y+5,`rgba(255,197,131,${power*.3})`,1.2)}
 }
 atmosphericShockfront(now,t);
 ctx.restore();
}

function dynamicBattlefieldAtmosphere(now,age,glowLife){
 ctx.save();ctx.globalCompositeOperation='screen';
 for(let i=0;i<smokeSeeds.length;i++){if(qualityMode==='ULDM'&&i>8)break;if(qualityMode==='LDM'&&i>13)break;const q=smokeSeeds[i],u=fract(age*.05*q.sway+q.phase/TAU),x=hit.x+lutCos(q.phase+age*.1)*q.dist*.45,y=hit.y-lutSin(q.phase*.7+age*.15)*q.lift*u*.55;glow(x,y,Math.max(5,q.size*(.58+u*.72)),`rgba(${i%3===0?'255,139,82':'115,214,255'},${glowLife*(.035+u*.038)})`)}
 for(let i=0;i<emberSeeds.length;i++){if(qualityMode==='ULDM'&&i>6)break;const e=emberSeeds[i],lift=fract(age*.11+e.seed),a=e.phase+age*.36*(i%2?1:-1),r=e.dist*(.72+lift*.58),x=hit.x+lutCos(a)*r,y=hit.y+lutSin(a)*r*.35-lift*18;glow(x,y,3.6+lift*4.5,`rgba(${i%2?'255,96,49':'115,214,255'},${glowLife*(.09+lift*.08)})`)}
 const n=qualityMode==='ULDM'?4:qualityMode==='LDM'?7:12;for(let pass=0;pass<3;pass++){ctx.beginPath();for(let i=0;i<n;i++){const isOrange=i%2===1,isWide=i%4===0;if((pass===0&&!isOrange)||(pass===1&&(isOrange||!isWide))||(pass===2&&(isOrange||isWide)))continue;const ang=i*TAU/n+age*.12,inner=18+(i%3)*8,outer=48+(i%5)*12;ctx.moveTo(hit.x+lutCos(ang)*inner,hit.y+lutSin(ang)*inner*.42);ctx.lineTo(hit.x+lutCos(ang)*outer,hit.y+lutSin(ang)*outer*.44)}ctx.strokeStyle=pass===0?`rgba(255,122,62,${glowLife*.18})`:`rgba(92,211,255,${glowLife*.1})`;ctx.lineWidth=pass===1?1.8:1.1;ctx.stroke();}
 // Molten fissures pulse beneath the crater rim. Same crack map, animated energy only.
 const pulse=.5+.5*Math.sin(now*.012),fissure=glowLife*(.18+.18*pulse);ctx.lineWidth=2.2;ctx.strokeStyle=`rgba(255,116,54,${fissure})`;ctx.beginPath();
 for(let i=0;i<impactCrackSeeds.length;i+=2){const d=impactCrackSeeds[i],reach=42+Math.min(age,4)*(22+i%8*5),x0=hit.x+d.c*10,y0=hit.y+d.s*5,x1=hit.x+d.c*reach*.56,y1=hit.y+d.s*reach*.27,x2=hit.x+d.c2*reach,y2=hit.y+d.s2*reach*.48;ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.lineTo(x2,y2)}ctx.stroke();
 const flare=age<3?1-smooth(age/3):0;if(flare>.01){for(let i=0;i<6;i++){const a=i*TAU/6+now*.00025,r=32+(i%3)*18,x=hit.x+lutCos(a)*r,y=hit.y+lutSin(a)*r*.36;glow(x,y,12+flare*9,`rgba(255,135,64,${flare*glowLife*.22})`)}}
 ctx.restore();
}
function persistentBattleDamage(now,t){
 if(t<32.15)return;
 ensureBattleDamageCache();
 const age=t-32.15,reveal=smooth(age/.82),glowLife=1-smooth(Math.max(0,age-1.2)/8);
 ctx.save();ctx.globalAlpha=reveal;drawCachedBattleDamage();ctx.restore();
 dynamicBattlefieldAtmosphere(now,age,glowLife);
}
function cameraShotName(t){
 if(replayView>=0)return ['REPLAY / MUZZLE POV','REPLAY / BEAM TRACK','REPLAY / IMPACT POV'][replayView]||'REPLAY';
 if(t<3)return 'SHOT 01 / TARGET LOCK';if(t<7)return 'SHOT 02 / UPLINK ESTABLISH';if(t<12.8)return 'SHOT 03 / GROUND ARRAY';
 if(t<18)return 'SHOT 04 / ORBITAL DEPLOYMENT';if(t<24.7)return 'SHOT 05 / REACTOR MACRO';if(t<28)return 'SHOT 06 / ENERGY RECAPTURE';
 if(t<29)return 'SHOT 07 / MUZZLE ALIGNMENT';if(t<31.9)return 'SHOT 08 / BEAM TRACK';if(t<37)return 'SHOT 09 / IMPACT LOW ANGLE';return 'SHOT 10 / POST-STRIKE PULLBACK';
}
function applyCameraDirector(t,now,base){
 if(!cameraEnabled)return base;let fx=base.x,fy=base.y,weight=.16,zoom=1;
 if(t>=13&&t<18){fx=origin.x;fy=origin.y;weight=.2;zoom=1.035}
 else if(t>=18&&t<28){fx=origin.x;fy=origin.y;weight=.22;zoom=1.045}
 else if(t>=29&&t<32){const u=clamp((t-29)/3);fx=mix(muzzle.x,hit.x,u);fy=mix(muzzle.y,hit.y,u);weight=.18;zoom=1.025}
 else if(t>=32&&t<37){fx=hit.x;fy=hit.y;weight=.2;zoom=1.035}
 else if(t>=37){const u=smooth((t-37)/6);fx=mix(hit.x,w*.5,u);fy=mix(hit.y,h*.5,u);weight=.13}
 cameraDirectorResult.x=mix(base.x,fx,weight)+Math.sin(now*.0011)*.7;cameraDirectorResult.y=mix(base.y,fy,weight)+Math.cos(now*.0013)*.55;cameraDirectorResult.z=base.z*zoom;cameraDirectorResult.roll=base.roll;return cameraDirectorResult;
}
function timeDilationScale(t){
 const inRamp=smooth((t-31.68)/.14),outRamp=1-smooth((t-32.42)/.43);
 return 1-.82*inRamp*outRamp;
}
function previewBlastData(){
 const impacted=troops.filter(([,c,r])=>Math.abs(c-locked.c)<=1&&Math.abs(r-locked.r)<=1),white=impacted.filter(p=>p[3]===1).length,black=impacted.length-white;
 const minC=Math.max(0,locked.c-1),maxC=Math.min(7,locked.c+1),minR=Math.max(0,locked.r-1),maxR=Math.min(7,locked.r+1);
 return {pieces:impacted.length,white,black,cells:(maxC-minC+1)*(maxR-minR+1)};
}
function moneyLabel(value,currency='USD'){const n=Number(value);if(!Number.isFinite(n))return 'LIVE GAME DATA NOT CONNECTED';return `${currency==='USD'?'$':currency+' '}${n.toLocaleString(undefined,{maximumFractionDigits:2})}`}

function updateBattleReport(){
 const preview=previewBlastData(),data=liveBattleReport,pieces=data&&Number.isFinite(data.piecesInZone)?data.piecesInZone:preview.pieces;
 const white=data&&Number.isFinite(data.whiteInZone)?data.whiteInZone:preview.white,black=data&&Number.isFinite(data.blackInZone)?data.blackInZone:preview.black;
 const cells=preview.cells,coverage=Math.round(cells/9*100),density=Math.min(100,Math.round(pieces/Math.max(1,cells)*100)),index=Math.min(100,Math.round((pieces/Math.max(1,troops.length))*100));
 reportTargetName.textContent=name();reportCells.textContent=`${cells} / 9`;reportPieces.textContent=String(pieces);reportSides.textContent=`${white} / ${black}`;
 reportAssetValue.textContent=data&&Number.isFinite(data.destroyedAssetValue)?moneyLabel(data.destroyedAssetValue,data.currency||'USD'):'LIVE GAME DATA NOT CONNECTED';
 reportAssessment.textContent=data&&data.assessment?String(data.assessment).slice(0,72):`${pieces} PREVIEW CONTACTS · BUILT-IN BOARD ONLY`;
 reportCoverage.textContent=`${cells} / 9 CELLS`;reportDensity.textContent=`${pieces} CONTACT${pieces===1?'':'S'}`;reportIndex.textContent=`${index}%`;
 reportCoverageFill.style.width=coverage+'%';reportDensityFill.style.width=density+'%';reportIndexFill.style.width=index+'%';
 reportVerdictText.textContent=pieces>=7?'CATASTROPHIC · TOTAL ZONE SATURATION':pieces>=4?'SEVERE · MULTIPLE ASSETS HIT':pieces>0?'CONFIRMED · PARTIAL CASUALTIES':'NO PIECES IN STRIKE ZONE';
}
function sendParent(type,detail={}){
 if(window.parent!==window)window.parent.postMessage({source:'CATACLYSM_V16',type,...detail},'*');
}
function setTargetSquare(squareName){
 const m=String(squareName||'').trim().match(/^([a-h])([1-8])$/i);
 if(!m)return false;
 if(status==='running')return false;
 if(status==='done')resetAll();
 locked={c:m[1].toLowerCase().charCodeAt(0)-97,r:8-Number(m[2])};
 hover=null;markBattleDamageDirty();markBoardCacheDirty();rebuildBoardCache();rebuildBattleDamageCache();
 ui.target.textContent=name();updateBattleReport();
 return true;
}
function setIntegrationMode(enabled=true){
 integrationMode=!!enabled;root.classList.toggle('capitalist-mode',integrationMode);
 if(integrationMode){
  ui.description.textContent='CAPITALIST CHESS · HOST-AUTHORIZED ORBITAL STRIKE · 3×3 AREA';
  root.querySelector('.smallnote').textContent='WEAPON SEQUENCE CONTROLLED BY CAPITALIST CHESS · REPLAY / CAMERA / QUALITY SETTINGS AVAILABLE';
 }else{
  root.querySelector('.smallnote').textContent='CLICK SQUARE → FIRE · CAMERA REPLAY · EMERGENCY REARM · V16 CACHED RENDER PIPELINE · UNLOCKED FPS';
 }
}
function updateWeaponPriceLabels(){
 const label=moneyLabel(weaponCost,weaponCurrency);
 root.querySelectorAll('.weaponCostLabel,.weaponCostButton,.reportCostLabel').forEach(el=>el.textContent=label);
 fire.setAttribute('aria-label','Authorize orbital strike · '+label);
}
function configureHost(options={}){
 if(!options||typeof options!=='object')return false;
 if(options.embedded!==undefined)setIntegrationMode(options.embedded);
 if(options.cost!==undefined&&Number.isFinite(Number(options.cost)))weaponCost=Math.max(0,Number(options.cost));
 if(typeof options.currency==='string'&&options.currency.length<=8)weaponCurrency=options.currency;
 if(typeof options.muted==='boolean'){muted=options.muted;sound.textContent=muted?'SFX OFF':'SFX ON'}
 if(typeof options.cameraEnabled==='boolean'){cameraEnabled=options.cameraEnabled;cameraBtn.textContent=cameraEnabled?'CAM ON':'CAM OFF'}
 updateWeaponPriceLabels();
 if(options.target&&!setTargetSquare(options.target))return false;
 if(Array.isArray(options.pieces)){
  troops.length=0;
  for(const p of options.pieces.slice(0,64)){
   if(!Number.isInteger(p.c)||p.c<0||p.c>7||!Number.isInteger(p.r)||p.r<0||p.r>7)continue;
   troops.push([String(p.glyph||'').slice(0,4),p.c,p.r,p.color==='w'?1:0]);
  }
  markBoardCacheDirty();markBattleDamageDirty();
 }
 if(['HIGH','LDM','ULDM'].includes(options.quality)){qualityMode=options.quality;qualitySelect.value=qualityMode;}
 if(Number.isFinite(options.resolutionScale))resolutionScale=clamp(options.resolutionScale,.5,1.5);
 if(Number.isFinite(options.fpsLimit))fpsLimit=clamp(options.fpsLimit,0,120);
 if(typeof options.adaptiveQuality==='boolean')adaptiveQuality=options.adaptiveQuality;
 resolutionSelect.value=String(resolutionScale);fpsLimitSelect.value=String(fpsLimit);applyQuality();
 if(options.report)window.CATACLYSM.setBattleReport(options.report);
 return true;
}
window.CATACLYSM=window.CATACLYSM||{};
window.CATACLYSM.version='V16';
window.CATACLYSM.configure=configureHost;
window.CATACLYSM.setTarget=setTargetSquare;
window.CATACLYSM.launch=function(options={}){
 if(disposed||status==='running')return false;
 if(options.target&&!setTargetSquare(options.target))return false;
 if(options.report)window.CATACLYSM.setBattleReport(options.report);
 if(status==='done')resetAll();
 start();
 return true;
};
window.CATACLYSM.reset=function(){resetAll();parentNotified=false;return true};
window.CATACLYSM.setBattleReport=function(data){
 if(!data||typeof data!=='object')return;
 const numeric=v=>Number.isFinite(Number(v))?Number(v):null;
 liveBattleReport={piecesInZone:numeric(data.piecesInZone),whiteInZone:numeric(data.whiteInZone),blackInZone:numeric(data.blackInZone),destroyedAssetValue:numeric(data.destroyedAssetValue),currency:typeof data.currency==='string'?data.currency:'USD',assessment:typeof data.assessment==='string'?data.assessment:''};
 updateBattleReport();
};
window.CATACLYSM.getState=function(){return {status,target:name(),integrationMode,weaponCost,weaponCurrency}};
function handleHostMessage(event){
 if(event.source!==window.parent||event.origin!==location.origin||!event.data||typeof event.data!=='object')return;
 const msg=event.data;
 if(msg.type==='CAPITALIST_CHESS:CONFIG')configureHost(msg.options||msg);
 else if(msg.type==='CAPITALIST_CHESS:LAUNCH')window.CATACLYSM.launch(msg.options||msg);
 else if(msg.type==='CAPITALIST_CHESS:RESET')window.CATACLYSM.reset();
}
window.addEventListener('message',handleHostMessage);
function onIntegrationKey(event){
 if(integrationMode&&event.key==='Escape'){event.preventDefault();sendParent('CATACLYSM:SKIP');}
}
document.addEventListener('keydown',onIntegrationKey);
window.CATACLYSM.destroy=function(){
 if(disposed)return;disposed=true;cancelAnimationFrame(animationFrame);animationFrame=0;stopSounds();
 observers.forEach(observer=>observer.disconnect());
 document.removeEventListener('visibilitychange',onVisibilityChange);
 document.removeEventListener('keydown',onIntegrationKey);
 window.removeEventListener('resize',resize);window.removeEventListener('message',handleHostMessage);
 if(ac){ac.close().catch(()=>{});ac=null;}
 glowSpriteCache.clear();backdropCache=boardCache=damagedBoardCache=battleDamageCache=null;
};
updateWeaponPriceLabels();
if(window.parent!==window)sendParent('CATACLYSM:READY',{version:'V16',capabilities:['configure','setTarget','launch','reset','setBattleReport','getPerformanceReport']});

window.CATACLYSM.getPerformanceReport=function(){
 const avgFrame=perfHistory.length?perfHistory.reduce((a,b)=>a+b,0)/perfHistory.length:0,sortedIntervals=frameIntervals.slice().sort((a,b)=>a-b),p99Interval=sortedIntervals.length?sortedIntervals[Math.min(sortedIntervals.length-1,Math.floor(sortedIntervals.length*.99))]:0;
 const input=perfEventDurations.slice().sort((a,b)=>a-b),inpApprox=input.length?input[Math.min(input.length-1,Math.floor(input.length*.98))]:0,mem=performance.memory||null;
 return {qualityMode,resolutionScale,measuredFps,avgFrameMs:avgFrame,onePercentLowFps:p99Interval?1000/p99Interval:0,inpApproxMs:inpApprox,eventSamples:input.length,longTaskCount:perfLongTaskCount,longTaskTotalMs:perfLongTaskTotalMs,longTaskMaxMs:perfLongTaskMaxMs,heapUsedMB:mem?mem.usedJSHeapSize/1048576:null,heapLimitMB:mem?mem.jsHeapSizeLimit/1048576:null,lastSections:{...perfSectionState},samples:perfHistory.length,frameIntervalSamples:frameIntervals.length,glowSpriteCacheEntries:glowSpriteCache.size,gcMetrics:'Not exposed by the page Performance API'};
};


function updateCriticalHud(now,t){
 if(now-lastCriticalUpdate<120)return;lastCriticalUpdate=now;
 const temp=t<18?320+t*5:t<21?410+(t-18)*180:t<25?950+(t-21)*150:t<32?1550:t<37?1550-(t-32)*95:t<43?1075-(t-37)*120:355;
 const output=t<18?Math.max(0,(t-13)*9):t<25?Math.min(100,45+(t-18)*9):t<29?100:t<33?100:t<37?Math.max(24,100-(t-33)*13):t<43?Math.max(0,48-(t-37)*8):0;
 const coolant=t<35?100:t<43?Math.min(100,(t-35)*13):100;
 const stability=t<18?100:t<21?98:t<25?Math.max(60,98-(t-21)*9):t<29?Math.max(18,62-(t-25)*11):t<32?Math.max(10,24-(t-29)*5):t<37?Math.max(8,18-(t-32)*2):t<43?Math.min(96,18+(t-37)*13):100;
 const rpm=t<13?0:t<18?Math.round(smooth((t-13)/5)*4200):t<25?Math.round(mix(4200,18250,smooth((t-18)/7))):t<29?18800:t<37?Math.round(mix(18800,8400,smooth((t-29)/8))):t<43?Math.round(mix(8400,1200,smooth((t-37)/6))):0;
 let eta='--';
 if(t<29)eta=(29-t).toFixed(1)+' s';
 else if(t<32)eta=(32-t).toFixed(1)+' s';
 else if(t<37)eta='IMPACT';
 else eta='RECOVER';
 coreTempEl.textContent=Math.round(temp)+' K';
 tempFill.style.width=clamp(temp/1700)*100+'%';
 outputValueEl.textContent=Math.round(output)+'%';
 outputFill.style.width=output+'%';
 beamStabilityEl.textContent=Math.round(stability)+'%';
 coilRpmEl.textContent=Math.round(rpm).toLocaleString()+' RPM';
 etaEl.textContent=eta;
 coolantStateEl.textContent=t<18?'SYSTEM NOMINAL':t<21?'REACTOR CRITICAL':t<29?'CONTAINMENT FAILURE':t<37?'MAXIMUM DISCHARGE':t<43?'CORE STABILIZING':'WEAPON READY';
 coolantPctEl.textContent=Math.round(coolant)+'%';
 criticalHUD.classList.toggle('hot',t>=18&&t<38);criticalHUD.style.display=t>=18&&t<45?'block':'none';
}
let lastFrame=0;
function render(now){
 if(disposed||document.hidden)return;
 const frameStart=performance.now();
 const realDelta=lastClockTick?Math.max(0,Math.min(100,now-lastClockTick)):0;lastClockTick=now;
 const simScale=status==='running'?timeDilationScale(clock):1;
 if(status==='running')clock+=realDelta/1000*simScale;
 visualClock+=realDelta*simScale;const fxNow=visualClock;
 const targetLimit=status==='running'?(fpsLimit>0?fpsLimit:0):(fpsLimit>0?fpsLimit:20);
 if(targetLimit>0&&lastFrame>0&&now-lastFrame<(1000/targetLimit)-.5){scheduleRender();return;}
 const frameGap=lastFrame>0?now-lastFrame:0;lastFrame=now;
 if(frameGap>0){fpsFrames++;if(!fpsWindowStart)fpsWindowStart=now;if(now-fpsWindowStart>=500){measuredFps=fpsFrames*1000/(now-fpsWindowStart);fpsValue.textContent=String(Math.round(measuredFps));frameMs.textContent=(1000/Math.max(1,measuredFps)).toFixed(1);fpsFrames=0;fpsWindowStart=now;}}
 if(status==='running'&&clock>=DUR){clock=DUR;status='done';fire.disabled=false;fire.textContent='↻ REPLAY '+moneyLabel(weaponCost,weaponCurrency)+' STRIKE';updateBattleReport();damageReport.classList.add('open');if(!parentNotified){parentNotified=true;sendParent('CATACLYSM:COMPLETE',{target:name(),report:liveBattleReport||previewBlastData()})}}
const t=clock,c=clamp;
if(status!=='idle'){let idx=stages.reduce((n,s,i)=>t>=s[0]?i:n,0);if(idx!==stageIndex){stageIndex=idx;stageChanged(idx)}}
const ground=t<3?0:t<7?smooth((t-3)/4):100/100;
const core=t<13?0:t<18?smooth((t-13)/5)*.48:t<23?mix(.48,.95,smooth((t-18)/5)):t<25?mix(.95,1,smooth((t-23)/2)):1;
const n=deployedNodes(t);synchronizeNodeBirths(t);
if(status==='running'&&t>=25.25&&t<27.6){for(let j=0;j<5;j++){let at=25.25+j*.48;if(t>=at)once('absorb-'+j,()=>{tone(780-j*85,.42,.04,180,'sawtooth');noise(.12,.045,true)})}}
ui.ground.textContent=Math.round(ground*100)+'%';ui.nodes.textContent=n+' / 5';ui.reactor.textContent=Math.round(core*100)+'%';ui.timer.textContent='T+ '+t.toFixed(1).padStart(4,'0')+' s';ui.fill.style.width=(t/DUR*100)+'%';ui.target.textContent=name();
ui.warning.textContent=t>=18&&t<21?'⚠ REACTOR CRITICAL · OUTPUT CLIMBING':t>=21&&t<28?'⚡ CONTAINMENT FAILURE · CRITICAL ARCING':t>=29&&t<35?'☢ MUZZLE DISCHARGE / BEAM PHASE TRANSITION':t>=35&&t<43?'⚠ REACTOR MELTDOWN · COOLANT PURGE':t>=43?'✓ REACTOR STABLE · WEAPON READY':'';
updateCriticalHud(now,t);replayLabel.style.display=replayView>=0&&t>=29&&t<37?'block':'none';
const dilated=t>=31.68&&t<32.95;timeDilationHUD.classList.toggle('active',dilated);timeDilationValue.textContent=`TIME DILATION · ×${timeDilationScale(t).toFixed(2)}`;
directorHUD.style.display=status==='idle'?'none':'block';if(now-lastDirectorUpdate>140){const label=cameraShotName(t);if(label!==lastDirectorLabel){directorShotEl.textContent=label;lastDirectorLabel=label}lastDirectorUpdate=now;}
if(status==='running'&&t>=21&&t<28&&now>nextCrackle){nextCrackle=now+(t<23?300:t<25?190:120);noise(.07+Math.random()*.11,.07+core*.06);if(Math.random()<.37)tone(400+Math.random()*1200,.1,.035,110,'sawtooth')}
const recoil=t>=29&&t<31.6?Math.max(0,Math.sin((t-29)*PI/2.6))*24:0;syncAim(fxNow,recoil);
const zoom=t<3?mix(.83,1,smooth(t/3)):1;
let shake=t>=29&&t<34?(t<32?5:13)*(1-c((t-29)/5)):0;
if(t>=32&&t<37){const age=t-32;let kick=(age<.12?30:Math.exp(-age*1.55)*(32*Math.sin(age*32)+13*Math.sin(age*63)));shake+=Math.abs(kick)}
ctx.clearRect(0,0,w,h);ctx.save();if(shake)ctx.translate(Math.sin(fxNow*.09)*shake,Math.cos(fxNow*.13)*shake*.72);
let perfMark=performance.now();
const baseCamera=cinematicCamera(t,fxNow),camera=applyCameraDirector(t,fxNow,baseCamera);perfSectionAccum.camera+=performance.now()-perfMark;
ctx.translate(w*.5,h*.5);ctx.rotate(camera.roll);ctx.scale(camera.z,camera.z);ctx.translate(-camera.x,-camera.y);
backdrop(fxNow);board(fxNow,zoom,t>=32);if(t>=32)boardRupture(t-32);strikeFootprint(fxNow,t);if(t<4)lockVisual(fxNow);
if(t>=3&&t<28){groundLattice(fxNow,ground);let fadeIn=smooth((t-3)/1.4),fadeOut=1-smooth((t-26.4)/1.6);let a=hit,o=origin;beam(a,o,5+ground*5,fadeIn*fadeOut,false,smooth((t-3)/2.3));if(t>=5)beamParticles(fxNow,a,o,80,7,fadeIn*fadeOut*.38);uplinkOverdrive(fxNow,ground,clamp((t-21)/4));if(t>=10)helices(fxNow,a,o,clamp((t-10)/6)*fadeOut);
if(t>=21&&t<28&&qualityMode!=='ULDM')highVoltage(fxNow,clamp((t-21)/3)*fadeOut)}
if(t>=NODE_START&&t<28){resonanceWeb(fxNow);rings(fxNow);}
if(t>=8&&t<28&&qualityMode!=='ULDM')v3FluxGates(fxNow);
if(t>=13&&t<28){let heat=t<21?0:clamp((t-21)/3.2);charging(fxNow,core,heat);chargeDecorations(fxNow,core,heat);if(t>=23){lens(fxNow,.5+heat*.5);glow(origin.x,origin.y,125+Math.abs(Math.sin(fxNow*.06))*80,`rgba(133,235,255,${.15+heat*.22})`)}}
if(t>=18&&t<28&&qualityMode!=='ULDM')v3PlasmaCatastrophe(fxNow);
if(t>=12.9&&t<28&&qualityMode!=='ULDM')v3MechGantry(fxNow);
if(t>=25&&t<28){for(let i=0;i<9;i++){let u=fract(fxNow*.0007+i/9);let ang=i*TAU/9+fxNow*.00045,r=65+80*(1-u);glow(origin.x+Math.cos(ang)*r,origin.y+Math.sin(ang)*r*.66,10,`rgba(159,242,255,${.2+.4*u})`)}}
if(t<28||t>=29)satellite(fxNow,core,t>=21&&t<28?clamp((t-21)/3):0,recoil/24);if(t>=21&&t<28)overloadDynamics(fxNow,clamp((t-21)/3));
if(t>=27&&t<29)preFireCompression(fxNow);
if(t>=28&&t<29){satellite(fxNow,1);ctx.fillStyle='rgba(0,0,0,.86)';ctx.fillRect(0,0,w,h);type('FINAL RELEASE INTERLOCK',w*.5,h*.35,14,'#d8f7ff');type((29-t).toFixed(1)+'s',w*.5,h*.405,28,'#ffffff')}
if(t>=29&&t<33.6){let p=smooth((t-29)/.38),fade=t>32.5?1-smooth((t-32.5)/1.1):1;beam(muzzle,hit,17+48*p,fade,true,p);beamParticles(fxNow,muzzle,{x:mix(muzzle.x,hit.x,p),y:mix(muzzle.y,hit.y,p)},96,13,fade*.68,true);dischargeBeamDetails(fxNow,muzzle,hit,fade,p);maximumDischargeLance(fxNow,muzzle,hit,fade,p);beamPhaseTransition(fxNow,muzzle,hit,p);glow(muzzle.x,muzzle.y,150+Math.abs(Math.sin(fxNow*.045))*58,`rgba(255,75,25,${fade*.62})`);glow(muzzle.x,muzzle.y,70,`rgba(255,222,183,${fade*.48})`);if(t<32)for(let i=0;i<10;i++){let u=fract(fxNow*.0008+i/10),x=mix(muzzle.x,hit.x,u),y=mix(muzzle.y,hit.y,u);ellipse(x,y,20+i%3*8,5+i%3*3,i%3===0?'#fff6df':(i%2?'#ffb04e':'#ff4b2c'),2.1,.66)}if(t>=32)glow(hit.x,hit.y,100+125*(t-32),`rgba(255,88,35,${fade*.46})`)}
if(t>=32){perfMark=performance.now();buildImpact(fxNow,t-32);if(qualityMode!=='ULDM')v3WorldRend(fxNow,t-32);collisionWarning(t);if(qualityMode!=='ULDM')coolGas(fxNow);perfSectionAccum.impact+=performance.now()-perfMark}
perfMark=performance.now();atmosphericDistortion(fxNow,t);perfSectionAccum.atmo+=performance.now()-perfMark;
if(t>=32.15){perfMark=performance.now();persistentBattleDamage(fxNow,t);perfSectionAccum.battleDamage+=performance.now()-perfMark;}
if(t>=35)v3Meltdown(fxNow);
if(t>=37&&t<45)emergencyRearm(fxNow);
if(t>=38&&t<45){let p=smooth((t-38)/7);glow(hit.x,hit.y,150+p*120,`rgba(83,195,242,${(1-p)*.13})`)}
ctx.restore();
ui.shotfade.style.opacity='0';
let flash=0;if(t>29.02&&t<29.24)flash=Math.max(flash,(1-(t-29.02)/.22)*.34);if(t>=32&&t<32.48){let a=t-32;flash=Math.max(flash,a<.105?.99:a<.22?.82*(1-smooth((a-.105)/.115)):Math.pow(1-smooth((a-.22)/.26),1.7)*.26)}for(const delay of [.37,.78,1.3]){if(t>=32+delay&&t<32+delay+.13)flash=Math.max(flash,(1-(t-32-delay)/.13)*.24)}ui.glint.style.opacity=String(c(flash));fpsHud.style.display=showFps?'block':'none';
const frameCost=performance.now()-frameStart;
if(adaptiveQuality&&status==='running'){
 slowFrames=(frameCost>23||(frameGap>30&&fpsLimit>=50))?slowFrames+1:Math.max(0,slowFrames-1);
 if(slowFrames>=45&&now-lastQualityChange>3000){
  if(resolutionScale>.65){resolutionScale=Math.max(.65,resolutionScale-.15);resolutionSelect.value=String(resolutionScale);resize();}
  else if(qualityMode!=='ULDM'){qualityMode=qualityMode==='HIGH'?'LDM':'ULDM';qualitySelect.value=qualityMode;applyQuality();}
  slowFrames=0;lastQualityChange=now;
 }
}
perfSectionAccum.frame+=frameCost;perfBudgetFrames++;perfHistory.push(frameCost);if(perfHistory.length>240)perfHistory.shift();if(frameGap>0){frameIntervals.push(frameGap);if(frameIntervals.length>240)frameIntervals.shift();}
if(now-perfBudgetTick>260&&perfBudgetFrames){perfSectionState={camera:perfSectionAccum.camera/perfBudgetFrames,battleDamage:perfSectionAccum.battleDamage/perfBudgetFrames,atmo:perfSectionAccum.atmo/perfBudgetFrames,frame:perfSectionAccum.frame/perfBudgetFrames,impact:perfSectionAccum.impact/perfBudgetFrames};budgetLine.textContent=`BD ${perfSectionState.battleDamage.toFixed(1)} · ATM ${perfSectionState.atmo.toFixed(1)} · CAM ${perfSectionState.camera.toFixed(1)} · IMP ${perfSectionState.impact.toFixed(1)} · JS ${perfSectionState.frame.toFixed(1)}ms`;perfSectionAccum={camera:0,battleDamage:0,atmo:0,frame:0,impact:0};perfBudgetFrames=0;perfBudgetTick=now;}
scheduleRender()}updateBattleReport();scheduleRender();
})();

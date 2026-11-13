// 실행: node --test --test-isolation=none tests/special-art.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const definitions=JSON.parse(read('data/special-pieces.json')).pieces;

function environment(role=null){
  const nodes=new Map();
  const document={createElement(){return {innerHTML:''};},getElementById(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',classList:{remove(){}},querySelector(){return null;}});return nodes.get(id);}};
  const window={EconomyRules:require('../js/economyRules.js'),GameLanguage:{text:(_,fallback)=>fallback},
    multiplayer:role?{socket:{readyState:1},code:'ROOM',token:'token',role}:null};
  const sandbox={window,document,console,localStorage:{getItem:()=>null},SpecialPieces:{get:id=>definitions[id]||null}};
  vm.createContext(sandbox);
  vm.runInContext(read('js/specialPieceArt.js'),sandbox);
  vm.runInContext(read('game.js').replace(/init\(\);\s*$/,''),sandbox);
  vm.runInContext(read('js/pieceInfo.js'),sandbox);
  return {sandbox,window,document,state:window.gameState};
}

test('30종 모두 백·흑 SVG가 있고 글자·외부 이미지 없이 고유 도형 사용',()=>{
  const {window}=environment();const silhouettes=new Set();
  assert.equal(Object.keys(definitions).length,30);
  for(const [id,def] of Object.entries(definitions)){
    for(const color of ['w','b']){
      const asset=window.SpecialPieceArt.path(id,color);assert.ok(asset);
      const svg=read(asset);
      assert.match(svg,/<svg[^>]*viewBox="0 0 96 112"/);
      assert.match(svg,/<title>/);assert.ok(svg.includes(def.name));
      assert.doesNotMatch(svg,/<(?:text|image|script|foreignObject)\b|https?:\/\/(?!www\.w3\.org)|onload=/i);
      assert.doesNotMatch(svg,/\uFFFD|\r|^\uFEFF/);
    }
    const geometry=read(window.SpecialPieceArt.path(id,'w')).replace(/<title>.*?<\/title>|<style>.*?<\/style>/gs,'');
    assert.equal(silhouettes.has(geometry),false,id);silhouettes.add(geometry);
    assert.notEqual(read(window.SpecialPieceArt.path(id,'w')),read(window.SpecialPieceArt.path(id,'b')));
  }
  assert.equal(window.SpecialPieceArt.path('../escape'),null);
});

test('상점·상세정보와 왕 역할 특수기물까지 전용 그림을 사용하고 이름표를 만들지 않음',()=>{
  const {sandbox,window,document}=environment();
  for(const [id,def] of Object.entries(definitions)){
    for(const color of ['w','b']){
      const html=sandbox.specialChessVisual(def,color,'A "quoted" <label>');
      assert.ok(html.includes(`assets/pieces/special/${id}-${color}.svg`));
      assert.doesNotMatch(html,/<em>|<text>/);assert.match(html,/&quot;quoted&quot; &lt;label&gt;/);
      const board=sandbox.pieceVisual({type:'special',specialId:id,color});
      if(id!=='fake_king'||color==='w')assert.ok(board.includes(`${id}-${color}.svg`),id);
      window.showPieceInfo(def,1,true,'unit',id,color);
      const modal=document.getElementById('pieceInfoBody').innerHTML;
      assert.equal(modal.split(`${id}-${color}.svg`).length-1,2,id);
    }
  }
});

test('가짜 킹의 소유자만 가면 조각을 보고 상대·관전자는 일반 킹과 동일하게 표시',()=>{
  for(const role of ['host','guest','spectator',null]){
    const {sandbox,window,document,state}=environment(role);state.turn='b';
    for(const color of ['w','b']){
      const piece={type:'special',specialId:'fake_king',color};
      const viewer=role==='host'?'w':role==='guest'?'b':role==='spectator'?null:'b';
      const own=color===viewer;
      const html=sandbox.pieceVisual(piece);
      if(own)assert.ok(html.includes(`fake_king-${color}.svg`));
      else assert.equal(html,sandbox.pieceImgTag(color+'k','piece',color+'k'));
      window.showPieceInfo(definitions.fake_king,1,own,'unit',own?'fake_king':null,color);
      const modal=document.getElementById('pieceInfoBody').innerHTML;
      if(!own)assert.doesNotMatch(modal,/special\/fake_king-/);
    }
  }
});

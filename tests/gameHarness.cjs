// UI·음향·외부 엔진만 대체하고 실제 게임 로직을 실행합니다.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const C=require('../js/chessRules.js'),E=require('../js/setupEditor.js');
const definitions=JSON.parse(read('data/special-pieces.json')).pieces;
function env(){
  let serial=0;const nodes=new Map(),document={getElementById(id){if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',matches:()=>true,classList:{add(){},remove(){},toggle(){}}});return nodes.get(id);},querySelector:()=>null,querySelectorAll:()=>[]};
  const window={EconomyRules:require('../js/economyRules.js'),ChessRules:C,SetupEditor:E,EconomyUI:{t:key=>key,render(){},initialAutomation:()=>({}),send(){}},GameLanguage:{text:(_,fallback)=>fallback}};
  const SpecialPieces={get:id=>definitions[id],list:()=>Object.values(definitions),data:{restockEveryTurns:3}};window.SpecialPieces=SpecialPieces;
  const sandbox={window,document,SpecialPieces,localStorage:{getItem:()=>null},crypto:{randomUUID:()=>String(++serial)},console:{...console,warn(...args){throw new Error(args.join(' '));}},setInterval:()=>1,clearInterval(){}};
  vm.createContext(sandbox);
  for(const p of ['js/movementHandlers.js','js/abilityHandlers.js','js/stockfishPositionAdapter.js'])vm.runInContext(read(p),sandbox);
  sandbox.runAbility=window.runAbility;
  vm.runInContext(read('game.js').replace(/init\(\);\s*$/,''),sandbox);
  vm.runInContext('render=()=>{};log=()=>({});playSound=()=>{};evaluateMoveWithStockfish=()=>{};startTurnTimer=()=>{};stopTurnTimer=()=>{};moveMarket=()=>{};restockSpecialPieces=()=>{};',sandbox);
  const state=window.gameState;state.started=true;state.board=C.initialBoard(false,sandbox.piece);
  return {s:sandbox,state,window,unit:(type,color='w')=>sandbox.piece(type,color),special:(id,color='w')=>({...sandbox.specialPiece(id,color),active:true,purchaseLocked:false,attackLockedTurns:0})};
}
module.exports={env,definitions,vm,C};

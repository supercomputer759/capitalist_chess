(function(){
  "use strict";
  const equivalentByMovement={pawn:"p",knight:"n",bishop:"b",rook:"r",queen:"q",king:"n",stationary:"p",dynamic:"n",progressive:"n",random_on_purchase:"p",king_aura_teleport:"n",ranged_capture:"r"};
  const royal=def=>Boolean(def?.countsAsKing||def?.abilities?.some(ability=>ability.id==="royal_unit"&&ability.params?.countsAsKing));
  function fallbackEquivalent(def){
    const movement=def?.movement||{};
    if(movement.type==="compound"){
      const modes=movement.modes||movement.parts||[];
      const types=modes.map(mode=>typeof mode==="string"?mode:mode?.type).filter(Boolean);
      for(const type of ["queen","rook","bishop","knight","pawn"])if(types.includes(type))return equivalentByMovement[type];
      return "n";
    }
    return equivalentByMovement[movement.type]||"p";
  }
  function equivalentFor(piece,allowRoyal=true){
    if(!piece?.specialId)return piece?.type;
    const def=window.SpecialPieces?.get(piece.specialId);if(!def)return "p";
    const configured=def.stockfish?.equivalent;
    if(typeof configured==="string"&&configured!=="k")return configured;
    if(allowRoyal&&(configured==="k"||royal(def)))return "k";
    return fallbackEquivalent(def);
  }
  function fromBoard(board,sideToMove){
    const mapped=Array.from({length:8},()=>Array(8).fill(null));let included=0,equivalent=0,excluded=0,approximate=0,penalty=0;
    const kings={w:0,b:0};
    for(let r=0;r<8;r++)for(let c=0;c<8;c++){
      const piece=board?.[r]?.[c];if(!piece)continue;
      const def=piece.specialId?window.SpecialPieces?.get(piece.specialId):null;
      let type=equivalentFor(piece,kings[piece.color]===0);
      if(type==="k")kings[piece.color]++;
      if(piece.specialId){equivalent++;const configured=def?.stockfish?.equivalent;const fallback=typeof configured!=="string";approximate+=fallback?1:0;penalty+=(Number(def?.stockfish?.confidencePenalty)||0.08)*(fallback?0.2:0.12);}
      if(!["p","n","b","r","q","k"].includes(type)){type="p";approximate++;}
      mapped[r][c]={type,color:piece.color};included++;
    }
    for(const color of ["w","b"]){
      if(kings[color])continue;
      let square=color==="w"?[7,4]:[0,4];
      if(mapped[square[0]][square[1]])square=mapped.flatMap((row,r)=>row.map((piece,c)=>!piece?[r,c]:null)).flat().find(Boolean)||null;
      if(square){mapped[square[0]][square[1]]={type:"k",color};kings[color]++;approximate++;}
    }
    const rows=mapped.map(row=>{let out="",empty=0;for(const piece of row){if(!piece){empty++;continue;}if(empty){out+=empty;empty=0;}let ch=piece.type;if(piece.color==="w")ch=ch.toUpperCase();out+=ch;}if(empty)out+=empty;return out;});
    const confidence=Math.max(0.4,Math.min(1,1-Math.min(0.42,penalty*0.25)-excluded*0.12-approximate*0.015));
    return {fen:`${rows.join("/")} ${sideToMove} - - 0 1`,confidence,included,equivalent,excluded,approximate,kings:kings.w+kings.b,analyzable:included>0&&kings.w===1&&kings.b===1};
  }
  function confidenceLabel(value){return value>=.85?"높음":value>=.6?"보통":"낮음";}
  window.stockfishPositionAdapter={fromBoard,confidenceLabel,equivalentFor};
})();

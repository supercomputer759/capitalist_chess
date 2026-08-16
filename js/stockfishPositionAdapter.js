(function(){
  "use strict";
  const equivalentByMovement={pawn:"p",knight:"n",bishop:"b",rook:"r",queen:"q",king:"k"};
  function specialField(def){return def?.stockfish?.equivalent;}
  function equivalentFor(piece){
    if(!piece?.specialId)return piece?.type;
    const def=window.SpecialPieces?.get(piece.specialId);if(!def)return null;
    if(specialField(def)===null)return null;
    if(typeof specialField(def)==="string")return specialField(def);
    const movement=def.movement||{};
    if(movement.type==="compound"){
      const modes=movement.modes||movement.parts||[];const first=typeof modes[0]==="string"?modes[0]:modes[0]?.type;return equivalentByMovement[first]||null;
    }
    return equivalentByMovement[movement.type]||null;
  }
  function fromBoard(board,sideToMove){
    const rows=[];let included=0,equivalent=0,excluded=0,penalty=0,kings=0;
    for(const row of board){let out="",empty=0;for(const piece of row){const type=equivalentFor(piece);if(!type){empty++;if(piece)excluded++;continue;}included++;if(type==="k")kings++;if(empty){out+=empty;empty=0;}if(piece?.specialId){equivalent++;penalty+=Number(window.SpecialPieces?.get(piece.specialId)?.stockfish?.confidencePenalty??0.1);}let ch=type;if(piece.color==="w")ch=ch.toUpperCase();out+=ch;}if(empty)out+=empty;rows.push(out);}
    const confidence=Math.max(0,Math.min(1,1-penalty-excluded*.22-(kings===2?0:1)));
    return {fen:`${rows.join("/")} ${sideToMove} - - 0 1`,confidence,included,equivalent,excluded,kings,analyzable:included>0&&excluded===0&&kings===2};
  }
  function confidenceLabel(value){return value>=.85?"높음":value>=.6?"보통":"낮음";}
  window.stockfishPositionAdapter={fromBoard,confidenceLabel,equivalentFor};
})();

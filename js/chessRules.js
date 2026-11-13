(function(root){
  "use strict";
  const inside=(r,c)=>Number.isInteger(r)&&Number.isInteger(c)&&r>=0&&r<8&&c>=0&&c<8;
  const copy=board=>board.map(row=>row.map(piece=>piece?{...piece}:null));
  function initialBoard(standard,createPiece){
    const board=Array.from({length:8},()=>Array(8).fill(null));
    for(const color of ["w","b"]){
      const row=color==="w"?7:0,pawns=color==="w"?6:1;
      if(!standard){board[row][4]=createPiece("k",color);continue;}
      for(const [c,type] of ["r","n","b","q","k","b","n","r"].entries()){
        board[row][c]={...createPiece(type,color),castleEligible:type==="k"||type==="r"};
        board[pawns][c]=createPiece("p",color);
      }
    }
    return board;
  }
  function enPassant(state,r,c,board=state.board){
    const piece=board[r]?.[c],ep=state.enPassant;
    if(piece?.type!=="p"||piece.specialId||!ep||piece.color!==ep.color||state.turnNo>ep.turnNo+1)return null;
    const dir=piece.color==="w"?-1:1,victim=board[ep.victim.r]?.[ep.victim.c];
    if(ep.victim.r!==r||Math.abs(ep.victim.c-c)!==1||ep.target.r!==r+dir||ep.target.c!==ep.victim.c)return null;
    if(!inside(ep.target.r,ep.target.c)||board[ep.target.r][ep.target.c]||victim?.type!=="p"||victim.specialId||victim.color===piece.color||victim.id!==ep.pawnId)return null;
    return {r:ep.target.r,c:ep.target.c,enPassant:true,capture:{...ep.victim}};
  }
  function castles(state,r,c,attacked,board=state.board){
    const king=board[r]?.[c],row=king?.color==="w"?7:0;
    if(!state.standardSetup||king?.type!=="k"||king.specialId||king.moved||!king.castleEligible||king.purchaseLocked||r!==row||c!==4)return [];
    const enemy=king.color==="w"?"b":"w",out=[];
    if(attacked(r,c,enemy,board))return out;
    for(const rookC of [0,7]){
      const rook=board[r][rookC],direction=rookC===7?1:-1;
      if(rook?.type!=="r"||rook.specialId||rook.color!==king.color||rook.moved||!rook.castleEligible||rook.purchaseLocked)continue;
      let clear=true;for(let col=c+direction;col!==rookC;col+=direction)if(board[r][col])clear=false;
      if(!clear)continue;
      const transit=copy(board);transit[r][c]=null;transit[r][c+direction]={...king,moved:true};
      if(attacked(r,c+direction,enemy,transit))continue;
      const final=copy(board);final[r][c]=null;final[r][rookC]=null;
      final[r][c+2*direction]={...king,moved:true};final[r][c+direction]={...rook,moved:true};
      if(attacked(r,c+2*direction,enemy,final))continue;
      out.push({r,c:c+2*direction,castle:{from:{r,c:rookC},to:{r,c:c+direction}}});
    }
    return out;
  }
  function moveInfo(state,from,to,board=state.board){
    const piece=board[from.r]?.[from.c],ep=enPassant(state,from.r,from.c,board);
    const capture=ep&&ep.r===to.r&&ep.c===to.c?ep.capture:{r:to.r,c:to.c};
    let castle=null;
    if(state.standardSetup&&piece?.type==="k"&&!piece.specialId&&Math.abs(to.c-from.c)===2&&from.r===to.r){
      castle={from:{r:from.r,c:to.c>from.c?7:0},to:{r:from.r,c:to.c>from.c?5:3}};
    }
    return {capture,enPassant:capture.r!==to.r||capture.c!==to.c,castle};
  }
  function simulate(state,from,to,ranged=false){
    const board=copy(state.board),piece=board[from.r][from.c],info=moveInfo(state,from,to),target=board[to.r][to.c];
    board[info.capture.r][info.capture.c]=null;
    if(!ranged){
      board[from.r][from.c]=piece.shelterFortress||null;board[to.r][to.c]={...piece,moved:true};
      delete board[to.r][to.c].shelterFortress;
      if(target?.specialId==="fortress"&&target.color===piece.color)board[to.r][to.c].shelterFortress=target;
    }
    if(info.castle){board[info.castle.to.r][info.castle.to.c]={...board[info.castle.from.r][info.castle.from.c],moved:true};board[info.castle.from.r][info.castle.from.c]=null;}
    return board;
  }
  function nextEnPassant(piece,from,to,turnNo){
    if(piece?.type!=="p"||piece.specialId||from.c!==to.c||Math.abs(from.r-to.r)!==2)return null;
    return {target:{r:(from.r+to.r)/2,c:to.c},victim:{...to},pawnId:piece.id,color:piece.color==="w"?"b":"w",turnNo};
  }
  const api={initialBoard,enPassant,castles,moveInfo,simulate,nextEnPassant};root.ChessRules=api;
  if(typeof module!=="undefined")module.exports=api;
})(typeof window==="undefined"?globalThis:window);

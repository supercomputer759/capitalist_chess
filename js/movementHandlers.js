(function(){
  "use strict";
  const inside=(r,c)=>r>=0&&r<8&&c>=0&&c<8;
  const add=(out,r,c,board,p,attackOnly=false)=>{
    if(!inside(r,c))return;
    if(!board[r][c]||board[r][c].color!==p.color||attackOnly)out.push({r,c});
  };
  const slide=(ctx,dirs)=>{
    const out=[]; const {r,c,board,p,attackOnly}=ctx;
    const max=Math.max(1,Number(ctx.movement?.maxDistance)||8);
    for(const [dr,dc] of dirs){let rr=r,cc=c,steps=0;while(inside(rr+dr,cc+dc)&&steps<max){rr+=dr;cc+=dc;steps++;if(board[rr][cc]){if(board[rr][cc].color!==p.color||attackOnly)out.push({r:rr,c:cc});break;}out.push({r:rr,c:cc});}}
    return out;
  };
  const vectors={king:[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]],knight:[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]],bishop:[[-1,-1],[-1,1],[1,-1],[1,1]],rook:[[-1,0],[1,0],[0,-1],[0,1]],queen:[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]};
  const movementHandlers={
    stationary:()=>[],
    king:ctx=>ctx.board?((Number(ctx.movement?.maxDistance)||1)>1?slide(ctx,vectors.queen):vectors.king.flatMap(([dr,dc])=>{const o=[];add(o,ctx.r+dr,ctx.c+dc,ctx.board,ctx.p,ctx.attackOnly);return o;})):[],
    knight:ctx=>vectors.knight.flatMap(([dr,dc])=>{const o=[];add(o,ctx.r+dr,ctx.c+dc,ctx.board,ctx.p,ctx.attackOnly);return o;}),
    bishop:ctx=>slide(ctx,vectors.bishop),
    rook:ctx=>slide(ctx,vectors.rook),
    queen:ctx=>slide(ctx,vectors.queen),
    pawn:ctx=>{
      const out=[],dir=ctx.p.color==="w"?-1:1;
      if(ctx.attackOnly){add(out,ctx.r+dir,ctx.c-1,ctx.board,ctx.p,true);add(out,ctx.r+dir,ctx.c+1,ctx.board,ctx.p,true);return out;}
      if(inside(ctx.r+dir,ctx.c)&&!ctx.board[ctx.r+dir][ctx.c])out.push({r:ctx.r+dir,c:ctx.c});
      for(const dc of [-1,1]){const rr=ctx.r+dir,cc=ctx.c+dc;if(inside(rr,cc)&&ctx.board[rr][cc]&&ctx.board[rr][cc].color!==ctx.p.color)out.push({r:rr,c:cc});}
      return out;
    },
    compound:ctx=>(ctx.movement.parts||ctx.movement.modes||[]).flatMap(part=>{const type=typeof part==="string"?part:part.type;return movementHandlers[type]?movementHandlers[type]({...ctx,movement:typeof part==="string"?{}:part}):[]}),
    king_aura_teleport:ctx=>movementHandlers.king(ctx),
    progressive:ctx=>movementHandlers.king(ctx),
    random_on_purchase:ctx=>movementHandlers.pawn(ctx),
    dynamic:ctx=>movementHandlers.king(ctx),
    knight_bishop:ctx=>movementHandlers.compound({...ctx,movement:{modes:["knight","bishop"]}})
    ,ranged_capture:ctx=>{
      const out=[],range=Math.max(1,Number(ctx.movement?.range)||3),dirs=vectors.queen;
      for(const [dr,dc] of dirs)for(let step=1;step<=range;step++){
        const rr=ctx.r+dr*step,cc=ctx.c+dc*step;if(!inside(rr,cc))break;
        if(ctx.board[rr][cc]){if(ctx.board[rr][cc].color!==ctx.p.color)out.push({r:rr,c:cc});break;}
      }
      return out;
    }
  };
  function movementPreviewCells(movement={}){
    if(movement.preview?.cells)return movement.preview.cells;
    const types=movement.type==="compound"?(movement.modes||movement.parts||[]):[movement.type];
    const cells=[];const seen=new Set();
    for(const item of types){const type=typeof item==="string"?item:item.type;const vectorsFor=vectors[type]||[];for(const cell of vectorsFor){const key=cell.join(",");if(!seen.has(key)){seen.add(key);cells.push(cell);}}}
    return cells;
  }
  window.movementHandlers=movementHandlers;
  window.movementPreviewCells=movementPreviewCells;
})();

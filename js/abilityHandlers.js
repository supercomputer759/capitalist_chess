(function(){
  "use strict";
  const abilityHandlers={
    move_income(ctx){if(ctx.event==="turn"&&ctx.owner&&Number(ctx.params.amount))ctx.owner.money+=Number(ctx.params.amount);},
    deposit_interest_bonus(ctx){if(ctx.event==="turn"&&ctx.owner)ctx.owner.interestMultiplier=Number(ctx.params.multiplier)||1;},
    black_hole_pulse(){},
    guard_check_warning(){/* 체크는 시각 경고만 제공 */},
    fortress_capture_guard(ctx){if(ctx.event==="capture"&&ctx.captureSquare)return {defense:true};return null;},
    fake_king_reveal(ctx){return Number(ctx.params.captureApPenalty)||0;},
    fake_king_identity(){/* 포획 시 game.js가 JSON params로 정체 공개와 AP 차감을 처리 */},
    royal_unit(){/* countsAsKing은 game.js가 JSON params로 판정 */}
    ,dismount_escape(ctx){
      if(ctx.event!=="capture"||!ctx.captureSquare)return null;
      const charges=Number(ctx.piece.abilityCharges?.dismount_escape??ctx.params.charges??0);
      if(charges<=0)return null;
      const {r,c}=ctx.captureSquare,radius=Math.max(1,Number(ctx.params.escapeRadius)||1);
      for(let dr=-radius;dr<=radius;dr++)for(let dc=-radius;dc<=radius;dc++){
        if(!dr&&!dc)continue;
        const rr=r+dr,cc=c+dc;
        if(rr>=0&&rr<8&&cc>=0&&cc<8&&!ctx.state.board[rr][cc]){
          ctx.piece.abilityCharges={...(ctx.piece.abilityCharges||{}),dismount_escape:charges-1};
          return {escapeSquare:{r:rr,c:cc}};
        }
      }
      return null;
    }
  };
  const inside=(r,c)=>r>=0&&r<8&&c>=0&&c<8;
  const distance=(a,b)=>Math.max(Math.abs(a.r-b.r),Math.abs(a.c-b.c));
  const locate=(state,piece)=>{for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(state.board[r][c]===piece)return {r,c};return null;};
  Object.assign(abilityHandlers,{
    black_hole_pulse(ctx){
      if(ctx.event!=="turn")return null;
      const pos=locate(ctx.state,ctx.piece),radius=Math.max(0,Number(ctx.params.radius)||0),interval=Math.max(1,Number(ctx.params.intervalTurns)||1),ownTurnCount=Number(ctx.piece.specialTurnCount||0);
      if(!pos||ownTurnCount%interval||ctx.piece.lastBlackHolePulseTurn===ownTurnCount)return null;
      let removed=0;
      for(let r=0;r<8;r++)for(let c=0;c<8;c++){const target=ctx.state.board[r][c];if(!target||target===ctx.piece||distance(pos,{r,c})>radius)continue;if(!ctx.params.affectsFriendly&&target.color===ctx.piece.color)continue;if(!ctx.params.affectsKing&&target.type==="k")continue;ctx.state.board[r][c]=null;removed++;}
      ctx.piece.lastBlackHolePulseTurn=ownTurnCount;
      return {blackHolePulse:true,removed};
    },
    deposit_interest_bonus(ctx){if(ctx.event==="turn"&&ctx.owner)ctx.owner.interestMultiplier=Number(ctx.params.multiplier)||1;},
    ally_defense_aura(ctx){if(ctx.event==="capture"&&ctx.captureSquare&&ctx.piece?.color===ctx.owner?.color){const pos=locate(ctx.state,ctx.piece);if(pos&&distance(pos,ctx.captureSquare)<=Number(ctx.params.radius||1))return {defense:true};}return null;},
    bonus_move_on_capture(ctx){if(ctx.event==="capture"&&ctx.piece?.color===ctx.owner?.color)return {extraMove:true};return null;},
    capture_or_convert(ctx){if(ctx.event==="capture"&&ctx.piece?.color===ctx.owner?.color&&Math.random()<=Number(ctx.params.convertChance||0))return {convert:true};return null;},
    cash_steal_on_capture(ctx){if(ctx.event==="capture"&&ctx.piece?.color===ctx.owner?.color)return {stealFraction:Number(ctx.params.fractionOfVictimValue)||0,maxSteal:Number(ctx.params.maxSteal)||0};return null;},
    explode_on_capture(ctx){if(ctx.event==="capture"&&ctx.piece?.color===ctx.owner?.color)return {explode:true};return null;},
    fortress_capture_guard(ctx){if(ctx.event==="capture"&&ctx.captureSquare&&ctx.piece?.color===ctx.owner?.color){const pos=locate(ctx.state,ctx.piece);if(pos&&distance(pos,ctx.captureSquare)<=Number(ctx.params.radius||1))return {defense:true};}return null;},
    ranged_capture(){return null;},
    sacrifice_for_king(ctx){if(ctx.event==="capture"&&ctx.captured&&ctx.captured.color===ctx.owner?.color){const pos=locate(ctx.state,ctx.piece);if(pos&&distance(pos,ctx.captureSquare)<=Number(ctx.params.radius||1))return {defense:true,sacrifice:true};}return null;},
    produce_pawn(ctx){if(ctx.event!=="turn")return null;const pos=locate(ctx.state,ctx.piece),interval=Math.max(1,Number(ctx.params.intervalTurns)||1);if(!pos||ctx.state.turnNo%interval)return null;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){const r=pos.r+dr,c=pos.c+dc;if(inside(r,c)&&!ctx.state.board[r][c]){ctx.state.board[r][c]={type:"p",color:ctx.piece.color,moved:false,id:crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)};return null;}}return null;},
    venture_roll(ctx){if(ctx.event==="turn"&&ctx.piece){let n=Math.random(),sum=0;for(const outcome of ctx.params.outcomes||[]){sum+=Number(outcome.weight)||0;if(n<=sum){ctx.piece.ventureMovement=outcome.movement;ctx.piece.ventureScore=outcome.score;break;}}}return null;},
    hostile_takeover(ctx){if(ctx.event==="capture"&&ctx.piece?.color===ctx.owner?.color)return {takeover:true,premiumFraction:Number(ctx.params.premiumFraction)||0};return null;},
    magnet_pull_on_move(ctx){if(ctx.event==="move")return {magnet:true};return null;},
    paid_friendly_swap(ctx){if(ctx.event==="action")return {moneyCost:Number(ctx.params.moneyCost)||0,apCost:Number(ctx.params.apCost)||0};return null;},
    disable_enemy_specials_aura(ctx){if(ctx.event==="turn"&&ctx.piece){const pos=locate(ctx.state,ctx.piece);ctx.piece.disableAura=pos?Number(ctx.params.radius)||0:0;}return null;}
    ,deposit_loss_on_capture(ctx){if(ctx.event==="capture"&&ctx.piece?.color===ctx.owner?.color)return {depositLossFraction:Number(ctx.params.fraction)||0};return null;}
    ,piece_tax_discount(ctx){return ctx.event==="tax"?{discount:Number(ctx.params.fraction)||0}:null;}
    ,nearby_capture_bonus(ctx){if(ctx.event!=="capture"||!ctx.captureSquare)return null;const pos=locate(ctx.state,ctx.piece);return pos&&distance(pos,ctx.captureSquare)<=Number(ctx.params.radius||1)?{captureBonusFraction:Number(ctx.params.bonusFraction)||0}:null;}
    ,capture_chance(ctx){if(ctx.event==="capture"&&Math.random()<=Number(ctx.params.chance||0))return {defense:true};return null;}
    ,nearby_toll_bonus(ctx){if(ctx.event==="toll"&&ctx.captureSquare)return {tollMultiplier:Number(ctx.params.multiplier)||1};return null;}
    ,king_shelter(ctx){if(ctx.event!=="capture"||!ctx.captureSquare||!ctx.captured?.type||ctx.captured.type!=="k")return null;const pos=locate(ctx.state,ctx.piece);return pos&&distance(pos,ctx.captureSquare)<=Number(ctx.params.radius||1)?{defense:true,sacrifice:Boolean(ctx.params.sacrifice)}:null;}
    ,grow_on_capture(ctx){if(ctx.event==="capture"&&ctx.piece){ctx.piece.growthCaptures=Number(ctx.piece.growthCaptures||0)+1;const stages=ctx.params.stages||[];const current=stages.filter(stage=>Number(stage.captures)<=ctx.piece.growthCaptures).at(-1);if(current)ctx.piece.growMovement=current.movement; }return null;}
    ,mirror_first_attack(ctx){if(ctx.event==="capture"&&ctx.piece&&!ctx.piece.mirrorUsed){ctx.piece.mirrorUsed=true;return {mirror:true};}return null;}
    ,power_from_enemy_stock_losses(){return null;}
    ,allow_credit_purchases(){return null;}
    ,solid_obstacle(){return null;}
    ,carry_friendly_piece(){return null;}
    ,paid_same_color_warp(){return null;}
    ,defect_on_unpaid_tax(){return null;}
  });
  window.abilityHandlers=abilityHandlers;
  window.runAbility=(id,ctx)=>{const handler=abilityHandlers[id];if(!handler){console.warn(`알 수 없는 특수능력: ${id}`);return undefined;}try{return handler(ctx);}catch(error){console.warn(`특수능력 실행 실패: ${id}`,error);return undefined;}};
})();

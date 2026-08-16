(function(){
  "use strict";
  const abilityHandlers={
    move_income(ctx){if(ctx.event==="turn"&&ctx.owner&&Number(ctx.params.amount))ctx.owner.money+=Number(ctx.params.amount);},
    deposit_interest_bonus(){/* TODO: 예금 만기 계산과 연결할 수 있을 때 적용 */},
    black_hole_pulse(){/* TODO: 범위 효과는 capture-the-king 방어 규칙 확정 후 연결 */},
    guard_check_warning(){/* 체크는 시각 경고만 제공 */},
    fortress_capture_guard(){/* TODO: 포획 방어 충전량을 전투 규칙에 연결 */},
    fake_king_reveal(ctx){return Number(ctx.params.captureApPenalty)||0;},
    fake_king_identity(){/* 포획 시 game.js가 JSON params로 정체 공개와 AP 차감을 처리 */},
    royal_unit(){/* countsAsKing은 game.js가 JSON params로 판정 */}
  };
  window.abilityHandlers=abilityHandlers;
  window.runAbility=(id,ctx)=>{const handler=abilityHandlers[id];if(!handler){console.warn(`알 수 없는 특수능력: ${id}`);return undefined;}try{return handler(ctx);}catch(error){console.warn(`특수능력 실행 실패: ${id}`,error);return undefined;}};
})();

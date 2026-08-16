(function(){
  "use strict";
  const api={data:null,error:null,async load(){
    try{
      const response=await fetch("data/special-pieces.json",{cache:"no-store"});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      api.data=await response.json();
      return api.data;
    }catch(error){
      api.error=error;
      console.error("특수기물 데이터 로드 실패",error);
      return null;
    }
  },list(){return Object.entries(api.data?.pieces||{}).map(([id,def])=>({...def,id}));},get(id){const def=api.data?.pieces?.[id];return def?{...def,id}:null;}};
  window.SpecialPieces=api;
})();

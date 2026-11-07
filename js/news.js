(function(){
  "use strict";
  const fallback=[["pastry",0.13,"\uc559\ud30c\uc0c1 \uc81c\uacfc, \uc2e0\uaddc \uacfc\uc790 \u2018\ud0b9\ub9db \uc4f0\ub0cc\u2019 \ucd9c\uc2dc\u2026 \ubc18\uc751 \uc88b\uc544"],["pastry",-0.18,"\uc559\ud30c\uc0c1 \uc81c\uacfc, \uc6d0\uc7ac\ub8cc \uac00\uaca9 \uae09\ub4f1\u2026 \ub9c8\uc9c4 \uc545\ud654 \uc6b0\ub824"],["pastry",0.08,"\uc559\ud30c\uc0c1 \uc81c\uacfc, \ud3b8\uc758\uc810 \uccb4\uc778\uacfc \uc804\uad6d \ub0a9\ud488 \uacc4\uc57d \uccb4\uacb0"],["pastry",-0.11,"\uc559\ud30c\uc0c1 \uc81c\uacfc, \uc2e0\uc81c\ud488 \ud3ec\uc7a5 \ubd88\ub7c9\uc73c\ub85c \uc790\ubc1c\uc801 \ud68c\uc218"],["pastry",0.1,"\uc559\ud30c\uc0c1 \uc81c\uacfc, \uccb4\uc2a4 \ub300\ud68c \uac04\uc2dd \ud6c4\uc6d0\uc73c\ub85c \uc8fc\ubb38 \uc99d\uac00"],["check",-0.19,"\uccb4\ud06c\uc804\uc790, \ubd80\ud488 \uc0ac\uae30 \ub17c\ub780\uc5d0 \uc18c\ube44\uc790 \ubd88\ub9cc \ucee4\uc838\u2026"]];
  function normalize(rows){
    return rows.filter(row=>Array.isArray(row)&&row.length>=3&&typeof row[0]==="string"&&Number.isFinite(Number(row[1]))&&typeof row[2]==="string")
      .map((row,index)=>({id:"market-"+(index+1),companyId:row[0],effect:Number(row[1]),text:row[2],company:row[3]||null}));
  }
  async function load(){
    try{
      const response=await fetch("data/news.json",{cache:"no-store"});
      if(!response.ok)throw new Error("뉴스 데이터를 불러오지 못했습니다.");
      const rows=await response.json();
      const news=Array.isArray(rows)?normalize(rows):[];
      return news.length?news:normalize(fallback);
    }catch(_){return normalize(fallback);}
  }
  window.GameNews={load};
})();

(function(){
  "use strict";
  const DEFAULT_LOCALE="ko_kr";
  const SUPPORTED_LOCALES=new Set([DEFAULT_LOCALE,"en_us"]);
  let messages={};
  let currentLocale=DEFAULT_LOCALE;

  function text(key,fallback,values={}){
    let value=typeof messages[key]==="string"?messages[key]:fallback;
    for(const [name,replacement] of Object.entries(values))value=value.replaceAll("{"+name+"}",String(replacement));
    return value;
  }

  function apply(root=document){
    root.querySelectorAll("[data-i18n]").forEach(element=>{
      const translated=messages[element.dataset.i18n];
      if(typeof translated==="string")element.textContent=translated;
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach(element=>{
      const translated=messages[element.dataset.i18nPlaceholder];
      if(typeof translated==="string")element.placeholder=translated;
    });
    root.querySelectorAll("[data-i18n-value]").forEach(element=>{
      const translated=messages[element.dataset.i18nValue];
      if(typeof translated==="string")element.value=translated;
    });
  }

  function savedLocale(){
    try{
      const saved=localStorage.getItem("capitalist-chess-locale");
      return SUPPORTED_LOCALES.has(saved)?saved:DEFAULT_LOCALE;
    }catch(_){return DEFAULT_LOCALE;}
  }

  function validMessages(data){
    return Boolean(data&&typeof data==="object"&&!Array.isArray(data));
  }

  async function load(requestedLocale=savedLocale()){
    const preferred=SUPPORTED_LOCALES.has(requestedLocale)?requestedLocale:DEFAULT_LOCALE;
    const candidates=preferred===DEFAULT_LOCALE?[DEFAULT_LOCALE]:[preferred,DEFAULT_LOCALE];
    for(const locale of candidates){
      try{
        const response=await fetch(`data/${locale}.json`,{cache:"no-store"});
        if(!response.ok)continue;
        const data=await response.json();
        if(!validMessages(data))continue;
        messages=data;
        currentLocale=locale;
        document.documentElement.lang=locale==="en_us"?"en":"ko";
        apply();
        return true;
      }catch(_){
        // 선택 언어를 못 읽으면 기본 한국어 파일로 다시 시도한다.
      }
    }
    messages={};
    currentLocale=DEFAULT_LOCALE;
    document.documentElement.lang="ko";
    return false;
  }

  async function setLocale(locale){
    const requested=SUPPORTED_LOCALES.has(locale)?locale:DEFAULT_LOCALE;
    const loaded=await load(requested);
    try{localStorage.setItem("capitalist-chess-locale",currentLocale);}catch(_){}
    window.dispatchEvent(new CustomEvent("game-language-change",{detail:{locale:currentLocale,loaded}}));
    return loaded;
  }

  window.GameLanguage={load,text,apply,setLocale,getLocale:()=>currentLocale};
})();

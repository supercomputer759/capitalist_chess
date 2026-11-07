(function(){
  "use strict";
  const DEFAULT_LOCALE="ko_kr";
  const SUPPORTED_LOCALES=new Set([DEFAULT_LOCALE,"en_us"]);
  const defaults=new WeakMap();
  let messages={};
  let currentLocale=DEFAULT_LOCALE;

  function original(element,key,value){
    let values=defaults.get(element);
    if(!values){values={};defaults.set(element,values);}
    if(!(key in values))values[key]=value;
    return values[key];
  }

  function text(key,fallback,values={}){
    const value=typeof messages[key]==="string"?messages[key]:String(fallback??key);
    return value.replace(/\{([A-Za-z0-9_]+)\}/g,(token,name)=>Object.prototype.hasOwnProperty.call(values,name)?String(values[name]):token);
  }

  function apply(root=document){
    root.querySelectorAll("[data-i18n]").forEach(element=>{
      const fallback=original(element,"text",element.textContent);
      const translated=messages[element.dataset.i18n];
      element.textContent=typeof translated==="string"?translated:fallback;
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach(element=>{
      const fallback=original(element,"placeholder",element.placeholder);
      const translated=messages[element.dataset.i18nPlaceholder];
      element.placeholder=typeof translated==="string"?translated:fallback;
    });
    root.querySelectorAll("[data-i18n-value]").forEach(element=>{
      const fallback=original(element,"value",element.value);
      const translated=messages[element.dataset.i18nValue];
      element.value=typeof translated==="string"?translated:fallback;
    });
    for(const attribute of ["title","alt"]){
      root.querySelectorAll("[data-i18n-"+attribute+"]").forEach(element=>{
        const fallback=original(element,attribute,element.getAttribute(attribute)||"");
        const translated=messages[element.getAttribute("data-i18n-"+attribute)];
        element.setAttribute(attribute,typeof translated==="string"?translated:fallback);
      });
    }
    root.querySelectorAll("[data-i18n-aria]").forEach(element=>{
      const translated=messages[element.dataset.i18nAria];
      const fallback=original(element,"aria-label",element.getAttribute("aria-label")||"");
      element.setAttribute("aria-label",typeof translated==="string"?translated:fallback);
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
    apply();
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

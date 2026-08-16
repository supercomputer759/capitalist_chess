(function(){
  "use strict";
  class StockfishEngine {
    constructor(){this.worker=null;this.ready=false;this.status="idle";this.statusHandler=null;this.pending=null;this.requestSerial=0;this.initPromise=null;}
    setStatusHandler(handler){this.statusHandler=handler;this.emit(this.status);return this;}
    emit(status,detail=""){this.status=status;this.statusHandler?.({status,detail});}
    async init(){
      if(this.ready)return this;
      if(this.initPromise)return this.initPromise;
      this.initPromise=new Promise((resolve,reject)=>{
        try{
          this.emit("loading");
          const workerUrl = new URL(
            "./engine/stockfish-18-lite-single.js",
            document.baseURI
          );
          const worker = new Worker(workerUrl.href);
          let uciOk=false,readyOk=false;
          const timer=setTimeout(()=>{if(!readyOk){const error=new Error("Stockfish ready timeout");this.fail(error);reject(error);}},12000);
          worker.onmessage=e=>{
            // Stockfish.js는 여러 UCI 응답을 한 메시지에 묶어 보낼 수 있다.
            const lines=String(e.data||"").split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
            lines.forEach(line=>{
              if(line.includes("uciok")){uciOk=true;worker.postMessage("isready");}
              if(line.includes("readyok") && !readyOk){
                readyOk=true;
                clearTimeout(timer);
                this.ready=true;
                this.emit("ready");
                resolve(this);
              }
              if(this.pending)this.handlePendingLine(line);
            });
          };
          worker.onerror=e=>{clearTimeout(timer);const error=new Error(e.message||"Stockfish worker error");this.fail(error);reject(error);};
          worker.onmessageerror=()=>{clearTimeout(timer);const error=new Error("Stockfish worker message error");this.fail(error);reject(error);};
          worker.postMessage("uci");
        }catch(error){this.fail(error);reject(error);}
      }).catch(error=>{this.initPromise=null;throw error;});
      return this.initPromise;
    }
    fail(error){this.ready=false;this.worker?.terminate();this.worker=null;this.emit("error",error?.message||"Stockfish load failed");}
    send(command){if(this.worker)this.worker.postMessage(command);}
    handlePendingLine(line){
      const request=this.pending;
      if(!request)return;
      const clean=String(line||"").trim();
      const depth=clean.match(/\bdepth\s+(\d+)/);if(depth)request.depth=Number(depth[1]);
      const cp=clean.match(/\bscore\s+cp\s+(-?\d+)/);if(cp)request.score={type:"cp",value:Number(cp[1])};
      const mate=clean.match(/\bscore\s+mate\s+(-?\d+)/);if(mate)request.score={type:"mate",value:Number(mate[1])};
      const bestmove=clean.match(/(?:^|\s)bestmove\s+(\S+)/);
      if(bestmove){const best=bestmove[1]||null;clearTimeout(request.timeout);this.pending=null;this.emit("ready");request.resolve({bestmove:best,depth:request.depth||0,score:request.score});}
    }
    analyze(fen,options={}){
      const run=async()=>{
        await this.init();
        if(this.pending)this.stop(new Error("Superseded by newer analysis"));
        const requestId=++this.requestSerial;
        return new Promise((resolve,reject)=>{
          this.pending={requestId,resolve,reject,depth:0,score:null};
          this.emit("analyzing");
          this.send("ucinewgame");this.send("isready");this.send("position fen "+fen);
          const command=options.movetime?`go movetime ${Math.max(1,Number(options.movetime))}`:`go depth ${Math.max(1,Number(options.depth||12))}`;
          this.send(command);
          this.pending.cancel=()=>{reject(new Error("Analysis cancelled"));};
          this.pending.timeout=setTimeout(()=>{if(this.pending?.requestId===requestId){this.stop(new Error("Analysis timeout"));}},Math.max(5000,Number(options.timeout||12000)));
        });
      };
      return run();
    }
    getBestMove(fen,options={}){return this.analyze(fen,options);}
    stop(reason=new Error("Analysis stopped")){
      if(this.pending){const request=this.pending;this.pending=null;clearTimeout(request.timeout);request.cancel?.();request.reject(reason);}
      this.send("stop");if(this.ready)this.emit("ready");
    }
    destroy(){this.stop();this.worker?.terminate();this.worker=null;this.ready=false;this.initPromise=null;this.emit("destroyed");}
    restart(){this.destroy();return this.init();}
  }
  window.StockfishEngine=StockfishEngine;
  window.stockfish=new StockfishEngine();
})();

(function(){
  "use strict";
  const DEBUG_STOCKFISH=true;
  class StockfishEngine{
    constructor(){this.worker=null;this.ready=false;this.status="idle";this.statusHandler=null;this.pending=null;this.waiters=[];this.requestSerial=0;this.initPromise=null;this.queue=Promise.resolve();}
    setStatusHandler(handler){this.statusHandler=handler;this.emit(this.status);return this;}
    emit(status,detail=""){this.status=status;this.statusHandler?.({status,detail});}
    debug(direction,line){if(DEBUG_STOCKFISH)console.log(`[SF ${direction}] ${line}`);}
    send(command){if(!this.worker)throw new Error("Stockfish worker unavailable");this.debug(">>",command);this.worker.postMessage(command);}
    waitForLine(predicate,timeout=5000){return new Promise((resolve,reject)=>{const waiter={predicate,resolve,reject,timer:null};waiter.timer=setTimeout(()=>{this.waiters=this.waiters.filter(item=>item!==waiter);reject(new Error("Stockfish UCI response timeout"));},timeout);this.waiters.push(waiter);});}
    async sendAndWait(command,predicate,timeout=5000){const response=this.waitForLine(predicate,timeout);this.send(command);return response;}
    waitForReady(timeout=5000){return this.sendAndWait("isready",line=>line==="readyok",timeout);}
    dispatchLine(rawLine){
      const line=String(rawLine||"").trim();if(!line)return;
      this.debug("<<",line);
      for(const waiter of this.waiters.slice()){
        let matched=false;try{matched=Boolean(waiter.predicate(line));}catch(_){ }
        if(matched){clearTimeout(waiter.timer);this.waiters=this.waiters.filter(item=>item!==waiter);waiter.resolve(line);}
      }
      const request=this.pending;if(!request)return;
      const depth=line.match(/\bdepth\s+(\d+)/);if(depth)request.depth=Number(depth[1]);
      const cp=line.match(/\bscore\s+cp\s+(-?\d+)/);if(cp)request.score={type:"cp",value:Number(cp[1])};
      const mate=line.match(/\bscore\s+mate\s+(-?\d+)/);if(mate)request.score={type:"mate",value:Number(mate[1])};
      const bestmove=line.match(/(?:^|\s)bestmove\s+(\S+)/);
      if(bestmove){
        const best=bestmove[1]||null;
        this.finishRequest({bestmove:best,depth:request.depth||0,score:request.score,valid:Boolean(best&&best!=="(none)"&&(request.depth||0)>0),invalidReason:best==="(none)"?"bestmove (none)":(request.depth||0)<=0?"depth <= 0":null});
      }
    }
    finishRequest(result){const request=this.pending;if(!request)return;this.pending=null;clearTimeout(request.timeout);this.emit("ready");request.resolve(result);}
    rejectRequest(error){const request=this.pending;if(!request)return;this.pending=null;clearTimeout(request.timeout);request.reject(error);}
    attachWorker(worker){worker.onmessage=e=>String(e.data||"").split(/\r?\n/).forEach(line=>this.dispatchLine(line));worker.onerror=e=>this.fail(new Error(e.message||"Stockfish worker error"));worker.onmessageerror=()=>this.fail(new Error("Stockfish worker message error"));}
    async init(){
      if(this.ready)return this;if(this.initPromise)return this.initPromise;
      this.initPromise=(async()=>{
        this.emit("loading");
        const worker=new Worker(new URL("./engine/stockfish-18-lite-single.js",document.baseURI));this.worker=worker;this.attachWorker(worker);
        await this.sendAndWait("uci",line=>line==="uciok",12000);await this.waitForReady(12000);
        this.ready=true;this.emit("ready");return this;
      })().catch(error=>{this.initPromise=null;this.fail(error);throw error;});
      return this.initPromise;
    }
    fail(error){const reason=error instanceof Error?error:new Error(String(error||"Stockfish load failed"));this.ready=false;this.rejectRequest(reason);for(const waiter of this.waiters){clearTimeout(waiter.timer);waiter.reject(reason);}this.waiters=[];this.worker?.terminate();this.worker=null;this.emit("error",reason.message);}
    async stop(reason=new Error("Analysis stopped")){
      if(this.pending)this.rejectRequest(reason);if(!this.worker)return;
      try{this.send("stop");}catch(_){return;}
      try{await this.waitForReady(5000);}catch(_){ }
      if(this.ready)this.emit("ready");
    }
    async runAnalysis(fen,options={}){
      await this.init();if(this.pending)await this.stop(new Error("Superseded by newer analysis"));
      this.emit("analyzing");this.send("ucinewgame");await this.waitForReady(Number(options.syncTimeout||5000));
      const moves=Array.isArray(options.moves)&&options.moves.length?` moves ${options.moves.join(" ")}`:"";
      this.send("position fen "+fen+moves);
      const requestId=++this.requestSerial,timeoutMs=Math.max(5000,Number(options.timeout||12000));
      return new Promise((resolve,reject)=>{
        const request={requestId,resolve,reject,depth:0,score:null,timeout:null};this.pending=request;
        request.timeout=setTimeout(async()=>{if(this.pending!==request)return;const error=new Error("Stockfish analysis timeout");this.rejectRequest(error);try{this.send("stop");}catch(_){ }try{await this.waitForReady(5000);}catch(_){ }if(this.ready)this.emit("ready");},timeoutMs);
        const command=options.movetime?`go movetime ${Math.max(1,Number(options.movetime))}`:`go depth ${Math.max(1,Number(options.depth||12))}`;this.send(command);
      });
    }
    analyze(fen,options={}){const run=this.queue.then(()=>this.runAnalysis(fen,options));this.queue=run.catch(()=>{});return run;}
    getBestMove(fen,options={}){return this.analyze(fen,options);}
    destroy(){const reason=new Error("Stockfish destroyed");this.rejectRequest(reason);for(const waiter of this.waiters){clearTimeout(waiter.timer);waiter.reject(reason);}this.waiters=[];this.worker?.postMessage("stop");this.worker?.terminate();this.worker=null;this.ready=false;this.initPromise=null;this.emit("destroyed");}
    restart(){this.destroy();return this.init();}
  }
  window.StockfishEngine=StockfishEngine;window.stockfish=new StockfishEngine();
})();

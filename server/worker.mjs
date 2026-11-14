import { DurableObject } from "cloudflare:workers";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const GRACE_MS = 120_000;
const MAX_MESSAGE_BYTES = 512 * 1024;
const json = (body, status = 200) => Response.json(body, {status});
const attachment = ws => ws.deserializeAttachment() || {};
const send = (ws, message) => {
  if (ws?.readyState === 1) ws.send(JSON.stringify(message));
};

function roomStub(env, code) {
  // 리전 힌트·관할권을 지정하지 않습니다. 실제 방 생성 요청 위치를 기준으로 자동 배치합니다.
  return env.ROOMS.get(env.ROOMS.idFromName(code));
}

function cors(response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, {status: response.status, headers});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return cors(new Response(null, {status: 204}));
    if (url.pathname === "/rooms" && request.method === "POST") {
      for (let attempt = 0; attempt < 8; attempt++) {
        const random = crypto.getRandomValues(new Uint8Array(6));
        const code = Array.from(random, n => CODE_CHARS[n % CODE_CHARS.length]).join("");
        const result = await roomStub(env, code).fetch(new Request("https://room.internal/reserve", {
          method: "POST", body: JSON.stringify({code})
        }));
        if (result.status !== 409) return cors(result);
      }
      return cors(json({error: "Room allocation failed"}, 503));
    }
    const match = /^\/rooms\/([A-Z0-9]{6})$/.exec(url.pathname);
    if (match && CODE_PATTERN.test(match[1])) {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return cors(json({error: "WebSocket upgrade required"}, 426));
      }
      return roomStub(env, match[1]).fetch(request);
    }
    if (url.pathname === "/" || url.pathname === "/health") {
      return cors(json({service: "capitalist-chess", transport: "cloudflare", placement: "automatic"}));
    }
    return cors(json({error: "Not found"}, 404));
  }
};

export class ChessRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.room = null;
    ctx.blockConcurrencyWhile(async () => {this.room = await ctx.storage.get("room") || null;});
    // 토큰을 담지 않는 생존 확인은 방을 깨우거나 저장소를 쓰지 않고 응답합니다.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(
      JSON.stringify({type: "heartbeat"}), JSON.stringify({type: "heartbeatAck"})
    ));
  }

  sockets(role) {
    return this.ctx.getWebSockets().filter(ws => ws.readyState === 1 &&
      (!role || attachment(ws).role === role));
  }

  peer(role) {
    const connection = this.room?.[`${role}Connection`];
    return this.sockets(role).find(ws => attachment(ws).connection === connection);
  }

  broadcast(message, spectators = true) {
    for (const ws of this.sockets()) {
      const role = attachment(ws).role;
      if (role && (spectators || role !== "spectator")) send(ws, message);
    }
  }

  async save() {
    if (!this.room) return;
    await this.ctx.storage.put("room", this.room);
    const deadlines = [this.room.reservedUntil,
      this.room.hostDisconnectedAt && this.room.hostDisconnectedAt + GRACE_MS,
      this.room.guestDisconnectedAt && this.room.guestDisconnectedAt + GRACE_MS].filter(Boolean);
    if (deadlines.length) await this.ctx.storage.setAlarm(Math.min(...deadlines));
    else await this.ctx.storage.deleteAlarm();
  }

  async closeRoom(reason) {
    this.broadcast({type: "roomClosed", ...(reason ? {reason} : {})});
    for (const ws of this.sockets()) {
      ws.serializeAttachment({...attachment(ws), role: null, token: null});
      ws.close(1000, "Room closed");
    }
    this.room = null;
    await this.ctx.storage.deleteAll();
    await this.ctx.storage.deleteAlarm();
  }

  async expire() {
    const room = this.room;
    if (!room) return;
    if ((room.reservedUntil && room.reservedUntil <= Date.now()) ||
        (room.hostDisconnectedAt && room.hostDisconnectedAt + GRACE_MS <= Date.now())) {
      await this.closeRoom(room.hostToken ? "hostTimeout" : "reservationTimeout");
    } else if (room.guestDisconnectedAt && room.guestDisconnectedAt + GRACE_MS <= Date.now()) {
      room.guestToken = null; room.guestConnection = null; room.guestDisconnectedAt = null;
      await this.save();
    }
  }

  async fetch(request) {
    return this.ctx.blockConcurrencyWhile(async () => {
      await this.expire();
      const path = new URL(request.url).pathname;
      if (path === "/reserve" && request.method === "POST") {
        if (this.room) return json({error: "Room already exists"}, 409);
        const {code} = await request.json();
        this.room = {code, createToken: crypto.randomUUID(), reservedUntil: Date.now() + GRACE_MS,
          hostToken: null, guestToken: null, hostConnection: null, guestConnection: null,
          hostDisconnectedAt: null, guestDisconnectedAt: null, state: null, revision: 0};
        await this.save();
        return json({code, createToken: this.room.createToken}, 201);
      }
      if (!this.room) return json({error: "Room not found"}, 404);
      if (this.sockets().length >= 64) return json({error: "Too many connections"}, 429);
      const pair = new WebSocketPair(), client = pair[0], server = pair[1];
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({connection: crypto.randomUUID(), role: null, token: null});
      return new Response(null, {status: 101, webSocket: client});
    });
  }

  attach(ws, role, token) {
    const data = {...attachment(ws), role, token};
    ws.serializeAttachment(data);
    if (role !== "spectator") {
      this.room[`${role}Connection`] = data.connection;
      this.room[`${role}DisconnectedAt`] = null;
    }
  }

  replySession(ws, type, role, token, lastRevision) {
    send(ws, {type, code: this.room.code, token, role, revision: this.room.revision,
      opponentConnected: role === "host" ? Boolean(this.room.guestConnection) : role === "guest" ? Boolean(this.room.hostConnection) : false,
      ...(type !== "roomCreated" ? {state: this.room.state} : {}),
      ...(lastRevision !== undefined ? {lastRevision: Number(lastRevision) || 0} : {})});
  }

  async handleMessage(ws, message) {
    await this.expire();
    if (!this.room) return send(ws, {type: "error", message: "Room not found"});
    const room = this.room, session = attachment(ws);
    if (message.type === "heartbeat") return send(ws, {type: "heartbeatAck", at: Date.now()});
    if (["create", "join", "watch", "reconnect"].includes(message.type)) {
      if (session.role) return send(ws, {type: "error", message: "Already connected to a room"});
      if (message.code && message.code !== room.code) return send(ws, {type: "error", message: "Room not found"});
      if (message.type === "create") {
        if (room.hostToken || message.createToken !== room.createToken) return send(ws, {type: "error", message: "Invalid room reservation"});
        room.hostToken = crypto.randomUUID(); room.createToken = null; room.reservedUntil = null;
        room.state = message.state || null; room.revision = Number(message.revision) || 0;
        this.attach(ws, "host", room.hostToken);
        await this.save(); this.replySession(ws, "roomCreated", "host", room.hostToken); return;
      }
      if (!room.hostToken) return send(ws, {type: "error", message: "Room not found"});
      if (message.type === "join") {
        if (room.guestToken) {
          const token = crypto.randomUUID(); this.attach(ws, "spectator", token);
          this.replySession(ws, "watched", "spectator", token);
          this.broadcast({type: "spectatorCount", count: this.sockets("spectator").length}, false); return;
        }
        room.guestToken = crypto.randomUUID(); this.attach(ws, "guest", room.guestToken);
        await this.save(); this.replySession(ws, "joined", "guest", room.guestToken);
        send(this.peer("host"), {type: "guestJoined"}); return;
      }
      if (message.type === "watch") {
        const token = crypto.randomUUID(); this.attach(ws, "spectator", token);
        this.replySession(ws, "watched", "spectator", token);
        this.broadcast({type: "spectatorCount", count: this.sockets("spectator").length}, false); return;
      }
      const role = message.token === room.hostToken ? "host" : message.token === room.guestToken ? "guest" : null;
      if (!role) return send(ws, {type: "error", message: "Reconnect session not found"});
      if (this.peer(role)) return send(ws, {type: "error", message: "Player slot is already connected"});
      this.attach(ws, role, message.token); await this.save();
      this.replySession(ws, "reconnected", role, message.token, message.lastRevision);
      send(this.peer(role === "host" ? "guest" : "host"), {type: `${role}Reconnected`}); return;
    }
    if (!session.role || (message.token && message.token !== session.token)) return send(ws, {type: "error", message: "Not connected to a room"});
    if (session.role !== "spectator" && room[`${session.role}Token`] !== session.token) return send(ws, {type: "error", message: "Session expired"});
    if (message.type === "closeRoom" && session.role === "host") return this.closeRoom();
    if (message.type === "leave") {
      if (session.role === "host") {this.broadcast({type: "hostLeft"}); return this.closeRoom();}
      ws.serializeAttachment({...session, role: null, token: null}); ws.close(1000, "Left room");
      if (session.role === "guest") {
        room.guestToken = null; room.guestConnection = null; room.guestDisconnectedAt = null;
        await this.save(); this.broadcast({type: "guestLeft"});
      } else this.broadcast({type: "spectatorCount", count: this.sockets("spectator").length}, false);
      return;
    }
    if (message.type === "state" && session.role === "host") {
      if (message.state?.started === true && !room.guestConnection) {
        return send(ws, {type: "error", message: "Opponent required to start"});
      }
      room.state = message.state; room.revision = Number(message.revision) || 0;
      await this.save(); return this.broadcast({type: "state", state: room.state, revision: room.revision});
    }
    if (message.type === "orbitalStrikeResult" && session.role === "host") return this.broadcast({type: "orbitalStrikeResult", result: message.result});
    if (message.type === "action" && session.role === "guest") return send(this.peer("host"), {type: "action", action: message.action, token: session.token});
    if (message.type === "chat") {
      const text = String(message.text || "").trim().slice(0, 200);
      if (text) this.broadcast({type: "chat", from: session.role, text, at: Date.now()});
    }
    if (message.type === "sync") send(ws, {type: "state", revision: room.revision, state: room.state});
  }

  async webSocketMessage(ws, raw) {
    return this.ctx.blockConcurrencyWhile(async () => {
      if (typeof raw !== "string" || new TextEncoder().encode(raw).length > MAX_MESSAGE_BYTES) {
        return send(ws, {type: "error", message: "Message too large or invalid"});
      }
      let message;
      try {message = JSON.parse(raw);} catch {return send(ws, {type: "error", message: "Invalid JSON"});}
      if (!message || typeof message.type !== "string") return;
      await this.handleMessage(ws, message);
    });
  }

  async disconnected(ws) {
    const session = attachment(ws), role = session.role;
    if (!this.room || !role) return;
    if (role === "spectator") {
      ws.serializeAttachment({...session, role: null, token: null});
      this.broadcast({type: "spectatorCount", count: this.sockets("spectator").length}, false); return;
    }
    if (this.room[`${role}Connection`] !== session.connection) return;
    this.room[`${role}Connection`] = null; this.room[`${role}DisconnectedAt`] = Date.now();
    await this.save();
    send(this.peer(role === "host" ? "guest" : "host"), {type: `${role}Disconnected`, graceMs: GRACE_MS});
  }

  async webSocketClose(ws) {
    ws.close(1000, "Connection closed");
    return this.ctx.blockConcurrencyWhile(() => this.disconnected(ws));
  }

  async webSocketError(ws) {
    ws.close(1011, "Connection error");
    return this.ctx.blockConcurrencyWhile(() => this.disconnected(ws));
  }

  async alarm() {
    return this.ctx.blockConcurrencyWhile(async () => {await this.expire(); if (this.room) await this.save();});
  }
}

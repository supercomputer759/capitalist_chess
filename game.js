"use strict";

const FILES = [
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h"
];
const PIECES = {
    p: {
        name: "폰",
        price: 180,
        captureReward: 140,
        tax: 10
    },
    n: {
        name: "나이트",
        price: 520,
        captureReward: 400,
        tax: 28
    },
    b: {
        name: "비숍",
        price: 520,
        captureReward: 400,
        tax: 28
    },
    r: {
        name: "룩",
        price: 850,
        captureReward: 650,
        tax: 45
    },
    q: {
        name: "퀸",
        price: 1500,
        captureReward: 1150,
        tax: 90
    },
    k: {
        name: "킹",
        price: null,
        captureReward: 0,
        tax: 0,
        purchasable: false
    }
};
const PIECE_SCORE = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 0
};
let DEBUG_STOCKFISH = false;
try {
    DEBUG_STOCKFISH = localStorage.getItem("capitalistChessStockfishDebug") === "true";
} catch (_) {}
window.DEBUG_STOCKFISH = DEBUG_STOCKFISH;
const CFG = {
    startMoney: 1600,
    startSalary: 190,
    maxAP: 3,
    jobPay: 100,
    salaryRaise: 30,
    salaryBaseCost: 800,
    salaryUpgradeMultiplier: 1.65,
    depositAmount: 500,
    depositReturn: 1.10,
    ventureAmount: 300,
    ventureMinReturn: 0.5,
    ventureMaxReturn: 1.75,
    bankruptcy: -900,
    propertyBase: 140,
    propertyVisitPrice: 50,
    tollBase: 20,
    tollVisitIncrement: 15,
    sellRatio: 0.60,
    brilliantBonus: 180,
    bestBonus: 80,
    promoteCost: 1500,
    teleportCost: 3000,
    insuranceCost: 8000,
    orbitalStrike: {
        enabled: true,
        price: 24000,
        apCost: 3,
        radius: 1
    }
};
const CLOCK_INITIAL_SECONDS = 900;
let orbitalTargetCancel = null;
const ENGINE_EVAL_CONFIG = {
    depth: 10,
    multiPV: 3,
    confidenceMinimum: 0.6,
    brilliantBonus: 600,
    bestBonus: 300,
    excellentBonus: 180,
    goodBonus: 100,
    interestingBonus: 40,
    bestMaxLoss: 25,
    goodMaxLoss: 35,
    brilliantMaxLoss: 25,
    excellentMaxLoss: 35,
    goodMaxLoss: 80,
    interestingMaxLoss: 140,
    inaccuracyMaxLoss: 220,
    mistakeMaxLoss: 450,
    tacticalGain: 80
};

// Wikipedia/Wikimedia의 원본 SVG를 직접 사용한다. 백은 light(l), 흑은 classic dark(d) SVG를
// 사용해 기존 흑/백 색감을 유지한다.
const IMG = {
    wk: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_klt45.svg",
    wq: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_qlt45.svg",
    wr: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_rlt45.svg",
    wb: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_blt45.svg",
    wn: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_nlt45.svg",
    wp: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_plt45.svg",
    bk: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_kdt45.svg",
    bq: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_qdt45.svg",
    br: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_rdt45.svg",
    bb: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_bdt45.svg",
    bn: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_ndt45.svg",
    bp: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Chess_pdt45.svg"
};
const IMG_FALLBACK = Object.fromEntries(
    Object.keys(IMG).map(k => [k, `assets/pieces/${k}.png`])
);
function pieceImgTag(key, cls = "piece", alt = key) {
    return `<img class="${cls}" src="${IMG[key]}" data-fallback="${IMG_FALLBACK[key]}" alt="${alt}">`;
}
function attachImageFallbacks(scope = document) {
    scope
        .querySelectorAll("img[data-fallback]")
        .forEach(img => {
            img.onerror = () => {
                if (img.dataset.fallback && img.src !== new URL(img.dataset.fallback, location.href).href) {
                    img.onerror = null;
                    img.src = img.dataset.fallback;
                }
            };
        });
}

const STOCKS = {
    pastry: {
        name: "앙파상 제과",
        price: 100,
        last: 100
    },
    check: {
        name: "체크전자",
        price: 135,
        last: 135
    },
    castle: {
        name: "캐슬링 공업",
        price: 122,
        last: 122
    },
    knight: {
        name: "나이트 AI",
        price: 188,
        last: 188
    },
    bed: {
        name: "킹 침대",
        price: 96,
        last: 96
    }
};

let NEWS = [];
const NEWS_HISTORY_LIMIT = 12;

function makePlayer(color) {
    return {
        color,
        money: CFG.startMoney,
        creditDebt: 0,
        salary: CFG.startSalary,
        salaryLevel: 0,
        ap: CFG.maxAP,
        moveUsed: false,
        insurance: false,
        holdings: Object.fromEntries(Object.keys(STOCKS).map(k => [k, 0])),
        stockBasis: Object.fromEntries(Object.keys(STOCKS).map(k => [k, 0])),
        deposits: [],
        ventures: [],
        automation: {
            ...window.EconomyRules.DEFAULT_AUTOMATION
        },
        warehouse: [],
        receivables: [],
        pendingInterest: 0,
        ownTurns: 0
    };
}

const state = {
    started: false,
    multiplayerHostColor: "w",
    economyRules: window
        .EconomyRules
        .preset("standard"),
    auctions: [],
    auctionSerial: 0,
    lobbySettings: {},
    stockfishEnabled: true,
    specialEnabled: true,
    orbitalSettings: {
        ...CFG.orbitalStrike
    },
    board: Array.from({
        length: 8
    }, () => Array(8).fill(null)),
    turn: "w",
    turnNo: 1,
    players: {
        w: makePlayer("w"),
        b: makePlayer("b")
    },
    selected: null,
    mode: null,
    pendingPiece: null,
    pendingSpecialId: null,
    pendingWarehouseId: null,
    legalTargets: [],
    kingDangerTargets: [],
    visits: {},
    properties: {},
    lastMove: null,
    enPassant: null,
    standardSetup: false,
    setupMode: "kings",
    customSetup: null,
    gameOver: false,
    gameResult: null,
    engineReady: false,
    engine: null,
    engineQueue: [],
    news: [],
    annotations: [],
    annotationStart: null,
    annotationPreview: null,
    annotationPointerId: null,
    dragFrom: null,
    justDragged: 0,
    headlineIndex: 0,
    recentNewsIds: [],
    newsEventSerial: 0,
    headlineTimer: null,
    clock: {
        w: CLOCK_INITIAL_SECONDS,
        b: CLOCK_INITIAL_SECONDS
    },
    audio: {
        sound: true,
        bgm: true,
        bgmPlayer: null,
        bgmIndex: 0,
        bgmLastIndex: -1,
        started: false
    },
    turnTimeLeft: CLOCK_INITIAL_SECONDS,
    turnTimerId: null,
    drawOffer: null,
    positionEval: null,
    specialStock: {},
    specialRestockTurn: 0,
    engineRevision: 0,
    engineMoveSerial: 0,
    engineAwarded: new Set()
};

function loadAudioSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem("capitalistChessAudio") || "{}");
        if (typeof saved.sound === "boolean")
            state.audio.sound = saved.sound;
        if (typeof saved.bgm === "boolean")
            state.audio.bgm = saved.bgm;
        }
    catch (_) {}
}
function saveAudioSettings() {
    try {
        localStorage.setItem(
            "capitalistChessAudio",
            JSON.stringify({sound: state.audio.sound, bgm: state.audio.bgm})
        );
    } catch (_) {}
}
function playSound(name) {
    if (!state.audio.sound)
        return;
    const audio = new Audio(`assets/sounds/${name}.ogg`);
    audio.volume = .55;
    audio
        .play()
        .catch(() => {});
}
const BGM_TRACKS = ["bgm_market_01.ogg", "bgm_market_02.ogg", "bgm_strategy_01.ogg"];
function playNextBgm() {
    if (!state.audio.bgm)
        return;
    const choices = BGM_TRACKS
        .map((_, index) => index)
        .filter(index => index !== state.audio.bgmLastIndex);
    const index = choices[Math.floor(Math.random() * choices.length)];
    state.audio.bgmLastIndex = index;
    const track = BGM_TRACKS[index];
    const audio = new Audio(`assets/sounds/${track}`);
    audio.volume = .18;
    audio.onended = () => {
        if (state.audio.bgmPlayer === audio) {
            state.audio.bgmPlayer = null;
            playNextBgm();
        }
    };
    state.audio.bgmPlayer = audio;
    audio
        .play()
        .catch(() => {
            if (state.audio.bgmPlayer === audio)
                state.audio.bgmPlayer = null;
            }
        );
}
function startBgm() {
    if (!state.audio.bgm || state.audio.bgmPlayer)
        return;
    playNextBgm();
}
function stopBgm() {
    if (state.audio.bgmPlayer) {
        state.audio.bgmPlayer.onended = null;
        state
            .audio
            .bgmPlayer
            .pause();
        state.audio.bgmPlayer.currentTime = 0;
        state.audio.bgmPlayer = null;
    }
}
function renderAudioControls() {
    const soundIcon = `assets/images/sound_${state.audio.sound ? "on" : "off"}.png`;
    const soundLabel = langText("audio.soundOn", "효과음 켜짐");
    const soundOffLabel = langText("audio.soundOff", "효과음 꺼짐");
    const bgmIcon = `assets/images/bgm_${state.audio.bgm ? "on" : "off"}.png`;
    const bgmLabel = langText("audio.bgmOn", "배경음악 켜짐");
    const bgmOffLabel = langText("audio.bgmOff", "배경음악 꺼짐");
    for (const id of ["soundToggleIcon", "lobbySoundToggleIcon"]) {
        const icon = document.getElementById(id);
        if (!icon) continue;
        icon.src = soundIcon;
        icon.alt = state.audio.sound ? soundLabel : soundOffLabel;
    }
    for (const id of ["bgmToggleIcon", "lobbyBgmToggleIcon"]) {
        const icon = document.getElementById(id);
        if (!icon) continue;
        icon.src = bgmIcon;
        icon.alt = state.audio.bgm ? bgmLabel : bgmOffLabel;
    }
    for (const id of ["soundToggle", "lobbySoundToggle"]) {
        document.getElementById(id)?.setAttribute("aria-pressed", String(state.audio.sound));
    }
    for (const id of ["bgmToggle", "lobbyBgmToggle"]) {
        document.getElementById(id)?.setAttribute("aria-pressed", String(state.audio.bgm));
    }
}
function renderStockfishDebugControl() {
    const debug = document.getElementById("stockfishDebugToggle");
    if (!debug)
        return;
    debug
        .classList
        .toggle("active", DEBUG_STOCKFISH);
    debug.setAttribute("aria-pressed", String(DEBUG_STOCKFISH));
    debug.title = langText("audio.debugTitle", "Stockfish DEBUG 로그 {v0}", {
        v0: DEBUG_STOCKFISH
            ? langText("audio.turnOff", "끄기")
            : langText("audio.turnOn", "켜기")
    });
}
function setStockfishDebug(enabled) {
    DEBUG_STOCKFISH = Boolean(enabled);
    window.DEBUG_STOCKFISH = DEBUG_STOCKFISH;
    try {
        localStorage.setItem("capitalistChessStockfishDebug", String(DEBUG_STOCKFISH));
    } catch (_) {}
    renderAudioControls();
    renderStockfishDebugControl();
}
function bindAudioControls() {
    loadAudioSettings();
    renderAudioControls();
    renderStockfishDebugControl();
    const toggleSound = () => {
        state.audio.sound = !state.audio.sound;
        saveAudioSettings();
        renderAudioControls();
        if (state.audio.sound) playSound("click");
    };
    const toggleBgm = () => {
        state.audio.bgm = !state.audio.bgm;
        saveAudioSettings();
        if (state.audio.bgm) startBgm();
        else stopBgm();
        renderAudioControls();
    };
    for (const id of ["soundToggle", "lobbySoundToggle"]) {
        document.getElementById(id)?.addEventListener("click", toggleSound);
    }
    for (const id of ["bgmToggle", "lobbyBgmToggle"]) {
        document.getElementById(id)?.addEventListener("click", toggleBgm);
    }
    document.getElementById("stockfishDebugToggle")?.addEventListener("click", () => {
        setStockfishDebug(!DEBUG_STOCKFISH);
    });
    document.addEventListener("pointerdown", () => {
        state.audio.started = true;
        startBgm();
    }, {once: true});
}

function cheatPlayer(color) {
    const normalized = String(color).toLowerCase();
    if (!state.players[normalized])
        throw new Error(`색상은 w 또는 b여야 해: ${color}`);
    return state.players[normalized];
}

window.gameState = state;
function serializeGameState() {
    return JSON.parse(JSON.stringify({
        schemaVersion: 1,
        started: state.started,
        multiplayerHostColor: state.multiplayerHostColor,
        stockfishEnabled: state.stockfishEnabled,
        specialEnabled: state.specialEnabled,
        orbitalSettings: state.orbitalSettings,
        economySettings: economySettingsSnapshot(),
        economyRules: state.economyRules,
        auctions: state.auctions,
        auctionSerial: state.auctionSerial,
        lobbySettings: state.lobbySettings,
        revision: state.engineRevision,
        board: state.board,
        turn: state.turn,
        turnNo: state.turnNo,
        players: state.players,
        visits: state.visits,
        properties: state.properties,
        lastMove: state.lastMove,
        enPassant: state.enPassant,
        standardSetup: state.standardSetup,
        setupMode: state.setupMode,
        customSetup: state.customSetup,
        gameOver: state.gameOver,
        gameResult: state.gameResult,
        specialStock: state.specialStock,
        specialRestockTurn: state.specialRestockTurn,
        clock: state.clock,
        drawOffer: state.drawOffer,
        positionEval: state.positionEval,
        news: state.news,
        recentNewsIds: state.recentNewsIds
    }));
}
function economySettingsSnapshot() {
    return {
        startMoney: CFG.startMoney,
        startSalary: CFG.startSalary,
        maxAP: CFG.maxAP,
        jobPay: CFG.jobPay,
        salaryRaise: CFG.salaryRaise,
        salaryBaseCost: CFG.salaryBaseCost,
        salaryUpgradeMultiplier: CFG.salaryUpgradeMultiplier,
        depositAmount: CFG.depositAmount,
        depositReturn: CFG.depositReturn,
        ventureAmount: CFG.ventureAmount,
        ventureMinReturn: CFG.ventureMinReturn,
        ventureMaxReturn: CFG.ventureMaxReturn
    };
}
function applyEconomySettings(settings = {}) {
    const number = (key, fallback, min, max) => {
        const value = Number(settings[key]);
        return Number.isFinite(value)
            ? Math.max(min, Math.min(max, value))
            : fallback;
    };
    CFG.jobPay = number("jobPay", CFG.jobPay, 0, 100000);
    CFG.startMoney = number("startMoney", CFG.startMoney, 0, 1000000);
    CFG.startSalary = number("startSalary", CFG.startSalary, 0, 1000000);
    CFG.maxAP = Math.round(number("maxAP", CFG.maxAP, 1, 9));
    CFG.salaryRaise = number("salaryRaise", CFG.salaryRaise, 0, 100000);
    CFG.salaryBaseCost = number("salaryBaseCost", CFG.salaryBaseCost, 0, 1000000);
    CFG.salaryUpgradeMultiplier = number(
        "salaryUpgradeMultiplier",
        CFG.salaryUpgradeMultiplier,
        1,
        10
    );
    CFG.depositAmount = number("depositAmount", CFG.depositAmount, 0, 1000000);
    CFG.depositReturn = number("depositReturn", CFG.depositReturn, 1, 10);
    CFG.ventureAmount = number("ventureAmount", CFG.ventureAmount, 0, 1000000);
    CFG.ventureMinReturn = number("ventureMinReturn", CFG.ventureMinReturn, 0, 20);
    CFG.ventureMaxReturn = Math.max(
        CFG.ventureMinReturn,
        number("ventureMaxReturn", CFG.ventureMaxReturn, 0, 20)
    );
}
function applyGameState(snapshot) {
    if (!snapshot || snapshot.schemaVersion !== 1)
        return false;
    const boardChanged = Boolean(
        snapshot.board && JSON.stringify(snapshot.board) !== JSON.stringify(state.board)
    );
    const turnChanged = Boolean(snapshot.turn && snapshot.turn !== state.turn);
    const turnNoChanged = Number(snapshot.turnNo || state.turnNo) !== state.turnNo;
    const startedChanged = Boolean(snapshot.started) !== state.started;
    const previousEvalMoveId = state.positionEval
        ?.moveId;
    const previousPriceMultiplier = state.economyRules.priceMultiplier;
    if (snapshot.economySettings)
        applyEconomySettings(snapshot.economySettings);
    state.enPassant = snapshot.enPassant || null;
    state.standardSetup = Boolean(snapshot.standardSetup);
    state.setupMode = snapshot.setupMode || "kings";
    state.customSetup = snapshot.customSetup || null;
    if (!snapshot.started && document.getElementById("lobbyBoardSetup"))
        document
            .getElementById("lobbyBoardSetup")
            .value = state.setupMode;
    state.economyRules = window
        .EconomyRules
        .normalize(snapshot.economyRules);
    state.auctions = snapshot.auctions || [];
    state.auctionSerial = Number(snapshot.auctionSerial) || 0;
    state.lobbySettings = snapshot.lobbySettings || {};
    state.multiplayerHostColor = snapshot.multiplayerHostColor === "b"
        ? "b"
        : "w";
    window
            .multiplayer
            ?.updateRoomUI();
    window.dispatchEvent(new Event("multiplayer-host-color-change"));
    if (!snapshot.started)
        for (const [id, value] of Object.entries(state.lobbySettings)) {
            const input = document.getElementById(id);
            if (
                !input
                    ?.matches(
                        ".lobby-settings input,.lobby-economy-settings input,.lobby-rules input:not([re" +
                        "adonly]):not(#lobbyKingCapture)"
                    )
            )
                continue;
            if (input.type === "checkbox")
                input.checked = Boolean(value);
            else
                input.value = value;
            }
        const wasStarted = state.started;
    state.started = Boolean(snapshot.started);
    state.stockfishEnabled = snapshot.stockfishEnabled !== false;
    state.specialEnabled = snapshot.specialEnabled !== false;
    if (snapshot.orbitalSettings) {
        state.orbitalSettings = {
            ...CFG.orbitalStrike,
            ...snapshot.orbitalSettings
        };
        Object.assign(CFG.orbitalStrike, state.orbitalSettings);
    }
    CFG.orbitalStrike.apCost = CFG.maxAP;
    state.orbitalSettings.apCost = CFG.maxAP;
    document.querySelector(".shop-panel")
        ?.classList
            .toggle("special-disabled", !state.specialEnabled);
    state.board = snapshot.board || state.board;
    state.turn = snapshot.turn || state.turn;
    state.turnNo = Number(snapshot.turnNo || state.turnNo);
    state.players = snapshot.players || state.players;
    for (const color of["w", "b"]) {
        const player = state.players[color];
        player.creditDebt = Number(player.creditDebt || 0);
        player.stockBasis ||= Object.fromEntries(
            Object.keys(STOCKS).map(key => [key, 0])
        );
        player.holdings ||= Object.fromEntries(
            Object.keys(STOCKS).map(key => [key, 0])
        );
    }
    state.visits = snapshot.visits || {};
    state.properties = snapshot.properties || {};
    state.lastMove = snapshot.lastMove || null;
    for (const color of["w", "b"])
        window
            .EconomyRules
            .player(state.players[color]);
    const wasGameOver = state.gameOver;
    state.gameOver = Boolean(snapshot.gameOver);
    const gameOverChanged = wasGameOver !== state.gameOver;
    state.gameResult = snapshot.gameResult || null;
    state.specialStock = snapshot.specialStock || {};
    state.specialRestockTurn = Number(snapshot.specialRestockTurn || 0);
    state.clock = snapshot.clock || state.clock;
    state.drawOffer = snapshot.drawOffer || null;
    state.positionEval = snapshot.positionEval || null;
    state.news = snapshot.news || [];
    state.recentNewsIds = snapshot.recentNewsIds || [];
    state.engineRevision = Number(snapshot.revision || 0);
    state.engineAwarded = new Set();
    if (previousPriceMultiplier !== state.economyRules.priceMultiplier)
        buildShop();
    if (boardChanged || turnChanged || turnNoChanged || startedChanged || gameOverChanged) {
        state.selected = null;
        state.legalTargets = [];
        state.mode = null;
    }
    render();
    renderTurnTimer();
    if (
        ["guest", "spectator"].includes(multiplayerRole()) && state.positionEval
            ?.moveId && state.positionEval.moveId !== previousEvalMoveId
    ) {
        showMoveGradeEffect({
            grade: state.positionEval.gradeKey || "Unrated",
            bonus: state.positionEval.bonus || 0,
            square: state.positionEval.square,
            moveId: state.positionEval.moveId
        });
    }
    if (state.started)
        document.getElementById("lobbyScreen")
            ?.classList
                .add("hidden");
    if (state.started && !wasStarted) {
        startTurnTimer();
        if (multiplayerRole() === "guest") {
            const automation = window
                .EconomyUI
                .initialAutomation(multiplayerColorForRole("guest"));
            for (const key of Object.keys(window.EconomyRules.DEFAULT_AUTOMATION)) {
                window
                    .EconomyUI
                    .send("automation", {
                        key,
                        value: typeof automation
                            ?.[key] === "boolean"
                                ? automation[key]
                                : true
                    });
            }
        }
    }
    if (state.gameOver && !wasGameOver && state.gameResult)
        showGameResult();
    return true;
}
window.serializeGameState = serializeGameState;
window.applyGameState = applyGameState;
function multiplayerRole() {
    const mp = window.multiplayer;
    return mp
        ?.socket
            ?.readyState === 1 && mp.code && mp.token
                ? mp.role
                : null;
}
function multiplayerColorForRole(role = multiplayerRole()) {
    const hostColor = state.multiplayerHostColor === "b"
        ? "b"
        : "w";
    if (role === "host")
        return hostColor;
    if (role === "guest")
        return hostColor === "w"
            ? "b"
            : "w";
    return null;
}
window.multiplayerColorForRole = multiplayerColorForRole;
function multiplayerOwnsColor(color) {
    const role = multiplayerRole();
    if (role === "host" || role === "guest")
        return color === multiplayerColorForRole(role);
    if (role === "spectator")
        return false;
    return true;
}
function multiplayerOwnsSquare(square) {
    return Boolean(square && multiplayerOwnsColor(
        state.board[square.r]
            ?.[square.c]
                ?.color
    ));
}
function economyFeature(key) {
    return window
        .EconomyRules
        .enabled(state, key);
}
function economyPrice(value) {
    return window
        .EconomyRules
        .price(state, Number(value) || 0);
}
window.economyPrice = economyPrice;
function publishEconomyLobby() {
    if (state.started || ["guest", "spectator"].includes(multiplayerRole()))
        return;
    state.economyRules = window
        .EconomyUI
        .lobbyRules();
    state.lobbySettings = {};
    state.setupMode = document.getElementById("lobbyBoardSetup")
        ?.value || "kings";
    state.customSetup ||= window
            .SetupEditor
            ?.saved() || null;
    document
        .querySelectorAll(
            ".lobby-settings input,.lobby-economy-settings input,.lobby-rules input:not([re" +
            "adonly]):not([disabled])"
        )
        .forEach(input => {
            state.lobbySettings[input.id] = input.type === "checkbox"
                ? input.checked
                : input.value;
        });
    if (multiplayerRole() === "host")
        window
            .multiplayer
            .sendState(serializeGameState());
    }
function handleEconomyExpansion(color, action) {
    const R = window.EconomyRules,
        UI = window.EconomyUI,
        p = R.player(state.players[color]);
    if (!state.started || state.gameOver)
        return;
    let ok = false;
    if (action.op === "automation" && economyFeature("automation")) {
        if (Object.hasOwn(R.DEFAULT_AUTOMATION, action.key) && typeof action.value === "boolean") {
            p.automation[action.key] = action.value;
            ok = true;
            if (multiplayerOwnsColor(color))
                UI.saveAutomation(p);
            }
        } else if (state.turn === color) {
        if (action.op === "list")
            ok = R.list(
                state,
                color,
                action.square,
                action.startPrice,
                piecePrice,
                p => p.type === "k" || isKingLike(p)
            );
        if (action.op === "bid")
            ok = R.bid(state, color, action.id, action.amount);
        if (action.op === "deploy")
            ok = R.deploy(state, color, action.id, action.square);
        if (economyFeature("automation")) {
            if (action.op === "claim" && p.receivables.length) {
                R.claim(p);
                ok = true;
            }
            if (action.op === "interest" && p.pendingInterest) {
                R.settleInterest(p);
                ok = true;
            }
            if (action.op === "repay" && p.money > 0 && ((p.creditDebt || 0) + p.pendingInterest) > 0) {
                R.repay(p);
                ok = true;
            }
        }
    }
    if (ok) {
        if (["list", "deploy"].includes(action.op)) {
            state.engineRevision++;
            state.selected = null;
            state.legalTargets = [];
            state.mode = null;
            state.pendingWarehouseId = null;
        }
        if (action.op !== "automation")
            log(UI.t("done"), "good");
        }
    else
        log(UI.t("failed"), "bad");
    render();
}
function rejectRemoteTurn() {
    log(langText("notice.notYourTurn", "상대 턴에는 행동할 수 없어."), "bad");
    render();
}
window.handleMultiplayerAction = function (action) {
    if (multiplayerRole() !== "host" || !action)
        return;
    if (action.type === "economyExpansion")
        return handleEconomyExpansion("b", action);
    if (action.type === "resign")
        return finishGame("w", "흑 기권", "result.resigned", {side: "b"});
    if (action.type === "orbitalStrike")
        return executeOrbitalStrike(action.target);
    if (state.turn !== "b")
        return;
    if (action.type === "endTurn")
        return endTurn();
    if (action.type === "draw")
        return requestDrawFor("b");
    if (action.type === "purchase") {
        state.mode = action.specialId
            ? "special-buy"
            : "buy";
        state.pendingSpecialId = action.specialId || null;
        state.pendingPiece = action.piece || null;
        return finishPurchase(action.r, action.c);
    }
    if (action.type === "teleport") {
        if (!multiplayerOwnsSquare(action.selected))
            return;
        state.selected = action.selected;
        return finishTeleport(action.r, action.c);
    }
    if (action.type === "pieceAbility") {
        if (
            !action.source || state.board[action.source.r]
                ?.[action.source.c]
                    ?.color !== "b"
        )
            return;
        return executePieceAbility(
            action.id,
            action.source,
            action.target,
            action.passenger
        );
    }
    if ([
        "job",
        "salary",
        "deposit",
        "venture",
        "insurance",
        "promote",
        "buyProperty",
        "sellPiece",
        "stockBuy",
        "stockSell"
    ].includes(action.type)) {
        if (action.selected && !multiplayerOwnsSquare(action.selected))
            return;
        if (action.selected) {
            state.selected = action.selected;
        }
        if (action.type === "job")
            return doJob();
        if (action.type === "salary")
            return raiseSalary();
        if (action.type === "deposit")
            return makeDeposit();
        if (action.type === "venture")
            return makeVenture();
        if (action.type === "insurance")
            return buyInsurance();
        if (action.type === "promote")
            return instantPromote();
        if (action.type === "buyProperty")
            return buyProperty();
        if (action.type === "sellPiece")
            return sellSelectedPiece();
        if (action.type === "stockBuy" || action.type === "stockSell") {
            const select = document.getElementById("stockSelect"),
                qty = document.getElementById("stockQty");
            if (select && action.key)
                select.value = action.key;
            if (qty && action.qty)
                qty.value = action.qty;
            return tradeStock(action.type === "stockBuy");
        }
    }
    if (action.type !== "move")
        return;
    const from = fromName(action.from),
        to = fromName(action.to),
        moving = from && to
            ? state.board[from.r]
                ?.[from.c]
                : null;
    if (!from || !to)
        return;
    if (!moving || moving.color !== "b")
        return log(langText("notice.blackOnly", "흑 기물만 조작할 수 있어."), "bad");
    const legal = legalMovesFor(from.r, from.c).some(
        cell => cell.r === to.r && cell.c === to.c
    );
    if (!legal)
        return log(
            langText("notice.illegalGuestMove", "온라인 상대의 불법 이동 요청을 거부했어."),
            "bad"
        );
    makeMove(from.r, from.c, to.r, to.c);
};
function runMultiplayerAction(type, local, payload = () => ({})) {
    return(...args) => {
        if (type === "draw" && !canRequestDraw())
            return rejectRemoteTurn();
        if (multiplayerRole() === "guest") {
            window
                .multiplayer
                .sendAction({
                    type,
                    ...payload(...args)
                });
            return;
        }
        if (multiplayerRole() === "spectator") {
            log(langText("notice.spectatorAction", "관전자는 게임 행동을 할 수 없어."), "bad");
            return;
        }
        local(...args);
    };
}
window.setStockfishDebug = setStockfishDebug;
window.cheat = {
    money(color, amount) {
        cheatPlayer(color).money = Number(amount);
        render();
    },
    addMoney(color, amount) {
        cheatPlayer(color).money += Number(amount);
        render();
    },
    ap(color, amount) {
        cheatPlayer(color).ap = Number(amount);
        render();
    },
    clock(color, seconds) {
        const normalized = String(color).toLowerCase();
        if (!state.clock[normalized])
            throw new Error(`색상은 w 또는 b여야 해: ${color}`);
        state.clock[normalized] = Math.max(0, Number(seconds) || 0);
        renderTurnTimer();
    },
    addClock(color, seconds) {
        const normalized = String(color).toLowerCase();
        if (!state.clock[normalized])
            throw new Error(`색상은 w 또는 b여야 해: ${color}`);
        state.clock[normalized] = Math.max(
            0,
            state.clock[normalized] + (Number(seconds) || 0)
        );
        renderTurnTimer();
    },
    specialStock(id, amount) {
        if (!SpecialPieces.get(id))
            throw new Error(`특수기물 id를 찾을 수 없어: ${id}`);
        state.specialStock[id] = Math.max(0, Math.floor(Number(amount) || 0));
        render();
    },
    restockSpecial() {
        restockSpecialPieces();
        render();
    },
    fillSpecialStock(amount = null) {
        for (const def of SpecialPieces.list()) {
            const max = Math.max(0, Math.floor(Number(
                def.stock
                    ?.max
            ) || 0));
            const value = amount === null
                ? max
                : Math.max(0, Math.floor(Number(amount) || 0));
            state.specialStock[def.id] = Math.min(max, value);
        }
        render();
    },
    fillStock(amount = null) {
        return this.fillSpecialStock(amount);
    },
    effect(grade = "brilliant", bonus = null) {
        const key = String(grade).toLowerCase();
        const config = MOVE_GRADE_VFX[key] || MOVE_GRADE_VFX.brilliant;
        const value = bonus === null
            ? config.defaultBonus
            : Number(bonus) || 0;
        showMoveGradeEffect(
            {grade: key, bonus: value, square: state.lastMove, moveId: `cheat-${Date.now()}`}
        );
        if (key === "brilliant")
            playSound("brilliant");
        }
    ,
    brilliant(bonus = CFG.brilliantBonus) {
        this.effect("brilliant", bonus);
    },
    best(bonus = CFG.bestBonus) {
        this.effect("best", bonus);
    },
    excellent(bonus = 0) {
        this.effect("excellent", bonus);
    },
    good(bonus = ENGINE_EVAL_CONFIG.goodBonus) {
        this.effect("good", bonus);
    },
    inaccuracy() {
        this.effect("inaccuracy", 0);
    },
    mistake() {
        this.effect("mistake", 0);
    },
    blunder() {
        this.effect("blunder", 0);
    },
    unrated() {
        this.effect("unrated", 0);
    }
};
window.cheat.clock = (color, seconds) => {
    const normalized = String(color).toLowerCase();
    if (!["w", "b"].includes(normalized))
        throw new Error("clock color must be w or b");
    state.clock[normalized] = Math.max(0, Number(seconds) || 0);
    renderTurnTimer();
};
window.cheat.addClock = (color, seconds) => {
    const normalized = String(color).toLowerCase();
    if (!["w", "b"].includes(normalized))
        throw new Error("clock color must be w or b");
    state.clock[normalized] = Math.max(
        0,
        state.clock[normalized] + (Number(seconds) || 0)
    );
    renderTurnTimer();
};

function lobbyNumber(id, fallback, min, max) {
    const input = document.getElementById(id);
    if (!input || input.value.trim() === "")
        return fallback;
    const parsed = Number(input.value);
    if (!Number.isFinite(parsed))
        return fallback;
    const value = Math.max(min, Math.min(max, parsed));
    input.value = String(value);
    return value;
}
function setupLobby() {
    const lobby = document.getElementById("lobbyScreen");
    const single = document.getElementById("singleModeBtn");
    const multi = document.getElementById("multiModeBtn");
    const hubTitle = document.querySelector(".lobby-hub-head h2");
    const internet = document.getElementById("lobbyInternetStatus");
    const connection = document.getElementById("lobbyConnectionStatus");
    const roomStatus = document.getElementById("lobbyRoomStatus");
    const tools = document.getElementById("lobbyMultiplayerTools");
    const start = document.getElementById("lobbyStartBtn");
    const hostWhite = document.getElementById("lobbyHostWhiteBtn");
    const hostBlack = document.getElementById("lobbyHostBlackBtn");
    if (!lobby || !single || !multi || !start)
        return;
    let mode = "single";
    const returnToLobby = () => {
        stopTurnTimer();
        state.started = false;
        state.gameOver = false;
        state.gameResult = null;
        state.drawOffer = null;
        state.mode = null;
        state.selected = null;
        state.legalTargets = [];
        document.getElementById("gameOverModal")
            ?.classList
                .add("hidden");
        lobby
            .classList
            .remove("hidden");
        mode = "multi";
        renderInternet("offline");
        update();
        render();
    };
    if (window.multiplayer)
        window.multiplayer.onRoomEnded = returnToLobby;
    const update = () => {
        const isMulti = mode === "multi",
            role = multiplayerRole();
        single
            .classList
            .toggle("active", !isMulti);
        multi
            .classList
            .toggle("active", isMulti);
        if (hubTitle)
            hubTitle.textContent = langText(
                isMulti
                    ? "lobby.multiHub"
                    : "lobby.hubTitle",
                isMulti
                    ? "\uba40\ud2f0\ud50c\ub808\uc774 \ud5c8\ube0c"
                    : "\uc2f1\uae00\ud50c\ub808\uc774 \ud5c8\ube0c"
            );
        if (connection)
            connection.textContent = isMulti
                ? (
                    role
                        ? langText("lobby.onlineRoom", "\uc628\ub77c\uc778 \ubc29") + " | " + (
                            role === "spectator"
                                ? langText("network.spectatorLabel", "Spectator · 관전자")
                                : role === "host"
                                    ? "Host"
                                    : "Guest"
                        )
                        : langText("lobby.waitingRoom", "\ubc29 \uc5f0\uacb0 \ub300\uae30")
                )
                : langText("lobby.localGame", "\ub85c\uceec \uac8c\uc784");
        tools
            ?.classList
                .toggle("hidden", !isMulti);
        start.textContent = langText(
            isMulti
                ? "lobby.startMulti"
                : "lobby.startSingle",
            isMulti
                ? "\uba40\ud2f0\ud50c\ub808\uc774 \uc2dc\uc791"
                : "\uc2f1\uae00\ud50c\ub808\uc774 \uc2dc\uc791"
        );
        const opponentPresent = Boolean(
            window.multiplayer
                ?.opponentPresent
        );
        start.disabled = isMulti && (role !== "host" || !opponentPresent);
        start.title = isMulti && role === "host" && !opponentPresent
            ? langText("lobby.waitingForOpponent", "상대 참가자가 연결되면 시작할 수 있습니다.")
            : "";
        if (hostWhite && hostBlack) {
            const hostColor = state.multiplayerHostColor === "b"
                ? "b"
                : "w";
            hostWhite
                .classList
                .toggle("active", hostColor === "w");
            hostBlack
                .classList
                .toggle("active", hostColor === "b");
            hostWhite.disabled = state.started || (Boolean(role) && role !== "host");
            hostBlack.disabled = state.started || (Boolean(role) && role !== "host");
            hostWhite.setAttribute("aria-pressed", String(hostColor === "w"));
            hostBlack.setAttribute("aria-pressed", String(hostColor === "b"));
        }
        const hostActive = role === "host";
        for (
            const id of["lobbyCreateRoomBtn", "lobbyJoinRoomBtn", "lobbyWatchRoomBtn"]
        ) {
            const button = document.getElementById(id);
            if (button)
                button.disabled = hostActive;
            }
        window
            .EconomyUI
            .syncLobby();
        document
            .querySelectorAll(
                ".lobby-settings input:not([readonly]),.lobby-rules input:not(#lobbyKingCapture" +
                "):not([readonly]),.lobby-economy-settings input,#economyPresetPanel button,#ec" +
                "onomyPresetPanel select,#economyPresetPanel input"
            )
            .forEach(input => input.disabled = isMulti && Boolean(role) && role !== "host");
        const readonly = state.started || (isMulti && Boolean(role) && role !== "host");
        document
            .getElementById("lobbyBoardSetup")
            .disabled = readonly;
        document
            .getElementById("editCustomSetup")
            .disabled = readonly;
    };
    const apply = () => {
        const hostRole = multiplayerRole();
        if (mode === "multi" && hostRole !== "host")
            return;
        state.turn = "w";
        state.turnNo = 1;
        state.gameOver = false;
        state.gameResult = null;
        state.drawOffer = null;
        state.positionEval = null;
        state.visits = {};
        state.properties = {};
        state.auctions = [];
        state.auctionSerial = 0;
        state.news = [];
        state.recentNewsIds = [];
        state.newsEventSerial = 0;
        state.engineMoveSerial = 0;
        state.engineAwarded = new Set();
        for (const color of["w", "b"])
            state.players[color] = makePlayer(color);
        state.economyRules = window
            .EconomyUI
            .lobbyRules();
        state.setupMode = document
            .getElementById("lobbyBoardSetup")
            .value;
        if (state.setupMode === "custom") {
            state.customSetup = window
                .SetupEditor
                .normalize(
                    state.customSetup || window.SetupEditor.saved(),
                    Object.fromEntries(SpecialPieces.list().map(def => [def.id, def]))
                );
            if (!state.customSetup) {
                window
                    .SetupEditor
                    .open();
                return false;
            }
        }
        state.standardSetup = state.setupMode === "standard" || (
            state.setupMode === "custom" && state.customSetup.castling
        );
        state.board = state.setupMode === "custom"
            ? window
                .SetupEditor
                .initialBoard(state.customSetup, piece, specialPiece)
            : window
                .ChessRules
                .initialBoard(state.standardSetup, piece);
        state.enPassant = null;
        state.lastMove = null;
        state.selected = null;
        state.legalTargets = [];
        for (const color of["w", "b"])
            if (multiplayerOwnsColor(color)) {
                state
                    .players[color]
                    .automation = window
                    .EconomyUI
                    .initialAutomation(color);
                window
                    .EconomyRules
                    .player(state.players[color]);
            }
        CFG.startMoney = lobbyNumber("lobbyMoney", 1600, 0, 1000000);
        CFG.startSalary = lobbyNumber("lobbySalary", 190, 0, 1000000);
        CFG.maxAP = Math.round(lobbyNumber("lobbyAP", 3, 1, 9));
        const seconds = Math.max(
            60,
            Math.round(lobbyNumber("lobbyClock", 15, 1, 180) * 60)
        );
        applyEconomySettings({
            jobPay: lobbyNumber("lobbyJobPay", CFG.jobPay, 0, 100000),
            salaryRaise: lobbyNumber("lobbySalaryRaise", CFG.salaryRaise, 0, 100000),
            salaryBaseCost: lobbyNumber(
                "lobbySalaryBaseCost",
                CFG.salaryBaseCost,
                0,
                1000000
            ),
            salaryUpgradeMultiplier: lobbyNumber(
                "lobbySalaryMultiplier",
                CFG.salaryUpgradeMultiplier,
                1,
                10
            ),
            depositAmount: lobbyNumber("lobbyDepositAmount", CFG.depositAmount, 0, 1000000),
            depositReturn: 1 + lobbyNumber(
                "lobbyDepositReturn",
                Math.round((CFG.depositReturn - 1) * 100),
                0,
                900
            ) / 100,
            ventureAmount: lobbyNumber("lobbyVentureAmount", CFG.ventureAmount, 0, 1000000),
            ventureMinReturn: lobbyNumber("lobbyVentureMin", CFG.ventureMinReturn, 0, 20),
            ventureMaxReturn: lobbyNumber("lobbyVentureMax", CFG.ventureMaxReturn, 0, 20)
        });
        state.stockfishEnabled = document.getElementById("lobbyStockfish")
            ?.checked !== false;
        state.specialEnabled = document.getElementById("lobbySpecialPieces")
            ?.checked !== false;
        CFG.orbitalStrike.enabled = document.getElementById("lobbyOrbitalEnabled")
            ?.checked !== false;
        CFG.orbitalStrike.price = lobbyNumber("lobbyOrbitalPrice", 24000, 0, 10000000);
        CFG.orbitalStrike.apCost = CFG.maxAP;
        state.orbitalSettings = {
            ...CFG.orbitalStrike
        };
        buildShop();
        for (const color of["w", "b"]) {
            state
                .players[color]
                .money = state.setupMode === "custom"
                    ? state
                        .customSetup
                        .money[color]
                    : CFG.startMoney;
            state
                .players[color]
                .salary = CFG.startSalary;
            state
                .players[color]
                .salaryLevel = 0;
            state
                .players[color]
                .ap = CFG.maxAP;
        }
        state.clock = {
            w: seconds,
            b: seconds
        };
        state.turnTimeLeft = seconds;
        document.querySelector(".shop-panel")
            ?.classList
                .toggle("special-disabled", !state.specialEnabled);
    };
    const begin = () => {
        const role = multiplayerRole();
        if (mode === "multi" && role !== "host")
            return;
        if (
            mode === "multi" && !window.multiplayer
                ?.opponentPresent
        ) {
            update();
            return;
        }
        if (mode !== "multi" || role === "host")
            if (apply() === false)
                return;
    if (!state.started) {
            if (state.setupMode === "custom")
                log(
                    langText("log.customStarted", "커스텀 게임 시작. 백 초기 자금 {white} / 흑 초기 자금 {black}.", {
                        white: fmt(state.players.w.money),
                        black: fmt(state.players.b.money)
                    }),
                    "gold"
                );
            else
                log(langText("log.gameStarted", "게임 시작. 양측 킹 1개 + {money}.", {
                    money: fmt(CFG.startMoney)
                }), "gold");
            }
        state.started = true;
        lobby
            .classList
            .add("hidden");
        render();
        startTurnTimer();
        if (role === "host")
            window
                .multiplayer
                .sendState(serializeGameState());
        };
    single.onclick = () => {
        if (multiplayerRole())
            return;
        mode = "single";
        renderInternet("offline");
        update();
    };
    multi.onclick = () => {
        mode = "multi";
        renderInternet(
            window.multiplayer
                ?.status || "offline"
        );
        update();
    };
    start.onclick = begin;
    document
            .getElementById("lobbyCreateRoomBtn")
            ?.addEventListener(
                "click",
                () => {
                    publishEconomyLobby();
                    window.multiplayer
                        ?.createRoom().catch(error => {
                            if (connection)
                                connection.textContent = error.message;
                        });
                }
            );
    document
            .getElementById("lobbyJoinRoomBtn")
            ?.addEventListener(
                "click",
                () => window.multiplayer
                    ?.joinRoom(
                        document.getElementById("lobbyRoomCodeInput")
                            ?.value
                    ).catch(error => {
                            if (connection)
                                connection.textContent = error.message;
                            }
                        )
            );
    document
            .getElementById("lobbyWatchRoomBtn")
            ?.addEventListener(
                "click",
                () => window.multiplayer
                    ?.watchRoom(
                        document.getElementById("lobbyRoomCodeInput")
                            ?.value
                    ).catch(error => {
                            if (connection)
                                connection.textContent = error.message;
                            }
                        )
            );
    hostWhite
        ?.addEventListener("click", () => {
            const role = multiplayerRole();
            if (role && role !== "host" || state.started)
                return;
            state.multiplayerHostColor = "w";
            update();
            if (role === "host")
                publishEconomyLobby();
            }
        );
    hostBlack
        ?.addEventListener("click", () => {
            const role = multiplayerRole();
            if (role && role !== "host" || state.started)
                return;
            state.multiplayerHostColor = "b";
            update();
            if (role === "host")
                publishEconomyLobby();
            }
        );
    document
            .getElementById("lobbyLeaveRoomBtn")
            ?.addEventListener(
                "click",
                () => window.multiplayer
                    ?.leave()
            );
    document
            .getElementById("lobbyCopyRoomCodeBtn")
            ?.addEventListener("click", async () => {
                const code = window.multiplayer
                    ?.code;
                if (!code)
                    return;
                try {
                    await navigator
                        .clipboard
                        .writeText(code);
                    if (roomStatus)
                        roomStatus.textContent = langText(
                            "network.codeCopied",
                            "방 코드 {code}를 복사했습니다.",
                            {code}
                        );
                    }
                catch (_) {
                    const input = document.getElementById("lobbyRoomCodeInput");
                    if (input) {
                        input.value = code;
                        input.select();
                        document.execCommand("copy");
                        if (roomStatus)
                            roomStatus.textContent = langText(
                                "network.codeCopied",
                                "방 코드 {code}를 복사했습니다.",
                                {code}
                            );
                        }
                    }
            });
    const renderInternet = status => {
        if (!internet)
            return;
        const key = ["room", "waiting"].includes(status)
            ? "connected"
            : status;
        const labels = {
            offline: "인터넷: 오프라인",
            booting: "인터넷: 서버 부팅 중...",
            connecting: "인터넷: 서버에 연결 중...",
            reconnecting: "인터넷: 재연결 중...",
            connected: "인터넷: 연결됨",
            error: "인터넷: 연결 오류"
        };
        internet.textContent = mode !== "multi"
            ? langText("network.local", "인터넷: 로컬 모드")
            : langText("network." + key, labels[key] || ("인터넷: " + (
                status || "확인 중"
            )));
    };
    if (window.multiplayer)
        window.multiplayer.onStatus = ({status, detail}) => {
            renderInternet(status);
            if (connection && mode === "multi")
                connection.textContent = detail || window.multiplayer.status;
            if (roomStatus && mode === "multi" && !detail)
                roomStatus.textContent = window.multiplayer.status;
            update();
            };
        window.addEventListener("game-language-change", () => {
            renderInternet(
                window.multiplayer
                    ?.status || "offline"
            );
            update();
        });
    window.addEventListener("multiplayer-host-color-change", update);
    renderInternet(
        window.multiplayer
            ?.status || "offline"
    );
    update();
}

async function init() {
    const [specialData, newsData] = await Promise.all([
        SpecialPieces.load(), window
            .GameNews
            .load()
    ]);
    NEWS = newsData;
    await window
        .GameLanguage
        .load();
    const status = document.getElementById("specialLoadStatus");
    if (!specialData) {
        if (status) {
            status.dataset.i18n = "shop.loadFailed";
            status.textContent = langText(
                "shop.loadFailed",
                "특수기물 데이터를 불러오지 못했습니다. 일반 게임은 계속할 수 있습니다."
            );
        }
    } else {
        restockSpecialPieces(true);
        if (status) {
            status.dataset.i18n = "shop.sharedStock";
            status.textContent = langText("shop.sharedStock", "공유 재고 · 휠클릭으로 상세정보");
        }
    }
    state.board[7][4] = piece("k", "w");
    state.board[0][4] = piece("k", "b");
    buildBoard();
    buildShop();
    buildStocks();
    bindControls();
    bindAudioControls();
    window
        .SetupEditor
        .init({
            state,
            role: multiplayerRole,
            publish: publishEconomyLobby,
            sideName,
            standardName: stockPieceName,
            specialName: specialPieceName,
            setMode: value => {
                document
                    .getElementById("lobbyBoardSetup")
                    .value = value;
                state.setupMode = value;
            },
            image: unit => unit.specialId
                ? specialChessVisual(specialDef(unit.specialId), unit.color)
                : pieceImgTag(unit.color + unit.type, "piece", stockPieceName(unit.type)),
            fallbacks: attachImageFallbacks
        });
    document
        .getElementById("lobbyBoardSetup")
        .addEventListener("change", publishEconomyLobby);
    window
        .EconomyUI
        .init({
            state,
            role: multiplayerRole,
            action: handleEconomyExpansion,
            publish: publishEconomyLobby,
            render,
            log,
            pieceName,
            sideName,
            money: fmt,
            tax: countTax,
            bankruptcy: CFG.bankruptcy
        });
    document
        .querySelectorAll(
            ".lobby-settings input,.lobby-rules input,.lobby-economy-settings input"
        )
        .forEach(input => input.addEventListener("change", publishEconomyLobby));
    if (window.multiplayer) {
        window.multiplayer.onAction = action => window.handleMultiplayerAction(action);
        window.multiplayer.onState = snapshot => applyGameState(snapshot);
        window
            .multiplayer
            .bindUI();
    }
    addNews(
        {id: "opening", companyId: "market", company: "시장", text: "자본주의 체스 거래소가 개장했다. 모두의 통장이 무사하길."}
    );
    const readyLog = log(
        langText("log.gameReady", "게임 준비 완료. 로비에서 설정한 뒤 시작해."),
        "gold"
    );
    if (readyLog)
        readyLog.dataset.i18n = "log.gameReady";
    initStockfish();
    render();
    setupLobby();
    window.addEventListener("game-language-change", refreshLanguageUI);
    const languageSelect = document.getElementById("interfaceLanguage");
    if (languageSelect) {
        languageSelect.value = window
            .GameLanguage
            .getLocale();
        languageSelect.addEventListener("change", async () => {
            languageSelect.disabled = true;
            try {
                await window
                    .GameLanguage
                    .setLocale(languageSelect.value);
            } finally {
                languageSelect.value = window
                    .GameLanguage
                    .getLocale();
                languageSelect.disabled = false;
            }
        });
    }
    showHeadline(0, true);
    state.headlineTimer = setInterval(cycleHeadline, 3600);
}

function piece(type, color) {
    return {
        type,
        color,
        moved: false,
        id: crypto.randomUUID
            ? crypto.randomUUID()
            : Math
                .random()
                .toString(36)
                .slice(2)
    };
}
function purchasedPiece(type, color) {
    return {
        ...piece(type, color),
        purchaseLocked: true,
        active: false,
        activationTurn: state.turnNo + 1,
        attackLockedTurns: 3
    };
}
function specialPiece(id, color) {
    const def = SpecialPieces.get(id);
    const abilityCharges = Object.fromEntries((
        def
            ?.abilities || []
    ).filter(a => Number(
        a.params
            ?.charges
    ) > 0).map(a => [
        a.id,
        Number(a.params.charges)
    ]));
    const unit = {
        type: "special",
        specialId: id,
        color,
        moved: false,
        purchaseLocked: true,
        active: false,
        activationTurn: state.turnNo + 1,
        attackLockedTurns: 3,
        abilityCharges,
        id: crypto.randomUUID
            ? crypto.randomUUID()
            : Math
                .random()
                .toString(36)
                .slice(2)
    };
    const venture = specialAbility(def, "venture_roll");
    if (venture)
        runAbility(venture.id, {
            state,
            piece: unit,
            params: venture.params || {},
            event: "purchase"
        });
    return unit;
}
function movementSpec(piece, def = pieceDef(piece)) {
    const value = piece.growMovement || piece.ventureMovement || def
        ?.movement || {};
    return typeof value === "string"
        ? {
            type: value
        }
        : value;
}
function refreshLanguageUI() {
    const stockSelect = document.getElementById("stockSelect"),
        selectedStock = stockSelect
            ?.value;
    buildShop();
    buildStocks();
    if (stockSelect && selectedStock)
        stockSelect.value = selectedStock;
    renderAudioControls();
    renderStockfishDebugControl();
    renderEngineStatus();
    const loadStatus = document.getElementById("specialLoadStatus");
    if (loadStatus)
        loadStatus.textContent = SpecialPieces.data
            ? langText("shop.sharedStock", "공유 재고 · 휠클릭으로 상세정보")
            : langText("shop.loadFailed", "특수기물 데이터를 불러오지 못했습니다. 일반 게임은 계속할 수 있습니다.");
    const readyLog = document.querySelector('[data-i18n="log.gameReady"]');
    if (readyLog)
        readyLog.textContent = langText("log.gameReady", "게임 준비 완료. 로비에서 설정한 뒤 시작해.");
    window
            .multiplayer
            ?.updateRoomUI();
    window
            .multiplayer
            ?.updateChatUI();
    render();
    showHeadline(state.headlineIndex, true);
    if (state.selected)
        renderTileInfo(sqName(state.selected.r, state.selected.c));
    if (state.gameOver)
        showGameResult();
    }
function sideName(color) {
    return color === "w"
        ? langText("game.white", "백")
        : langText("game.black", "흑");
}
function specialDef(id) {
    return SpecialPieces.get(id);
}
function specialChessType(def) {
    const valid = new Set([
        "p",
        "n",
        "b",
        "r",
        "q",
        "k"
    ]);
    const configured = def
        ?.stockfish
            ?.equivalent;
    if (valid.has(configured))
        return configured;
    if (
        def
            ?.abilities
                ?.some(ability => ability.id === "ranged_capture")
    )
        return "r";
    const movement = def
        ?.movement || {};
    const types = movement.type === "compound"
        ? (movement.modes || movement.parts || []).map(
            mode => typeof mode === "string"
                ? mode
                : mode
                    ?.type
        )
        : [movement.type];
    const visualTypes = {
        queen: "q",
        rook: "r",
        bishop: "b",
        knight: "n",
        king: "k",
        pawn: "p",
        stationary: "r",
        dynamic: "r",
        progressive: "p",
        random_on_purchase: "n",
        king_aura_teleport: "k"
    };
    for (const type of["queen", "rook", "bishop", "knight", "king", "pawn"])
        if (types.includes(type))
            return visualTypes[type];
return visualTypes[types[0]] || "n";
}
function specialChessGlyph(def) {
    return ({
        k: "\u2654",
        q: "\u2655",
        r: "\u2656",
        b: "\u2657",
        n: "\u2658",
        p: "\u2659"
    })[specialChessType(def)];
}
function specialChessVisual(def, color = "w", label = "", conceal = false) {
    const escape = value => String(value).replace(
        /[&<>"']/g,
        char => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[char]
    );
    const side = color === "b"
            ? "b"
            : "w",
        type = conceal
            ? "k"
            : def
                ?.standardType || specialChessType(def);
    const title = conceal
        ? stockPieceName("k")
        : label || specialPieceName(def) || langText("piece.special", "특수기물");
    const asset = conceal
        ? null
        : window
                .SpecialPieceArt
                ?.path(
                    def
                        ?.id,
                    side
                );
    const image = asset
        ? '<img class="piece special-chess-image" src="' + asset + '" data-fallback="' +
                IMG_FALLBACK[side + type] + '" alt="' + escape(title) + '">'
        : pieceImgTag(side + type, "piece special-chess-image", escape(title));
    return '<span class="special-piece-icon special-piece-chess owner-' + side + '"' +
            ' title="' + escape(title) + '">' + image + '</span>';
}
window.specialChessVisual = specialChessVisual;
window.specialChessGlyph = specialChessGlyph;
function specialIcon(def) {
    return def
        ?.icon || def
            ?.emoji || "♟";
}
function specialScore(def) {
    return Number(
        def
            ?.score ?? def
                ?.pieceScore ?? 0
    );
}
function specialTax(def) {
    return Number(
        def
            ?.maintenanceTax ?? def
                ?.tax ?? 0
    );
}
function specialAbilities(def) {
    return def
        ?.abilities || [];
}
function specialAbility(def, id) {
    return specialAbilities(def).find(a => a.id === id);
}
function specialDisabledAt(r, c, p, board = state.board) {
    if (
        !p
            ?.specialId
    )
        return false;
    for (let rr = 0; rr < 8; rr++)
        for (let cc = 0; cc < 8; cc++) {
            const source = board[rr][cc];
            if (
                !source
                    ?.specialId || source.color === p.color || !source.active
            )
                continue;
            const ability = specialAbility(
                specialDef(source.specialId),
                "disable_enemy_specials_aura"
            );
            if (ability && Math.max(Math.abs(rr - r), Math.abs(cc - c)) <= Number(
                ability.params
                    ?.radius || 0
            ))
                return true;
            }
        return false;
    }
function operationalSpecialAt(r, c, p, board = state.board) {
    return Boolean(
        p
            ?.specialId && p.active && !specialDisabledAt(r, c, p, board)
    );
}
function fortressEntryMoves(r, c, p, board) {
    if (!isKingLike(p))
        return [];
    const out = [];
    for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr,
                cc = c + dc,
                fortress = board[rr]
                    ?.[cc];
            if (
                (dr || dc) && fortress
                    ?.specialId === "fortress" && fortress.color === p.color && operationalSpecialAt(
                        rr,
                        cc,
                        fortress,
                        board
                    )
            )
                out.push({r: rr, c: cc});
            }
        return out;
    }
function findPiecePosition(piece, board = state.board) {
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
            if (board[r][c] === piece || (
                piece
                    ?.id && board[r][c]
                        ?.id === piece.id
            ))
                return {r, c};
return null;
}
function isRangedCapture(piece, target, board = state.board) {
    const position = findPiecePosition(piece, board),
        victim = board[target.r]
            ?.[target.c];
    return Boolean(
        victim && victim.color !== piece.color && position && operationalSpecialAt(position.r, position.c, piece, board) && specialAbility(specialDef(piece.specialId), "ranged_capture")
    );
}
function isFakeKingDef(def) {
    return Boolean(
        def
            ?.fakeKing || specialAbility(def, "fake_king_identity")
    );
}
function isCountsAsKingDef(def) {
    return Boolean(
        def
            ?.countsAsKing || specialAbility(def, "royal_unit")
                ?.params
                    ?.countsAsKing
    );
}
function fakeKingPenalty(def) {
    const a = specialAbility(def, "fake_king_identity");
    return Number(
        def
            ?.captureApPenalty ?? a
                ?.params
                    ?.captureAPPenalty ?? a
                        ?.params
                            ?.captureApPenalty ?? 0
    );
}
function pieceDef(p) {
    return p
        ?.specialId
            ? specialDef(p.specialId)
            : PIECES[
                p
                    ?.type
            ];
}
function specialPieceName(def) {
    return def
        ? langText(`piece.${def.id}.name`, def.name || def.id)
        : langText("piece.special", "특수기물");
}
function specialPieceDescription(def) {
    return def
        ? langText(`piece.${def.id}.description`, def.description || "")
        : "";
}
function companyName(
    id,
    fallback = STOCKS[id]
        ?.name || id
) {
    return langText(`company.${id}`, fallback);
}
function stockPieceName(type) {
    return langText(
        `piece.standard.${type}`,
        PIECES[type]
            ?.name || type
    );
}
function localizedNews(event) {
    const company = companyName(
        event.companyId || "market",
        event.company || event.companyId || "Market"
    );
    const text = event.eventType === "specialRestock"
        ? langText("news.specialRestock", "{piece} {count}개 입고", {
            piece: specialPieceName(specialDef(event.pieceId)),
            count: event.count
        })
        : langText(`news.${event.id}`, event.text || "");
    return {company, text};
}
function pieceName(p, viewerColor = state.turn) {
    const def = pieceDef(p);
    if (!def)
        return langText("piece.unknown", "기물");
    if (
        p
            ?.specialId
    )
        return isFakeKingDef(def) && p.color !== viewerColor
            ? langText("piece.standard.k", "킹")
            : specialPieceName(def);
    return stockPieceName(p.type);
}
function piecePrice(p) {
    return economyPrice(
        pieceDef(p)
            ?.price || 0
    );
}
function pieceCaptureReward(p) {
    return economyPrice(
        pieceDef(p)
            ?.captureReward ?? pieceDef(p)
                ?.price ?? 0
    );
}
function pieceScore(p) {
    return p.specialId
        ? (
            p.specialId === "venture_knight" && Number.isFinite(Number(p.ventureScore))
                ? Number(p.ventureScore)
                : specialScore(pieceDef(p))
        )
        : Number(
            pieceDef(p)
                ?.score || 0
        );
}
function isKingLike(p) {
    const def = p
        ?.specialId
            ? specialDef(p.specialId)
            : null;
    return p
        ?.type === "k" || Boolean(
            p
                ?.specialId && !isFakeKingDef(def) && isCountsAsKingDef(def)
        );
}
function legacyPieceVisual(p) {
    return pieceVisual(p);
}
function pieceViewerColor() {
    const role = multiplayerRole();
    return role === "host" || role === "guest"
        ? multiplayerColorForRole(role)
        : role === "spectator"
            ? null
            : state.turn;
}
function pieceVisual(p) {
    const def = pieceDef(p);
    const owner = p.color === "w"
        ? langText("color.white", "\ubc31")
        : langText("color.black", "\ud751");
    const viewer = pieceViewerColor();
    const conceal = isFakeKingDef(def) && p.color !== viewer;
    if (conceal)
        return pieceImgTag(p.color + "k", "piece", p.color + "k");
    return specialChessVisual(
        def,
        p.color,
        pieceName(p, viewer) + " | " + owner,
        conceal
    );
}
function current() {
    return state.players[state.turn];
}
function enemyColor(c = state.turn) {
    return c === "w"
        ? "b"
        : "w";
}
function fmt(n) {
    return "$" + Math
        .round(n)
        .toLocaleString("ko-KR");
}
function langText(key, fallback, values = {}) {
    return window
            .GameLanguage
            ?.text(key, fallback, values) ?? fallback;
}
function sqName(r, c) {
    return FILES[c] + (8 - r);
}
function fromName(s) {
    return {
        r: 8 - Number(s[1]),
        c: FILES.indexOf(s[0])
    };
}
function inBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
}
function cloneBoard(board = state.board) {
    return board.map(row => row.map(
        p => p
            ? {
                ...p
            }
            : null
    ));
}
function countTax(color) {
    if (!economyFeature("tax"))
        return 0;
    let n = 0;
    for (const row of state.board)
        for (const p of row)
            if (
                p
                    ?.color === color
            ) {
                n += p.specialId
                    ? specialTax(pieceDef(p))
                    : Number(
                        PIECES[p.type]
                            ?.tax || 0
                    );
                if (p.shelterFortress)
                    n += specialTax(pieceDef(p.shelterFortress));
                }
            for (let r = 0; r < 8; r++)
                for (let c = 0; c < 8; c++) {
                    const p = state.board[r][c];
                    if (
                        p
                            ?.color === color && p.specialId && operationalSpecialAt(r, c, p)
                    ) {
                        const ability = specialAbility(specialDef(p.specialId), "piece_tax_discount");
                        if (ability)
                            n = Math.max(0, Math.round(n * (1 - Number(
                                ability.params
                                    ?.fraction || 0
                            ))));
                        }
                    }
            return n;
}
function countPieceScore(color) {
    let score = 0;
    for (const row of state.board)
        for (const p of row)
            if (
                p
                    ?.color === color
            ) {
                score += p.specialId
                    ? pieceScore(p)
                    : PIECE_SCORE[p.type] || 0;
                if (p.shelterFortress)
                    score += pieceScore(p.shelterFortress);
                }
            return score;
        }
    function spend(player, amount, reason = langText("action.expense", "지출")) {
    if (player.money < amount) {
        log(langText("log.moneyRequired", "{v0}: 돈 부족 ({v1} 필요)", {
            v0: reason,
            v1: fmt(amount)
        }), "bad");
        return false;
    }
    player.money -= amount;
    return true;
}
function creditTerms(color = state.turn) {
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
            const unit = state.board[r][c];
            if (
                unit
                    ?.color === color && unit.specialId === "credit_card_knight" && operationalSpecialAt(
                        r,
                        c,
                        unit
                    )
            ) {
                const ability = specialAbility(
                    specialDef(unit.specialId),
                    "allow_credit_purchases"
                );
                return runAbility(ability.id, {
                    state,
                    piece: unit,
                    owner: state.players[color],
                    params: ability.params || {},
                    event: "purchase"
                }) || {};
            }
        }
    return {};
}
function hasCreditLine(color = state.turn) {
    if (!economyFeature("credit"))
        return false;
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
            const unit = state.board[r][c];
            if (
                unit
                    ?.color === color && unit.specialId === "credit_card_knight" && operationalSpecialAt(
                        r,
                        c,
                        unit
                    )
            )
                return Number(creditTerms(color).creditLimit) > 0;
            }
        return false;
    }
function purchaseAndAP(amount, apCost, label) {
    const p = current(),
        limit = hasCreditLine()
            ? Number(creditTerms().creditLimit) || 0
            : 0;
    if (p.money + Math.max(0, limit - Number(p.creditDebt || 0) - Number(p.pendingInterest || 0)) < amount) {
        log(
            langText("log.creditInsufficient", "{v0}: 구매 자금과 신용 한도 부족", {v0: label}),
            `bad`
        );
        return false;
    }
    if (p.ap < apCost) {
        log(langText("log.apRequired", "{v0}: AP 부족 ({v1} 필요)", {
            v0: label,
            v1: apCost
        }), `bad`);
        return false;
    }
    const shortage = Math.max(0, amount - p.money);
    p.money -= Math.min(amount, Math.max(0, p.money));
    p.creditDebt = Number(p.creditDebt || 0) + shortage;
    p.ap -= apCost;
    if (shortage)
        log(langText("log.creditAdded", "{v0}: 신용 구매 +{v1} 부채", {
            v0: label,
            v1: fmt(shortage)
        }), `gold`);
    return true;
}
function useAP(cost, label) {
    const p = current();
    if (p.ap < cost) {
        log(langText("log.apCost", "{v0}: AP 부족 ({v1} 필요)", {
            v0: label,
            v1: cost
        }), "bad");
        return false;
    }
    p.ap -= cost;
    return true;
}
function payAndAP(amount, apCost, label) {
    const p = current();
    if (p.money < amount) {
        log(langText("log.cashRequired", "{v0}: 돈 부족 ({v1} 필요)", {
            v0: label,
            v1: fmt(amount)
        }), "bad");
        return false;
    }
    if (p.ap < apCost) {
        log(langText("log.apRequired", "{v0}: AP 부족 ({v1} 필요)", {
            v0: label,
            v1: apCost
        }), "bad");
        return false;
    }
    p.money -= amount;
    p.ap -= apCost;
    return true;
}
function activeInCheck() {
    return isKingInCheck(state.turn, state.board);
}
function canEconomy() {
    return state.started && !state.gameOver && multiplayerRole() !== "spectator";
}

function rollSpecialStock(def) {
    const stock = def.stock || {};
    const max = Math.max(0, Number(stock.max) || 0);
    if (!max || Math.random() > Number(stock.restockChance || 0))
        return 0;
    if (Math.random() < Number(stock.zeroStockWeight || 0))
        return 0;
    return 1 + Math.floor(Math.random() * max);
}
function restockSpecialPieces(initial = false) {
    if (!SpecialPieces.data)
        return;
    for (const def of SpecialPieces.list()) {
        const amount = rollSpecialStock(def);
        state.specialStock[def.id] = amount;
        if (amount > 0 && (def.rarity === "신화" || def.rarity === "mythic"))
            addNews({
                id: `special-restock-${state.turnNo}-${def.id}`,
                eventType: "specialRestock",
                companyId: "market",
                pieceId: def.id,
                count: amount,
                text: `${specialPieceName(def)} ${amount}개 입고`
            });
        }
    for (const def of SpecialPieces.list()) {
        if (String(def.rarity).toLowerCase() === "legendary" && (state.specialStock[def.id] || 0) > 0) {
            addNews({
                id: `special-restock-${state.turnNo}-${def.id}`,
                eventType: "specialRestock",
                companyId: "market",
                pieceId: def.id,
                count: state.specialStock[def.id],
                text: `${specialPieceName(def)} ${state.specialStock[def.id]}개 입고`
            });
        }
    }
    const rareRestocked = ["black_hole", "chaebol_king", "mounted_king", "mounted_king_mk2"].some(
        id => (state.specialStock[id] || 0) > 0
    );
    if (rareRestocked)
        playSound("rare-restock");
    state.specialRestockTurn = state.turnNo;
    if (!initial)
        log(langText("notice.marketRestocked", "특수기물 시장 전체 재입고."), "gold");
    }

function buildBoard() {
    const board = document.getElementById("board");
    board.innerHTML = "";
    document
        .getElementById("fileLabels")
        .innerHTML = FILES
        .map(x => `<span>${x}</span>`)
        .join("");
    document
        .getElementById("rankLabels")
        .innerHTML = [
            8,
            7,
            6,
            5,
            4,
            3,
            2,
            1
        ]
        .map(x => `<span>${x}</span>`)
        .join("");
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
            const el = document.createElement("div");
            el.className = `square ${ (r + c) % 2
                ? "dark"
                : "light"}`;
            el.dataset.r = r;
            el.dataset.c = c;
            el.addEventListener("click", () => clickSquare(r, c));
            el.addEventListener("mousedown", e => {
                if (e.button === 1) {
                    e.preventDefault();
                    showBoardPieceInfo(r, c);
                }
            });
            el.addEventListener("auxclick", e => {
                if (e.button === 1)
                    e.preventDefault();
                }
            );
            el.addEventListener("dragstart", e => dragStartSquare(e, r, c));
            el.addEventListener("dragover", e => {
                if (state.dragFrom)
                    e.preventDefault();
                }
            );
            el.addEventListener("drop", e => dropSquare(e, r, c));
            el.addEventListener("dragend", dragEndSquare);
            board.appendChild(el);
        }
    board.addEventListener("contextmenu", e => e.preventDefault());
    board.addEventListener("pointerdown", annotationPointerDown);
    board.addEventListener("pointermove", annotationPointerMove);
    board.addEventListener("pointerup", annotationPointerUp);
    board.addEventListener("pointercancel", annotationPointerCancel);
    board.addEventListener("pointerleave", annotationPointerLeave);
}

function squareFromEvent(e) {
    const el = e.target.closest
        ?.(".square");
    return el
        ? {
            r: Number(el.dataset.r),
            c: Number(el.dataset.c)
        }
        : null;
}
function squareFromPoint(clientX, clientY) {
    const board = document.getElementById("board");
    if (!board)
        return null;
    const rect = board.getBoundingClientRect();
    /* Use the rendered board rectangle instead of event.target. This fixes circles
     drifting to the wrong square when the pointer is released near a border. */
    if (clientX < rect.left || clientX >= rect.right || clientY < rect.top || clientY >= rect.bottom)
        return null;
    const c = Math.max(
        0,
        Math.min(7, Math.floor((clientX - rect.left) / (rect.width / 8)))
    );
    const r = Math.max(
        0,
        Math.min(7, Math.floor((clientY - rect.top) / (rect.height / 8)))
    );
    return {r, c};
}
function clearAnnotationHover() {
    document
        .querySelectorAll(".square.annotation-hover,.square.annotation-origin")
        .forEach(el => el.classList.remove("annotation-hover", "annotation-origin"));
}
function paintAnnotationHover(from, to) {
    clearAnnotationHover();
    if (from) {
        const idx = from.r * 8 + from.c,
            el = document.querySelectorAll(".square")[idx];
        el
            ?.classList
                .add("annotation-origin");
    }
    if (to) {
        const idx = to.r * 8 + to.c,
            el = document.querySelectorAll(".square")[idx];
        el
            ?.classList
                .add("annotation-hover");
    }
}
function annotationPointerDown(e) {
    if (e.button !== 2)
        return;
    e.preventDefault();
    const from = squareFromPoint(e.clientX, e.clientY);
    if (!from)
        return;
    state.annotationStart = from;
    state.annotationPreview = {
        kind: "circle",
        fr: from.r,
        fc: from.c,
        tr: from.r,
        tc: from.c
    };
    state.annotationPointerId = e.pointerId;
    try {
        e
            .currentTarget
            .setPointerCapture(e.pointerId)
    } catch (_) {}
    paintAnnotationHover(from, from);
    renderAnnotations();
}
function annotationPointerMove(e) {
    if (state.annotationStart == null || state.annotationPointerId !== e.pointerId)
        return;
    const to = squareFromPoint(e.clientX, e.clientY);
    if (!to)
        return;
    const from = state.annotationStart;
    state.annotationPreview = {
        kind: (from.r === to.r && from.c === to.c)
            ? "circle"
            : "arrow",
        fr: from.r,
        fc: from.c,
        tr: to.r,
        tc: to.c
    };
    paintAnnotationHover(from, to);
    renderAnnotations();
}
function annotationPointerUp(e) {
    if (e.button !== 2 || !state.annotationStart || state.annotationPointerId !== e.pointerId)
        return;
    e.preventDefault();
    const from = state.annotationStart;
    const to = squareFromPoint(e.clientX, e.clientY) || (
        state.annotationPreview
            ? {
                r: state.annotationPreview.tr,
                c: state.annotationPreview.tc
            }
            : null
    );
    state.annotationStart = null;
    state.annotationPreview = null;
    state.annotationPointerId = null;
    try {
        e
            .currentTarget
            .releasePointerCapture(e.pointerId)
    } catch (_) {}
    clearAnnotationHover();
    if (!to) {
        renderAnnotations();
        return;
    }
    const kind = (from.r === to.r && from.c === to.c)
        ? "circle"
        : "arrow";
    const idx = state
        .annotations
        .findIndex(
            a => a.kind === kind && a.fr === from.r && a.fc === from.c && a.tr === to.r && a.tc === to.c
        );
    /*  Same right-drag gesture toggles exactly this annotation, never clears the re
 * st.
 */
    if (idx >= 0)
        state
            .annotations
            .splice(idx, 1);
    else
        state
            .annotations
            .push({kind, fr: from.r, fc: from.c, tr: to.r, tc: to.c});
    renderAnnotations();
}
function annotationPointerCancel(e) {
    state.annotationStart = null;
    state.annotationPreview = null;
    state.annotationPointerId = null;
    clearAnnotationHover();
    renderAnnotations();
}
function annotationPointerLeave(e) {
    if (state.annotationStart == null)
        clearAnnotationHover();
    }
function annotationSvg(a, preview = false) {
    const x1 = a.fc * 100 + 50,
        y1 = a.fr * 100 + 50,
        extra = preview
            ? " annotation-preview"
            : "";
    if (a.kind === "circle")
        return `<circle class="annotation-circle${extra}" cx="${x1}" cy="${y1}" r="31"></circle>`;
    const x2 = a.tc * 100 + 50,
        y2 = a.tr * 100 + 50,
        dx = x2 - x1,
        dy = y2 - y1,
        len = Math.hypot(dx, dy) || 1;
    /* Keep both ends away from piece centers and use a compact arrow head. */
    const sx = x1 + dx / len * 22,
        sy = y1 + dy / len * 22,
        ex = x2 - dx / len * 24,
        ey = y2 - dy / len * 24;
    return `<line class="annotation-arrow${extra}" x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}"></line>`;
}
function renderAnnotations() {
    const layer = document.getElementById("annotationLayer");
    if (!layer)
        return;
    let html = state
        .annotations
        .map(a => annotationSvg(a, false))
        .join("");
    if (state.annotationPreview)
        html += annotationSvg(state.annotationPreview, true);
    layer.innerHTML = html;
}
function dragStartSquare(e, r, c) {
    if (state.gameOver || state.mode || current().moveUsed)
        return e.preventDefault();
    const p = state.board[r][c];
    if (!p || p.color !== state.turn || !multiplayerOwnsColor(p.color))
        return e.preventDefault();
    state.dragFrom = {
        r,
        c
    };
    state.selected = {
        r,
        c
    };
    state.legalTargets = legalMovesFor(r, c, true);
    e
        .currentTarget
        .classList
        .add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e
        .dataTransfer
        .setData("text/plain", sqName(r, c));
    render();
}
function dropSquare(e, r, c) {
    if (!state.dragFrom)
        return;
    e.preventDefault();
    const from = state.dragFrom;
    const role = multiplayerRole();
    if (!multiplayerOwnsSquare(from) || state.turn !== (
        role === "guest" || role === "host"
            ? multiplayerColorForRole(role)
            : state.turn
    )) {
        state.dragFrom = null;
        rejectRemoteTurn();
        return;
    }
    const legal = state
        .legalTargets
        .some(x => x.r === r && x.c === c);
    state.justDragged = Date.now();
    state.dragFrom = null;
    if (legal)
        makeMove(from.r, from.c, r, c);
    else {
        state.selected = {
            r: from.r,
            c: from.c
        };
        render();
    }
}
function dragEndSquare() {
    document
        .querySelectorAll(".square.dragging")
        .forEach(x => x.classList.remove("dragging"));
    state.dragFrom = null;
}

function buildShop() {
    const el = document.getElementById("pieceShop");
    el.innerHTML = "";
    ["p", "n", "b", "r", "q"].forEach(t => {
        const btn = document.createElement("button");
        btn.className = "shop-item";
        btn.innerHTML = `<span class="shop-piece"><img id="shop-${t}" alt="${stockPieceName(
            t
        )}"></span><b>${stockPieceName(t)}</b><small>${fmt(
            economyPrice(PIECES[t].price)
        )}</small>`;
        btn.addEventListener("click", () => startPurchase(t));
        btn.addEventListener("mousedown", e => {
            if (e.button === 1) {
                e.preventDefault();
                showPieceInfo(normalPieceInfo({type: t}), null, true, t);
            }
        });
        btn.addEventListener("auxclick", e => {
            if (e.button === 1)
                e.preventDefault();
            }
        );
        el.appendChild(btn);
    });
    buildSpecialShop();
}

function buildSpecialShop() {
    const el = document.getElementById("specialPieceShop");
    if (!el)
        return;
    el.innerHTML = "";
    for (const def of SpecialPieces.list()) {
        const btn = document.createElement("button");
        btn.className = "shop-item special-shop-item";
        btn.dataset.specialId = def.id;
        const name = specialPieceName(def);
        btn.innerHTML = `<span class="shop-piece special-shop-icon">${specialChessVisual(
            def,
            "w",
            name
        )}</span><b>${name}</b><small>${fmt(economyPrice(def.price))} · ${def.buyAP} AP</small><em class="special-stock" id="special-stock-${def.id}">${langText("shop.stock", "재고 {count}", {
            count: 0})}</em>`;
            btn.addEventListener("click", () => startSpecialPurchase(def.id));
            btn.addEventListener("mousedown", e => {
                if (e.button === 1) {
                    e.preventDefault();
                    showPieceInfo(def, state.specialStock[def.id] || 0, true, def.id, def.id);
                }
            });
            btn.addEventListener("auxclick", e => {
                if (e.button === 1)
                    e.preventDefault();
                }
            );
            el.appendChild(btn);
        }}

    function buildStocks() {
        const sel = document.getElementById("stockSelect");
        sel.innerHTML = Object
            .entries(STOCKS)
            .map(([k, s]) => `<option value="${k}">${companyName(k, s.name)}</option>`)
            .join("");
    }

    function bindControls() {
        document
            .getElementById("endTurnBtn")
            .onclick = runMultiplayerAction("endTurn", endTurn);
        document
            .getElementById("cancelModeBtn")
            .onclick = clearMode;
        document
            .getElementById("clearLogBtn")
            .onclick = () => document
            .getElementById("log")
            .innerHTML = "";
        document
            .getElementById("jobBtn")
            .onclick = runMultiplayerAction("job", doJob);
        document
            .getElementById("salaryBtn")
            .onclick = runMultiplayerAction("salary", raiseSalary);
        document
            .getElementById("depositBtn")
            .onclick = runMultiplayerAction("deposit", makeDeposit);
        document
            .getElementById("ventureBtn")
            .onclick = runMultiplayerAction("venture", makeVenture);
        document
            .getElementById("promoteBtn")
            .onclick = runMultiplayerAction(
                "promote",
                instantPromote,
                () => ({selected: state.selected})
            );
        document
            .getElementById("teleportBtn")
            .onclick = startTeleport;
        document
            .getElementById("insuranceBtn")
            .onclick = runMultiplayerAction("insurance", buyInsurance);
        document
            .getElementById("orbitalStrikeBtn")
            .onclick = startOrbitalStrike;
        document
            .getElementById("buyPropertyBtn")
            .onclick = runMultiplayerAction(
                "buyProperty",
                buyProperty,
                () => ({selected: state.selected})
            );
        document
            .getElementById("sellPieceBtn")
            .onclick = runMultiplayerAction(
                "sellPiece",
                sellSelectedPiece,
                () => ({selected: state.selected})
            );
        document
            .getElementById("stockBuyBtn")
            .onclick = runMultiplayerAction("stockBuy", () => tradeStock(true), () => ({
            key: document.getElementById("stockSelect")
                ?.value,
            qty: document.getElementById("stockQty")
                ?.value
        }));
        document
            .getElementById("stockSellBtn")
            .onclick = runMultiplayerAction("stockSell", () => tradeStock(false), () => ({
            key: document.getElementById("stockSelect")
                ?.value,
            qty: document.getElementById("stockQty")
                ?.value
        }));
        document
            .getElementById("drawBtn")
            .onclick = runMultiplayerAction("draw", requestDraw);
        document
                .getElementById("resignBtn")
                ?.addEventListener("click", () => {
                    if (confirm(langText("dialog.resign", "정말 기권할까?")))
                        resignGame();
                    }
                );
        document
                .getElementById("closeRoomBtn")
                ?.addEventListener("click", () => {
                    if (confirm(langText("dialog.closeRoom", "방을 종료하면 상대도 방에서 나가게 돼. 계속할까?")))
                        window
                                .multiplayer
                                ?.closeRoom();
                    }
                );
        [
            "cancelModeBtn",
            "clearLogBtn",
            "salaryBtn",
            "depositBtn",
            "ventureBtn",
            "promoteBtn",
            "teleportBtn",
            "insuranceBtn",
            "sellPieceBtn",
            "stockBuyBtn",
            "stockSellBtn"
        ].forEach(id => {
            document
                    .getElementById(id)
                    ?.addEventListener("click", () => playSound("click"));
        });
        document
            .getElementById("pieceInfoClose")
            .onclick = closePieceInfo;
        document
            .getElementById("pieceInfoModal")
            .addEventListener("click", e => {
                if (e.target.id === "pieceInfoModal")
                    closePieceInfo();
                }
            );
        document.addEventListener("keydown", e => {
            if (e.key === "Escape")
                closePieceInfo();
            }
        );
    }

    function closePieceInfo() {
        document.getElementById("pieceInfoModal")
            ?.classList
                .add("hidden");
    }
    function normalPieceInfo(p) {
        const movement = {
            p: "pawn",
            n: "knight",
            b: "bishop",
            r: "rook",
            q: "queen",
            k: "king"
        }[p.type] || "stationary";
        return {
            standardType: p.type,
            name: stockPieceName(p.type),
            icon: p.type === "k"
                ? "♔"
                : "♟",
            rarity: "common",
            score: PIECE_SCORE[p.type] || 0,
            price: PIECES[p.type].price,
            captureReward: PIECES[p.type].captureReward,
            buyAP: 1,
            maintenanceTax: PIECES[p.type].tax,
            description: "일반 체스 기물",
            warnings: [],
            movement: {
                type: movement,
                preview: {
                    cells: []
                }
            },
            abilities: []
        };
    }
    function showBoardPieceInfo(r, c) {
        const p = state.board[r][c];
        if (!p)
            return;
        const base = p.specialId
            ? specialDef(p.specialId)
            : normalPieceInfo(p);
        const def = p.specialId
            ? {
                ...base,
                movement: movementSpec(p, base),
                score: pieceScore(p)
            }
            : base;
        const viewerOwns = p.color === pieceViewerColor();
        const hiddenFakeId = p.specialId && isFakeKingDef(def) && !viewerOwns;
        showPieceInfo(
            def,
            p.specialId
                ? state.specialStock[p.specialId] || 0
                : null,
            viewerOwns,
            p.id,
            hiddenFakeId
                ? null
                : (p.specialId || p.type),
            p.color
        );
    }

    function clickSquare(r, c) {
        if (state.gameOver)
            return;
        if (state.mode === "orbital-targeting")
            return;
        if (multiplayerRole() === "spectator")
            return;
        playSound("click");
        if (Date.now() - state.justDragged < 180)
            return;
        if (state.annotations.length || state.annotationPreview) {
            state.annotations = [];
            state.annotationPreview = null;
            clearAnnotationHover();
            renderAnnotations();
        }
        if (state.mode === "warehouse-deploy") {
            window
                .EconomyUI
                .send("deploy", {
                    id: state.pendingWarehouseId,
                    square: {
                        r,
                        c
                    }
                });
            return;
        }
        const p = state.board[r][c];
        const key = sqName(r, c);

        if (state.mode === "buy" || state.mode === "special-buy") {
            if (multiplayerRole() === "guest" && state.turn !== multiplayerColorForRole("guest"))
                return rejectRemoteTurn();
            if (multiplayerRole() === "guest") {
                window
                    .multiplayer
                    .sendAction(
                        {type: "purchase", piece: state.pendingPiece, specialId: state.pendingSpecialId, r, c}
                    );
                return;
            }
            return finishPurchase(r, c);
        }
        if (state.mode === "teleport") {
            if (multiplayerRole() === "guest" && (state.turn !== multiplayerColorForRole("guest") || !multiplayerOwnsSquare(state.selected)))
                return rejectRemoteTurn();
            if (multiplayerRole() === "guest") {
                window
                    .multiplayer
                    .sendAction({type: "teleport", selected: state.selected, r, c});
                return;
            }
            return finishTeleport(r, c);
        }
        if (state.mode === "taxi-passenger") {
            if (!p || p.color !== state.turn || p.type === "k" || isKingLike(p))
                return log(langText("notice.taxiPassenger", "택시가 태울 아군 기물을 선택해."), "bad");
            state.abilityPassenger = {
                r,
                c
            };
            state.mode = "taxi-destination";
            log(
                langText("log.taxiBoarded", "{v0} 탑승 완료. 택시가 이동할 빈 칸을 선택해.", {v0: pieceName(p)}),
                "gold"
            );
            render();
            return;
        }
        if (state.mode === "taxi-destination" || state.mode === "piece-ability-target") {
            if (state.mode === "taxi-destination" && p)
                return log(langText("notice.taxiEmpty", "택시는 빈 칸으로 이동해야 해."), "bad");
            if (state.mode === "piece-ability-target" && state.pendingAbilityId === "paid_same_color_warp" && p)
                return log(langText("notice.warpEmpty", "워프 목적지는 빈 칸이어야 해."), "bad");
            const id = state.pendingAbilityId,
                source = {
                    ...state.abilitySource
                },
                passenger = state.abilityPassenger
                    ? {
                        ...state.abilityPassenger
                    }
                    : null,
                target = {
                    r,
                    c
                };
            if (multiplayerRole() === "guest")
                return window
                    .multiplayer
                    .sendAction({type: "pieceAbility", id, source, target, passenger});
            return executePieceAbility(id, source, target, passenger);
        }

        const isLegal = state
            .legalTargets
            .some(x => x.r === r && x.c === c);
        if (state.selected && isLegal) {
            if (multiplayerRole() === "guest" && state.turn === multiplayerColorForRole("guest") && multiplayerOwnsSquare(state.selected)) {
                window
                    .multiplayer
                    .sendAction({
                        type: "move",
                        from: sqName(state.selected.r, state.selected.c),
                        to: sqName(r, c)
                    });
                return;
            }
            if (multiplayerRole() === "guest" || multiplayerRole() === "host" && !multiplayerOwnsSquare(state.selected))
                return rejectRemoteTurn();
            return makeMove(state.selected.r, state.selected.c, r, c);
        }

        if (p && !multiplayerOwnsColor(p.color))
            return rejectRemoteTurn();
        state.selected = {
            r,
            c
        };
        state.legalTargets = [];
        if (p && p.color === state.turn && multiplayerOwnsColor(p.color) && !current().moveUsed) {
            playSound("select");
            state.legalTargets = legalMovesFor(r, c, true);
        }
        render();
        renderTileInfo(key);
    }

    function clearMode() {
        state.mode = null;
        state.pendingWarehouseId = null;
        state.pendingPiece = null;
        state.pendingSpecialId = null;
        state.pendingAbilityId = null;
        state.abilitySource = null;
        state.abilityPassenger = null;
        state.legalTargets = [];
        state.selected = null;
        render();
    }

    function getOrbitalStrikeSquares(target, settings = CFG.orbitalStrike) {
        const center = typeof target === "string"
            ? fromName(target)
            : target;
        if (!center)
            return [];
        const radius = Math.max(0, Number(settings.radius) || 1),
            squares = [];
        for (let r = center.r - radius; r <= center.r + radius; r++)
            for (let c = center.c - radius; c <= center.c + radius; c++)
                if (inBounds(r, c))
                    squares.push({
                        r,
                        c,
                        key: sqName(r, c)
                    });
    return squares;
    }
    window.getOrbitalStrikeSquares = getOrbitalStrikeSquares;
    function orbitalStrikeReady() {
        const cfg = CFG.orbitalStrike,
            p = current();
        if (!cfg.enabled || !state.specialEnabled)
            return {
                ok: false,
                reason: langText("orbital.disabled", "궤도 빔이 비활성화돼 있어.")
            };
        if (state.gameOver || !state.started)
            return {
                ok: false,
                reason: langText("orbital.notStarted", "게임이 시작되지 않았어.")
            };
        if (p.money < cfg.price)
            return {
                ok: false,
                reason: langText("log.insufficientFunds", "자금 부족 ({amount} 필요)", {
                    amount: fmt(cfg.price)
                })
            };
        if (p.ap < cfg.apCost)
            return {
                ok: false,
                reason: langText(
                    "orbital.apInsufficient",
                    "AP 부족 ({amount} 필요)",
                    {amount: cfg.apCost}
                )
            };
        return {ok: true};
    }
    function startOrbitalStrike() {
        if (multiplayerRole() === "spectator")
            return log(langText("notice.orbitalSpectator", "관전자는 궤도 빔을 사용할 수 없어."), "bad");
        const ready = orbitalStrikeReady();
        if (!ready.ok)
            return log(`ORBITAL BEAM: ${ready.reason}`, "bad");
        if (!window.OrbitalBeamVfx)
            return log(
                langText("notice.orbitalModuleMissing", "궤도 빔 조준 모듈을 불러오지 못했어."),
                "bad"
            );
        state.mode = "orbital-targeting";
        render();
        orbitalTargetCancel = window
            .OrbitalBeamVfx
            .startTargeting({
                onConfirm: target => {
                    orbitalTargetCancel = null;
                    state.mode = null;
                    render();
                    if (multiplayerRole() === "guest")
                        window
                            .multiplayer
                            .sendAction({type: "orbitalStrike", target: target.key});
                    else
                        executeOrbitalStrike(target.key);
                    }
                ,
                onCancel: () => {
                    orbitalTargetCancel = null;
                    state.mode = null;
                    render();
                    log(langText("notice.orbitalCancelled", "궤도 빔 조준을 취소했어."));
                }
            });
    }
    function executeOrbitalStrike(targetKey) {
        const ready = orbitalStrikeReady();
        if (!ready.ok)
            return log(
                langText("log.orbitalRejected", "ORBITAL BEAM 거부: {v0}", {v0: ready.reason}),
                "bad"
            );
        const target = fromName(String(targetKey || ""));
        if (!target)
            return log(langText("notice.orbitalInvalidTarget", "궤도 빔 목표 좌표가 잘못됐어."), "bad");
        const shooter = state.turn,
            affectedSquares = getOrbitalStrikeSquares(target),
            destroyedPieces = [];
        let friendlyDamage = 0,
            enemyDamage = 0,
            whiteKing = false,
            blackKing = false;
        // 연출에는 파괴 이전 배치를 전달한다. 실제 판정과 차감은 이 함수에서만 처리한다.
        const boardPieces = [];
        for (let r = 0; r < 8; r++)
            for (let c = 0; c < 8; c++) {
                const piece = state.board[r][c];
                if (!piece)
                    continue;
                boardPieces.push({
                    r,
                    c,
                    color: piece.color,
                    type: piece.type,
                    specialId: piece.specialId || null,
                    visualType: piece.type === "special"
                        ? specialChessType(specialDef(piece.specialId))
                        : piece.type
                });
            }
        current().money -= CFG.orbitalStrike.price;
        current().ap -= CFG.orbitalStrike.apCost;
        for (const cell of affectedSquares) {
            const p = state.board[cell.r][cell.c];
            if (!p)
                continue;
            const value = p.type === "k"
                ? 0
                : piecePrice(p);
            destroyedPieces.push({
                r: cell.r,
                c: cell.c,
                key: cell.key,
                color: p.color,
                type: p.type,
                specialId: p.specialId || null,
                value
            });
            if (p.color === shooter)
                friendlyDamage += value;
            else
                enemyDamage += value;
            if (p.color === "w" && isKingLike(p))
                whiteKing = true;
            if (p.color === "b" && isKingLike(p))
                blackKing = true;
            state.board[cell.r][cell.c] = null;
        }
        const result = {
            target: targetKey,
            shooter,
            cost: CFG.orbitalStrike.price,
            boardPieces,
            affectedSquares,
            destroyedPieces,
            friendlyDamage,
            enemyDamage,
            kingDestroyed: {
                w: whiteKing,
                b: blackKing
            }
        };
        log(langText("log.orbitalFired", "{v1}이 ORBITAL NUCLEAR BEAM을 발사했습니다.", {
            v0: state.turnNo,
            v1: sideName(shooter)
        }), "bad");
        log(langText("log.orbitalDestroyed", "아군 {v1}개 / 적군 {v2}개 기물이 파괴되었습니다.", {
            v0: state.turnNo,
            v1: destroyedPieces
                .filter(p => p.color === shooter)
                .length,
            v2: destroyedPieces
                .filter(p => p.color !== shooter)
                .length
        }));
        log(langText("log.orbitalDamage", "아군 피해액 {v1} / 적군 피해액 {v2}", {
            v0: state.turnNo,
            v1: fmt(friendlyDamage),
            v2: fmt(enemyDamage)
        }));
        if (whiteKing)
            log(
                langText("log.orbitalWhiteKing", "백 KING이 궤도 타격으로 파괴되었습니다.", {v0: state.turnNo}),
                "bad"
            );
        if (blackKing)
            log(
                langText("log.orbitalBlackKing", "흑 KING이 궤도 타격으로 파괴되었습니다.", {v0: state.turnNo}),
                "bad"
            );
        state.engineRevision++;
        state.selected = null;
        state.legalTargets = [];
        render();
        window
                .OrbitalBeamVfx
                ?.play(result, {
                    muted: !state.audio.sound
                });
        if (multiplayerRole() === "host") {
            window.multiplayer.sendOrbitalStrikeResult
                ?.(result);
            window
                .multiplayer
                .sendState(serializeGameState());
        }
        if (whiteKing && blackKing)
            return finishGame(null, "양쪽 KING이 궤도 타격으로 동시에 파괴되어 무승부", "result.orbitalBoth");
        if (whiteKing || blackKing)
            return finishGame(
                whiteKing
                    ? "b"
                    : "w",
                "ORBITAL NUCLEAR BEAM이 킹을 파괴했어",
                "result.orbitalKing"
            );
        }
    window.handleOrbitalStrikeResult = result => {
        if (multiplayerRole() !== "host")
            window
                    .OrbitalBeamVfx
                    ?.play(result, {
                        muted: !state.audio.sound
                    });
        };
    window.debugOrbitalStrike = target => executeOrbitalStrike(target);

    function startPurchase(type) {
        if (multiplayerRole() === "spectator")
            return log(langText("notice.spectatorBuy", "관전자는 구매할 수 없어."), "bad");
        if (!canEconomy())
            return;
        if (current().ap < 1)
            return log(langText("notice.buyAP", "기물 구매: AP 부족"), "bad");
        if (current().money < economyPrice(PIECES[type].price) && !hasCreditLine())
            return log(langText("log.purchaseRequired", "기물 구매: {v0} 필요", {
                v0: fmt(economyPrice(PIECES[type].price))
            }), `bad`);
        state.mode = "buy";
        state.pendingPiece = type;
        state.selected = null;
        state.legalTargets = [];
        log(
            langText("log.purchaseSelect", "{piece} 구매 위치를 선택해.", {piece: stockPieceName(type)}),
            "gold"
        );
        render();
    }
    function startSpecialPurchase(id) {
        if (multiplayerRole() === "spectator")
            return log(langText("notice.spectatorBuy", "관전자는 구매할 수 없어."), "bad");
        const def = specialDef(id),
            stock = state.specialStock[id] || 0;
        if (!def)
            return log(langText("log.pieceDataMissing", "특수기물 데이터를 찾을 수 없어."), "bad");
        const name = specialPieceName(def);
        if (stock <= 0)
            return log(`${name}: ${langText("shop.soldOut", "품절")}`, "bad");
        if (current().money < economyPrice(def.price) && !hasCreditLine())
            return log(langText("log.notEnoughFunds", "{piece}: 돈 부족 ({amount} 필요)", {
                piece: name,
                amount: fmt(economyPrice(def.price))
            }), "bad");
        if (current().ap < Number(def.buyAP))
            return log(langText("log.notEnoughAP", "{piece}: AP 부족 ({amount} 필요)", {
                piece: name,
                amount: def.buyAP
            }), "bad");
        state.mode = "special-buy";
        state.pendingSpecialId = id;
        state.pendingPiece = null;
        state.selected = null;
        state.legalTargets = [];
        log(
            langText("log.purchaseSelect", "{piece} 구매 위치를 선택해.", {piece: name}),
            "gold"
        );
        render();
    }
    function homeZone(color, r) {
        return color === "w"
            ? r >= 6
            : r <= 1;
    }
    function finishPurchase(r, c) {
        if (state.mode === "special-buy")
            return finishSpecialPurchase(r, c);
        const type = state.pendingPiece;
        if (!homeZone(state.turn, r) || state.board[r][c])
            return log(langText("notice.homeEmpty", "자기 진영의 빈 칸에만 배치 가능해."), "bad");
        const price = economyPrice(PIECES[type].price);
        if (!purchaseAndAP(price, 1, langText("action.buyPiece", "기물 구매")))
            return;
        state.board[r][c] = purchasedPiece(type, state.turn);
        playSound("buy");
        log(langText("log.pieceHired", "{square}에 {piece} 채용 -{price}", {
            square: sqName(r, c),
            piece: stockPieceName(type),
            price: fmt(price)
        }));
        state.mode = null;
        state.pendingPiece = null;
        render();
    }
    function finishSpecialPurchase(r, c) {
        const id = state.pendingSpecialId,
            def = specialDef(id);
        if (!def || !homeZone(state.turn, r) || state.board[r][c])
            return log(langText("notice.homeEmpty", "자기 진영의 빈 칸에만 배치 가능해."), "bad");
        if ((state.specialStock[id] || 0) <= 0)
            return log(
                langText("log.soldOut", "{v0}: 품절", {v0: specialPieceName(def)}),
                "bad"
            );
        if (current().money < economyPrice(def.price) && !hasCreditLine())
            return log(
                langText("log.specialMoney", "{v0}: 돈 부족", {v0: specialPieceName(def)}),
                "bad"
            );
        if (current().ap < Number(def.buyAP))
            return log(
                langText("log.specialAP", "{v0}: AP 부족", {v0: specialPieceName(def)}),
                "bad"
            );
        if (!purchaseAndAP(
            economyPrice(def.price),
            Number(def.buyAP),
            langText("log.specialPurchase", "{v0} 구매", {v0: specialPieceName(def)})
        ))
            return;
        state.specialStock[id]--;
        if (isCountsAsKingDef(def) && !isFakeKingDef(def)) {
            for (let rr = 0; rr < 8; rr++)
                for (let cc = 0; cc < 8; cc++) {
                    const existing = state.board[rr][cc];
                    if (
                        existing
                            ?.color === state.turn && (existing.type === "k" || isKingLike(existing))
                    )
                        state.board[rr][cc] = existing.shelterFortress || null;
                    }
                log(
                    langText("log.kingReplaced", "{piece}이(가) 기존 킹을 대체했어.", {piece: specialPieceName(def)}),
                    "gold"
                );
            }
        state.board[r][c] = specialPiece(id, state.turn);
        playSound("buy");
        log(
            langText("log.piecePlaced", "{square}에 {piece} 배치 -{price} / {ap} AP · 다음 자기 턴에 활성화", {
                square: sqName(r, c),
                piece: specialPieceName(def),
                price: fmt(economyPrice(def.price)),
                ap: def.buyAP
            })
        );
        state.mode = null;
        state.pendingSpecialId = null;
        render();
    }

    function sellSelectedPiece() {
        if (!canEconomy() || !state.selected)
            return;
        const {r, c} = state.selected,
            p = state.board[r][c];
        if (!p || p.color !== state.turn || p.type === "k")
            return log(langText("notice.sellSelect", "매각할 자기 기물(킹 제외)을 선택해."), "bad");
        if (!useAP(1, langText("action.sellPiece", "기물 매각")))
            return;
        const gain = Math.round(piecePrice(p) * CFG.sellRatio);
        state.board[r][c] = null;
        current().money += gain;
        log(langText("log.pieceSold", "{v0} 매각 +{v1}", {
            v0: pieceName(p),
            v1: fmt(gain)
        }), "good");
        clearMode();
    }

    function pseudoMoves(r, c, board = state.board, attackOnly = false) {
        const p = board[r][c];
        if (!p)
            return [];
        if (p.purchaseLocked && !p.active)
            return [];
        if (p.attackLockedTurns > 0 && attackOnly)
            return [];
        const disabled = specialDisabledAt(r, c, p, board);
        if (p.specialId) {
            const def = specialDef(p.specialId),
                ranged = specialAbility(def, "ranged_capture");
            let movement = movementSpec(p, def);
            if (ranged && !disabled) {
                const context = {
                    r,
                    c,
                    board,
                    p,
                    attackOnly,
                    movement
                };
                const shots = p.attackLockedTurns > 0
                    ? []
                    : window
                        .movementHandlers
                        .ranged_capture({
                            ...context,
                            movement: {
                                type: "ranged_capture",
                                ...ranged.params
                            }
                        });
                const steps = attackOnly
                    ? []
                    : (
                        window.movementHandlers[movement.type]
                            ?.(context) || []
                    ).filter(target => !board[target.r][target.c]);
                return [
                    ...steps,
                    ...shots
                ];
            }
            if (p.specialId === "short_seller" && !disabled) {
                const opponent = state.players[enemyColor(p.color)],
                    basis = Object
                        .values(opponent.stockBasis || {})
                        .reduce((sum, value) => sum + Number(value || 0), 0),
                    held = Object
                        .entries(opponent.holdings || {})
                        .reduce((sum, [key, qty]) => sum + Math.max(0, Number(
                            opponent.stockBasis
                                ?.[key] || 0
                        ) - STOCKS[key].price * qty), 0),
                    loss = basis
                        ? held / basis
                        : 0;
                const power = runAbility("power_from_enemy_stock_losses", {
                    state,
                    piece: p,
                    owner: state.players[p.color],
                    params: specialAbility(def, "power_from_enemy_stock_losses")
                        ?.params || {},
                    event: "evaluate",
                    lossPct: loss * 100
                }) || {
                    rangeBonus: 0,
                    captureBonus: 0
                };
                const range = 1 + Number(power.rangeBonus || 0);
                movement = range > 1
                    ? {
                        type: "queen",
                        maxDistance: range
                    }
                    : {
                        type: "king",
                        maxDistance: 1
                    };
                p.shortSellerCaptureBonus = Number(power.captureBonus || 0);
            }
            const handler = window.movementHandlers
                ?.[
                    movement
                        ?.type
                ];
            const moves = handler
                ? handler({
                    r,
                    c,
                    board,
                    p,
                    attackOnly,
                    movement
                })
                : [];
            return attackOnly
                ? moves
                : [
                    ...moves,
                    ...fortressEntryMoves(r, c, p, board)
                ];
        }
        const out = [];
        const add = (rr, cc) => {
            if (inBounds(rr, cc))
                out.push({r: rr, c: cc});
            };
        const slide = (dirs) => {
            for (const [dr, dc] of dirs) {
                let rr = r + dr,
                    cc = c + dc;
                while (inBounds(rr, cc)) {
                    if (board[rr][cc]) {
                        if (board[rr][cc].color !== p.color)
                            add(rr, cc);
                        break;
                    }
                    add(rr, cc);
                    rr += dr;
                    cc += dc;
                }
            }
        };
        if (p.type === "n")
            for (const [dr, dc] of[
                [
                    -2, -1
                ], [
                    -2, 1
                ], [
                    -1, -2
                ], [
                    -1, 2
                ], [
                    1, -2
                ], [
                    1, 2
                ], [
                    2, -1
                ], [
                    2, 1
                ]
            ]) {
                const rr = r + dr,
                    cc = c + dc;
                if (inBounds(rr, cc) && (!board[rr][cc] || board[rr][cc].color !== p.color))
                    add(rr, cc);
                }
            if (p.type === "b")
                slide([
                    [
                        -1, -1
                    ],
                    [
                        -1, 1
                    ],
                    [
                        1, -1
                    ],
                    [
                        1, 1
                    ]
                ]);
    if (p.type === "r")
            slide([
                [
                    -1, 0
                ],
                [
                    1, 0
                ],
                [
                    0, -1
                ],
                [
                    0, 1
                ]
            ]);
        if (p.type === "q")
            slide([
                [
                    -1, -1
                ],
                [
                    -1, 1
                ],
                [
                    1, -1
                ],
                [
                    1, 1
                ],
                [
                    -1, 0
                ],
                [
                    1, 0
                ],
                [
                    0, -1
                ],
                [
                    0, 1
                ]
            ]);
        if (p.type === "k")
            for (let dr = -1; dr <= 1; dr++)
                for (let dc = -1; dc <= 1; dc++)
                    if (dr || dc) {
                        const rr = r + dr,
                            cc = c + dc;
                        if (inBounds(rr, cc) && (!board[rr][cc] || board[rr][cc].color !== p.color))
                            add(rr, cc);
                        }
                    if (p.type === "p") {
                        const dir = p.color === "w"
                            ? -1
                            : 1;
                        if (attackOnly) {
                            add(r + dir, c - 1);
                            add(r + dir, c + 1);
                        } else {
                            if (inBounds(r + dir, c) && !board[r + dir][c]) {
                                add(r + dir, c);
                                const startRow = p.color === "w"
                                    ? 6
                                    : 1;
                                if (!p.moved && r === startRow && inBounds(r + dir * 2, c) && !board[r + dir * 2][c])
                                    add(r + dir * 2, c);
                                }
                            for (const dc of[-1, 1]) {
                                const rr = r + dir,
                                    cc = c + dc;
                                if (inBounds(rr, cc) && board[rr][cc] && board[rr][cc].color !== p.color)
                                    add(rr, cc);
                                }
                            }
                    }
                if (!attackOnly && p.type === "p") {
            const ep = window
                .ChessRules
                .enPassant(state, r, c, board);
            if (ep)
                out.push(ep);
            }
        if (!attackOnly && p.type === "k")
            out.push(...window.ChessRules.castles(state, r, c, isSquareAttacked, board));
        if (!attackOnly)
            out.push(...fortressEntryMoves(r, c, p, board));
        return out.filter(x => inBounds(x.r, x.c));
    }

    function isSquareAttacked(r, c, byColor, board = state.board) {
        for (let rr = 0; rr < 8; rr++)
            for (let cc = 0; cc < 8; cc++) {
                const p = board[rr][cc];
                if (!p || p.color !== byColor)
                    continue;
                const moves = pseudoMoves(rr, cc, board, true);
                if (moves.some(x => x.r === r && x.c === c))
                    return true;
                }
            return false;
        }
    function findKing(color, board = state.board) {
        for (let r = 0; r < 8; r++)
            for (let c = 0; c < 8; c++)
                if (
                    board[r][c]
                        ?.specialId && board[r][c].color === color && isKingLike(board[r][c])
                )
                    return {r, c};
    for (let r = 0; r < 8; r++)
            for (let c = 0; c < 8; c++)
                if (
                    board[r][c]
                        ?.type === "k" && board[r][c].color === color
                )
                    return {r, c};
    return null;
    }
    function isKingInCheck(color, board = state.board) {
        const k = findKing(color, board);
        return k
            ? isSquareAttacked(k.r, k.c, enemyColor(color), board)
            : true;
    }
    function kingDangerTargetsFor(r, c) {
        const unit = state.board[r][c];
        if (!unit || unit.color !== state.turn || state.mode)
            return [];
        return legalMovesFor(r, c).filter(target => {
            const ranged = isRangedCapture(unit, target);
            const board = window
                .ChessRules
                .simulate(state, {
                    r,
                    c
                }, target, ranged);
            const info = window
                    .ChessRules
                    .moveInfo(state, {
                        r,
                        c
                    }, target),
                victim = state.board[info.capture.r][info.capture.c];
            const explosion = victim
                ?.specialId && specialAbility(
                    specialDef(victim.specialId),
                    "explode_on_capture"
                );
            if (explosion) {
                const radius = Number(
                    explosion.params
                        ?.radius
                ) || 1;
                for (let rr = target.r - radius; rr <= target.r + radius; rr++)
                    for (let cc = target.c - radius; cc <= target.c + radius; cc++)
                        if (inBounds(rr, cc))
                            board[rr][cc] = null;
                        }
                    return isKingInCheck(unit.color, board);
        });
    }
    function legalMovesFor(r, c) {
        const p = state.board[r][c];
        if (!p)
            return [];
        return pseudoMoves(r, c, state.board, false).filter(
            target => !(p.attackLockedTurns > 0 && ((state.board[target.r][target.c] && state.board[target.r][target.c].color !== p.color) || target.enPassant))
        );
    }
    function tryCaptureDefense(
        captured,
        captureSquare,
        beforeBoard,
        attacker,
        fromSquare
    ) {
        const shelter = captured
                ?.shelterFortress,
            charges = Number(
                shelter
                    ?.abilityCharges
                        ?.king_shelter ?? 0
            );
        if (shelter && charges > 0 && !specialDisabledAt(captureSquare.r, captureSquare.c, shelter, beforeBoard)) {
            state.board = beforeBoard;
            state.board[captureSquare.r][captureSquare.c] = {
                ...captured,
                shelterFortress: {
                    ...shelter,
                    abilityCharges: {
                        ...shelter.abilityCharges,
                        king_shelter: charges - 1
                    }
                }
            };
            log(langText("log.fortressSaved", "요새가 주둔한 킹을 한 번 보호했습니다."), "gold");
            return true;
        }
        if (
            !captured
                ?.specialId
        )
            return false;
        const oldPosition = beforeBoard
            .flatMap((row, r) => row.map(
                (unit, c) => unit
                    ?.id === captured.id
                        ? {
                            r,
                            c
                        }
                        : null
            ))
            .flat()
            .find(Boolean);
        if (oldPosition && specialDisabledAt(oldPosition.r, oldPosition.c, captured, beforeBoard))
            return false;
        const def = specialDef(captured.specialId);
        for (const ability of specialAbilities(def)) {
            if (!["mirror_first_attack", "capture_or_convert", "dismount_escape"].includes(ability.id))
                continue;
            if (["mirror_first_attack", "capture_or_convert"].includes(ability.id) && !captured.active)
                continue;
            const result = runAbility(ability.id, {
                state,
                piece: captured,
                owner: state.players[captured.color],
                captured,
                params: ability.params || {},
                event: ability.id === "mirror_first_attack"
                    ? "beingCaptured"
                    : "capture",
                captureSquare,
                beforeBoard
            });
            if (
                result
                    ?.mirror
            ) {
                state.board = beforeBoard;
                state.board[captureSquare.r][captureSquare.c] = {
                    ...state.board[captureSquare.r][captureSquare.c],
                    mirrorUsed: true
                };
                log(
                    langText("log.mirror", "{v0}이(가) 첫 공격을 반사했어.", {v0: specialPieceName(def)}),
                    `gold`
                );
                return true;
            }
            if (
                result
                    ?.convert && attacker && fromSquare
            ) {
                state.board = beforeBoard;
                state.board[captureSquare.r][captureSquare.c] = {
                    ...captured,
                    color: attacker.color,
                    moved: true,
                    active: false,
                    purchaseLocked: true,
                    activationTurn: state.turnNo + 1
                };
                log(langText("log.factoryOccupied", "공장이 공격한 진영에 점령되었습니다."), "gold");
                return true;
            }
            if (
                !result
                    ?.escapeSquare
            )
                continue;
            state.board = beforeBoard;
            state.board[captureSquare.r][captureSquare.c] = null;
            state.board[result.escapeSquare.r][result.escapeSquare.c] = piece(
                "k",
                captured.color
            );
            log(langText("log.kingEscaped", "{v0}이(가) 말을 버리고 {v1}로 탈출했어.", {
                v0: specialPieceName(def),
                v1: sqName(result.escapeSquare.r, result.escapeSquare.c)
            }), "gold");
            return true;
        }
        return false;
    }
    function tryNearbyCaptureDefense(captured, captureSquare, beforeBoard) {
        for (let r = 0; r < 8; r++)
            for (let c = 0; c < 8; c++) {
                const occupant = state.board[r][c],
                    defender = occupant
                        ?.shelterFortress || occupant;
                if (!defender || defender.color !== captured.color || !defender.specialId || !operationalSpecialAt(r, c, defender))
                    continue;
                for (const ability of specialAbilities(specialDef(defender.specialId))) {
                    if (!["ally_defense_aura", "sacrifice_for_king"].includes(ability.id))
                        continue;
                    const result = runAbility(ability.id, {
                        state,
                        piece: defender,
                        captured,
                        owner: state.players[defender.color],
                        params: ability.params || {},
                        event: "capture",
                        captureSquare,
                        beforeBoard
                    });
                    if (
                        result
                            ?.defense
                    ) {
                        const charges = defender.abilityCharges
                            ? {
                                ...defender.abilityCharges
                            }
                            : null;
                        state.board = beforeBoard;
                        if (charges)
                            for (const row of state.board)
                                for (const unit of row)
                                    if (
                                        unit
                                            ?.id === defender.id
                                    )
                                        unit.abilityCharges = charges;
                    if (result.sacrifice) {
                            for (const row of state.board)
                                for (const piece of row)
                                    if (
                                        piece
                                            ?.id === defender.id
                                    ) {
                                        const rr = state
                                                .board
                                                .indexOf(row),
                                            cc = row.indexOf(piece);
                                        state.board[rr][cc] = null;
                                    }
                                }
                        return true;
                    }
                }
            }
        return false;
    }
    function runCapturedAbilityEffects(
        captured,
        captureSquare,
        attacker,
        beforeBoard
    ) {
        const effects = [];
        if (
            !captured
                ?.specialId
        )
            return effects;
        const oldPosition = beforeBoard
            ?.flatMap((row, r) => row.map(
                    (unit, c) => unit
                        ?.id === captured.id
                            ? {
                                r,
                                c
                            }
                            : null
                ))
                .flat()
                .find(Boolean);
        if (oldPosition && specialDisabledAt(oldPosition.r, oldPosition.c, captured, beforeBoard))
            return effects;
        for (const ability of specialAbilities(specialDef(captured.specialId))) {
            if (!["explode_on_capture", "deposit_loss_on_capture"].includes(ability.id))
                continue;
            if (ability.id === "deposit_loss_on_capture" && !captured.active)
                continue;
            const event = ability.id === "explode_on_capture"
                ? "beingCaptured"
                : "capture";
            const result = runAbility(ability.id, {
                state,
                piece: captured,
                owner: state.players[captured.color],
                captured: attacker || captured,
                params: ability.params || {},
                event,
                captureSquare,
                beforeBoard: null
            });
            if (result)
                effects.push(result);
            }
        return effects;
    }
    function runCaptureAbilityEffects(moving, captured, captureSquare) {
        const effects = [];
        const position = findPiecePosition(moving);
        const enabled = !moving
            ?.specialId || (
                position && operationalSpecialAt(position.r, position.c, moving)
            );
        for (const ability of enabled? specialAbilities(specialDef(
            moving
                ?.specialId
        )): []) {
            if (["grow_on_capture", "nearby_capture_bonus"].includes(ability.id))
                continue;
            const result = runAbility(ability.id, {
                state,
                piece: moving,
                captured,
                owner: state.players[moving.color],
                params: ability.params || {},
                event: "capture",
                captureSquare
            });
            if (result)
                effects.push(result);
            }
        for (let r = 0; r < 8; r++)
            for (let c = 0; c < 8; c++) {
                const broker = state.board[r][c];
                if (
                    !broker || broker.id === moving
                        ?.id || broker.color !== moving
                            ?.color || !broker.specialId || !operationalSpecialAt(r, c, broker)
                )
                    continue;
                for (const ability of specialAbilities(specialDef(broker.specialId))) {
                    if (ability.id !== "nearby_capture_bonus")
                        continue;
                    const result = runAbility(ability.id, {
                        state,
                        piece: broker,
                        captured,
                        owner: state.players[broker.color],
                        params: ability.params || {},
                        event: "capture",
                        captureSquare
                    });
                    if (result)
                        effects.push(result);
                    }
                }
        if (
            enabled && moving
                ?.specialId === "short_seller" && moving.shortSellerCaptureBonus
        )
            effects.push({captureBonusFraction: moving.shortSellerCaptureBonus});
        return effects;
    }
    function runMoveAbilityEffects(moving, from, to) {
        const effects = [];
        if (
            moving
                ?.specialId && !operationalSpecialAt(to.r, to.c, moving)
        )
            return effects;
        for (const ability of specialAbilities(specialDef(
            moving
                ?.specialId
        ))) {
            const result = runAbility(ability.id, {
                state,
                piece: moving,
                owner: state.players[moving.color],
                params: ability.params || {},
                event: "move",
                from,
                to
            });
            if (result)
                effects.push({
                    ...result,
                    params: ability.params || {}
                });
            }
        return effects;
    }
    function applyMoveAbilityEffects(effects, to, moving) {
        for (const effect of effects) {
            if (!effect.magnet)
                continue;
            const sourceRadius = Math.max(1, Number(effect.params.sourceRadius) || 1),
                destinationRadius = Math.max(1, Number(effect.params.destinationRadius) || 1),
                candidates = [];
            for (let r = 0; r < 8; r++)
                for (let c = 0; c < 8; c++) {
                    const target = state.board[r][c];
                    if (target && target.id !== moving.id && Math.max(Math.abs(r - to.r), Math.abs(c - to.c)) <= sourceRadius)
                        candidates.push({r, c});
                    }
                if (!candidates.length)
                    continue;
        const target = effect.params.randomTarget
                ? candidates[Math.floor(Math.random() * candidates.length)]
                : candidates[0];
            const destinations = [];
            for (let dr = -destinationRadius; dr <= destinationRadius; dr++)
                for (let dc = -destinationRadius; dc <= destinationRadius; dc++) {
                    const r = to.r + dr,
                        c = to.c + dc;
                    if (inBounds(r, c) && !state.board[r][c])
                        destinations.push({r, c});
                    }
                if (destinations.length) {
                    const destination = destinations[Math.floor(Math.random() * destinations.length)];
                    state.board[destination.r][destination.c] = {
                        ...state.board[target.r][target.c],
                        moved: true
                    };
                    state.board[target.r][target.c] = null;
                    log(langText("log.magnetPulled", "자석이 주변 기물을 끌어왔습니다."), "gold");
                }
            }
    }
    function payMoveIncome(effects, moving) {
        for (const effect of effects)
            if (effect.moveIncome) {
                current().money += effect.moveIncome;
                log(langText("log.moveIncome", "{v0} 이동 수익 +{v1}", {
                    v0: pieceName(moving),
                    v1: fmt(effect.moveIncome)
                }), "good");
            }
        }
    function makeMove(fr, fc, tr, tc) {
        if (!inBounds(fr, fc) || !inBounds(tr, tc))
            return;
        const pl = current();
        if (pl.moveUsed)
            return log(langText("notice.oneMove", "일반 체스 이동은 턴당 1번이야."), "bad");
        const moving = state.board[fr][fc];
        if (
            pl.extraMovePieceId && pl.extraMovePieceId !== moving
                ?.id
        )
            return log(langText("notice.cavalryOnly", "추가 이동은 포획한 기병만 사용할 수 있습니다."), "bad");
        const moveCost = pl.extraMovePieceId === moving
            ?.id
                ? Number(
                    specialAbility(specialDef(
                        moving
                            ?.specialId
                    ), "bonus_move_on_capture")
                        ?.params
                            ?.apCost ?? 0
                )
                : 1;
        if (pl.ap < moveCost)
            return log(langText("notice.noMoveAP", "이동할 AP가 없어."), "bad");
        const moveInfo = window
            .ChessRules
            .moveInfo(state, {
                r: fr,
                c: fc
            }, {
                r: tr,
                c: tc
            });
        const captured = state.board[moveInfo.capture.r][moveInfo.capture.c],
            previousEnPassant = state.enPassant;
        if (!moving || moving.color !== state.turn)
            return;
        if (!legalMovesFor(fr, fc).some(target => target.r === tr && target.c === tc))
            return;
        const rangedCapture = isRangedCapture(moving, {
            r: tr,
            c: tc
        });
        if (rangedCapture && (!captured || captured.color === moving.color))
            return log(langText("notice.sniperEnemy", "저격은 사거리 안의 적 기물만 노릴 수 있어."), "bad");
        if (moving.purchaseLocked && !moving.active)
            return log(
                langText("notice.purchaseInactive", "구매한 기물은 다음 자기 턴부터 활성화돼."),
                "bad"
            );
        if (captured && captured.color !== moving.color && moving.attackLockedTurns > 0)
            return log(langText("notice.attackLocked", "구매한 기물은 2턴 동안 공격할 수 없어."), "bad");
        if (moving.specialId && !moving.active)
            return log(
                langText("log.inactivePiece", "{v0}은 다음 자기 턴부터 활성화돼.", {v0: pieceName(moving)}),
                "bad"
            );
        const enteringFortress = captured
            ?.color === moving.color && captured.specialId === "fortress";
        if (enteringFortress) {
            state.board[fr][fc] = moving.shelterFortress || null;
            state.board[tr][tc] = {
                ...moving,
                moved: true,
                shelterFortress: captured
            };
            pl.ap -= moveCost;
            pl.moveUsed = true;
            pl.extraMovePieceId = null;
            state.enPassant = null;
            state.selected = {
                r: tr,
                c: tc
            };
            state.legalTargets = [];
            state.engineRevision++;
            log(langText("log.fortressEntered", "킹이 요새에 주둔했습니다."));
            render();
            return;
        }
        log(
            `${pieceName(moving, state.turn)} ${sqName(fr, fc)} → ${sqName(tr, tc)}${captured
                ? ` × ${pieceName(captured, state.turn)}`
                : ""}`
        );
        const moveLogEl = log(
            `${pieceName(moving, state.turn)} ${sqName(fr, fc)} → ${sqName(tr, tc)}${captured
                ? ` × ${pieceName(captured, state.turn)}`
                : ""}`
        );
        playSound(
            captured
                ? "capture"
                : "move"
        );
        const beforeBoard = cloneBoard();
        state.enPassant = null;
        const uci = sqName(fr, fc) + sqName(tr, tc) + (
            moving.type === "p" && (tr === 0 || tr === 7)
                ? "q"
                : ""
        );
        if (rangedCapture)
            state.board[tr][tc] = null;
        else {
            state.board[tr][tc] = {
                ...moving,
                moved: true
            };
            delete state
                .board[tr][tc]
                .shelterFortress;
            state.board[fr][fc] = moving.shelterFortress || null;
        }
        if (moveInfo.enPassant)
            state.board[moveInfo.capture.r][moveInfo.capture.c] = null;
        if (moveInfo.castle) {
            const rook = state.board[moveInfo.castle.from.r][moveInfo.castle.from.c];
            state.board[moveInfo.castle.to.r][moveInfo.castle.to.c] = {
                ...rook,
                moved: true
            };
            state.board[moveInfo.castle.from.r][moveInfo.castle.from.c] = null;
            log(langText("log.castled", "캐슬링을 완료했습니다."));
        }
        if (moveInfo.enPassant)
            log(langText("log.enPassant", "앙파상으로 폰을 포획했습니다."));
        const moveEffects = runMoveAbilityEffects(moving, {
            r: fr,
            c: fc
        }, {
            r: tr,
            c: tc
        });
        applyMoveAbilityEffects(moveEffects, {
            r: tr,
            c: tc
        }, moving);
        pl.ap -= moveCost;
        pl.moveUsed = true;
        pl.extraMovePieceId = null;
        if (isKingInCheck(enemyColor(), state.board))
            playSound("check");
        const revision = ++state.engineRevision,
            moveId = ++state.engineMoveSerial;
        if (captured) {
            const captureEffects = runCaptureAbilityEffects(moving, captured, {
                r: tr,
                c: tc
            });
            if (captureEffects.some(effect => effect.defense)) {
                state.board = beforeBoard;
                state.enPassant = previousEnPassant;
                log(
                    langText("log.captureBlocked", "{v0}의 포획이 특수능력에 막혔어.", {v0: pieceName(moving)}),
                    "gold"
                );
                state.selected = {
                    r: fr,
                    c: fc
                };
                state.legalTargets = [];
                render();
                return;
            }
            if (tryNearbyCaptureDefense(captured, {
                r: tr,
                c: tc
            }, beforeBoard) || tryCaptureDefense(captured, {
                r: tr,
                c: tc
            }, beforeBoard, moving, {
                r: fr,
                c: fc
            })) {
                state.enPassant = previousEnPassant;
                state.selected = state.board[tr][tc]
                    ?.color === state.turn
                        ? {
                            r: fr,
                            c: fc
                        }
                        : {
                            r: tr,
                            c: tc
                        };
                state.legalTargets = [];
                render();
                return;
            }
            payMoveIncome(moveEffects, moving);
            const capturedEffects = runCapturedAbilityEffects(captured, {
                r: tr,
                c: tc
            }, moving, beforeBoard);
            if (capturedEffects.some(effect => effect.explode)) {
                const radius = Number(
                        specialAbility(specialDef(captured.specialId), "explode_on_capture")
                            ?.params
                                ?.radius
                    ) || 1,
                    kingBefore = {
                        w: Boolean(findKing("w")),
                        b: Boolean(findKing("b"))
                    };
                for (let rr = tr - radius; rr <= tr + radius; rr++)
                    for (let cc = tc - radius; cc <= tc + radius; cc++)
                        if (inBounds(rr, cc) && Math.max(Math.abs(rr - tr), Math.abs(cc - tc)) <= radius)
                            state.board[rr][cc] = null;
            log(langText("log.selfDestruct", "{v0} 자폭! 주변 {v1}칸 기물을 날려버렸어.", {
                    v0: pieceName(captured),
                    v1: radius
                }), `bad`);
                const whiteLost = kingBefore.w && !findKing("w"),
                    blackLost = kingBefore.b && !findKing("b");
                if (whiteLost && blackLost)
                    return finishGame(null, "자폭으로 양쪽 킹이 함께 파괴되어 무승부", "result.explosionBoth");
                if (whiteLost || blackLost)
                    return finishGame(
                        whiteLost
                            ? "b"
                            : "w",
                        "자폭으로 킹이 파괴됐어",
                        "result.explosionKing"
                    );
                }
            const depositLoss = capturedEffects.find(effect => effect.depositLossFraction);
            if (depositLoss) {
                const owner = state.players[captured.color];
                owner.deposits = owner
                    .deposits
                    .map(d => ({
                        ...d,
                        principal: Math.max(
                            0,
                            Math.round(d.principal * (1 - depositLoss.depositLossFraction))
                        )
                    }));
            }
            const stolen = captureEffects.find(effect => effect.stealFraction);
            if (stolen) {
                const amount = Math.min(
                    stolen.maxSteal,
                    Math.max(0, Math.round(piecePrice(captured) * stolen.stealFraction))
                );
                state
                    .players[captured.color]
                    .money -= amount;
                pl.money += amount;
                log(langText("log.cashStolen", "{v0} 현금 강탈 +{v1}", {
                    v0: pieceName(moving),
                    v1: fmt(amount)
                }), "good");
            }
            if (captureEffects.some(effect => effect.explode)) {
                const radius = Number(
                    specialAbility(specialDef(moving.specialId), "explode_on_capture")
                        ?.params
                            ?.radius
                ) || 1;
                for (let rr = tr - radius; rr <= tr + radius; rr++)
                    for (let cc = tc - radius; cc <= tc + radius; cc++)
                        if (inBounds(rr, cc) && !(rr === tr && cc === tc))
                            state.board[rr][cc] = null;
                        }
                    if (captureEffects.some(effect => effect.convert)) {
                state.board[tr][tc] = {
                    ...captured,
                    color: moving.color,
                    moved: true
                };
                state.board[fr][fc] = null;
                log(langText("log.converted", "{v0}가 {v1}를 전환했어.", {
                    v0: pieceName(moving),
                    v1: pieceName(captured)
                }), "gold");
                state.selected = {
                    r: tr,
                    c: tc
                };
                state.legalTargets = [];
                render();
                return;
            }
            const takeover = captureEffects.find(effect => effect.takeover);
            if (takeover) {
                const key = sqName(tr, tc),
                    premium = Math.round(piecePrice(captured) * takeover.premiumFraction);
                state.properties[key] = moving.color;
                pl.money -= premium;
                log(langText("log.takeoverPremium", "{v0} 적대적 인수 · 프리미엄 -{v1}", {
                    v0: key,
                    v1: fmt(premium)
                }), "gold");
            }
            let reward = pieceCaptureReward(captured);
            const captureBonus = captureEffects.find(effect => effect.captureBonusFraction);
            if (captureBonus)
                reward += Math.round(reward * captureBonus.captureBonusFraction);
            if (isKingLike(captured) && state.players[captured.color].insurance) {
                state
                    .players[captured.color]
                    .insurance = false;
                state.board = beforeBoard;
                state.enPassant = previousEnPassant;
                log(langText("log.insuranceSaved", "{v0} 킹 포획을 부활 보험이 막았다.", {
                    v0: sideName(captured.color)
                }), "gold");
                state.selected = {
                    r: fr,
                    c: fc
                };
                state.legalTargets = [];
                render();
                return;
            }
            const survivor = rangedCapture
                ? state.board[fr][fc]
                : state.board[tr][tc];
            if (
                survivor
                    ?.id === moving.id && (!moving.specialId || operationalSpecialAt(
                        rangedCapture
                            ? fr
                            : tr,
                        rangedCapture
                            ? fc
                            : tc,
                        survivor
                    ))
            ) {
                const growth = specialAbility(specialDef(moving.specialId), "grow_on_capture");
                if (growth)
                    runAbility(growth.id, {
                        state,
                        piece: survivor,
                        params: growth.params || {},
                        event: "capture"
                    });
                if (captureEffects.some(effect => effect.extraMove)) {
                    pl.moveUsed = false;
                    pl.extraMovePieceId = moving.id;
                }
            }
            pl.money += reward;
            const capturedName = pieceName(captured, state.turn);
            log(langText("log.captured", "{v0} 포획! +{v1}", {
                v0: capturedName,
                v1: fmt(reward)
            }), "good");
            if (captured.specialId && isFakeKingDef(specialDef(captured.specialId))) {
                const penalty = fakeKingPenalty(specialDef(captured.specialId));
                pl.ap = Math.max(0, pl.ap - penalty);
                log(
                    langText("log.fakeKing", "포획한 기물은 가짜 킹이었다. 포획자 AP -{v0}.", {v0: penalty}),
                    "gold"
                );
            }
            state.lastMove = {
                fr,
                fc,
                tr,
                tc,
                color: state.turn,
                enPassant: moveInfo.enPassant
            };
            state.selected = rangedCapture
                ? {
                    r: fr,
                    c: fc
                }
                : {
                    r: tr,
                    c: tc
                };
            state.legalTargets = [];
            if (captured.type === "k" || (captured.specialId && isCountsAsKingDef(specialDef(captured.specialId))))
                finishGame(
                    state.turn,
                    `${captured.color === "w"
                        ? "백"
                        : "흑"} 킹 포획`,
                    "result.kingCaptured",
                    {side: captured.color}
                );
            evaluateMoveWithStockfish({
                beforeBoard,
                afterBoard: cloneBoard(),
                beforeRules: {
                    standardSetup: state.standardSetup,
                    enPassant: previousEnPassant
                },
                afterRules: {
                    standardSetup: state.standardSetup,
                    enPassant: state.enPassant
                },
                captureSquare: moveInfo.capture,
                uci,
                mover: state.turn,
                revision,
                moveId,
                moveLogEl,
                square: {
                    r: tr,
                    c: tc
                },
                info: {
                    capture: true,
                    check: isKingInCheck(enemyColor(), state.board),
                    capturedValue: piecePrice(captured),
                    movingValue: piecePrice(moving),
                    movingIsStandard: !moving.specialId
                }
            });
            render();
            if (state.gameOver)
                return;
            return;
        }
        payMoveIncome(moveEffects, moving);
        if (moving.type === "p" && (tr === 0 || tr === 7)) {
            state.board[tr][tc] = {
                ...state.board[tr][tc],
                type: "q"
            };
            log(langText("notice.pawnPromoted", "폰 승급 → 퀸!"), "gold");
        }
        visitSquare(tr, tc, state.turn);
        if (moveInfo.castle)
            visitSquare(moveInfo.castle.to.r, moveInfo.castle.to.c, state.turn);
        state.enPassant = window
            .ChessRules
            .nextEnPassant(moving, {
                r: fr,
                c: fc
            }, {
                r: tr,
                c: tc
            }, state.turnNo);
        state.lastMove = {
            fr,
            fc,
            tr,
            tc,
            color: state.turn,
            castle: moveInfo.castle
        };
        evaluateMoveWithStockfish({
            beforeBoard,
            afterBoard: cloneBoard(),
            beforeRules: {
                standardSetup: state.standardSetup,
                enPassant: previousEnPassant
            },
            afterRules: {
                standardSetup: state.standardSetup,
                enPassant: state.enPassant
            },
            captureSquare: moveInfo.capture,
            uci,
            mover: state.turn,
            revision,
            moveId,
            moveLogEl,
            square: {
                r: tr,
                c: tc
            },
            info: {
                capture: false,
                check: isKingInCheck(enemyColor(), state.board),
                capturedValue: 0,
                movingValue: piecePrice(moving),
                movingIsStandard: !moving.specialId
            }
        });
        state.selected = {
            r: tr,
            c: tc
        };
        state.legalTargets = [];
        checkBankruptcy();
        render();
    }

    function visitSquare(r, c, color) {
        const key = sqName(r, c);
        state.visits[key] = (state.visits[key] || 0) + 1;
        const owner = state.properties[key];
        if (economyFeature("property") && owner && owner !== color) {
            let toll = propertyToll(key),
                multiplier = 1;
            const square = {
                r,
                c
            };
            for (let rr = 0; rr < 8; rr++)
                for (let cc = 0; cc < 8; cc++) {
                    const p = state.board[rr][cc];
                    if (
                        !p
                            ?.specialId || p.color !== owner || !operationalSpecialAt(rr, cc, p)
                    )
                        continue;
                    for (const ability of specialAbilities(specialDef(p.specialId))) {
                        const effect = runAbility(ability.id, {
                            state,
                            piece: p,
                            owner: state.players[owner],
                            params: ability.params || {},
                            event: "toll",
                            captureSquare: square
                        });
                        if (
                            effect
                                ?.tollMultiplier
                        )
                            multiplier = Math.max(multiplier, effect.tollMultiplier);
                        }
                    }
            toll = Math.round(toll * multiplier);
            const payer = state.players[color],
                receiver = state.players[owner];
            payer.money -= toll;
            receiver.money += toll;
            log(langText("log.toll", "{v0} 통행료: {v1} -{v2} → {v3}", {
                v0: key,
                v1: sideName(color),
                v2: fmt(toll),
                v3: sideName(owner)
            }), "bad");
        }
    }
    function propertyPrice(key) {
        return economyPrice(
            CFG.propertyBase + (state.visits[key] || 0) * CFG.propertyVisitPrice
        );
    }
    function propertyToll(key) {
        return economyPrice(
            CFG.tollBase + (state.visits[key] || 0) * CFG.tollVisitIncrement
        );
    }
    function buyProperty() {
        if (!economyFeature("property") || !canEconomy() || !state.selected)
            return;
        const key = sqName(state.selected.r, state.selected.c),
            visits = state.visits[key] || 0;
        if (visits < 1)
            return log(
                langText("notice.unvisitedProperty", "아직 아무도 밟지 않은 허허벌판이야. 가치가 없어ㅋㅋ"),
                "bad"
            );
        if (state.properties[key])
            return log(langText("notice.propertyOwned", "이미 주인이 있는 칸이야."), "bad");
        const price = propertyPrice(key);
        if (!payAndAP(price, 1, langText("action.buyProperty", "부동산 매입")))
            return;
        state.properties[key] = state.turn;
        log(langText("log.propertyBought", "{v0} 매입 -{v1} (현재 통행료 {v2})", {
            v0: key,
            v1: fmt(price),
            v2: fmt(propertyToll(key))
        }), `gold`);
        playSound("buy");
        render();
        renderTileInfo(key);
    }
    function beginPieceAbility(id) {
        if (!state.selected || !canEconomy())
            return;
        const p = state.board[state.selected.r][state.selected.c],
            def = p
                ?.specialId
                    ? specialDef(p.specialId)
                    : null;
        if (!p || p.color !== state.turn || !operationalSpecialAt(state.selected.r, state.selected.c, p) || !specialAbility(def, id))
            return log(langText("notice.selectAbilityPiece", "능력을 사용할 특수기물을 선택해."), "bad");
        if (id === "paid_friendly_swap" || id === "paid_same_color_warp" || id === "hostile_takeover") {
            state.mode = "piece-ability-target";
            state.pendingAbilityId = id;
            state.abilitySource = {
                ...state.selected
            };
            state.abilityPassenger = null;
            log(
                id === "paid_friendly_swap"
                    ? langText("notice.swapSelect", "위치를 바꿀 아군 기물을 선택해.")
                    : id === "paid_same_color_warp"
                        ? langText("notice.warpSelect", "같은 색의 빈 칸을 선택해.")
                        : langText("notice.takeoverSelect", "인수할 인접한 적 기물을 선택해."),
                "gold"
            );
            render();
            return;
        }
        if (id === "carry_friendly_piece") {
            state.mode = "taxi-passenger";
            state.pendingAbilityId = id;
            state.abilitySource = {
                ...state.selected
            };
            state.abilityPassenger = null;
            log(langText("notice.taxiSelect", "택시에 태울 아군 기물을 선택해."), "gold");
            render();
        }
    }
    function executePieceAbility(id, source, target, passenger) {
        if (!source || !target || !inBounds(source.r, source.c) || !inBounds(target.r, target.c))
            return;
        const unit = state.board[source.r][source.c],
            def = unit
                ?.specialId
                    ? specialDef(unit.specialId)
                    : null,
            ability = specialAbility(def, id),
            p = current();
        if (!unit || unit.color !== state.turn || !operationalSpecialAt(source.r, source.c, unit) || !ability || state.gameOver)
            return log(langText("notice.abilityConditions", "능력 사용 조건이 맞지 않아."), "bad");
        const from = sqName(source.r, source.c),
            to = sqName(target.r, target.c),
            params = ability.params || {},
            action = runAbility(id, {
                state,
                piece: unit,
                owner: p,
                params,
                event: "action"
            }) || {};
        if (id === "paid_same_color_warp") {
            const cost = Number(action.moneyCost ?? params.moneyCost) || 500,
                ap = Number(action.apCost ?? params.apCost) || 1;
            if (state.board[target.r][target.c] || ((source.r + source.c) % 2) !== (
                (target.r + target.c) % 2
            ))
                return log(langText("notice.warpSameColor", "같은 색의 빈 칸만 워프할 수 있어."), "bad");
            if (!payAndAP(cost, ap, langText("action.warp", "워프")))
                return;
            state.board[target.r][target.c] = {
                ...unit,
                moved: true
            };
            state.board[source.r][source.c] = null;
            visitSquare(target.r, target.c, state.turn);
            log(langText("log.warp", "{v0}: {v1} → {v2} · 워프 -{v3} / {v4} AP", {
                v0: specialPieceName(def),
                v1: from,
                v2: to,
                v3: fmt(cost),
                v4: ap
            }), "gold");
        } else if (id === "paid_friendly_swap") {
            const other = state.board[target.r][target.c],
                cost = Number(action.moneyCost ?? params.moneyCost) || 350,
                ap = Number(action.apCost ?? params.apCost) || 1;
            if (!other || other.color !== unit.color || other === unit || isKingLike(other))
                return log(langText("notice.swapNonKing", "킹이 아닌 아군 기물과만 교환할 수 있어."), "bad");
            if (!payAndAP(cost, ap, langText("action.swap", "기물 교환")))
                return;
            state.board[source.r][source.c] = {
                ...other,
                moved: true
            };
            state.board[target.r][target.c] = {
                ...unit,
                moved: true
            };
            log(langText("log.swap", "{v0}: {v1} ↔ {v2} 교환 -{v3} / {v4} AP", {
                v0: specialPieceName(def),
                v1: from,
                v2: to,
                v3: fmt(cost),
                v4: ap
            }), "gold");
        } else if (id === "hostile_takeover") {
            const other = state.board[target.r][target.c],
                radius = Number(params.radius) || 1,
                cost = other
                    ? Math.ceil(
                        piecePrice(other) * (1 + (Number(action.premiumFraction ?? params.premiumFraction) || 0))
                    )
                    : 0;
            if (!other || other.color === unit.color || isKingLike(other) || Math.max(Math.abs(source.r - target.r), Math.abs(source.c - target.c)) > radius)
                return log(
                    langText("notice.takeoverNonKing", "인접한 킹 이외의 적 기물만 인수할 수 있어."),
                    "bad"
                );
            if (!payAndAP(cost, 2, langText("action.takeover", "적대적 인수")))
                return;
            state.board[target.r][target.c] = {
                ...other,
                color: unit.color,
                active: true,
                purchaseLocked: false,
                attackLockedTurns: 0
            };
            log(langText("log.acquired", "{v0} 인수 완료 -{v1} / 2 AP", {
                v0: pieceName(other),
                v1: fmt(cost)
            }), "gold");
        } else if (id === "carry_friendly_piece") {
            const rider = passenger && state.board[passenger.r]
                ?.[passenger.c];
            if (!rider || rider === unit || (passenger.r === source.r && passenger.c === source.c) || rider.color !== unit.color || rider.type === "k" || isKingLike(rider) || state.board[target.r][target.c] || Math.max(
                Math.abs(source.r - target.r),
                Math.abs(source.c - target.c)
            ) > (Number(def.movement.maxDistance) || 3))
                return log(langText("notice.taxiInvalid", "택시 목적지 또는 승객이 올바르지 않아."), "bad");
            let drop = null;
            for (let radius = 1; radius <= 2 && !drop; radius++)
                for (let dr = -radius; dr <= radius && !drop; dr++)
                    for (let dc = -radius; dc <= radius; dc++) {
                        const rr = target.r + dr,
                            cc = target.c + dc,
                            willVacate = (rr === source.r && cc === source.c) || (
                                rr === passenger.r && cc === passenger.c
                            );
                        if (inBounds(rr, cc) && (willVacate || !state.board[rr][cc]) && (rr !== target.r || cc !== target.c) && Math.max(Math.abs(rr - target.r), Math.abs(cc - target.c)) === radius) {
                            drop = {
                                r: rr,
                                c: cc
                            };
                            break;
                        }
                    }
                if (!drop)
                return log(langText("notice.noDropSquare", "승객이 내릴 칸이 없어."), "bad");
            if (!payAndAP(
                Number(params.moneyCost) || 250,
                Number(params.apCost) || 1,
                langText("action.taxi", "택시 운송")
            ))
                return;
            state.board[source.r][source.c] = null;
            state.board[passenger.r][passenger.c] = null;
            state.board[target.r][target.c] = {
                ...unit,
                moved: true
            };
            state.board[drop.r][drop.c] = {
                ...rider,
                moved: true
            };
            visitSquare(target.r, target.c, state.turn);
            visitSquare(drop.r, drop.c, state.turn);
            log(langText("log.taxiDelivered", "{v0} 택시 탑승 운송 {v1} · -{v2}", {
                v0: pieceName(rider),
                v1: sqName(drop.r, drop.c),
                v2: fmt(Number(params.moneyCost) || 250)
            }), "gold");
        } else
            return log(langText("notice.abilityUnavailable", "아직 연결되지 않은 능력이야."), "bad");
        state.mode = null;
        state.pendingAbilityId = null;
        state.abilitySource = null;
        state.abilityPassenger = null;
        state.selected = {
            r: target.r,
            c: target.c
        };
        checkBankruptcy();
        render();
    }
    function renderTileInfo(key) {
        const owner = state.properties[key];
        const visits = state.visits[key] || 0;
        const tile = state.board[8 - Number(key[1])][FILES.indexOf(key[0])],
            actions = {
                paid_same_color_warp: langText("board.actionWarp", "같은 색 칸으로 워프"),
                paid_friendly_swap: langText("board.actionSwap", "아군과 위치 교환"),
                carry_friendly_piece: langText("board.actionCarry", "아군 기물 운송"),
                hostile_takeover: langText("board.actionTakeover", "인접 기물 인수")
            },
            ability = tile
                ?.specialId
                    ? specialAbilities(specialDef(tile.specialId)).find(a => actions[a.id])
                    : null;
        const ownerName = owner
            ? (
                owner === "w"
                    ? langText("game.white", "백")
                    : langText("game.black", "흑")
            )
            : langText("board.unowned", "없음");
        document
            .getElementById("tileInfo")
            .innerHTML = `<b>${key}</b> · ${langText("board.visits", "방문 {count}회", {
                count: visits})} · ${langText("board.value", "가치 {amount}", {
                    amount: fmt(propertyPrice(key))})} · ${langText("board.toll", "통행료 {amount}", {
                        amount: fmt(propertyToll(key))})}<br>${langText("board.owner", "소유자")}: ${ownerName}${ability && tile.color === state.turn
                            ? `<br><button type="button" id="pieceAbilityBtn">${actions[ability.id]}</button>`
                            : ""}`;
                        document
                                .getElementById("pieceAbilityBtn")
                                ?.addEventListener("click", () => beginPieceAbility(ability.id));
                        if (
                            tile
                                ?.shelterFortress
                        )
                            document
                                .getElementById("tileInfo")
                                .innerHTML += `<br>${langText("board.fortressShelter", "요새 주둔 · 보호 {count}회 남음", {
                                    count: Number(
                                        tile.shelterFortress.abilityCharges
                                            ?.king_shelter ?? 0
                                    )})}`;
                                }

                                function doJob() {
                                    if (!economyFeature("labor") || !canEconomy() || !useAP(1, langText("economy.job", "알바")))
                                        return;
                                    current().money += CFG.jobPay;
                                    playSound("click");
                                    log(langText("log.job", "알바 완료 +{v0} (킹이 알바 뛰는 세계관)", {
                                        v0: fmt(CFG.jobPay)
                                    }), `good`);
                                    render();
                                }
                                function salaryCost(p = current()) {
                                    return Math.round(
                                        CFG.salaryBaseCost * Math.pow(CFG.salaryUpgradeMultiplier, p.salaryLevel)
                                    );
                                }
                                function raiseSalary() {
                                    if (!economyFeature("salary") || !canEconomy())
                                        return;
                                    const p = current(),
                                        cost = salaryCost(p);
                                    if (!payAndAP(cost, 1, langText("economy.salary", "월급 인상")))
                                        return;
                                    p.salaryLevel++;
                                    p.salary += CFG.salaryRaise;
                                    log(langText("log.salaryRaised", "월급 인상! 다음부터 {v0}/턴", {
                                        v0: fmt(p.salary)
                                    }), `good`);
                                    render();
                                }
                                function makeDeposit() {
                                    if (!economyFeature("deposits") || !canEconomy())
                                        return;
                                    const p = current();
                                    if (!payAndAP(CFG.depositAmount, 1, langText("economy.deposit", "적금")))
                                        return;
                                    p
                                        .deposits
                                        .push({
                                            principal: CFG.depositAmount,
                                            due: p.ownTurns + 4
                                        });
                                    log(langText("log.depositMade", "적금 가입 -{v0} · 4회 내 턴 뒤 만기", {
                                        v0: fmt(CFG.depositAmount)
                                    }), `gold`);
                                    render();
                                }
                                function makeVenture() {
                                    if (!economyFeature("ventures") || !canEconomy())
                                        return;
                                    const p = current();
                                    if (!payAndAP(CFG.ventureAmount, 1, langText("economy.venture", "벤처 투자")))
                                        return;
                                    const mult = + (
                                        CFG.ventureMinReturn + Math.random() * (CFG.ventureMaxReturn - CFG.ventureMinReturn)
                                    ).toFixed(2);
                                    p
                                        .ventures
                                        .push({
                                            principal: CFG.ventureAmount,
                                            due: p.ownTurns + 3,
                                            mult
                                        });
                                    log(langText("log.ventureMade", "벤처 투자 -{v0} · 결과는 3회 내 턴 뒤 공개", {
                                        v0: fmt(CFG.ventureAmount)
                                    }), `gold`);
                                    render();
                                }
                                function processMaturities(color) {
                                    const p = state.players[color];
                                    let banker = null;
                                    for (let r = 0; r < 8; r++)
                                        for (let c = 0; c < 8; c++) {
                                            const unit = state.board[r][c];
                                            if (
                                                unit
                                                    ?.color === color && unit.specialId === "banker" && operationalSpecialAt(
                                                        r,
                                                        c,
                                                        unit
                                                    )
                                            )
                                                banker = unit;
                                            }
                                        const bonus = banker
                                            ? Number(
                                                specialAbility(specialDef("banker"), "deposit_interest_bonus")
                                                    ?.params
                                                        ?.multiplier
                                            ) || 1.2
                                            : 1;
                                    const paid = window
                                        .EconomyRules
                                        .mature(
                                            p,
                                            CFG.depositReturn,
                                            bonus,
                                            !economyFeature("automation") || window.EconomyRules.player(p).automation.maturity
                                        );
                                    if (paid)
                                        log(window.EconomyUI.t("payout") + " +" + fmt(paid), "good");
                                    }
                                function escortKingAuraPieces(color) {
                                    const king = findKing(color);
                                    if (!king)
                                        return;
                                    for (let r = 0; r < 8; r++)
                                        for (let c = 0; c < 8; c++) {
                                            const guard = state.board[r][c],
                                                def = guard
                                                    ?.specialId
                                                        ? specialDef(guard.specialId)
                                                        : null,
                                                movement = def
                                                    ?.movement;
                                            if (
                                                !guard || guard.color !== color || !operationalSpecialAt(r, c, guard) || movement
                                                    ?.type !== "king_aura_teleport"
                                            )
                                                continue;
                                            const radius = Math.max(1, Number(movement.radiusFromKing) || 1);
                                            if (Math.max(Math.abs(r - king.r), Math.abs(c - king.c)) <= radius)
                                                continue;
                                            let destination = null;
                                            for (let dr = -radius; dr <= radius && !destination; dr++)
                                                for (let dc = -radius; dc <= radius; dc++) {
                                                    const rr = king.r + dr,
                                                        cc = king.c + dc;
                                                    if (inBounds(rr, cc) && !state.board[rr][cc] && Math.max(
                                                        Math.abs(dr),
                                                        Math.abs(dc)
                                                    ) <= radius)
                                                        destination = {
                                                            r: rr,
                                                            c: cc
                                                        };
                                                }
                                            if (destination) {
                                                state.board[destination.r][destination.c] = {
                                                    ...guard,
                                                    moved: true
                                                };
                                                state.board[r][c] = null;
                                                log(
                                                    langText("log.escort", "{v0}이 킹 곁으로 이동했어.", {v0: specialPieceName(def)}),
                                                    "gold"
                                                );
                                            }
                                        }
                                    }
                                function runTurnAbilities(color) {
                                    for (const row of state.board)
                                        for (const p of row)
                                            if (
                                                p
                                                    ?.color === color && p.purchaseLocked && !p.active && p.activationTurn <= state.turnNo
                                            ) {
                                                p.active = true;
                                                if (p.attackLockedTurns > 0)
                                                    p.attackLockedTurns--;
                                                log(langText("log.activatedMove", "{v0} 활성화 · 이동 가능", {
                                                    v0: pieceName(p, color)
                                                }), "gold");
                                            }
                                        for (const row of state.board)
                                        for (const p of row)
                                            if (
                                                p
                                                    ?.color === color && p.purchaseLocked && p.active && p.activationTurn < state.turnNo && p.attackLockedTurns > 0
                                            ) {
                                                p.attackLockedTurns--;
                                            }
                                        for (let r = 0; r < 8; r++)
                                        for (let c = 0; c < 8; c++) {
                                            const p = state.board[r][c];
                                            if (
                                                p
                                                    ?.color === color && p.specialId
                                            ) {
                                                const def = specialDef(p.specialId);
                                                if (!p.active && p.activationTurn <= state.turnNo) {
                                                    p.active = true;
                                                    log(
                                                        langText("log.activated", "{v0} 활성화.", {v0: specialPieceName(def)}),
                                                        `gold`
                                                    );
                                                }
                                                if (!p.active || specialDisabledAt(r, c, p))
                                                    continue;
                                                p.specialTurnCount = Number(p.specialTurnCount || 0) + 1;
                                                for (const ability of specialAbilities(def)) {
                                                    const result = runAbility(ability.id, {
                                                        state,
                                                        owner: state.players[color],
                                                        piece: p,
                                                        params: ability.params || {},
                                                        event: "turn"
                                                    });
                                                    if (
                                                        result
                                                            ?.blackHolePulse
                                                    ) {
                                                        log(langText("log.blackHolePulse", "{v0} 펄스 발동 · {v1}개 기물 제거", {
                                                            v0: specialPieceName(def),
                                                            v1: result.removed
                                                        }), "bad");
                                                        if (!findKing(color))
                                                            finishGame(
                                                                enemyColor(color),
                                                                `${color === "w"
                                                                    ? "백"
                                                                    : "흑"} 킹이 블랙홀에 휩쓸렸어`,
                                                                "result.blackHole",
                                                                {side: color}
                                                            );
                                                        else if (!findKing(enemyColor(color)))
                                                            finishGame(
                                                                color,
                                                                "상대 킹이 블랙홀에 휩쓸렸어",
                                                                "result.blackHole",
                                                                {side: enemyColor(color)}
                                                            );
                                                        }
                                                    }
                                            }
                                        }
                                    escortKingAuraPieces(color);
                                }

                                function instantPromote() {
                                    if (!canEconomy() || !state.selected)
                                        return log(langText("notice.promoteSelect", "승급할 자기 폰을 먼저 선택해."), "bad");
                                    const {r, c} = state.selected,
                                        p = state.board[r][c];
                                    if (!p || p.color !== state.turn || p.type !== "p")
                                        return log(langText("notice.notOwnPawn", "선택한 게 네 폰이 아님."), "bad");
                                    if (!payAndAP(CFG.promoteCost, 1, langText("special.promote", "즉시 승급")))
                                        return;
                                    const restrictions = p.purchaseLocked
                                        ? {}
                                        : {
                                            purchaseLocked: true,
                                            active: false,
                                            activationTurn: state.turnNo + 1,
                                            attackLockedTurns: 1
                                        };
                                    state.board[r][c] = {
                                        ...p,
                                        ...restrictions,
                                        type: "q"
                                    };
                                    log(langText("log.instantPromotion", "{v0} 폰 즉시승급 → 퀸 -{v1} · 다음 자기 턴부터 활동", {
                                        v0: sqName(r, c),
                                        v1: fmt(CFG.promoteCost)
                                    }), "gold");
                                    render();
                                }
                                function startTeleport() {
                                    if (!canEconomy() || !state.selected)
                                        return log(langText("log.teleportSelect", "텔레포트할 자기 기물을 선택해."), "bad");
                                    const p = state.board[state.selected.r][state.selected.c];
                                    if (!p || p.color !== state.turn || isKingLike(p))
                                        return log(langText("notice.teleportNonKing", "자기 기물(킹 제외)을 선택해."), "bad");
                                    if (current().money < CFG.teleportCost || current().ap < 2)
                                        return log(langText("log.teleportCost", "즉시이동은 {v0} + 2 AP 필요.", {
                                            v0: fmt(CFG.teleportCost)
                                        }), "bad");
                                    state.mode = "teleport";
                                    log(langText("log.teleportTarget", "빈 칸을 클릭하면 즉시이동 발동."), "gold");
                                    render();
                                }
                                function finishTeleport(r, c) {
                                    if (!canEconomy() || !inBounds(r, c))
                                        return clearMode();
                                    if (state.board[r][c])
                                        return log(langText("notice.teleportEmpty", "빈 칸으로만 순간이동 가능."), "bad");
                                    const from = {
                                            ...state.selected
                                        },
                                        p = state.board[from.r][from.c];
                                    if (!p)
                                        return clearMode();
                                    if (p.color !== state.turn || isKingLike(p))
                                        return clearMode();
                                    if (!payAndAP(CFG.teleportCost, 2, langText("special.teleport", "즉시이동")))
                                        return clearMode();
                                    state.board[r][c] = {
                                        ...p,
                                        moved: true
                                    };
                                    state.board[from.r][from.c] = null;
                                    visitSquare(r, c, state.turn);
                                    log(langText("log.teleported", "{v0} → {v1} 즉시이동 -{v2}", {
                                        v0: sqName(from.r, from.c),
                                        v1: sqName(r, c),
                                        v2: fmt(CFG.teleportCost)
                                    }), "gold");
                                    clearMode();
                                    checkBankruptcy();
                                }
                                function buyInsurance() {
                                    if (!canEconomy())
                                        return;
                                    const p = current();
                                    if (p.insurance)
                                        return log(langText("notice.insuranceOwned", "이미 킹 부활 보험 있어."), "bad");
                                    if (!payAndAP(CFG.insuranceCost, 2, langText("action.insurance", "부활 보험")))
                                        return;
                                    p.insurance = true;
                                    log(
                                        langText("notice.insurancePurchased", "킹 포획 방어 보험 가입 완료. 다음 킹 포획 1회 방어."),
                                        "gold"
                                    );
                                    render();
                                }

                                function tradeStock(isBuy) {
                                    if (!economyFeature("stocks") || !canEconomy())
                                        return;
                                    const key = document
                                        .getElementById("stockSelect")
                                        .value;
                                    const qty = Math.max(
                                        1,
                                        Math.min(99, Number(document.getElementById("stockQty").value) || 1)
                                    );
                                    const p = current(),
                                        stock = STOCKS[key],
                                        total = Math.round(stock.price * qty);
                                    const name = companyName(key, stock.name);
                                    if (p.ap < 1)
                                        return log(langText("log.stockTradeAP", "주식 거래에는 1 AP가 필요해."), "bad");
                                    if (isBuy) {
                                        if (p.money < total) {
                                            if (!hasCreditLine())
                                                return log(langText("market.notEnoughFunds", "매수 자금 부족"), "bad");
                                            if (!purchaseAndAP(total, 1, langText("action.stockBuy", "주식 매수")))
                                                return;
                                            }
                                        else {
                                            p.money -= total;
                                            p.ap--;
                                        }
                                        p.holdings[key] += qty;
                                        p.stockBasis[key] = Number(
                                            p.stockBasis
                                                ?.[key] || 0
                                        ) + total;
                                        log(langText("market.purchaseLog", "{company} {count}주 매수 -{amount}", {
                                            company: name,
                                            count: qty,
                                            amount: fmt(total)
                                        }));
                                    } else {
                                        if (p.holdings[key] < qty)
                                            return log(langText("market.notEnoughShares", "보유 주식 부족"), "bad");
                                        const average = Number(
                                            p.stockBasis
                                                ?.[key] || 0
                                        ) / p.holdings[key];
                                        p.holdings[key] -= qty;
                                        p.stockBasis[key] = Math.max(0, Number(
                                            p.stockBasis
                                                ?.[key] || 0
                                        ) - average * qty);
                                        p.money += total;
                                        p.ap--;
                                        log(langText("market.saleLog", "{company} {count}주 매도 +{amount}", {
                                            company: name,
                                            count: qty,
                                            amount: fmt(total)
                                        }), "good");
                                    }
                                    render();
                                }
                                function moveMarket() {
                                    if (!economyFeature("stocks"))
                                        return;
                                    for (const s of Object.values(STOCKS)) {
                                        s.last = s.price;
                                        const drift = (Math.random() - 0.5) * 0.05;
                                        s.price = Math.max(10, + ((s.price * (1 + drift)).toFixed(2)));
                                    }
                                    if (Math.random() < 0.72) {
                                        const news = selectNews();
                                        if (news.companyId === "market")
                                            for (const s of Object.values(STOCKS))
                                                s.price = Math.max(10, + ((s.price * (1 + news.effect)).toFixed(2)));
                                            else {
                                                const s = STOCKS[news.companyId];
                                                if (s)
                                                    s.price = Math.max(10, + ((s.price * (1 + news.effect)).toFixed(2)));
                                                }
                                            addNews({
                                                id: news.id,
                                                company: news.company || STOCKS[news.companyId]
                                                    ?.name || news.companyId,
                                                companyId: news.companyId,
                                                text: news.text
                                            });
                                        }
                                    }
                                function selectNews() {
                                    let candidates = NEWS.filter(news => !state.recentNewsIds.includes(news.id));
                                    const last = state.news[0];
                                    const differentCompany = candidates.filter(
                                        news => news.companyId !== last
                                            ?.companyId
                                    );
                                    if (differentCompany.length)
                                        candidates = differentCompany;
                                    if (!candidates.length) {
                                        const oldestId = state.recentNewsIds[0];
                                        candidates = NEWS.filter(news => news.id === oldestId);
                                        if (!candidates.length)
                                            candidates = NEWS.slice();
                                        }
                                    return candidates[Math.floor(Math.random() * candidates.length)];
                                }
                                function addNews(eventOrCompany, text) {
                                    const event = typeof eventOrCompany === "object"
                                        ? {
                                            ...eventOrCompany
                                        }
                                        : {
                                            id: `news-${++ state.newsEventSerial}`,
                                            company: eventOrCompany,
                                            text
                                        };
                                    if (!event.id)
                                        event.id = `news-${++ state.newsEventSerial}`;
                                    if (state.news.some(news => news.id === event.id))
                                        return state
                                            .news
                                            .find(news => news.id === event.id);
                                    state.recentNewsIds = state
                                        .recentNewsIds
                                        .filter(id => id !== event.id);
                                    state
                                        .recentNewsIds
                                        .push(event.id);
                                    if (state.recentNewsIds.length > NEWS_HISTORY_LIMIT)
                                        state
                                            .recentNewsIds
                                            .shift();
                                    state
                                        .news
                                        .unshift(event);
                                    state.news = state
                                        .news
                                        .slice(0, NEWS_HISTORY_LIMIT);
                                    state.headlineIndex = 0;
                                    showHeadline(0, false);
                                    return event;
                                }
                                function headlineString(n) {
                                    if (!n)
                                        return langText("news.waiting", "시장 개장 준비 중...");
                                    const item = localizedNews(n);
                                    return `${item.company} - ${item.text}`;
                                }
                                function showHeadline(index = 0, instant = false) {
                                    const el = document.getElementById("headlineText");
                                    if (!el)
                                        return;
                                    if (!state.news.length) {
                                        el.textContent = langText("news.waiting", "시장 개장 준비 중...");
                                        return;
                                    }
                                    state.headlineIndex = ((index % state.news.length) + state.news.length) % state.news.length;
                                    const apply = () => {
                                        el.textContent = headlineString(state.news[state.headlineIndex]);
                                        el
                                            .classList
                                            .remove("slide-out");
                                        el
                                            .classList
                                            .add("slide-in");
                                        setTimeout(() => el.classList.remove("slide-in"), 320);
                                    };
                                    if (instant) {
                                        el.textContent = headlineString(state.news[state.headlineIndex]);
                                        return;
                                    }
                                    el
                                        .classList
                                        .add("slide-out");
                                    setTimeout(apply, 230);
                                }
                                function cycleHeadline() {
                                    if (!state.news.length)
                                        return;
                                    showHeadline(state.headlineIndex + 1, false);
                                }

                                function endTurn(timedOut = false) {
                                    if (state.gameOver)
                                        return;
                                    playSound(
                                        timedOut
                                            ? "error"
                                            : "click"
                                    );
                                    const mover = state.turn,
                                        next = enemyColor(mover);
                                    stopTurnTimer();
                                    state.turn = next;
                                    state.turnNo++;
                                    if (
                                        state.enPassant
                                            ?.color !== next
                                    )
                                        state.enPassant = null;
                                    const auctionResults = window
                                        .EconomyRules
                                        .settleAuctions(state);
                                    if (auctionResults.length)
                                        log(window.EconomyUI.t("settled"), "gold");
                                    const p = current();
                                    p.ownTurns++;
                                    p.ap = CFG.maxAP;
                                    p.moveUsed = false;
                                    p.extraMovePieceId = null;
                                    playSound("select");
                                    p.money += p.salary;
                                    const tax = countTax(state.turn);
                                    p.money -= tax;
                                    const creditSettlement = window
                                        .EconomyRules
                                        .creditTurn(
                                            p,
                                            Number(creditTerms(state.turn).interestPerTurn) || .08,
                                            economyFeature("automation")
                                        );
                                    if (creditSettlement.fee || creditSettlement.paid)
                                        log(
                                            langText("log.creditSettlement", "신용 잔액 이자 +{v0} · 자동 상환 -{v1} · 부채 {v2}", {
                                                v0: fmt(creditSettlement.fee),
                                                v1: fmt(creditSettlement.paid),
                                                v2: fmt((p.creditDebt || 0) + p.pendingInterest)
                                            }),
                                            creditSettlement.fee
                                                ? "bad"
                                                : ""
                                        );
                                    if (p.money < 0) {
                                        for (const row of state.board)
                                            for (const unit of row)
                                                if (
                                                    unit
                                                        ?.color === state.turn && unit.specialId
                                                ) {
                                                    const ability = specialAbility(
                                                            specialDef(unit.specialId),
                                                            "defect_on_unpaid_tax"
                                                        ),
                                                        effect = ability && runAbility(ability.id, {
                                                            state,
                                                            piece: unit,
                                                            owner: p,
                                                            params: ability.params || {},
                                                            event: "tax"
                                                        });
                                                    if (
                                                        effect
                                                            ?.toOpponent
                                                    ) {
                                                        unit.color = enemyColor(state.turn);
                                                        log(langText("log.taxDefection", "{v0}이 세금 미납으로 상대 진영에 넘어갔어.", {
                                                            v0: specialPieceName(specialDef(unit.specialId))
                                                        }), "bad");
                                                    }
                                                }
                                            }
                                    log(
                                        langText("log.turnIncome", "{v0} 턴 시작: 월급 +{v1}, 세금 -{v2}", {
                                            v0: sideName(state.turn),
                                            v1: fmt(p.salary),
                                            v2: fmt(tax)
                                        }),
                                        tax
                                            ? ""
                                            : "good"
                                    );
                                    processMaturities(state.turn);
                                    runTurnAbilities(state.turn);
                                    if (state.gameOver) {
                                        render();
                                        return;
                                    }
                                    moveMarket();
                                    if (checkBankruptcy()) {
                                        render();
                                        return;
                                    }
                                    if (SpecialPieces.data && state.turnNo % Number(SpecialPieces.data.restockEveryTurns || 3) === 0)
                                        restockSpecialPieces();
                                    clearMode();
                                    startTurnTimer();
                                    render();
                                }
                                function resignGame() {
                                    if (state.gameOver)
                                        return;
                                    if (multiplayerRole() === "guest")
                                        return window
                                            .multiplayer
                                            .resign();
                                    if (multiplayerRole() === "host")
                                        return finishGame("b", "백 기권", "result.resigned", {side: "w"});
                                    finishGame(
                                        enemyColor(state.turn),
                                        `${state.turn === "w"
                                            ? "백"
                                            : "흑"} 기권`,
                                        "result.resigned",
                                        {side: state.turn}
                                    );
                                }
                                function finishGame(winner, reason, reasonKey = null, reasonValues = {}) {
                                    stopTurnTimer();
                                    if (state.auctions.length) {
                                        window
                                            .EconomyRules
                                            .closeAuctions(state);
                                        log(window.EconomyUI.t("closed"));
                                    }
                                    state.gameOver = true;
                                    state.gameResult = {
                                        winner,
                                        reason,
                                        reasonKey,
                                        reasonValues
                                    };
                                    showGameResult();
                                    render();
                                }
                                function showGameResult() {
                                    const result = state.gameResult || {
                                        winner: null,
                                        reason: "게임 종료"
                                    };
                                    const name = result.winner
                                        ? sideName(result.winner)
                                        : null;
                                    const values = {
                                        ...(result.reasonValues || {})
                                    };
                                    if (values.side)
                                        values.side = sideName(values.side);
                                    const reason = result.reasonKey
                                        ? langText(result.reasonKey, result.reason, values)
                                        : result.reason || langText("gameOver.title", "게임 종료");
                                    document
                                        .getElementById("gameOverTitle")
                                        .textContent = name
                                            ? langText("gameOver.winTitle", "{side} 승리", {side: name})
                                            : langText("gameOver.draw", "무승부");
                                    document
                                        .getElementById("gameOverText")
                                        .textContent = reason + "\n" + langText(
                                            "gameOver.finalAssets",
                                            "최종 자산 - 백 {white} / 흑 {black}",
                                            {
                                            white: fmt(state.players.w.money),
                                            black: fmt(state.players.b.money)
                                        }
                                        );
                                    document
                                        .getElementById("gameOverModal")
                                        .classList
                                        .remove("hidden");
                                }
                                function checkBankruptcy() {
                                    for (const color of["w", "b"]) {
                                        if (state.players[color].money <= CFG.bankruptcy) {
                                            finishGame(
                                                enemyColor(color),
                                                `${color === "w"
                                                    ? "백"
                                                    : "흑"} 자본 파산`,
                                                "result.bankrupt",
                                                {side: color}
                                            );
                                            return true;
                                        }
                                    }
                                    return false;
                                }

                                function renderTurnTimer() {
                                    const format = seconds => {
                                        const s = Math.max(0, Math.floor(seconds));
                                        return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(
                                            2,
                                            "0"
                                        )}`;
                                    };
                                    state.turnTimeLeft = state.clock[state.turn];
                                    const currentEl = document.getElementById("turnTimer");
                                    if (currentEl) {
                                        currentEl.textContent = format(state.turnTimeLeft);
                                        currentEl
                                            .classList
                                            .toggle("warning", state.turnTimeLeft <= 10);
                                    }
                                    for (const color of["w", "b"]) {
                                        const el = document.getElementById(
                                            color === "w"
                                                ? "whiteClock"
                                                : "blackClock"
                                        );
                                        if (el) {
                                            el.textContent = format(state.clock[color]);
                                            el
                                                .classList
                                                .toggle("warning", state.clock[color] <= 10);
                                        }
                                    }
                                }
                                function startTurnTimer() {
                                    if (!state.started)
                                        return;
                                    stopTurnTimer();
                                    renderTurnTimer();
                                    state.turnTimerId = setInterval(() => {
                                        if (state.gameOver)
                                            return stopTurnTimer();
                                        state.clock[state.turn] = Math.max(0, state.clock[state.turn] - 1);
                                        renderTurnTimer();
                                        if (state.clock[state.turn] <= 0) {
                                            if (multiplayerRole() !== "guest")
                                                finishGame(
                                                    enemyColor(state.turn),
                                                    `${state.turn === "w"
                                                        ? "백"
                                                        : "흑"} 시간 초과`,
                                                    "result.timeout",
                                                    {side: state.turn}
                                                );
                                            else
                                                stopTurnTimer();
                                            }
                                        }, 1000);
                                }
                                function stopTurnTimer() {
                                    if (state.turnTimerId) {
                                        clearInterval(state.turnTimerId);
                                        state.turnTimerId = null;
                                    }
                                }
                                function canRequestDraw(color = pieceViewerColor()) {
                                    return state.started && !state.gameOver && ["w", "b"].includes(color) && color === state.turn;
                                }
                                function updateDrawButton() {
                                    const button = document.getElementById("drawBtn");
                                    if (!button)
                                        return;
                                    const viewer = pieceViewerColor();
                                    button.textContent = !state.drawOffer
                                        ? langText("button.drawRequest", "무승부 요청")
                                        : state.drawOffer === viewer
                                            ? langText("button.drawCancel", "요청 취소")
                                            : langText("button.drawAccept", "무승부 승인");
                                    button.disabled = !canRequestDraw();
                                }
                                function requestDraw() {
                                    return requestDrawFor(pieceViewerColor());
                                }
                                function requestDrawFor(color) {
                                    if (!canRequestDraw(color))
                                        return;
                                    playSound("select");
                                    const side = sideName(state.turn);
                                    if (!state.drawOffer) {
                                        state.drawOffer = state.turn;
                                        log(
                                            langText("log.drawRequested", "{v0}이 무승부를 요청함. 상대의 승인이 필요해.", {v0: side}),
                                            "gold"
                                        );
                                    } else if (state.drawOffer === state.turn) {
                                        state.drawOffer = null;
                                        log(langText("log.drawCancelled", "{v0}의 무승부 요청을 취소함.", {v0: side}));
                                    } else {
                                        finishDraw();
                                        return;
                                    }
                                    render();
                                }
                                function finishDraw() {
                                    finishGame(null, "백과 흑이 무승부에 합의했습니다.", "result.drawAgreement");
                                }

                                function fenFor(side) {
                                    const rows = state
                                        .board
                                        .map(row => {
                                            let out = "",
                                                empty = 0;
                                            for (const p of row) {
                                                if (!p) {
                                                    empty++;
                                                    continue;
                                                }
                                                if (empty) {
                                                    out += empty;
                                                    empty = 0;
                                                }
                                                let ch = p.specialId
                                                    ? (
                                                        isKingLike(p)
                                                            ? "k"
                                                            : "q"
                                                    )
                                                    : p.type;
                                                if (p.color === "w")
                                                    ch = ch.toUpperCase();
                                                out += ch;
                                            }
                                            if (empty)
                                                out += empty;
                                            return out;
                                        });
                                    return `${rows.join("/")} ${side} - - 0 1`;
                                }

                                function renderEngineStatus(engineStatus = state.engineStatus || "loading") {
                                    const status = document.getElementById("engineStatus");
                                    const keys = {
                                        loading: "engine.loading",
                                        ready: "engine.ready",
                                        analyzing: "engine.analyzing",
                                        error: "engine.error",
                                        destroyed: "engine.error"
                                    };
                                    const fallbacks = {
                                        loading: "Stockfish 로딩 중...",
                                        ready: "Stockfish 준비됨",
                                        analyzing: "Stockfish 분석 중...",
                                        error: "Stockfish 분석 불가",
                                        destroyed: "Stockfish 분석 불가"
                                    };
                                    if (status) {
                                        status.textContent = langText(
                                            keys[engineStatus] || "engine.error",
                                            fallbacks[engineStatus] || fallbacks.error
                                        );
                                        status.className = "engine-pill" + (
                                            ["ready", "analyzing"].includes(engineStatus)
                                                ? " online"
                                                : ["error", "destroyed"].includes(engineStatus)
                                                    ? " offline"
                                                    : ""
                                        );
                                    }
                                }
                                function initStockfish() {
                                    stockfish.setStatusHandler(({status}) => {
                                        state.engineStatus = status;
                                        state.engineReady = status === "ready";
                                        renderEngineStatus(status);
                                    });
                                    stockfish
                                        .init()
                                        .catch(error => {
                                            state.engineReady = false;
                                            log(langText("engine.initFailed", "Stockfish 초기화 실패: {error}", {
                                                error: error
                                                    ?.message || langText("engine.noWorker", "Worker 응답 없음")
                                            }), "bad");
                                        });
                                }
                                window.stockfishTestPositions = [
                                    {
                                        name: "명백한 최선수 후보",
                                        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                                        move: "e2e4"
                                    }, {
                                        name: "평범한 수 후보",
                                        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                                        move: "d2d3"
                                    }, {
                                        name: "폰 공짜 희생 후보",
                                        fen: "4k3/8/8/3q4/8/8/4P3/4K3 w - - 0 1",
                                        move: "e2e3"
                                    }, {
                                        name: "룩 공짜 희생 후보",
                                        fen: "4k3/8/8/8/q7/8/8/R3K3 w - - 0 1",
                                        move: "a1a2"
                                    }, {
                                        name: "퀸 공짜 희생 후보",
                                        fen: "3rk3/8/8/8/8/8/8/3QK3 w - - 0 1",
                                        move: "d1d2"
                                    }
                                ];
                                window.runStockfishTestPositions = async function () {
                                    const rows = [];
                                    for (const test of window.stockfishTestPositions) {
                                        const best = await stockfish.analyze(test.fen, {
                                            depth: ENGINE_EVAL_CONFIG.depth,
                                            timeout: 20000
                                        });
                                        const played = await stockfish.analyze(test.fen, {
                                            moves: [test.move],
                                            depth: ENGINE_EVAL_CONFIG.depth,
                                            timeout: 20000
                                        });
                                        const bestScore = normalizeScoreToColor(best.score, "w", "w"),
                                            playedScore = normalizeScoreToColor(played.score, "b", "w");
                                        rows.push({
                                            name: test.name,
                                            move: test.move,
                                            bestmove: best.bestmove,
                                            bestmoveMatch: String(best.bestmove).toLowerCase() === test.move,
                                            analysisValid: Boolean(best.valid && played.valid),
                                            bestScoreMoverPOV: bestScore,
                                            playedScoreMoverPOV: playedScore,
                                            centipawnLoss: bestScore === null || playedScore === null
                                                ? null
                                                : Math.max(0, bestScore - playedScore)
                                        });
                                    }
                                    console.table(rows);
                                    return rows;
                                };
                                function normalizeScoreToColor(score, rootSide, targetColor) {
                                    if (!score || !rootSide || !targetColor)
                                        return null;
                                    const raw = score.type === "mate"
                                        ? (
                                            score.value > 0
                                                ? 100000 - Math.abs(score.value) * 100
                                                : -100000 + Math.abs(score.value) * 100
                                        )
                                        : Number(score.value);
                                    if (!Number.isFinite(raw))
                                        return null;
                                    return rootSide === targetColor
                                        ? raw
                                        : -raw;
                                }
                                window.normalizeScoreToColor = normalizeScoreToColor;
                                function scoreForMover(score, rootSide, mover) {
                                    return normalizeScoreToColor(score, rootSide, mover);
                                }
                                function standardLegalUci(board, mover, uci) {
                                    const text = String(uci || "").toLowerCase();
                                    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(text))
                                        return false;
                                    const from = fromName(text.slice(0, 2)),
                                        to = fromName(text.slice(2, 4));
                                    const moving = board
                                            ?.[from.r]
                                                ?.[from.c],
                                        target = board
                                            ?.[to.r]
                                                ?.[to.c];
                                    if (
                                        !moving || moving.color !== mover || target
                                            ?.color === mover || target
                                                ?.type === "k"
                                    )
                                        return false;
                                    if (!pseudoMoves(from.r, from.c, board, false).some(cell => cell.r === to.r && cell.c === to.c))
                                        return false;
                                    const hasPromotion = Boolean(text.slice(4));
                                    if (moving.type === "p" && ((to.r === 0 || to.r === 7) !== hasPromotion))
                                        return false;
                                    if (moving.type !== "p" && hasPromotion)
                                        return false;
                                    const next = cloneBoard(board);
                                    next[to.r][to.c] = {
                                        ...moving,
                                        moved: true
                                    };
                                    next[from.r][from.c] = null;
                                    return !isKingInCheck(mover, next);
                                }
                                function standardLegalMoveCount(board, color) {
                                    let count = 0;
                                    for (let r = 0; r < 8; r++)
                                        for (let c = 0; c < 8; c++) {
                                            const p = board
                                                ?.[r]
                                                    ?.[c];
                                            if (!p || p.color !== color)
                                                continue;
                                            for (const target of pseudoMoves(r, c, board, false)) {
                                                if (
                                                    board[target.r]
                                                        ?.[target.c]
                                                            ?.type === "k"
                                                )
                                                    continue;
                                                const next = cloneBoard(board);
                                                next[target.r][target.c] = {
                                                    ...p,
                                                    moved: true
                                                };
                                                next[r][c] = null;
                                                if (!isKingInCheck(color, next))
                                                    count++;
                                                }
                                            }
                                    return count;
                                }
                                function isForcedMovePosition(board, color) {
                                    return standardLegalMoveCount(board, color) === 1;
                                }
                                function legacyClassifyMove(context, before, after) {
                                    const loss = Math.max(0, before - after),
                                        gain = after - before,
                                        best = context.standardLegal && after !== null && String(
                                            context.bestmove || ""
                                        ).toLowerCase() === String(context.uci || "").toLowerCase();
                                    if (isBrilliantMove({
                                        context,
                                        before,
                                        after,
                                        loss,
                                        gain,
                                        best
                                    }))
                                        return {
                                            key: "brilliant",
                                            bonus: ENGINE_EVAL_CONFIG.brilliantBonus,
                                            label: langText("grade.brilliant", "!! 탁월수")
                                        };
                                    if (best)
                                        return {
                                            key: "best",
                                            bonus: ENGINE_EVAL_CONFIG.bestBonus,
                                            label: langText("grade.best", "! 최선수")
                                        };
                                    if (loss <= ENGINE_EVAL_CONFIG.bestMaxLoss)
                                        return {
                                            key: "good",
                                            bonus: ENGINE_EVAL_CONFIG.goodBonus,
                                            label: langText("grade.good", "좋은 수")
                                        };
                                    if (loss <= ENGINE_EVAL_CONFIG.goodMaxLoss)
                                        return {
                                            key: "good",
                                            bonus: ENGINE_EVAL_CONFIG.goodBonus,
                                            label: langText("grade.goodMarked", "✓ 좋은 수")
                                        };
                                    return {
                                        key: "normal",
                                        bonus: 0,
                                        label: langText("grade.normal", "일반 수")
                                    };
                                }
                                function isBrilliantMove({context, after, gain, best}) {
                                    const sacrifice = context.moverMaterialDelta < 0 && context.movingMaterial > context.capturedMaterial && !context.freeCapture;
                                    return context.confidence >= .75 && (best || context.centipawnLoss <= 10) && sacrifice && gain >= ENGINE_EVAL_CONFIG.tacticalGain;
                                }
                                function legacyStockfishGrade(result, context, loss) {
                                    const best = String(context.bestmove || "").toLowerCase() === String(
                                        context.uci || ""
                                    ).toLowerCase();
                                    if (result.key === "brilliant")
                                        return {label: "Brilliant", annotation: "!!"};
                                    if (best)
                                        return {label: "Great", annotation: "!"};
                                    if (result.key === "best")
                                        return {
                                            label: loss <= 25
                                                ? "Best"
                                                : "Excellent",
                                            annotation: ""
                                        };
                                    if (result.key === "good")
                                        return {label: "Good", annotation: ""};
                                    if (loss <= 150)
                                        return {label: "Inaccuracy", annotation: "?!"};
                                    if (loss <= 300)
                                        return {label: "Mistake", annotation: "?"};
                                    return {label: "Blunder", annotation: "??"};
                                }
                                function classifyMove(context, before, after) {
                                    const loss = Math.max(0, before - after),
                                        gain = after - before,
                                        best = context.standardLegal && after !== null && String(
                                            context.bestmove || ""
                                        ).toLowerCase() === String(context.uci || "").toLowerCase();
                                    if (context.forced)
                                        return {
                                            key: "forced",
                                            bonus: 0,
                                            label: langText("grade.forced", "강제수")
                                        };
                                    if (isBrilliantMove({
                                        context,
                                        before,
                                        after,
                                        loss,
                                        gain,
                                        best
                                    }))
                                        return {
                                            key: "brilliant",
                                            bonus: ENGINE_EVAL_CONFIG.brilliantBonus,
                                            label: langText("grade.brilliant", "!! 탁월수")
                                        };
                                    if (best)
                                        return {
                                            key: "great",
                                            bonus: ENGINE_EVAL_CONFIG.bestBonus,
                                            label: langText("grade.great", "! 훌륭한 수")
                                        };
                                    if (context.bestCandidateRank > 0 && loss <= ENGINE_EVAL_CONFIG.goodMaxLoss)
                                        return {
                                            key: "excellent",
                                            bonus: ENGINE_EVAL_CONFIG.excellentBonus,
                                            label: langText("grade.excellent", "아주 좋은 수")
                                        };
                                    if (loss <= ENGINE_EVAL_CONFIG.excellentMaxLoss)
                                        return {
                                            key: "excellent",
                                            bonus: ENGINE_EVAL_CONFIG.excellentBonus,
                                            label: langText("grade.excellent", "아주 좋은 수")
                                        };
                                    if (loss <= ENGINE_EVAL_CONFIG.goodMaxLoss)
                                        return {
                                            key: "good",
                                            bonus: ENGINE_EVAL_CONFIG.goodBonus,
                                            label: langText("grade.good", "좋은 수")
                                        };
                                    if (loss <= ENGINE_EVAL_CONFIG.interestingMaxLoss)
                                        return {
                                            key: "interesting",
                                            bonus: ENGINE_EVAL_CONFIG.interestingBonus,
                                            label: langText("grade.interesting", "!? 흥미로운 수")
                                        };
                                    if (loss <= ENGINE_EVAL_CONFIG.inaccuracyMaxLoss)
                                        return {
                                            key: "inaccuracy",
                                            bonus: 0,
                                            label: langText("grade.inaccuracy", "?! 부정확한 수")
                                        };
                                    if (loss <= ENGINE_EVAL_CONFIG.mistakeMaxLoss)
                                        return {
                                            key: "mistake",
                                            bonus: 0,
                                            label: langText("grade.mistake", "? 실수")
                                        };
                                    return {
                                        key: "blunder",
                                        bonus: 0,
                                        label: langText("grade.blunder", "?? 블런더")
                                    };
                                }
                                function stockfishGrade(result, context, loss) {
                                    const grades = {
                                        forced: [
                                            "Forced",
                                            langText("grade.forced", "강제수"),
                                            "→"
                                        ],
                                        brilliant: [
                                            "Brilliant",
                                            langText("grade.brilliant", "!! 탁월수"),
                                            "!!"
                                        ],
                                        great: [
                                            "Great",
                                            langText("grade.great", "! 훌륭한 수"),
                                            "!"
                                        ],
                                        excellent: [
                                            "Excellent",
                                            langText("grade.excellent", "아주 좋은 수"),
                                            ""
                                        ],
                                        good: [
                                            "Good",
                                            langText("grade.good", "좋은 수"),
                                            ""
                                        ],
                                        interesting: [
                                            "Interesting",
                                            langText("grade.interesting", "!? 흥미로운 수"),
                                            "!?"
                                        ],
                                        inaccuracy: [
                                            "Inaccuracy",
                                            langText("grade.inaccuracy", "?! 부정확한 수"),
                                            "?!"
                                        ],
                                        mistake: [
                                            "Mistake",
                                            langText("grade.mistake", "? 실수"),
                                            "?"
                                        ],
                                        blunder: [
                                            "Blunder",
                                            langText("grade.blunder", "?? 블런더"),
                                            "??"
                                        ],
                                        unrated: [
                                            "Unrated",
                                            langText("grade.unrated", "미평가"),
                                            ""
                                        ]
                                    };
                                    const [label, display, annotation] = grades[result.key] || grades.unrated;
                                    return {label, display, annotation};
                                }
                                function annotateMoveLog(context, symbol) {
                                    if (!context.moveLogEl || !symbol)
                                        return;
                                    if (!context.moveLogEl.textContent.endsWith(` ${symbol}`))
                                        context.moveLogEl.textContent += ` ${symbol}`;
                                    }
                                const MOVE_GRADE_VFX = {
                                    brilliant: {
                                        className: "brilliant",
                                        title: "BRILLIANT",
                                        symbol: "!!",
                                        duration: 1800,
                                        particles: 20,
                                        defaultBonus: 600,
                                        variants: ["sunburst", "slash", "crown", "nova", "orbit"]
                                    },
                                    best: {
                                        className: "best",
                                        title: "BEST MOVE",
                                        symbol: "",
                                        duration: 1400,
                                        particles: 9,
                                        defaultBonus: 300,
                                        variants: ["ripple", "sweep", "orbit", "pulse"]
                                    },
                                    forced: {
                                        className: "forced",
                                        title: "FORCED MOVE",
                                        symbol: "→",
                                        duration: 1050,
                                        particles: 3,
                                        defaultBonus: 0,
                                        variants: ["pulse", "sweep"]
                                    },
                                    interesting: {
                                        className: "interesting",
                                        title: "INTERESTING",
                                        symbol: "!?",
                                        duration: 1000,
                                        particles: 5,
                                        defaultBonus: 40,
                                        variants: ["sweep", "fork", "orbit"]
                                    },
                                    excellent: {
                                        className: "excellent",
                                        title: "EXCELLENT",
                                        symbol: "",
                                        duration: 1100,
                                        particles: 5,
                                        defaultBonus: 180,
                                        variants: ["sweep"]
                                    },
                                    good: {
                                        className: "good",
                                        title: "GOOD",
                                        symbol: "",
                                        duration: 900,
                                        particles: 3,
                                        defaultBonus: 100,
                                        variants: ["pulse"]
                                    },
                                    inaccuracy: {
                                        className: "inaccuracy",
                                        title: "INACCURACY",
                                        symbol: "?!",
                                        duration: 850,
                                        particles: 2,
                                        defaultBonus: 0,
                                        variants: ["wobble", "glitch", "flash"]
                                    },
                                    mistake: {
                                        className: "mistake",
                                        title: "MISTAKE",
                                        symbol: "?",
                                        duration: 1000,
                                        particles: 1,
                                        defaultBonus: 0,
                                        variants: ["drop", "tilt", "crack"]
                                    },
                                    blunder: {
                                        className: "blunder",
                                        title: "BLUNDER",
                                        symbol: "??",
                                        duration: 1200,
                                        particles: 2,
                                        defaultBonus: 0,
                                        variants: ["impact", "quake", "vignette"]
                                    },
                                    unrated: {
                                        className: "unrated",
                                        title: "UNRATED",
                                        symbol: "",
                                        duration: 850,
                                        particles: 2,
                                        defaultBonus: 0,
                                        variants: ["scan", "flicker"]
                                    }
                                };
                                function vfxGradeKey(grade) {
                                    const value = String(grade || "").toLowerCase();
                                    if (value === "great" || value === "best")
                                        return "best";
                                    if (value === "excellent")
                                        return "excellent";
                                    if (value === "brilliant")
                                        return "brilliant";
                                    return MOVE_GRADE_VFX[value]
                                        ? value
                                        : "unrated";
                                }
                                function vfxTargetPosition(square) {
                                    if (!square)
                                        return null;
                                    const r = typeof square.r === "number"
                                        ? square.r
                                        : typeof square.tr === "number"
                                            ? square.tr
                                            : 8 - Number(String(square).slice(1));
                                    const c = typeof square.c === "number"
                                        ? square.c
                                        : typeof square.tc === "number"
                                            ? square.tc
                                            : FILES.indexOf(String(square).slice(0, 1));
                                    const el = document.querySelector(`.square[data-r="${r}"][data-c="${c}"]`);
                                    if (!el)
                                        return null;
                                    const rect = el.getBoundingClientRect();
                                    return {
                                        x: rect.left + rect.width / 2,
                                        y: rect.top + rect.height / 2
                                    };
                                }
                                function showMoveGradeEffect({
                                    grade,
                                    bonus = 0,
                                    square = null,
                                    moveId = null
                                } = {}) {
                                    const overlay = document.getElementById("moveGradeOverlay");
                                    if (!overlay)
                                        return;
                                    const key = vfxGradeKey(grade),
                                        config = MOVE_GRADE_VFX[key];
                                    const variant = config.variants[Math.floor(Math.random() * config.variants.length)];
                                    const target = vfxTargetPosition(square);
                                    clearTimeout(overlay._hideTimer);
                                    overlay._vfxToken = (overlay._vfxToken || 0) + 1;
                                    overlay._vfxMoveId = moveId;
                                    overlay.className = `move-grade-overlay cinematic grade-${config.className} variant-${variant}`;
                                    overlay.setAttribute("aria-hidden", "false");
                                    const targetStyle = target
                                        ? `style="--target-x:${target.x}px;--target-y:${target.y}px"`
                                        : "";
                                    const particles = Array
                                        .from({
                                            length: Math.min(24, Math.max(0, config.particles))
                                        }, (_, index) => {
                                            const angle = Math.random() * Math.PI * 2,
                                                distance = 70 + Math.random() * 230;
                                            const x = Math.cos(angle) * distance,
                                                y = Math.sin(angle) * distance,
                                                delay = Math.random() * .18,
                                                rotate = Math.random() * 360,
                                                scale = .5 + Math.random() * .9;
                                            return `<i class="vfx-particle" style="--x:${x}px;--y:${y}px;--delay:${delay}s;--rotate:${rotate}deg;--scale:${scale};--index:${index}"></i>`;
                                        })
                                        .join("");
                                    overlay.innerHTML = `<div class="vfx-backdrop"></div><div class="vfx-target" ${targetStyle}><span class="vfx-ring"></span><span class="vfx-ring"></span></div><div class="vfx-streaks"></div><div class="vfx-particles">${particles}</div><div class="vfx-copy"><b class="vfx-symbol">${config.symbol}</b><strong class="vfx-title">${config.title}</strong>${Number(
                                        bonus
                                    ) > 0
                                        ? `<span class="vfx-bonus">+$${Math
                                            .round(Number(bonus))
                                            .toLocaleString("ko-KR")}</span>`
                                        : ""}</div>`;
                                    void overlay.offsetWidth;
                                    overlay
                                        .classList
                                        .add("show");
                                    const token = overlay._vfxToken;
                                    overlay._hideTimer = setTimeout(() => {
                                        if (overlay._vfxToken !== token)
                                            return;
                                        overlay.className = "move-grade-overlay";
                                        overlay.innerHTML = "";
                                        overlay.setAttribute("aria-hidden", "true");
                                    }, config.duration);
                                }
                                function stockfishMaterial(board) {
                                    const value = {
                                        w: 0,
                                        b: 0
                                    };
                                    for (const row of board)
                                        for (const p of row)
                                            if (
                                                p
                                                    ?.color
                                            )
                                                value[p.color] += p.specialId
                                                    ? pieceScore(p)
                                                    : PIECE_SCORE[p.type] || 0;
                                    return value;
                                }
                                function stockfishPieceLabel(p) {
                                    if (!p)
                                        return "none";
                                    return p.specialId
                                        ? `${p.specialId}(${p.type})`
                                        : p.type;
                                }
                                function debugStockfishMoveEval(data) {
                                    if (!DEBUG_STOCKFISH)
                                        return;
                                    const materialBefore = data.materialBefore || {
                                        w: null,
                                        b: null
                                    };
                                    const materialAfter = data.materialAfter || {
                                        w: null,
                                        b: null
                                    };
                                    const materialDelta = {
                                        w: materialBefore.w === null || materialAfter.w === null
                                            ? null
                                            : materialAfter.w - materialBefore.w,
                                        b: materialBefore.b === null || materialAfter.b === null
                                            ? null
                                            : materialAfter.b - materialBefore.b
                                    };
                                    console.log("========== STOCKFISH MOVE EVAL ==========");
                                    console.log("beforeFen", data.beforeFen);
                                    console.log("playerUci", data.playerUci);
                                    console.log("stockfishBestmove", data.stockfishBestmove);
                                    console.log("bestmoveMatch", data.bestmoveMatch);
                                    console.log("rawBestScore", data.rawBestScore);
                                    console.log("rawPlayedScore", data.rawPlayedScore);
                                    console.log("rootSideBefore", data.rootSideBefore);
                                    console.log("rootSidePlayed", data.rootSidePlayed);
                                    console.log("normalizedBestScore", data.normalizedBestScore);
                                    console.log("normalizedPlayedScore", data.normalizedPlayedScore);
                                    console.log("moverColor", data.moverColor);
                                    console.log("bestScoreMoverPOV", data.bestScoreMoverPOV);
                                    console.log("playedScoreMoverPOV", data.playedScoreMoverPOV);
                                    console.log("centipawnLoss", data.centipawnLoss);
                                    console.log("movingPiece", data.movingPiece);
                                    console.log("capturedPiece", data.capturedPiece);
                                    console.log("materialBefore", materialBefore);
                                    console.log("materialAfter", materialAfter);
                                    console.log("materialDelta", materialDelta);
                                    console.log("confidence", data.confidence);
                                    console.log("analysisValid", data.analysisValid);
                                    console.log("invalidReason", data.invalidReason);
                                    console.log("standardLegal", data.standardLegal);
                                    console.log("bonusEligible", data.bonusEligible);
                                    console.log("classification", data.classification);
                                    console.log("bonus", data.bonus);
                                    console.log("==========================================");
                                    if (data.bestmoveMatch && materialDelta[data.moverColor] < 0 && data.centipawnLoss <= 0) {
                                        console.warn("[SF WARNING] 큰 기물 손실인데 BEST 경로로 판정됨", data);
                                    }
                                }
                                function fallbackStockfishGrade(context, reason, capturedPiece) {
                                    if (state.engineRevision !== context.revision || state.engineAwarded.has(context.moveId))
                                        return;
                                    state.positionEval = {
                                        status: "unrated",
                                        reason: String(reason || "analysis unavailable").slice(0, 100),
                                        rootSide: enemyColor(context.mover),
                                        depth: 0,
                                        lines: [],
                                        moveId: context.moveId,
                                        gradeKey: "Unrated",
                                        bonus: 0,
                                        square: context.square
                                    };
                                    showMoveGradeEffect(
                                        {grade: "Unrated", square: context.square, moveId: context.moveId}
                                    );
                                    annotateMoveLog(context, "Unrated");
                                    log(langText("log.unrated", "수 평가: 미평가 · Stockfish 분석을 완료하지 못했습니다."));
                                    render();
                                }
                                async function evaluateMoveWithStockfish(context) {
                                    if (state.stockfishEnabled === false) {
                                        fallbackStockfishGrade(context, "Stockfish evaluation disabled");
                                        return;
                                    }
                                    const playerUci = String(context.uci || "").toLowerCase();
                                    const from = fromName(playerUci.slice(0, 2)),
                                        to = fromName(playerUci.slice(2, 4));
                                    const movingPiece = context.beforeBoard
                                        ?.[from.r]
                                            ?.[from.c] || null;
                                    const captureSquare = context.captureSquare || to;
                                    const capturedPiece = context.beforeBoard
                                        ?.[captureSquare.r]
                                            ?.[captureSquare.c] || null;
                                    const materialBefore = context.beforeBoard
                                        ? stockfishMaterial(context.beforeBoard)
                                        : null;
                                    const materialAfter = context.afterBoard
                                        ? stockfishMaterial(context.afterBoard)
                                        : null;
                                    const standardLegal = standardLegalUci(
                                        context.beforeBoard,
                                        context.mover,
                                        playerUci
                                    );
                                    const debugSkipped = (classification, extra = {}) => debugStockfishMoveEval({
                                        beforeFen: "unavailable",
                                        playerUci,
                                        stockfishBestmove: null,
                                        bestmoveMatch: false,
                                        rawBestScore: null,
                                        rawPlayedScore: null,
                                        rootSideBefore: context.mover,
                                        rootSidePlayed: enemyColor(context.mover),
                                        normalizedBestScore: null,
                                        normalizedPlayedScore: null,
                                        moverColor: context.mover,
                                        bestScoreMoverPOV: null,
                                        playedScoreMoverPOV: null,
                                        centipawnLoss: null,
                                        movingPiece: stockfishPieceLabel(movingPiece),
                                        capturedPiece: stockfishPieceLabel(capturedPiece),
                                        materialBefore,
                                        materialAfter,
                                        confidence: context.confidence ?? null,
                                        analysisValid: false,
                                        invalidReason: classification,
                                        standardLegal: extra.standardLegal ?? standardLegal,
                                        bonusEligible: false,
                                        classification: extra.grade || "Fallback",
                                        bonus: 0
                                    });
                                    if (!window.stockfishPositionAdapter) {
                                        fallbackStockfishGrade(context, "adapter unavailable", capturedPiece);
                                        return;
                                    }
                                    const beforePosition = stockfishPositionAdapter.fromBoard(
                                        context.beforeBoard,
                                        context.mover,
                                        context.beforeRules
                                    );
                                    const afterPosition = stockfishPositionAdapter.fromBoard(
                                        context.afterBoard,
                                        enemyColor(context.mover),
                                        context.afterRules
                                    );
                                    context.confidence = Math.min(
                                        beforePosition.confidence,
                                        afterPosition.confidence
                                    );
                                    const enemyKingPresent = context
                                            .afterBoard
                                            ?.flat()
                                            .some(
                                                piece => piece && piece.color === enemyColor(context.mover) && isKingLike(piece)
                                            );
                                    if (!enemyKingPresent) {
                                        fallbackStockfishGrade(context, "king captured", capturedPiece);
                                        return;
                                    }
                                    try {
                                        const beforeResult = await stockfish
                                            .analyze(beforePosition.fen, {
                                                depth: ENGINE_EVAL_CONFIG.depth,
                                                multiPV: ENGINE_EVAL_CONFIG.multiPV,
                                                timeout: 30000
                                            })
                                            .catch(error => {
                                                debugSkipped(
                                                    `failed: before analysis (${error
                                                        ?.message || "unknown"})`
                                                );
                                                return null;
                                            });
                                        if (!beforeResult) {
                                            fallbackStockfishGrade(context, "before analysis failed", capturedPiece);
                                            return;
                                        }
                                        if (!beforeResult.valid) {
                                            fallbackStockfishGrade(
                                                context,
                                                beforeResult.invalidReason || "invalid before analysis",
                                                capturedPiece
                                            );
                                            return;
                                        }
                                        if (state.engineRevision !== context.revision) {
                                            debugSkipped("skipped: stale move revision");
                                            return;
                                        }
                                        const playedResult = await stockfish
                                            .analyze(afterPosition.fen, {
                                                depth: ENGINE_EVAL_CONFIG.depth,
                                                multiPV: ENGINE_EVAL_CONFIG.multiPV,
                                                timeout: 30000
                                            })
                                            .catch(error => {
                                                debugSkipped(
                                                    `failed: played analysis (${error
                                                        ?.message || "unknown"})`
                                                );
                                                return null;
                                            });
                                        if (!playedResult) {
                                            fallbackStockfishGrade(context, "played analysis failed", capturedPiece);
                                            return;
                                        }
                                        if (!playedResult.valid) {
                                            fallbackStockfishGrade(
                                                context,
                                                playedResult.invalidReason || "invalid played analysis",
                                                capturedPiece
                                            );
                                            return;
                                        }
                                        if (state.engineRevision !== context.revision || state.engineAwarded.has(context.moveId)) {
                                            debugSkipped("skipped: stale or already awarded");
                                            return;
                                        }
                                        const rootSideBefore = context.mover,
                                            rootSidePlayed = enemyColor(context.mover);
                                        const before = normalizeScoreToColor(
                                                beforeResult.score,
                                                rootSideBefore,
                                                context.mover
                                            ),
                                            after = normalizeScoreToColor(
                                                playedResult.score,
                                                rootSidePlayed,
                                                context.mover
                                            );
                                        if (before === null || after === null) {
                                            fallbackStockfishGrade(context, "score normalization failed", capturedPiece);
                                            return;
                                        }
                                        context.bestmove = beforeResult.bestmove;
                                        context.standardLegal = Boolean(context.info.movingIsStandard && standardLegal);
                                        const beforeLines = Array.isArray(beforeResult.lines)
                                            ? beforeResult.lines
                                            : [];
                                        context.bestCandidateRank = beforeLines.findIndex(line => String(
                                            line.pv
                                                ?.[0] || ""
                                        ).toLowerCase() === playerUci);
                                        context.forced = context.standardLegal && beforeLines.length === 1 && String(
                                            beforeLines[0].pv
                                                ?.[0] || ""
                                        ).toLowerCase() === playerUci;
                                        const playedLines = (
                                            Array.isArray(playedResult.lines) && playedResult.lines.length
                                                ? playedResult.lines
                                                : [
                                                    {
                                                        score: playedResult.score,
                                                        pv: playedResult.bestmove
                                                            ? [playedResult.bestmove]
                                                            : []
                                                    }
                                                ]
                                        ).slice(0, ENGINE_EVAL_CONFIG.multiPV);
                                        state.positionEval = {
                                            status: "rated",
                                            rootSide: rootSidePlayed,
                                            turnNo: state.turnNo,
                                            depth: Number(playedResult.depth) || 0,
                                            lines: playedLines.map(line => ({
                                                score: line.score || playedResult.score,
                                                pv: (
                                                    Array.isArray(line.pv)
                                                        ? line.pv
                                                        : []
                                                ).slice(0, 12)
                                            })),
                                            moveId: context.moveId,
                                            square: context.square
                                        };
                                        context.centipawnLoss = Math.max(0, before - after);
                                        context.movingMaterial = movingPiece
                                            ? pieceScore(movingPiece)
                                            : 0;
                                        context.capturedMaterial = capturedPiece
                                            ? pieceScore(capturedPiece)
                                            : 0;
                                        context.moverMaterialDelta = materialAfter[context.mover] - materialBefore[context.mover];
                                        context.freeCapture = materialAfter[enemyColor(context.mover)] < materialBefore[enemyColor(context.mover)] && context.moverMaterialDelta >= 0;
                                        context.bonusEligible = true;
                                        const result = classifyMove(context, before, after);
                                        const grade = stockfishGrade(result, context, Math.max(0, before - after));
                                        result.label = grade.display;
                                        result.bonus = Math.round(result.bonus * (0.5 + 0.5 * context.confidence));
                                        const stockfishBestmove = String(context.bestmove || "").toLowerCase();
                                        const bestmoveMatch = Boolean(playerUci && stockfishBestmove === playerUci);
                                        if (!context.bonusEligible)
                                            result.bonus = 0;
                                        state.positionEval.gradeKey = grade.label;
                                        state.positionEval.bonus = result.bonus;
                                        debugStockfishMoveEval({
                                            beforeFen: beforePosition.fen,
                                            playerUci,
                                            stockfishBestmove,
                                            bestmoveMatch,
                                            rawBestScore: beforeResult.score,
                                            rawPlayedScore: playedResult.score,
                                            rootSideBefore,
                                            rootSidePlayed,
                                            normalizedBestScore: before,
                                            normalizedPlayedScore: after,
                                            moverColor: context.mover,
                                            bestScoreMoverPOV: before,
                                            playedScoreMoverPOV: after,
                                            centipawnLoss: context.centipawnLoss,
                                            movingPiece: stockfishPieceLabel(movingPiece),
                                            capturedPiece: stockfishPieceLabel(capturedPiece),
                                            materialBefore,
                                            materialAfter,
                                            confidence: context.confidence,
                                            analysisValid: true,
                                            invalidReason: null,
                                            standardLegal,
                                            bonusEligible: context.bonusEligible,
                                            classification: grade.label,
                                            bonus: result.bonus
                                        });
                                        if (grade.label === "Brilliant")
                                            playSound("brilliant");
                                        showMoveGradeEffect(
                                            {grade: grade.label, bonus: result.bonus, square: context.square, moveId: context.moveId}
                                        );
                                        annotateMoveLog(
                                            context,
                                            `${grade.display}${grade.annotation
                                                ? ` ${grade.annotation}`
                                                : ""}`
                                        );
                                        if (!result.bonus) {
                                            log(langText("log.engineEvaluation", "Stockfish 판정: {v0} · {v1}", {
                                                v0: result.label,
                                                v1: stockfishPositionAdapter.confidenceLabel(context.confidence)
                                            }));
                                            render();
                                            return;
                                        }
                                        state
                                            .engineAwarded
                                            .add(context.moveId);
                                        state
                                            .players[context.mover]
                                            .money += result.bonus;
                                        log(langText("log.engineBonus", "{v0} — +{v1} · 신뢰도 {v2}", {
                                            v0: result.label,
                                            v1: fmt(result.bonus),
                                            v2: stockfishPositionAdapter.confidenceLabel(context.confidence)
                                        }), "gold");
                                        render();
                                    } catch (error) {
                                        fallbackStockfishGrade(
                                            context,
                                            `analysis failed: ${error
                                                ?.message || "Worker error"}`,
                                            capturedPiece
                                        );
                                    }
                                }

                                function formatEvaluationScore(score, rootSide) {
                                    const whiteScore = normalizeScoreToColor(score, rootSide, "w");
                                    if (whiteScore === null)
                                        return langText("evaluation.unknown", "평가 없음");
                                    if (
                                        score
                                            ?.type === "mate"
                                    ) {
                                        const winner = whiteScore >= 0
                                            ? "w"
                                            : "b";
                                        return langText("evaluation.mate", "M{moves} · {side} 메이트", {
                                            moves: Math.abs(Number(score.value) || 0),
                                            side: sideName(winner)
                                        });
                                    }
                                    const pawns = whiteScore / 100;
                                    if (Math.abs(whiteScore) < 10)
                                        return langText("evaluation.even", "균형 {score}", {
                                            score: `${pawns >= 0
                                                ? "+"
                                                : ""}${pawns.toFixed(2)}`
                                        });
                                    return langText("evaluation.score", "{side} +{score}", {
                                        side: sideName(
                                            pawns > 0
                                                ? "w"
                                                : "b"
                                        ),
                                        score: Math
                                            .abs(pawns)
                                            .toFixed(2)
                                    });
                                }
                                function formatEvaluationVariation(pv, rootSide, turnNo) {
                                    let side = rootSide,
                                        moveNumber = Math.max(1, Number(turnNo) || 1);
                                    return (
                                        Array.isArray(pv)
                                            ? pv
                                            : []
                                    )
                                        .slice(0, 12)
                                        .map((uci, index) => {
                                            const move = String(uci || "").toLowerCase();
                                            if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move))
                                                return "";
                                            const prefix = side === "w"
                                                ? `${moveNumber}. `
                                                : index === 0
                                                    ? `${moveNumber}... `
                                                    : "";
                                            const text = `${move.slice(0, 2)}–${move.slice(2, 4)}${move[4]
                                                ? `=${move[4].toUpperCase()}`
                                                : ""}`;
                                            if (side === "b")
                                                moveNumber++;
                                            side = enemyColor(side);
                                            return prefix + text;
                                        })
                                        .filter(Boolean)
                                        .join(" ");
                                }
                                function renderPositionEvaluation() {
                                    const panel = document.getElementById("positionEvaluation"),
                                        summary = document.getElementById("positionEvalSummary"),
                                        depth = document.getElementById("positionEvalDepth"),
                                        list = document.getElementById("positionEvalLines");
                                    if (!panel || !summary || !depth || !list)
                                        return;
                                    panel.hidden = !state.started;
                                    list.replaceChildren();
                                    const evaluation = state.positionEval;
                                    if (!evaluation || evaluation.status !== "rated") {
                                        summary.textContent = langText("evaluation.unrated", "미평가");
                                        depth.textContent = "";
                                        return;
                                    }
                                    const lines = Array.isArray(evaluation.lines)
                                        ? evaluation.lines
                                        : [];
                                    summary.textContent = lines.length
                                        ? formatEvaluationScore(lines[0].score, evaluation.rootSide)
                                        : langText("evaluation.unrated", "미평가");
                                    depth.textContent = evaluation.depth
                                        ? langText("evaluation.depth", "깊이 {depth}", {depth: evaluation.depth})
                                        : "";
                                    lines
                                        .slice(0, ENGINE_EVAL_CONFIG.multiPV)
                                        .forEach((line, index) => {
                                            const item = document.createElement("li"),
                                                rank = document.createElement("small"),
                                                score = document.createElement("b"),
                                                variation = document.createElement("span");
                                            rank.textContent = `${index + 1}.`;
                                            score.textContent = formatEvaluationScore(line.score, evaluation.rootSide);
                                            variation.textContent = formatEvaluationVariation(
                                                line.pv,
                                                evaluation.rootSide,
                                                evaluation.turnNo || state.turnNo
                                            );
                                            item.append(rank, score, variation);
                                            list.appendChild(item);
                                        });
                                }

                                function render() {
                                    state.kingDangerTargets = state.selected
                                        ? kingDangerTargetsFor(state.selected.r, state.selected.c)
                                        : [];
                                    renderPositionEvaluation();
                                    document
                                        .querySelectorAll(".square")
                                        .forEach(el => {
                                            const r = Number(el.dataset.r),
                                                c = Number(el.dataset.c),
                                                p = state.board[r][c],
                                                key = sqName(r, c);
                                            el
                                                .classList
                                                .remove(
                                                    "selected",
                                                    "legal",
                                                    "capture",
                                                    "buy-target",
                                                    "teleport-target",
                                                    "in-check",
                                                    "king-danger",
                                                    "dragging"
                                                );
                                            if (
                                                state.selected
                                                    ?.r === r && state.selected
                                                        ?.c === c
                                            )
                                                el
                                                    .classList
                                                    .add("selected");
                                            const legal = state
                                                .legalTargets
                                                .some(x => x.r === r && x.c === c);
                                            if (legal)
                                                el
                                                    .classList
                                                    .add(
                                                        p && p.color !== state.turn
                                                            ? "capture"
                                                            : "legal"
                                                    );
                                            const kingDanger = state
                                                .kingDangerTargets
                                                .some(x => x.r === r && x.c === c);
                                            if (kingDanger)
                                                el
                                                    .classList
                                                    .add("king-danger");
                                            el.title = kingDanger
                                                ? langText("board.kingDanger", "이동하면 아군 킹이 공격받거나 제거될 수 있습니다.")
                                                : "";
                                            if (["buy", "special-buy", "warehouse-deploy"].includes(state.mode) && homeZone(state.turn, r) && !p)
                                                el
                                                    .classList
                                                    .add("buy-target");
                                            if (state.mode === "teleport" && !p)
                                                el
                                                    .classList
                                                    .add("teleport-target");
                                            if (isKingLike(p) && isKingInCheck(p.color, state.board))
                                                el
                                                    .classList
                                                    .add("in-check");
                                            el.draggable = !!(
                                                p && p.color === state.turn && multiplayerOwnsColor(p.color) && !current().moveUsed && !state.mode && (!p.purchaseLocked || p.active)
                                            );
                                            let html = "";
                                            if (p) {
                                                const visual = p.specialId
                                                    ? pieceVisual(p)
                                                    : pieceImgTag(p.color + p.type, "piece", `${p.color}${p.type}`);
                                                html += p.shelterFortress
                                                    ? `<span class="fortress-garrison">${pieceVisual(p.shelterFortress)}${visual}</span>`
                                                    : visual;
                                            }
                                            if (state.visits[key])
                                                html += `<span class="visit-badge">${state.visits[key]}</span>`;
                                            if (state.properties[key])
                                                html += `<span class="owner-mark ${state.properties[key]}"></span>`;
                                            el.innerHTML = html;
                                        });
                                    for (const t of["p", "n", "b", "r", "q"]) {
                                        const img = document.getElementById(`shop-${t}`);
                                        if (img) {
                                            const key = state.turn + t;
                                            img.src = IMG[key];
                                            img.dataset.fallback = IMG_FALLBACK[key];
                                        }
                                    }
                                    for (const def of SpecialPieces.list()) {
                                        const stockEl = document.getElementById(`special-stock-${def.id}`),
                                            button = document.querySelector(`[data-special-id="${def.id}"]`),
                                            stock = state.specialStock[def.id] || 0;
                                        if (stockEl)
                                            stockEl.textContent = stock
                                                ? langText("shop.stock", "재고 {count}", {count: stock})
                                                : langText("shop.soldOut", "품절");
                                        if (button)
                                            button
                                                .classList
                                                .toggle("sold-out", stock <= 0);
                                        }
                                    attachImageFallbacks(document);
                                    const w = state.players.w,
                                        b = state.players.b,
                                        p = current();
                                    document
                                        .getElementById("whiteMoney")
                                        .textContent = fmt(w.money);
                                    document
                                        .getElementById("blackMoney")
                                        .textContent = fmt(b.money);
                                    document
                                        .getElementById("whiteSalary")
                                        .textContent = fmt(w.salary);
                                    document
                                        .getElementById("blackSalary")
                                        .textContent = fmt(b.salary);
                                    document
                                        .getElementById("whiteTax")
                                        .textContent = fmt(countTax("w"));
                                    document
                                        .getElementById("blackTax")
                                        .textContent = fmt(countTax("b"));
                                    document
                                        .getElementById("whitePieceScore")
                                        .textContent = langText(
                                            "game.score",
                                            "{score}점",
                                            {score: countPieceScore("w")}
                                        );
                                    document
                                        .getElementById("blackPieceScore")
                                        .textContent = langText(
                                            "game.score",
                                            "{score}점",
                                            {score: countPieceScore("b")}
                                        );
                                    document
                                        .getElementById("whiteDebt")
                                        .textContent = fmt(
                                            (state.players.w.creditDebt || 0) + (state.players.w.pendingInterest || 0)
                                        );
                                    document
                                        .getElementById("blackDebt")
                                        .textContent = fmt(
                                            (state.players.b.creditDebt || 0) + (state.players.b.pendingInterest || 0)
                                        );
                                    document
                                        .getElementById("whiteCard")
                                        .classList
                                        .toggle("active", state.turn === "w");
                                    document
                                        .getElementById("blackCard")
                                        .classList
                                        .toggle("active", state.turn === "b");
                                    const side = state.turn === "w"
                                        ? langText("game.white", "백")
                                        : langText("game.black", "흑");
                                    document
                                        .getElementById("turnLabel")
                                        .textContent = langText("game.turn", "{side}의 턴", {side}) + (
                                            activeInCheck()
                                                ? ` - ${langText("game.check", "체크!")}`
                                                : ""
                                        );
                                    document
                                        .getElementById("apValue")
                                        .textContent = `${p.ap} / ${CFG.maxAP}`;
                                    document
                                        .getElementById("moveState")
                                        .textContent = langText("game.moveState", "체스 수: {state}", {
                                        state: p.moveUsed
                                            ? langText("game.moveUsed", "사용 완료")
                                            : langText("game.moveAvailable", "사용 가능")
                                    });
                                    document
                                        .getElementById("selectedSquare")
                                        .textContent = state.selected
                                            ? sqName(state.selected.r, state.selected.c)
                                            : langText("board.none", "없음");
                                    const dangerHint = document.getElementById("kingDangerHint");
                                    if (dangerHint)
                                        dangerHint.textContent = state.kingDangerTargets.length
                                            ? langText(
                                                "board.kingDangerHint",
                                                "빨간 칸은 이동 후 킹이 위험해지는 위치입니다. 핀·앙파상에 따른 공격선 변화도 표시합니다."
                                            )
                                            : "";
                                    document
                                        .getElementById("salaryUpgradeText")
                                        .textContent = langText(
                                            "economy.salarySummary",
                                            "\ud604\uc7ac {current}/\ud134 | \uc778\uc0c1 \ud6c4 {next}/\ud134 | \ube44" +
                                                "\uc6a9 {cost} | 1 AP",
                                            {
                                            current: fmt(p.salary),
                                            next: fmt(p.salary + CFG.salaryRaise),
                                            cost: fmt(salaryCost(p))
                                        }
                                        );
                                    const actionSmall = id => document.querySelector('#' + id + ' small');
                                    const jobSmall = actionSmall("jobBtn");
                                    if (jobSmall)
                                        jobSmall.textContent = langText("economy.jobReward", "+ {amount} \xb7 1 AP", {
                                            amount: fmt(CFG.jobPay)
                                        });
                                    const depositButton = document.getElementById("depositBtn");
                                    if (depositButton) {
                                        depositButton
                                            .querySelector("b")
                                            .textContent = langText("economy.depositTitle", "\uc801\uae08 {amount}", {
                                            amount: fmt(CFG.depositAmount)
                                        });
                                        depositButton
                                            .querySelector("small")
                                            .textContent = langText("economy.depositMaturity", "4\ud134 \ub4a4 +{rate}%", {
                                            rate: Math.round((CFG.depositReturn - 1) * 100)
                                        });
                                    }
                                    const ventureButton = document.getElementById("ventureBtn");
                                    if (ventureButton) {
                                        ventureButton
                                            .querySelector("b")
                                            .textContent = langText(
                                                "economy.ventureTitle",
                                                "\ubca4\ucc98 \ud22c\uc790 {amount}",
                                                {
                                                amount: fmt(CFG.ventureAmount)
                                            }
                                            );
                                        ventureButton
                                            .querySelector("small")
                                            .textContent = langText(
                                                "economy.ventureMaturity",
                                                "3\ud134 \ub4a4 {minimum}~{maximum}\ubc30",
                                                {
                                                minimum: CFG
                                                    .ventureMinReturn
                                                    .toFixed(2),
                                                maximum: CFG
                                                    .ventureMaxReturn
                                                    .toFixed(2)
                                            }
                                            );
                                    }

                                    document
                                        .getElementById("insuranceStatus")
                                        .textContent = langText("insurance.status", "백 보험: {white} · 흑 보험: {black}", {
                                        white: langText(
                                            w.insurance
                                                ? "insurance.owned"
                                                : "insurance.none",
                                            w.insurance
                                                ? "보유"
                                                : "없음"
                                        ),
                                        black: langText(
                                            b.insurance
                                                ? "insurance.owned"
                                                : "insurance.none",
                                            b.insurance
                                                ? "보유"
                                                : "없음"
                                        )
                                    });
                                    updateDrawButton();
                                    const orbitalBtn = document.getElementById("orbitalStrikeBtn"),
                                        orbitalStatus = document.getElementById("orbitalStatus"),
                                        orbitalReady = orbitalStrikeReady();
                                    const orbitalHint = orbitalBtn
                                        ?.querySelector("small");
                                    if (orbitalHint)
                                        orbitalHint.textContent = langText(
                                            "special.orbitalHint",
                                            "{amount} · 턴 AP 전체",
                                            {
                                                amount: fmt(CFG.orbitalStrike.price)
                                            }
                                        );
                                    const orbitalReason = orbitalReady.reason;
                                    if (orbitalBtn) {
                                        orbitalBtn.disabled = !orbitalReady.ok || state.mode === "orbital-targeting" || state.gameOver;
                                        orbitalBtn.title = orbitalReady.ok
                                            ? langText("orbital.connecting", "궤도 플랫폼 접속")
                                            : langText(
                                                "orbital.unavailable",
                                                "궤도 빔 사용 불가: {reason}",
                                                {reason: orbitalReason}
                                            );
                                    }
                                    if (orbitalStatus)
                                        orbitalStatus.textContent = state.mode === "orbital-targeting"
                                            ? langText("orbital.targeting", "조준 중 · 클릭 발사 / ESC·우클릭 취소")
                                            : orbitalReady.ok
                                                ? langText("orbital.ready", "궤도 플랫폼 접속 가능")
                                                : orbitalReason;
                                    window
                                        .EconomyUI
                                        .render();
                                    renderMaturities();
                                    renderStocks();
                                    renderAnnotations();
                                    document
                                        .getElementById("endTurnBtn")
                                        .disabled = state.gameOver;
                                    if (multiplayerRole() === "host")
                                        window
                                            .multiplayer
                                            .sendState(serializeGameState());
                                    }
                                function renderMaturities() {
                                    const p = current();
                                    const items = [];
                                    for (const d of p.deposits)
                                        items.push(langText("maturity.deposit", "적금 {amount} · {turns}회 내 턴 남음", {
                                            amount: fmt(d.principal),
                                            turns: Math.max(0, d.due - p.ownTurns)
                                        }));
                                    for (const v of p.ventures)
                                        items.push(langText("maturity.venture", "벤처 {amount} · {turns}회 내 턴 남음", {
                                            amount: fmt(v.principal),
                                            turns: Math.max(0, v.due - p.ownTurns)
                                        }));
                                    document
                                        .getElementById("maturityList")
                                        .textContent = items.length
                                            ? items.join(" / ")
                                            : langText("maturity.empty", "진행 중인 적금·투자 없음");
                                }
                                function renderStocks() {
                                    const ticker = document.getElementById("ticker");
                                    ticker.innerHTML = "";
                                    for (const [k, s] of Object.entries(STOCKS)) {
                                        const pct = ((s.price - s.last) / s.last * 100) || 0;
                                        const cls = pct >= 0
                                            ? "up"
                                            : "down";
                                        const arrow = pct >= 0
                                            ? "▲"
                                            : "▼";
                                        ticker.innerHTML += `<div class="ticker-row"><span>${companyName(k, s.name)}</span><span class="price">${fmt(
                                            s.price
                                        )}</span><span class="delta ${cls}">${arrow} ${Math
                                            .abs(pct)
                                            .toFixed(1)}%</span></div>`;
                                    }
                                    const p = current();
                                    const portfolio = Object
                                        .entries(p.holdings)
                                        .filter(([, q]) => q > 0)
                                        .map(
                                            ([k, q]) => langText("market.shares", "{count}주", {count: q}) + ` ${companyName(k, STOCKS[k].name)} (${fmt(STOCKS[k].price * q)})`
                                        );
                                    const side = state.turn === "w"
                                        ? langText("game.white", "백")
                                        : langText("game.black", "흑");
                                    document
                                        .getElementById("portfolio")
                                        .textContent = portfolio.length
                                            ? langText(
                                                "market.ownedBy",
                                                "{side} 보유: {items}",
                                                {side, items: portfolio.join(" · ")}
                                            )
                                            : langText("market.portfolioEmpty", "보유 주식 없음");
                                    document
                                        .getElementById("newsFeed")
                                        .innerHTML = state
                                        .news
                                        .map(n => {
                                            const item = localizedNews(n);
                                            return `<div class="news-item"><b>${item.company}</b> — ${item.text}</div>`;
                                        })
                                        .join("");
                                    document
                                        .getElementById("marketTurn")
                                        .textContent = langText("market.turn", "시장 턴 {turn}", {turn: state.turnNo});
                                }

                                function log(text, type = "") {
                                    if (String(text).includes("Analysis cancelled"))
                                        return null;
                                    if (type === "bad")
                                        playSound("error");
                                    const el = document.getElementById("log");
                                    const message = `[T${state.turnNo}] ${text}`;
                                    if (
                                        el.firstElementChild
                                            ?.textContent === message
                                    )
                                        return el.firstElementChild;
                                    const d = document.createElement("div");
                                    d.className = `log-entry ${type}`;
                                    d.textContent = message;
                                    el.prepend(d);
                                    return d;
                                }

                                init();

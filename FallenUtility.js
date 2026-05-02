// ==UserScript==
// @name         Fallen Utility
// @namespace    http://tampermonkey.net/
// @version      7.1
// @description  Utility For Minefun.io - Ultimate Stable Edition
// @author       FallenNightA
// @match        https://*.minefun.io/*
// @icon         https://raw.githubusercontent.com/FallenNightA/FallenUtility/main/icon.png
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ==============================
    // CORE SYSTEM & BUS
    // ==============================
    const bus = {
        listeners: {},
        on(ev, cb) { if (!this.listeners[ev]) this.listeners[ev] = []; this.listeners[ev].push(cb); },
        emit(ev, data) { if (this.listeners[ev]) this.listeners[ev].forEach(cb => cb(data)); }
    };

    const hooks = {
        get stores() {
            try {
                const r = app._vnode.component.appContext.provides;
                return r[Object.getOwnPropertySymbols(r).find(t => r[t]._s)]._s;
            } catch (e) { return null; }
        },
        get world() { return this.stores?.get("gameState")?.gameWorld; },
        get player() { return this.world?.player; },
        get server() { return this.world?.server; }
    };

    // ==============================
    // STYLES (NEON BLUE FIX)
    // ==============================
    const injectStyles = () => {
        const css = `
        @font-face { font-family: "Product Sans"; src: url(https://fonts.gstatic.com/s/productsans/v19/pxiDypQkot1TnFhsFMOfGShVF9eO.woff2); }
        :root { --neon: #00e5ff; --dark: rgba(10, 10, 10, 0.95); --glow: 0 0 15px rgba(0, 229, 255, 0.6); }
        .fallen-gui { font-family: 'Product Sans', sans-serif !important; user-select: none; }
        .gui-panel { position: fixed; width: 190px; background: var(--dark); border-radius: 8px; z-index: 100000; border: 1px solid var(--neon); box-shadow: var(--glow); overflow: hidden; display: none; }
        .gui-header { height: 38px; font-weight: 900; display: flex; align-items: center; justify-content: center; font-size: 18px; cursor: grab; background: #000; color: var(--neon); border-bottom: 2px solid var(--neon); }
        .gui-button { height: 34px; display: flex; align-items: center; justify-content: space-between; padding: 0 10px; cursor: pointer; font-size: 14px; background: rgba(40, 40, 40, 0.9); color: #fff; border-bottom: 1px solid rgba(0,229,255,0.1); }
        .gui-button.enabled { background: rgba(0, 229, 255, 0.35); color: var(--neon); font-weight: bold; }
        .gui-settings { display: none; background: rgba(20, 20, 20, 0.95); padding: 8px; border-bottom: 1px solid var(--neon); }
        .setting-item { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; font-size: 11px; color: var(--neon); }
        .setting-input { width: 45px; background: #000; border: 1px solid var(--neon); color: #fff; text-align: center; border-radius: 3px; }
        #fallen-arraylist { position: fixed; top: 10px; right: 10px; display: flex; flex-direction: column; align-items: flex-end; z-index: 99999; pointer-events: none; }
        .array-item { background: rgba(0, 0, 0, 0.7); color: var(--neon); padding: 2px 12px; margin-bottom: 2px; font-weight: 900; font-size: 16px; border-right: 4px solid var(--neon); text-transform: lowercase; }
        #damage-display { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); color: var(--neon); font-size: 26px; font-weight: 900; z-index: 99999; text-shadow: 0 0 10px var(--neon), 2px 2px #000; display: none; }
        #fallen-keystrokes { position: fixed; bottom: 20px; left: 20px; display: none; flex-direction: column; gap: 4px; z-index: 99999; }
        .ks-row { display: flex; gap: 4px; justify-content: center; }
        .ks-key { width: 35px; height: 35px; background: rgba(0,0,0,0.7); border: 1px solid var(--neon); color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; border-radius: 4px; }
        .ks-key.active { background: var(--neon); color: #000; }
        .gui-background { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 99999; background: rgba(0,0,0,0.3); backdrop-filter: blur(4px); display: none; }
        `;
        const styleEl = document.createElement("style");
        styleEl.innerHTML = css;
        document.head.appendChild(styleEl);
    };

    // ==============================
    // MODULES SYSTEM
    // ==============================
    const modules = [];
    class Module {
        constructor(name, category, options = {}, desc = "") {
            this.name = name; this.category = category; this.options = options; this.desc = desc;
            this.enabled = false; this.keybind = null; this.waiting = false;
            modules.push(this);
        }
        toggle() {
            this.enabled = !this.enabled;
            if (this.enabled) this.onEnable(); else this.onDisable();
            bus.emit("module.update");
        }
        onEnable() {} onDisable() {} onRender() {}
    }

    // --- COMBAT ---
    const modAura = new (class extends Module {
        constructor() { super("Aura", "Combat", { Reach: 4.5, Delay: 100 }, "Auto-attack players."); this.last = 0; }
        onRender() {
            if (!this.enabled || !hooks.player || Date.now() - this.last < this.options.Delay) return;
            hooks.server?.players.forEach((en, id) => {
                if (en.isAlive && id !== hooks.player.id) {
                    let d = Math.hypot(hooks.player.position.x - en._model.position.x, hooks.player.position.z - en._model.position.z);
                    if (d <= this.options.Reach) {
                        let dx = en._model.position.x - hooks.player.position.x;
                        let dy = en._model.position.y - hooks.player.position.y;
                        let dz = en._model.position.z - hooks.player.position.z;
                        hooks.server.sendData(13, [hooks.world.time.localServerTimeMs, hooks.player.position.x, hooks.player.position.y + 1.5, hooks.player.position.z, dx, dy, dz, d, id]);
                        this.last = Date.now();
                    }
                }
            });
        }
    })();

    const modAim = new (class extends Module {
        constructor() { super("AimHelper", "Combat", { Range: 50 }, "Locks camera to player."); }
        onRender() {
            if (!this.enabled || !hooks.player) return;
            let target = null, minDist = this.options.Range;
            hooks.server?.players.forEach((en, id) => {
                if (en.isAlive && id !== hooks.player.id) {
                    let d = Math.hypot(hooks.player.position.x - en._model.position.x, hooks.player.position.z - en._model.position.z);
                    if (d < minDist) { minDist = d; target = en; }
                }
            });
            if (target && (hooks.player.inputs.leftMB || hooks.player.inputs.rightMB)) {
                let dx = target._model.position.x - hooks.player.position.x;
                let dz = target._model.position.z - hooks.player.position.z;
                hooks.player.rotation.y = (Math.atan2(dx, dz) + Math.PI) % (Math.PI * 2);
            }
        }
    })();

    new (class extends Module {
        constructor() { super("GunModifier", "Combat", { Bullets: 10, Firerate: 1 }, "Buff weapons."); }
        onRender() {
            if (!this.enabled) return;
            let s = hooks.world?.systemsManager?.activeSystems.find(e => e?.bulletsSystem)?.playerShooter?.currPlayerWeaponSpec;
            if (s) { s.bulletsPerShot = parseInt(this.options.Bullets); s.firerateMs = parseInt(this.options.Firerate); s.recoilAttackY = 0; s.recoilAttackX = 0; }
        }
    })();

    const createMassAttack = (name, count) => new (class extends Module {
        constructor() { super(name, "Combat", {}, "Attack server."); }
        onEnable() {
            hooks.server?.players.forEach((en, id) => { for(let i=0; i<count; i++) hooks.server.sendData(13, [hooks.world.time.localServerTimeMs+i, 0,0,0, 0,0,0, 2, id]); });
            this.toggle();
        }
    })();
    createMassAttack("1HitAll", 1); createMassAttack("2HitAll", 2);

    // --- MOVEMENT ---
    new (class extends Module {
        constructor() { super("Fly", "Movement", { Speed: 5 }, "Flight mode."); }
        onRender() {
            if (!this.enabled || !hooks.player) return;
            hooks.player.velocity.gravity = 0;
            if (hooks.player.inputs.jump) hooks.player.velocity.velVec3.y = this.options.Speed;
            else if (hooks.player.inputs.crouch) hooks.player.velocity.velVec3.y = -this.options.Speed;
            else hooks.player.velocity.velVec3.y = 0;
        }
        onDisable() { if (hooks.player) hooks.player.velocity.gravity = 23; }
    })();

    new (class extends Module {
        constructor() { super("Speed", "Movement", { Value: 15 }, "Run fast."); }
        onRender() { if (this.enabled && hooks.player) hooks.player.velocity.moveSpeed = parseFloat(this.options.Value); }
        onDisable() { if (hooks.player) hooks.player.velocity.moveSpeed = 4.5; }
    })();

    new (class extends Module {
        constructor() { super("Spider", "Movement", {}, "Climb walls."); }
        onRender() { if (this.enabled && hooks.player?.inputs.jump && (hooks.player.velocity.velVec3.x === 0 || hooks.player.velocity.velVec3.z === 0)) hooks.player.velocity.velVec3.y = 5; }
    })();

    // --- VISUAL & UTILS ---
    new Module("Arraylist", "Visual");
    new Module("Chams", "Visual");
    new (class extends Module {
        constructor() { super("DamageCounter", "Utils"); }
        onEnable() { document.getElementById("damage-display").style.display = "block"; }
        onDisable() { document.getElementById("damage-display").style.display = "none"; }
    })();

    new (class extends Module {
        constructor() { super("FreeMode", "Utils", {}, "Hide UI."); }
        onEnable() { [".stats", ".chat", ".hotbar", ".pause-cont"].forEach(s => document.querySelectorAll(s).forEach(el => el.style.visibility = "hidden")); }
        onDisable() { [".stats", ".chat", ".hotbar", ".pause-cont"].forEach(s => document.querySelectorAll(s).forEach(el => el.style.visibility = "visible")); }
    })();

    new (class extends Module {
        constructor() { super("Keystrokes", "Utils"); }
        onEnable() { document.getElementById("fallen-keystrokes").style.display = "flex"; }
        onDisable() { document.getElementById("fallen-keystrokes").style.display = "none"; }
    })();

    // --- RESOURCES & WORLD ---
    new (class extends Module {
        constructor() { super("AdBypass", "Resources"); }
        onRender() { let ads = hooks.stores?.get("adsStore"); if (ads) ads.rewardCommercialVideoWrapper = () => true; }
    })();

    new (class extends Module {
        constructor() { super("Instabreak", "World"); }
        onRender() { if(this.enabled) Object.values(hooks.world?.items || {}).forEach(e => { if(e?.destruction) e.destruction.durability = 0; }); }
    })();

    new (class extends Module {
        constructor() { super("Crafting", "Resources"); }
        onEnable() { 
            const pPos = Object.values(hooks.player.position).map(Math.floor);
            hooks.stores.get("inventoryState").setBackpackStates(0);
            const sys = hooks.world.systemsManager.activeSystems.find(i => i?.openOtherItem);
            setTimeout(() => sys.openOtherItem(pPos, 2), 50);
            this.toggle();
        }
    })();

    // ==============================
    // GUI RENDERING
    // ==============================
    const panels = [];
    function createGUI() {
        const categories = ["Combat", "Movement", "Visual", "Resources", "World", "Utils"];
        categories.forEach((cat, i) => {
            const panel = document.createElement("div"); panel.className = "gui-panel fallen-gui";
            panel.style.left = (20 + (i * 195)) + "px"; panel.style.top = "80px";
            const header = document.createElement("div"); header.className = "gui-header"; header.innerText = cat; panel.appendChild(header);
            
            modules.filter(m => m.category === cat).forEach(m => {
                const btn = document.createElement("div"); btn.className = "gui-button";
                btn.innerHTML = `<span>${m.name}</span><span class="bind" style="font-size:10px; opacity:0.5">${m.keybind || ''}</span>`;
                
                const setDiv = document.createElement("div"); setDiv.className = "gui-settings";
                if(m.desc) setDiv.innerHTML = `<div style="font-size:10px; color:#888; margin-bottom:5px;">${m.desc}</div>`;
                Object.keys(m.options).forEach(opt => {
                    let row = document.createElement("div"); row.className = "setting-item";
                    let input = typeof m.options[opt] === "boolean" ? `<input type="checkbox" ${m.options[opt]?'checked':''}>` : `<input type="text" class="setting-input" value="${m.options[opt]}">`;
                    row.innerHTML = `<span>${opt}</span>${input}`;
                    row.querySelector("input").onchange = (e) => { m.options[opt] = e.target.type === "checkbox" ? e.target.checked : e.target.value; };
                    setDiv.appendChild(row);
                });

                btn.onmousedown = (e) => {
                    if (e.button === 0) { m.toggle(); btn.classList.toggle("enabled", m.enabled); }
                    else if (e.button === 1) { e.preventDefault(); m.waiting = true; btn.querySelector(".bind").innerText = "..."; }
                    else if (e.button === 2) { e.preventDefault(); setDiv.style.display = setDiv.style.display === "block" ? "none" : "block"; }
                };
                panel.appendChild(btn); panel.appendChild(setDiv); m.element = btn;
            });
            document.body.appendChild(panel); panels.push(panel);
            // Drag logic
            let x=0,y=0,x1=0,y1=0; header.onmousedown=(e)=>{x1=e.clientX;y1=e.clientY;document.onmousemove=(e)=>{x=x1-e.clientX;y=y1-e.clientY;x1=e.clientX;y1=e.clientY;panel.style.top=(panel.offsetTop-y)+"px";panel.style.left=(panel.offsetLeft-x)+"px";};document.onmouseup=()=>{document.onmousemove=null;};};
        });
    }

    function updateArrayList() {
        const al = document.getElementById("fallen-arraylist"); if(!al) return; al.innerHTML = "";
        if(!modules.find(m => m.name === "Arraylist").enabled) return;
        modules.filter(m => m.enabled && m.name !== "Arraylist").sort((a,b) => b.name.length - a.name.length).forEach(m => {
            const item = document.createElement("div"); item.className = "array-item"; item.innerText = m.name; al.appendChild(item);
        });
    }

    // ==============================
    // PACKET & INPUT HANDLING
    // ==============================
    const OriginalWS = window.WebSocket;
    window.WebSocket = function(...args) {
        const ws = new OriginalWS(...args);
        ws.addEventListener("message", (e) => {
            try {
                let d = JSON.parse(typeof e.data === "string" ? e.data : new TextDecoder().decode(e.data));
                let dmgValue = d.damage || d.dmg || (d.hit && d.hit.damage);
                if (typeof dmgValue === "number") { totalDamage += dmgValue; document.getElementById("damage-display").innerText = "Damage: " + totalDamage; }
            } catch(ex){}
        });
        return ws;
    };

    document.addEventListener("keydown", (e) => {
        if (e.code === "ShiftRight") {
            const bg = document.querySelector(".gui-background");
            const show = bg.style.display !== "block";
            bg.style.display = show ? "block" : "none";
            panels.forEach(p => p.style.display = show ? "block" : "none");
            if(show) document.exitPointerLock?.();
        }
        document.getElementById("ks-" + e.code.replace("Key", ""))?.classList.add("active");
        modules.forEach(m => {
            if (m.waiting) { m.keybind = e.code; m.waiting = false; m.element.querySelector(".bind").innerText = e.code.replace("Key", ""); }
            else if (m.keybind === e.code) { m.toggle(); m.element.classList.toggle("enabled", m.enabled); }
        });
    });

    document.addEventListener("keyup", (e) => { document.getElementById("ks-" + e.code.replace("Key", ""))?.classList.remove("active"); });

    // ==============================
    // INIT
    // ==============================
    const initHUD = () => {
        const bg = document.createElement("div"); bg.className = "gui-background"; document.body.appendChild(bg);
        const al = document.createElement("div"); al.id = "fallen-arraylist"; al.className = "fallen-gui"; document.body.appendChild(al);
        const dd = document.createElement("div"); dd.id = "damage-display"; dd.className = "fallen-gui"; document.body.appendChild(dd);
        const ks = document.createElement("div"); ks.id = "fallen-keystrokes"; ks.className = "fallen-gui";
        ks.innerHTML = `<div class="ks-row"><div class="ks-key" id="ks-W">W</div></div><div class="ks-row"><div class="ks-key" id="ks-A">A</div><div class="ks-key" id="ks-S">S</div><div class="ks-key" id="ks-D">D</div></div>`;
        document.body.appendChild(ks);
    };

    injectStyles();
    initHUD();
    createGUI();
    bus.on("module.update", () => updateArrayList());
    setInterval(() => { modules.forEach(m => { if(m.enabled) m.onRender(); }); }, 1000 / 60);

    console.log("Fallen Utility v7.1 Loaded. Right Shift to Open.");
})();

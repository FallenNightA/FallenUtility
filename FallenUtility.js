// ==UserScript==
// @name         Fallen Utility
// @namespace    http://tampermonkey.net/
// @version      7.0
// @description  The Ultimate Combined Utility for Minefun.io
// @author       You & Zera & Wang
// @match        https://*.minefun.io/*
// @icon         https://raw.githubusercontent.com/FallenNightA/FallenUtility/main/icon.png
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ==============================
    // EVENT BUS (MINEBUNS CORE)
    // ==============================
    const bus = {
        listeners: {},
        on(event, cb) {
            if (!this.listeners[event]) this.listeners[event] = [];
            this.listeners[event].push(cb);
        },
        emit(event, data) {
            if (this.listeners[event]) this.listeners[event].forEach(cb => cb(data));
        }
    };

    // ==============================
    // GAME HOOKS (UNIVERSAL)
    // ==============================
    const hooks = {
        get stores() {
            try {
                let provides = app._vnode.component.appContext.provides;
                return provides[Object.getOwnPropertySymbols(provides).find(t => provides[t]._s)]._s;
            } catch (e) { return null; }
        },
        get gameWorld() { return this.stores?.get("gameState")?.gameWorld; },
        get player() { return this.gameWorld?.player; },
        get server() { return this.gameWorld?.server; }
    };

    // ==============================
    // BASE MODULE CLASS
    // ==============================
    class Module {
        constructor(name, category, options = {}, desc = "") {
            this.name = name;
            this.category = category;
            this.options = options;
            this.desc = desc;
            this.enabled = false;
            this.keybind = null;
            this.waitingForBind = false;
        }
        toggle() {
            this.enabled = !this.enabled;
            if (this.enabled) this.onEnable();
            else this.onDisable();
            bus.emit("module.update", this);
        }
        onEnable() {}
        onDisable() {}
        onRender() {}
    }

    // ==============================
    // COMBAT MODULES
    // ==============================

    class Aura extends Module {
        constructor() {
            super("Aura", "Combat", { Reach: 4.5, Delay: 80 }, "Attack players around you.");
            this.lastHit = 0;
        }
        onRender() {
            if (!hooks.player || Date.now() - this.lastHit < this.options.Delay) return;
            hooks.server?.players.forEach((en, id) => {
                if (en.isAlive && id !== hooks.player.id) {
                    let dist = Math.hypot(hooks.player.position.x - en._model.position.x, hooks.player.position.z - en._model.position.z);
                    if (dist <= this.options.Reach) {
                        let dx = en._model.position.x - hooks.player.position.x;
                        let dy = en._model.position.y - hooks.player.position.y;
                        let dz = en._model.position.z - hooks.player.position.z;
                        hooks.server.sendData(13, [hooks.gameWorld.time.localServerTimeMs, hooks.player.position.x, hooks.player.position.y + 1.5, hooks.player.position.z, dx, dy, dz, dist, id]);
                        this.lastHit = Date.now();
                    }
                }
            });
        }
    }

    class AimHelper extends Module {
        constructor() {
            super("AimHelper", "Combat", { Range: 50 }, "Lock aim on nearest target.");
        }
        onRender() {
            if (!hooks.player) return;
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
                let dy = target._model.position.y - hooks.player.position.y;
                hooks.player.rotation.y = (Math.atan2(dx, dz) + Math.PI) % (Math.PI * 2);
                hooks.player.rotation.x = -Math.atan2(dy, Math.hypot(dx, dz));
            }
        }
    }

    class GunModifier extends Module {
        constructor() {
            super("GunModifier", "Combat", { Spread: 0, Bullets: 10, Firerate: 1 }, "OP Weapon stats.");
        }
        onRender() {
            let spec = hooks.gameWorld?.systemsManager?.activeSystems.find(e => e?.bulletsSystem)?.playerShooter?.currPlayerWeaponSpec;
            if (spec) {
                spec.bulletsPerShot = parseInt(this.options.Bullets);
                spec.startSpread = parseFloat(this.options.Spread);
                spec.firerateMs = parseInt(this.options.Firerate);
                spec.recoilAttackY = 0; spec.recoilAttackX = 0;
            }
        }
    }

    class MassHit extends Module {
        constructor(name, hits) {
            super(name, "Combat", {}, "Attack everyone in server.");
            this.hits = hits;
        }
        onEnable() {
            if (!hooks.server) return;
            hooks.server.players.forEach((en, id) => {
                for (let i = 0; i < this.hits; i++) {
                    hooks.server.sendData(13, [hooks.gameWorld.time.localServerTimeMs + i, 0, 0, 0, 0, 0, 0, 2, id]);
                }
            });
            this.toggle();
        }
    }

    // ==============================
    // MOVEMENT MODULES
    // ==============================

    class Fly extends Module {
        constructor() {
            super("Fly", "Movement", { Speed: 5 }, "Defy gravity.");
        }
        onRender() {
            if (!hooks.player) return;
            hooks.player.velocity.gravity = 0;
            if (hooks.player.inputs.jump) hooks.player.velocity.velVec3.y = this.options.Speed;
            else if (hooks.player.inputs.crouch) hooks.player.velocity.velVec3.y = -this.options.Speed;
            else hooks.player.velocity.velVec3.y = 0;
        }
        onDisable() { if (hooks.player) hooks.player.velocity.gravity = 23; }
    }

    class Speed extends Module {
        constructor() {
            super("Speed", "Movement", { Value: 15 }, "Run very fast.");
        }
        onRender() {
            if (hooks.player) {
                hooks.player.velocity.moveSpeed = parseFloat(this.options.Value);
                hooks.player.velocity.fastMoveSpeed = parseFloat(this.options.Value);
            }
        }
        onDisable() {
            if (hooks.player) { hooks.player.velocity.moveSpeed = 4.5; hooks.player.velocity.fastMoveSpeed = 6.4; }
        }
    }

    class GhostMode extends Module {
        constructor() { super("GhostMode", "Movement", {}, "Locally invisible."); }
        onEnable() { if (hooks.player?.model) hooks.player.model.visible = false; }
        onDisable() { if (hooks.player?.model) hooks.player.model.visible = true; }
    }

    // ==============================
    // WORLD & RESOURCES
    // ==============================

    class AdBypass extends Module {
        constructor() { super("AdBypass", "Resources", {}, "Skip reward ads."); }
        onRender() {
            let ads = hooks.stores?.get("adsStore");
            if (ads) ads.rewardCommercialVideoWrapper = () => true;
        }
    }

    class Instabreak extends Module {
        constructor() { super("Instabreak", "World", {}, "Instant block break."); }
        onRender() {
            Object.values(hooks.gameWorld?.items || {}).forEach(e => {
                if (e?.destruction) e.destruction.durability = 0;
            });
        }
    }

    class MineExceptOres extends Module {
        constructor() { super("MineExceptOres", "World", { Radius: 3 }, "Nuker but keeps diamonds."); }
        onRender() {
            const p = hooks.player; if (!p) return;
            const r = parseInt(this.options.Radius);
            const ores = [581, 691, 830, 571, 652, 616];
            for (let x = -r; x <= r; x++)
                for (let y = -r; y <= r; y++)
                    for (let z = -r; z <= r; z++) {
                        let px = Math.floor(p.position.x) + x, py = Math.floor(p.position.y) + y, pz = Math.floor(p.position.z) + z;
                        let b = hooks.gameWorld.chunkManager.getBlock(px, py, pz);
                        if (b !== 0 && !ores.includes(b)) hooks.gameWorld.chunkManager.setBlock(px, py, pz, 0, true, true);
                    }
        }
    }

    // ==============================
    // UTILS & HUD
    // ==============================

    class FreeMode extends Module {
        constructor() { super("FreeMode", "Utils", {}, "Clean UI."); }
        onEnable() {
            const sel = [".stats", ".chat", ".hotbar", ".pause-cont", ".name-tag"];
            sel.forEach(s => document.querySelectorAll(s).forEach(el => el.style.visibility = "hidden"));
        }
        onDisable() {
            const sel = [".stats", ".chat", ".hotbar", ".pause-cont", ".name-tag"];
            sel.forEach(s => document.querySelectorAll(s).forEach(el => el.style.visibility = "visible"));
        }
    }

    class Keystrokes extends Module {
        constructor() { super("Keystrokes", "Utils", {}, "WASD overlay."); }
        onEnable() { document.getElementById("fallen-keystrokes").style.display = "flex"; }
        onDisable() { document.getElementById("fallen-keystrokes").style.display = "none"; }
    }

    // ==============================
    // GUI SYSTEM (MINEBUNS STYLE)
    // ==============================
    const modules = [
        new Aura(), new AimHelper(), new GunModifier(), new MassHit("1HitAll", 1), new MassHit("2HitAll", 2),
        new Fly(), new Speed(), new GhostMode(),
        new AdBypass(), new Instabreak(), new MineExceptOres(),
        new FreeMode(), new Keystrokes(),
        new Module("Arraylist", "Visual"), new Module("NoHunger", "Resources"), new Module("ChestStealer", "World")
    ];

    function updateArrayList() {
        const list = document.getElementById("fallen-arraylist");
        if (!list) return;
        list.innerHTML = "";
        modules.filter(m => m.enabled && m.name !== "Arraylist").sort((a, b) => b.name.length - a.name.length).forEach(m => {
            const item = document.createElement("div");
            item.className = "array-item";
            item.innerText = m.name;
            list.appendChild(item);
        });
    }

    function createGUI() {
        const cats = ["Combat", "Movement", "Visual", "Resources", "World", "Utils"];
        cats.forEach((cat, i) => {
            const panel = document.createElement("div");
            panel.className = "gui-panel fallen-gui";
            panel.style.left = (20 + (i * 195)) + "px";
            panel.style.top = "80px";

            const header = document.createElement("div");
            header.className = "gui-header";
            header.innerText = cat;
            panel.appendChild(header);

            modules.filter(m => m.category === cat).forEach(m => {
                const btn = document.createElement("div");
                btn.className = "gui-button";
                btn.innerHTML = `<span>${m.name}</span><span class="bind" style="font-size:10px; opacity:0.5">${m.keybind || ''}</span>`;
                
                const settings = document.createElement("div");
                settings.className = "gui-settings";
                if(m.desc) settings.innerHTML = `<div style="font-size:10px; color:#888; margin-bottom:4px;">${m.desc}</div>`;

                Object.keys(m.options).forEach(opt => {
                    const row = document.createElement("div");
                    row.className = "setting-item";
                    let input = typeof m.options[opt] === "boolean" ? `<input type="checkbox" ${m.options[opt]?'checked':''}>` : `<input type="text" class="setting-input" value="${m.options[opt]}">`;
                    row.innerHTML = `<span>${opt}</span>${input}`;
                    row.querySelector("input").onchange = (e) => { m.options[opt] = e.target.type === "checkbox" ? e.target.checked : e.target.value; };
                    settings.appendChild(row);
                });

                btn.onmousedown = (e) => {
                    if (e.button === 0) { m.toggle(); btn.classList.toggle("enabled", m.enabled); updateArrayList(); }
                    else if (e.button === 1) { e.preventDefault(); m.waitingForBind = true; btn.querySelector(".bind").innerText = "..."; }
                    else if (e.button === 2) { e.preventDefault(); settings.style.display = settings.style.display === "block" ? "none" : "block"; }
                };

                panel.appendChild(btn);
                panel.appendChild(settings);
                m.element = btn;
            });
            document.body.appendChild(panel);
            makeDraggable(panel, header);
        });
    }

    function makeDraggable(el, header) {
        let x = 0, y = 0, x1 = 0, y1 = 0;
        header.onmousedown = (e) => {
            x1 = e.clientX; y1 = e.clientY;
            document.onmousemove = (e) => {
                x = x1 - e.clientX; y = y1 - e.clientY;
                x1 = e.clientX; y1 = e.clientY;
                el.style.top = (el.offsetTop - y) + "px";
                el.style.left = (el.offsetLeft - x) + "px";
            };
            document.onmouseup = () => document.onmousemove = null;
        };
    }

    // ==============================
    // INITIALIZATION
    // ==============================
    const setupHUD = () => {
        const bg = document.createElement("div"); bg.className = "gui-background"; document.body.appendChild(bg);
        const al = document.createElement("div"); al.id = "fallen-arraylist"; al.className = "fallen-gui"; document.body.appendChild(al);
        const ks = document.createElement("div"); ks.id = "fallen-keystrokes"; ks.className = "fallen-gui";
        ks.innerHTML = `<div class="ks-row"><div class="ks-key" id="ks-W">W</div></div><div class="ks-row"><div class="ks-key" id="ks-A">A</div><div class="ks-key" id="ks-S">S</div><div class="ks-key" id="ks-D">D</div></div>`;
        document.body.appendChild(ks);
    };

    document.addEventListener("keydown", (e) => {
        if (e.code === "ShiftRight") {
            const show = document.querySelector(".gui-background").style.display !== "block";
            document.querySelector(".gui-background").style.display = show ? "block" : "none";
            document.querySelectorAll(".gui-panel").forEach(p => p.style.display = show ? "block" : "none");
            if(show) document.exitPointerLock?.();
        }
        document.getElementById("ks-" + e.code.replace("Key", ""))?.classList.add("active");
        modules.forEach(m => {
            if (m.waitingForBind) { m.keybind = e.code; m.waitingForBind = false; m.element.querySelector(".bind").innerText = e.code.replace("Key", ""); }
            else if (m.keybind === e.code) { m.toggle(); m.element.classList.toggle("enabled", m.enabled); updateArrayList(); }
        });
    });

    document.addEventListener("keyup", (e) => {
        document.getElementById("ks-" + e.code.replace("Key", ""))?.classList.remove("active");
    });

    setInterval(() => { modules.forEach(m => { if (m.enabled) m.onRender(); }); }, 1000 / 60);

    setupHUD();
    createGUI();
    updateArrayList();

    console.log("Fallen Utility v7.0 Loaded - Combined Power");
})();

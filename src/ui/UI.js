// Small UI helpers: the message log, the status bar (HUD), the end-of-game banner, the main menu,
// and a flag that tells the player whether keys should go to a window instead.
var UI = {
  lines: [], // the last few messages, newest last: { text, cls }

  show: function (text) {
    this.lines = text ? [{ text: text, cls: "" }] : [];
    this._drawLog();
  },
  // Add a line under the current ones (combat rolls, what Pedro does). cls: hit | hurt | miss | warn
  log: function (text, cls) {
    this.lines.push({ text: text, cls: cls || "" });
    if (this.lines.length > 4) { this.lines.shift(); }
    this._drawLog();
  },
  clear: function () {
    this.show("");
  },
  _drawLog: function () {
    var el = document.getElementById("message");
    el.innerHTML = "";
    this.lines.forEach(function (l) {
      var div = document.createElement("div");
      div.className = "msg " + l.cls;
      div.textContent = l.text;
      el.appendChild(div);
    });
  },

  // The status bar above the map: your HP, AC and attack, and the enemy's when you can see it.
  hud: function () {
    var el = document.getElementById("hud");
    var p = Game.player;
    if (!p) { el.innerHTML = ""; return; }
    el.innerHTML = "";
    var me = document.createElement("div");
    me.className = "hud-side";
    var atk = Combat.playerAttack(p);
    me.append(
      this._bar("HP", p.stats.hp, p.stats.maxHp, "#3fbf5f"),
      this._chip("AC " + p.getAC()),
      this._chip(atk.name + " " + Combat.signed(atk.bonus) + " (" + atk.dice + (atk.extra ? " +" + atk.extra : "") + ")")
    );
    me.append(
      this._bar("Food", Math.round(p.satiation), 100, p.satiation <= 25 ? "#d08020" : "#b09030"),
      this._bar("Fatigue", Math.round(p.fatigue), 100, p.fatigue >= 75 ? "#a04080" : "#6060a0"),
      this._chip((Clock.isNight() ? "\u263e " : "\u2600 ") + Clock.text(), "clock"),
      this._chip(this._where())
    );
    if (Game.level === Game.overworld) {
      var btn = this._chip((Game.showBorders ? "Hide" : "Show") + " borders (B)", "button" + (Game.showBorders ? " on" : ""));
      btn.addEventListener("click", function () { Game.toggleBorders(); });
      me.append(btn);
    }
    el.appendChild(me);
    this.factions();

    var e = Game.level && Game.enemyInSight();
    if (e) {
      var them = document.createElement("div");
      them.className = "hud-side enemy";
      them.append(
        this._chip(e.stats.name + " (" + e.stats.cls + ")"),
        this._bar("HP", e.stats.hp, e.stats.maxHp, "#d04040"),
        this._chip("AC " + e.getAC())
      );
      if (e.windup) { them.append(this._chip("WINDING UP!", "danger")); }
      else if (e.offBalance) { them.append(this._chip("off balance", "status")); }
      el.appendChild(them);
    }
  },
  _where: function () {
    var l = Game.level;
    if (!l) { return ""; }
    if (l.name === "town") {
      var t = l.poi;
      return t && t.stock ? l.townName + " \u00b7 pop. " + Economy.popText(t) + " \u00b7 " + Economy.goodsText(t) : l.townName;
    }
    if (l.name === "dungeon") { return (l.dungeon ? l.dungeon.name : "Dungeon") + ", level " + l.depth; }
    return "World map";
  },

  // The faction panel (left side of the screen) while the borders are shown on the world map:
  // each faction's treasury, soldiers and castle, and its towns with their people and goods.
  factions: function () {
    var el = document.getElementById("factions");
    var show = Game.running && Game.showBorders && Game.level === Game.overworld && Economy.factions.length > 0;
    el.hidden = !show;
    if (!show) { return; }
    el.innerHTML = "";
    Economy.factions.forEach(function (f) {
      var box = document.createElement("div");
      box.className = "faction";
      box.style.borderColor = f.color;
      var h = document.createElement("div");
      h.className = "faction-name";
      h.style.color = f.color;
      h.textContent = f.name;
      var who = document.createElement("div");
      who.className = "faction-meta";
      who.textContent = f.leader + " \u00b7 treasury " + Math.floor(f.treasury) + "g (taxes ~" + Math.round(f.taxRate || 0) + "g/day) \u00b7 " + f.soldiers + " soldiers" +
        (f.unpaid ? " (" + f.unpaid + " fired)" : "") + " \u00b7 castle " + Math.round(f.castle) + "%";
      box.append(h, who);
      f.towns.forEach(function (t) {
        var row = document.createElement("div");
        row.className = "faction-town";
        row.textContent = (t.capital ? "\u03a9 " : "\u2302 ") + t.name + " \u2014 " + Economy.popText(t) + " \u2014 " + Economy.goodsText(t) +
          " \u2014 " + Math.round(t.income) + "g/day" + (t.hungry ? " \u2014 hungry!" : "");
        box.appendChild(row);
      });
      el.appendChild(box);
    });
    if (Economy.news.length) {
      var news = document.createElement("div");
      news.className = "faction-news";
      news.textContent = Economy.news.map(function (n) { return "Day " + n.day + ": " + n.text; }).join("\n");
      el.appendChild(news);
    }
  },

  _chip: function (text, cls) {
    var s = document.createElement("span");
    s.className = "chip " + (cls || "");
    s.textContent = text;
    return s;
  },
  _bar: function (label, value, max, color) {
    var wrap = document.createElement("span");
    wrap.className = "bar";
    var fill = document.createElement("span");
    fill.className = "fill";
    fill.style.width = Math.round(100 * value / max) + "%";
    fill.style.background = color;
    var text = document.createElement("span");
    text.className = "bar-text";
    text.textContent = label + " " + value + "/" + max;
    wrap.append(fill, text);
    return wrap;
  },

  // True while the main menu, a chest or a shop window is open (the inventory alone doesn't block walking).
  isBlocking: function () {
    return Menu.isOpen() || InventoryUI.chest !== null || InventoryUI.shop !== null;
  },

  banner: function (title, sub) {
    var el = document.getElementById("banner");
    el.querySelector("h2").textContent = title;
    el.querySelector("p").textContent = sub;
    el.hidden = false;
    setTimeout(function () { el.hidden = true; }, 2500);
  }
};

// The main menu.
var Menu = {
  el: null,
  isOpen: function () { return !!this.el && !this.el.hidden; },

  init: function () {
    this.el = document.getElementById("menu");
    var self = this;
    document.getElementById("menu-new").addEventListener("click", function () { self.newWorld(); });
    document.getElementById("menu-resume").addEventListener("click", function () { self.close(); });
    document.getElementById("menu-controls").addEventListener("click", function () {
      var c = document.getElementById("menu-help");
      c.hidden = !c.hidden;
    });
    document.getElementById("menu-quit").addEventListener("click", function () { window.close(); });
    this.open();
  },

  open: function () {
    document.getElementById("menu-resume").hidden = !Game.running;
    this.el.hidden = false;
    document.getElementById(Game.running ? "menu-resume" : "menu-new").focus();
  },

  close: function () {
    this.el.hidden = true;
    if (document.activeElement) { document.activeElement.blur(); }
  },

  newWorld: function () {
    this.close();
    Game.newWorld();
  }
};

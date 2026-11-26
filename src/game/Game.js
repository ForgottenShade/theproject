// The Game object ties it all together. The world map (overworld) holds two towns and two
// dungeons; each town and each dungeon level is its own level with its own scheduler, and one
// engine runs whichever level you're on. Every map is 160 x 50 cells. The camera shows a window
// of it (zoom with + / - or the mouse wheel) that follows the player.
var Game = {
  WIDTH: 160,
  HEIGHT: 50,
  // Zoom levels: how many cells the camera shows. The first one is the whole map.
  ZOOMS: [[160, 50], [128, 40], [96, 30], [80, 25], [64, 20], [48, 15], [32, 10]],
  zoom: 3,
  display: null,
  engine: null,
  player: null,
  pedro: null,
  overworld: null,
  dungeon: null,  // the dungeon level you're on (or were on last)
  level: null,    // the level the player is on now
  running: false, // false before the first world and after winning or losing
  visible: {},    // cells the player can see this turn (dungeon only)
  hover: null,    // the map cell under the mouse, as [x, y]
  _lightCache: {},

  init: function () {
    this.display = new ROT.Display({ width: 80, height: 25, fontSize: 18 });
    var canvas = this.display.getContainer();
    document.getElementById("game").appendChild(canvas);
    this.setZoom(this.zoom);

    // Mouse: click a cell to walk there (click an enemy to attack it, a townsperson to talk or
    // trade, yourself to use what's here). The wheel zooms.
    var self = this;
    canvas.addEventListener("click", function (e) {
      if (!self.running || !self.player || UI.isBlocking()) { return; }
      var pos = self.screenToMap(self.display.eventToPosition(e));
      if (!pos) { return; }
      self.player.travelTo(pos[0], pos[1]);
    });
    canvas.addEventListener("mousemove", function (e) {
      if (!self.running || UI.isBlocking()) { return; }
      var h = self.screenToMap(self.display.eventToPosition(e));
      if (String(h) !== String(self.hover)) { self.hover = h; self.render(); }
    });
    canvas.addEventListener("mouseleave", function () {
      if (self.hover && self.running) { self.hover = null; self.render(); }
    });
    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      self.zoomBy(e.deltaY > 0 ? -1 : 1);
    }, { passive: false });
    // Refit the view when the window changes size (once per frame at most).
    var pending = false;
    window.addEventListener("resize", function () {
      if (pending) { return; }
      pending = true;
      requestAnimationFrame(function () { pending = false; self.fit(); });
    });
  },

  // ---- Camera ----

  // The view fills the space between the status bar and the message log. A zoom level sets the
  // smallest part of the map that must fit (ZOOMS[i] cells): the font is the biggest that fits
  // that span, then the view grows to fill the rest of the window (never past the map's edges).
  // fit() runs again whenever the window changes size or you go to a level of another size.
  view: [80, 25],

  setZoom: function (i) {
    this.zoom = Math.max(0, Math.min(this.ZOOMS.length - 1, i));
    this.fit();
  },

  fit: function () {
    var box = document.getElementById("game");
    var availW = Math.max(200, box.clientWidth - 4), availH = Math.max(120, box.clientHeight - 4);
    var W = this.level ? this.level.width : this.WIDTH, H = this.level ? this.level.height : this.HEIGHT;
    var z = this.ZOOMS[this.zoom];
    var span = [Math.min(z[0], W), Math.min(z[1], H)];
    this.display.setOptions({ width: span[0], height: span[1] });
    var font = Math.max(6, this.display.computeFontSize(availW, availH));
    this.display.setOptions({ fontSize: font });
    var size = this.display.computeSize(availW, availH);
    this.view = [Math.max(span[0], Math.min(W, size[0])), Math.max(span[1], Math.min(H, size[1]))];
    this.display.setOptions({ width: this.view[0], height: this.view[1] });
    if (this.running && this.level && this.player) { this.render(); }
  },

  // dir +1 zooms in (fewer, bigger cells), -1 zooms out.
  zoomBy: function (dir) {
    this.setZoom(this.zoom + dir);
  },

  // Top-left map cell the camera shows: centred on the player, kept inside the map.
  camera: function () {
    var z = this.view;
    var W = this.level ? this.level.width : this.WIDTH, H = this.level ? this.level.height : this.HEIGHT;
    var p = this.player;
    var ox = 0, oy = 0;
    if (p && z[0] < W) { ox = Math.max(0, Math.min(W - z[0], p.getX() - Math.floor(z[0] / 2))); }
    if (p && z[1] < H) { oy = Math.max(0, Math.min(H - z[1], p.getY() - Math.floor(z[1] / 2))); }
    return [ox, oy];
  },

  screenToMap: function (pos) {
    if (!pos || pos[0] < 0) { return null; }
    var c = this.camera();
    return [pos[0] + c[0], pos[1] + c[1]];
  },

  // ---- Time ----

  hour: function () { return Clock.hour(); },

  passTime: function (minutes, asleep) {
    Clock.advance(minutes, asleep);
    Economy.advance(minutes); // towns, caravans and tax collectors, once per game hour
  },

  // ---- Worlds and levels ----

  // A brand new world. Towns and dungeon levels are made the first time you go in.
  newWorld: function () {
    if (this.engine) { this.engine.lock(); }
    if (this.player) { this.player.stopListening(); }
    this.dungeon = null;
    this.pedro = null;
    this.running = true;
    Clock.reset();

    this.overworld = Overworld.generate(this.WIDTH, this.HEIGHT);
    Economy.init(this.overworld);
    this.overworld.scheduler = new ROT.Scheduler.Simple(); // just the player: caravans move with the clock
    this.player = new Player(this.overworld.start[0], this.overworld.start[1]);
    this.overworld.scheduler.add(this.player, true);

    var ab = this.player.stats.abilities;
    UI.show("The town of Caracas (⌂) is just nearby: press E on it to go in. Ω are capitals, > dungeons, C caravans (walk into one to trade), $ tax collectors. B shows the borders. Roads are twice as quick.");
    UI.log("Your fighter rolled (4d6, drop lowest): " + Combat.ABILITIES.map(function (k) {
      return k.toUpperCase() + " " + ab[k];
    }).join(", ") + ". HP " + this.player.stats.maxHp + ", AC " + this.player.getAC() + ".");
    InventoryUI.refresh();
    this._switchTo(this.overworld, this.overworld.start);
  },

  // The overworld place at (x, y), if any: { kind: "town"|"dungeon", name, ... }.
  poiAt: function (x, y) {
    return this.overworld && this.overworld.pois[x + "," + y];
  },

  _newScheduler: function (level) {
    level.scheduler = new ROT.Scheduler.Simple();
    level.scheduler.add(this.player, true);
    level.beings.forEach(function (b) { level.scheduler.add(b, true); });
  },

  // Go into the town at overworld position `pos` (default: the home town).
  enterTown: function (pos) {
    pos = pos || this.overworld.town;
    var poi = this.poiAt(pos[0], pos[1]);
    if (!poi.level) {
      // A capital is twice the area of a town (sqrt 2 times as wide and as tall).
      var W = poi.capital ? Math.round(this.WIDTH * Math.SQRT2) : this.WIDTH, H = poi.capital ? Math.round(this.HEIGHT * Math.SQRT2) : this.HEIGHT;
      poi.level = Town.generate(W, H, poi.name, poi);
      poi.level.worldPos = pos;
      this._newScheduler(poi.level);
    }
    var town = poi.level;
    Town.syncGuards(town);
    town.beings.forEach(function (b) { b.placeForTime(); });
    var fac = poi.faction !== undefined ? Economy.faction(poi.faction) : null;
    UI.show("You walk into " + poi.name + (fac ? (poi.capital ? ", capital of the " : ", a town of the ") + fac.name + " (pop. " + Economy.popText(poi) + ")" : "") +
      ". Shops: the tavern (beds, food), the blacksmith and the general store (it trades goods too)." +
      (poi.capital ? " The castle is in the middle: " + fac.leader + " sits on the throne." : "") + " X or the map edge leaves.");
    this._switchTo(town, town.start);
  },

  leaveTown: function () {
    var pos = this.level.worldPos;
    UI.show("You leave " + this.level.townName + " and head out into the wilds.");
    this._switchTo(this.overworld, pos);
  },

  // Go down into the dungeon at overworld position `pos` (default: the one with the ananas).
  enterDungeon: function (pos) {
    pos = pos || this.overworld.entrance;
    var poi = this.poiAt(pos[0], pos[1]);
    if (!poi.levels) { poi.levels = []; poi.worldPos = pos; }
    UI.show("You enter " + poi.name + " (level 1 of " + GameMap.DEPTH + "). F attacks, Q dodges. Stairs > lead deeper, < back up." +
      (poi.ananas ? " The ananas is somewhere at the bottom." : ""));
    var level = this._dungeonLevel(poi, 1);
    this._switchTo(level, level.start);
  },

  // Level `depth` (1 = top) of a dungeon, made the first time it's visited.
  _dungeonLevel: function (poi, depth) {
    if (!poi.levels[depth - 1]) {
      var level = GameMap.generate(this.WIDTH, this.HEIGHT, {
        depth: depth, deepest: depth === GameMap.DEPTH, ananas: poi.ananas, dungeon: poi
      });
      if (level.pedro) { this.pedro = level.pedro; }
      this._newScheduler(level);
      poi.levels[depth - 1] = level;
    }
    return poi.levels[depth - 1];
  },

  // Take the stairs on the current dungeon level: dir +1 = down (>), -1 = up (<).
  takeStairs: function (dir) {
    var level = this.level;
    var poi = level.dungeon;
    var depth = level.depth + dir;
    if (depth < 1) {
      UI.show("You climb back out into the daylight.");
      this._switchTo(this.overworld, poi.worldPos);
      return;
    }
    var next = this._dungeonLevel(poi, depth);
    UI.show(dir > 0 ? "You go down to level " + depth + ". It feels more dangerous here." : "You climb up to level " + depth + ".");
    this._switchTo(next, dir > 0 ? next.start : next.down);
  },

  // Older name, kept for the selftest: climbing out of the dungeon from wherever you are.
  leaveDungeon: function () {
    var poi = this.level.dungeon;
    UI.show("You climb back out into the daylight.");
    this._switchTo(this.overworld, poi.worldPos);
  },

  // Called whenever the player's bag changes: carrying the ananas wins the game.
  checkWin: function () {
    if (this.running && this.player.inventory.count("ananas") > 0) {
      this.running = false;
      this.engine.lock();
      this.player.stopListening();
      InventoryUI.closeChest();
      UI.show("Hooray! You got the ananas and won this game. Press Esc for the menu.");
      UI.banner("You found the ananas!", "Pedro will be furious.");
    }
  },

  gameOver: function (text, title, sub) {
    this.running = false;
    this.engine.lock();
    this.player.stopListening();
    InventoryUI.closeChest();
    InventoryUI.closeShop();
    this.render();
    UI.log(text + " Press Esc for the menu.", "hurt");
    UI.banner(title || "Game over", sub || "");
  },

  // A monster died: take it out of the turn order and leave its gear on the floor.
  monsterDied: function (monster) {
    var level = monster.level;
    level.scheduler.remove(monster);
    var i = level.beings.indexOf(monster);
    if (i >= 0) { level.beings.splice(i, 1); }
    var key = monster.getX() + "," + monster.getY();
    var drops = monster.stats.drops || [];
    var loot = [];
    if (monster.stats.boss) { loot = drops.slice(); }
    else if (drops.length && ROT.RNG.getUniform() < 0.35) { loot.push(drops[Math.floor(ROT.RNG.getUniform() * drops.length)]); }
    var gold = ROT.RNG.getUniform() < 0.6 || monster.stats.boss ? Dice.roll("2d6").total * (level.depth || 1) : 0;
    if (!loot.length && !gold) { return; }
    var pile = level.chests[key];
    if (!pile) {
      pile = new Container(monster.stats.boss ? "Pedro's remains" : "Remains of a " + monster.stats.name.toLowerCase(), 4, 2);
      pile.glyph = "%";
      level.chests[key] = pile;
    }
    loot.forEach(function (id) { pile.add(id, 1); });
    if (gold) { pile.add("gold", gold); }
  },

  // Can the player see this being right now?
  canPlayerSee: function (being) {
    if (being.level && being.level !== this.level) { return false; }
    if (!this.level.fog) { return true; }
    if (!this.visible) { return false; }
    return !!this.visible[being.getX() + "," + being.getY()];
  },

  // The nearest hostile the player can see, if any.
  enemyInSight: function () {
    if (!this.level || !this.level.beings) { return null; }
    if (this.level.fog && !this.visible) { this.visible = Sight.compute(this.level, this.player.getX(), this.player.getY()); }
    var p = this.player, best = null, bd = Infinity;
    this.level.beings.forEach(function (b) {
      if (!b.hostile || !b.isAlive() || !this.canPlayerSee(b)) { return; }
      var d = p.distanceTo(b);
      if (d < bd) { bd = d; best = b; }
    }, this);
    return best;
  },

  // Put the player on `level` at `pos`, and run that level's scheduler.
  _switchTo: function (level, pos) {
    if (this.engine) { this.engine.lock(); }
    this.level = level;
    if (level.name === "dungeon") { this.dungeon = level; }
    this.hover = null;
    this.visible = null;
    this.player.stopTravel();
    this.player._x = pos[0];
    this.player._y = pos[1];
    this.fit();
    this.engine = new ROT.Engine(level.scheduler);
    this.engine.start(); // the player acts first, which draws the screen
  },

  cellAt: function (x, y) {
    return this.level.cells[x + "," + y];
  },

  // Who's standing at (x, y) on `level` (default: the current level), apart from the player.
  beingAt: function (x, y, level) {
    level = level || this.level;
    if (!level || !level.beings) { return null; }
    for (var i = 0; i < level.beings.length; i++) {
      var b = level.beings[i];
      if (b.getX() === x && b.getY() === y && b.isAlive()) { return b; }
    }
    return null;
  },

  // What the scenery at a cell looks like: ground, with a chest on top if there is one.
  _look: function (key) {
    var cell = this.level.cells[key];
    var look = { ch: cell.ch, fg: cell.fg, bg: cell.bg, indoor: cell.indoor };
    var chest = this.level.chests[key];
    if (chest) {
      look.ch = chest.glyph || "*";
      look.fg = chest.isEmpty() ? "#7a6a50" : "#ffd24a";
    }
    return look;
  },

  // ---- Faction borders (B on the world map) ----

  showBorders: false,
  _borderCache: {},

  toggleBorders: function (on) {
    this.showBorders = on === undefined ? !this.showBorders : !!on;
    UI.factions();
    if (this.running) { this.render(); }
  },

  // Tint the ground with its faction's colour; the cells along a border get a strong edge.
  _borderLook: function (level, x, y, look) {
    var f = level.owner[x + "," + y];
    if (f === undefined) { return look; }
    var edge = false;
    for (var i = 0; i < 8 && !edge; i += 2) {
      var o = level.owner[(x + ROT.DIRS[8][i][0]) + "," + (y + ROT.DIRS[8][i][1])];
      if (o !== undefined && o !== f) { edge = true; }
    }
    var color = Economy.faction(f).color;
    var key = look.bg + color + edge;
    var bg = this._borderCache[key];
    if (!bg) {
      bg = ROT.Color.toHex(ROT.Color.interpolate(ROT.Color.fromString(look.bg), ROT.Color.fromString(color), edge ? 0.75 : 0.35));
      this._borderCache[key] = bg;
    }
    return { ch: look.ch, fg: look.fg, bg: bg, indoor: look.indoor };
  },

  // Outdoors, colours are tinted by the time of day (indoor tiles keep their own light).
  _lit: function (color, light, lightKey) {
    if (!color || !light) { return color; }
    var key = lightKey + color;
    var c = this._lightCache[key];
    if (!c) {
      c = ROT.Color.toHex(ROT.Color.multiply(ROT.Color.fromString(color), light));
      this._lightCache[key] = c;
    }
    return c;
  },

  // Redraw the screen: the part of the level the camera shows. In a dungeon, only what the
  // player can see is drawn as it is now; the rest is drawn from memory (dimmed), or not at all.
  render: function () {
    var level = this.level;
    var p = this.player;
    this.display.clear();
    var z = this.view;
    var cam = this.camera();
    var light = level.outdoor ? Clock.light() : null;
    var lightKey = light ? light.join(",") + "|" : "";
    if (Object.keys(this._lightCache).length > 20000) { this._lightCache = {}; }

    if (level.fog) {
      this.visible = Sight.compute(level, p.getX(), p.getY());
      for (var key in this.visible) {
        if (level.cells[key]) { level.memory[key] = this._look(key); }
      }
    } else {
      this.visible = null;
    }
    var borders = this.showBorders && level === this.overworld && level.owner;
    var self = this;
    var draw = function (x, y, ch, fg, bg, indoor) {
      var sx = x - cam[0], sy = y - cam[1];
      if (sx < 0 || sy < 0 || sx >= z[0] || sy >= z[1]) { return; }
      if (light && !indoor) { fg = self._lit(fg, light, lightKey); bg = self._lit(bg, light, lightKey); }
      self.display.draw(sx, sy, ch, fg, bg);
    };

    for (var sy = 0; sy < z[1]; sy++) {
      for (var sx = 0; sx < z[0]; sx++) {
        var x = sx + cam[0], y = sy + cam[1];
        var k = x + "," + y;
        var look;
        if (level.fog) {
          if (!level.memory[k]) { continue; }
          look = this.visible[k] ? level.memory[k] : Sight.dim(level.memory[k]);
        } else {
          if (!level.cells[k]) { continue; }
          look = this._look(k);
          if (borders) { look = this._borderLook(level, x, y, look); }
        }
        draw(x, y, look.ch, look.fg, look.bg, look.indoor);
      }
    }

    // The tell for a heavy attack: the cell it will land on glows red (if you can see the attacker).
    var dangers = {};
    (level.beings || []).forEach(function (b) {
      if (b.windup && b.isAlive() && this.canPlayerSee(b)) {
        var dk = b.windup.x + "," + b.windup.y;
        dangers[dk] = true;
        var dl = this._look(dk);
        draw(b.windup.x, b.windup.y, dl.ch, "#ffffff", "#b01010", true);
      }
    }, this);

    // The cell under the mouse.
    if (this.hover) {
      var hkey = this.hover.join(",");
      var hl = level.fog ? level.memory[hkey] : (level.cells[hkey] && this._look(hkey));
      if (hl) {
        var hbg = ROT.Color.toHex(ROT.Color.add(ROT.Color.fromString(hl.bg), [45, 45, 60]));
        draw(this.hover[0], this.hover[1], hl.ch, hl.fg, hbg, hl.indoor);
      }
    }

    // Beings on top: the player always, everyone else when in sight.
    var beings = [p].concat(level.beings || []);
    beings.forEach(function (b) {
      if (b !== p && (!b.isAlive() || !this.canPlayerSee(b))) { return; }
      var bkey = b.getX() + "," + b.getY();
      var cell = level.cells[bkey];
      if (dangers[bkey]) { draw(b.getX(), b.getY(), b.getChar(), b.getColor(), "#b01010", true); return; }
      draw(b.getX(), b.getY(), b.getChar(), b.getColor(), cell ? cell.bg : null, cell && cell.indoor);
    }, this);
    UI.hud();
  }
};

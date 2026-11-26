// Town folk.
//   Shopkeepers stand in their shop and sell to you: walk into one (or click them) to trade.
//   Villagers have a home and a job. From 7:00 to 18:00 they walk to work (a field, or one of
//   the shops) and potter about there; the rest of the time they walk home and stay in.
//   Walk into a villager to say hello.
// One step per turn, along an A* path (diagonals allowed) that goes around other people.
var Villager = function (x, y, opts) {
  var role = opts.role;
  var color = { shopkeeper: "#ff8adf", farmer: "#9adf6a", leader: "#ffd24a", soldier: "#c8d0e0" }[role] || "#7fd0ff";
  Entity.call(this, x, y, "@", color);
  this.name = opts.name;
  this.role = role;        // shopkeeper | farmer | helper | leader | soldier
  this.faction = opts.faction || null;
  this.shop = opts.shop || null;
  this.work = opts.work;   // { inside: [[x, y]...] } a building or a field
  this.home = opts.home;
  this.level = opts.level;
  this.hostile = false;
  this.stats = { name: opts.name };
  this.goal = null;
  this.path = null;
};
Villager.prototype = Object.create(Entity.prototype);
Villager.prototype.constructor = Villager;

Villager.WORK_START = 7;
Villager.WORK_END = 18;

Villager.LINES = [
  "Lovely weather for it.",
  "Mind the orcs if you go down any cellars.",
  "The blacksmith's prices are a crime, but her blades are good.",
  "They say Pedro guards a golden pineapple down in his cellar.",
  "Back to work, back to work...",
  "The stew at the tavern will fix whatever's wrong with you.",
  "Get some sleep, traveller. You look dreadful."
];

Villager.prototype.isAlive = function () { return true; };

// Where this person should be at the given hour: "work" or "home".
Villager.prototype.placeFor = function (hour) {
  if (this.role === "shopkeeper" || this.role === "leader" || this.role === "soldier") { return "work"; }
  return hour >= Villager.WORK_START && hour < Villager.WORK_END ? "work" : "home";
};

Villager.prototype._area = function () {
  return this.placeFor(Game.hour()) === "work" ? this.work : this.home;
};

Villager.prototype._inArea = function (area) {
  var x = this._x, y = this._y;
  return area.inside.some(function (c) { return c[0] === x && c[1] === y; });
};

// Put them straight where they'd be at this time (when you arrive in town, or after sleeping).
Villager.prototype.placeForTime = function () {
  if (this.role === "shopkeeper" || this.role === "leader") { return; }
  var area = this._area();
  var level = this.level;
  var free = area.inside.filter(function (c) {
    var cell = level.cells[c[0] + "," + c[1]];
    return cell.passable && !Game.beingAt(c[0], c[1], level);
  });
  if (free.length) {
    var c = free[Math.floor(ROT.RNG.getUniform() * free.length)];
    this._moveTo(c[0], c[1]);
  }
  this.goal = null;
  this.path = null;
};

Villager.prototype.act = function () {
  if (!Game.running || Game.level !== this.level) { return; }
  if (this.role === "shopkeeper" || this.role === "leader") { return; } // they mind the counter (or the throne)
  var area = this._area();
  if (this._inArea(area)) {
    this.path = null;
    // Potter about: now and then, a step to a random spot nearby in the same area.
    if (ROT.RNG.getUniform() < 0.2) {
      var self = this;
      var near = area.inside.filter(function (c) { return Math.max(Math.abs(c[0] - self._x), Math.abs(c[1] - self._y)) === 1; });
      var c = near[Math.floor(ROT.RNG.getUniform() * near.length)];
      if (c && this.level.cells[c[0] + "," + c[1]].passable && !Game.beingAt(c[0], c[1], this.level)) { this._moveTo(c[0], c[1]); }
    }
    return;
  }
  // On the way: pick a spot in the area and walk there.
  if (!this.goal || !area.inside.some(function (c) { return c === this.goal; }, this)) {
    var spots = area.inside.filter(function (c) { return this.level.cells[c[0] + "," + c[1]].passable; }, this);
    this.goal = spots[Math.floor(ROT.RNG.getUniform() * spots.length)];
    this.path = null;
  }
  this._step();
};

Villager.prototype._step = function () {
  var level = this.level;
  var self = this;
  var goal = this.goal;
  if (!this.path || !this.path.length) { this.path = this._findPath(goal, false); }
  if (!this.path || !this.path.length) { return; }
  var next = this.path[0];
  if (Game.beingAt(next[0], next[1], level)) {
    // Someone's in the way: find a way around them.
    this.path = this._findPath(goal, true);
    if (!this.path || !this.path.length) { return; }
    next = this.path[0];
    if (Game.beingAt(next[0], next[1], level)) { return; }
  }
  this.path.shift();
  self._moveTo(next[0], next[1]);
};

Villager.prototype._findPath = function (goal, avoidPeople) {
  var level = this.level;
  var self = this;
  var astar = new ROT.Path.AStar(goal[0], goal[1], function (x, y) {
    var cell = level.cells[x + "," + y];
    if (!cell || !cell.passable) { return false; }
    if (avoidPeople && !(x === self._x && y === self._y)) {
      var b = Game.beingAt(x, y, level);
      if (b) { return false; }
    }
    return true;
  }, { topology: 8 });
  var path = [];
  astar.compute(this._x, this._y, function (x, y) { path.push([x, y]); });
  path.shift();
  return path;
};

// Walking into them: shopkeepers trade, everyone else chats.
Villager.prototype.interact = function () {
  if (this.role === "shopkeeper") {
    InventoryUI.openShop(this.level.shops[this.shop]);
    return;
  }
  if (this.role === "leader") { UI.show(this._report()); return; }
  if (this.role === "soldier") {
    var f = this.faction;
    UI.show("Guard of the " + f.name + ": \u201c" + (f.unpaid ? "They sent " + f.unpaid + " of the lads home last night. No money for wages." :
      f.soldiers < 10 ? "We're spread thin. " + f.soldiers + " of us to hold the whole castle." : "Move along. " + f.soldiers + " of us keep the peace here.") + "\u201d");
    return;
  }
  var town = this.level.poi;
  if (town && town.stock && ROT.RNG.getUniform() < 0.5) {
    UI.show(this.name + ": \u201c" + Villager.townTalk(town) + "\u201d");
    return;
  }
  var line = Villager.LINES[Math.floor(ROT.RNG.getUniform() * Villager.LINES.length)];
  var job = this.role === "farmer" ? "a farmer" : "works at the " + (this.work.name || "shops").toLowerCase();
  UI.show(this.name + " (" + job + "): “" + line + "”");
};

// What the ruler says when you walk up to the throne: the state of the realm.
Villager.prototype._report = function () {
  var f = this.faction;
  var towns = f.towns.map(function (t) { return t.name + " (" + Economy.popText(t) + ")"; }).join(", ");
  return this.name + " of the " + f.name + ": \u201cOur treasury holds " + Math.floor(f.treasury) + " gold. " + f.soldiers +
    " soldiers guard this castle" + (f.unpaid ? ", " + f.unpaid + " fewer since we couldn't pay them" : "") + ", and its walls stand at " +
    Math.round(f.castle) + "%. Our towns: " + towns + ".\u201d";
};

// Townsfolk gossip about their town's trade.
Villager.townTalk = function (t) {
  if (t.hungry) { return "There's no grain left in " + t.name + ". People are leaving for the other towns."; }
  if (t.forgeIdle) { return "The forge is cold: not an ingot of metal in the whole town."; }
  var dear = null, cheap = null;
  Economy.GOODS.forEach(function (g) {
    var r = Economy.rawPrice(t, g) / Economy.BASE[g];
    if (!dear || r > dear.r) { dear = { g: g, r: r }; }
    if (!cheap || r < cheap.r) { cheap = { g: g, r: r }; }
  });
  if (dear.r >= 1.5) { return Items.get(dear.g).name + "? We'd pay good money for it here. " + Economy.buyPrice(t, dear.g) + " gold apiece at the store."; }
  if (cheap.r <= 0.6) { return "We've more " + Items.get(cheap.g).name.toLowerCase() + " than we know what to do with. Cheap at the store."; }
  return "We make " + Economy.goodsText(t) + " here. " + Economy.popText(t) + " souls and counting.";
};

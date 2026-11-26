// Part 2: the player, who waits for a key (or a mouse click) each turn.
// Part 3 (reworked): chests are opened with the interact key and looted through the chest window.
// The dungeon entrance (>) and the stairs (<) also need the interact key.
// Combat (5e-style, see src/systems/Combat.js): F attacks, Q dodges, walking into an enemy attacks it.
// Clicking a cell walks there along the shortest known path, and stops if an enemy comes into view.
var Player = function (x, y) {
  Entity.call(this, x, y, "@", "#ff0");
  this.stats = Combat.rollPlayer();
  this.equipment = { weapon: "dagger", armor: "leather_armor", shield: null, cloak: null };
  this.dodging = false;    // the Dodge action: lasts until the start of your next turn
  this.path = null;        // click-to-move: the cells still to walk, as [x, y]
  this._myTurn = false;    // true while the game is waiting for us
  this._travelTimer = null;
  this.satiation = 100;    // 0-100: food and drink (see src/systems/Clock.js)
  this.fatigue = 0;        // 0-100: tiredness; sleep resets it

  this.inventory = new Container("Inventory", 4, 4);
  // Something to start with.
  this.inventory.add("potion_heal", 2);
  this.inventory.add("bread", 3);
  this.inventory.add("rations", 2);
  this.inventory.add("waterskin", 1);
  this.inventory.add("camp_kit", 1);
  this.inventory.add("torch", 2);
  this.inventory.add("gold", 15);
};
Player.prototype = Object.create(Entity.prototype);
Player.prototype.constructor = Player;

Player.prototype.getAC = function () { return Combat.armorClass(this); };

// Called by the engine when it's our turn: stop the engine and wait for a key.
Player.prototype.act = function () {
  Game.engine.lock();
  this.dodging = false;
  this._myTurn = true;
  Game.render();
  window.addEventListener("keydown", this);
  if (this.path) { this._continueTravel(); }
};

// Our action is done: time passes (30 minutes on the world map, 1 minute elsewhere), then
// everyone else moves.
Player.prototype._endTurn = function () {
  this._myTurn = false;
  window.removeEventListener("keydown", this);
  var cell = Game.cellAt(this._x, this._y);
  Game.passTime(cell && cell.road && Game.level.roadMinutes ? Game.level.roadMinutes : (Game.level.minutesPerTurn || 1));
  if (!Game.running) { return; } // starved
  Game.engine.unlock();
};

Player.prototype.isExhausted = function () { return this.fatigue >= 100; };

// Stop waiting for input without taking a turn (changing level, game over).
Player.prototype.stopListening = function () {
  this._myTurn = false;
  this.stopTravel();
  window.removeEventListener("keydown", this);
};

Player.prototype.isMyTurn = function () { return this._myTurn; };

// Keys -> index into ROT.DIRS[8] (0 = up, then clockwise).
Player.KEY_MAP = {
  ArrowUp: 0, PageUp: 1, ArrowRight: 2, PageDown: 3,
  ArrowDown: 4, End: 5, ArrowLeft: 6, Home: 7,
  "8": 0, "9": 1, "6": 2, "3": 3, "2": 4, "1": 5, "4": 6, "7": 7,
  w: 0, d: 2, s: 4, a: 6
};
Player.INTERACT_KEYS = { e: true, E: true, Enter: true, " ": true };
Player.ATTACK_KEYS = { f: true, F: true };
Player.DODGE_KEYS = { q: true, Q: true };
Player.WAIT_KEYS = { ".": true, "5": true, Clear: true };
Player.EXIT_KEYS = { x: true, X: true };

// The player object is its own keydown listener (see addEventListener above).
Player.prototype.handleEvent = function (e) {
  if (UI.isBlocking() || !this._myTurn) { return; } // a menu or window is open: keys belong to it

  // Any key stops a click-to-move walk.
  if (this.path) {
    e.preventDefault();
    this.stopTravel();
    UI.show("You stop.");
    return;
  }

  if (Player.INTERACT_KEYS[e.key]) {
    e.preventDefault();
    this._interact();
  } else if (Player.ATTACK_KEYS[e.key]) {
    e.preventDefault();
    this.attackCommand();
  } else if (Player.DODGE_KEYS[e.key]) {
    e.preventDefault();
    this.dodge();
  } else if (Player.EXIT_KEYS[e.key]) {
    e.preventDefault();
    if (Game.level.name === "town") { this.stopListening(); Game.leaveTown(); }
    else { UI.show("X leaves a town. In a dungeon, take the stairs up (<)."); }
  } else if (Player.WAIT_KEYS[e.key]) {
    e.preventDefault();
    UI.show("You wait.");
    this._endTurn();
  } else if (e.key in Player.KEY_MAP) {
    e.preventDefault();
    var diff = ROT.DIRS[8][Player.KEY_MAP[e.key]];
    this.tryStep(diff[0], diff[1]);
  }
};

// Step one cell (diagonals allowed). Walking into an enemy attacks it.
// Returns true if that used up the turn.
Player.prototype.tryStep = function (dx, dy) {
  var newX = this._x + dx;
  var newY = this._y + dy;
  var cell = Game.cellAt(newX, newY);
  if (!cell) {
    // Walking off the edge of a town takes you back to the world map.
    if (Game.level.exitOnEdge) { this.stopListening(); Game.leaveTown(); return true; }
    return false;
  }
  if (!cell.passable) {
    if (cell.type === "mountain") { UI.show("The mountains are too steep to climb."); }
    return false;
  }
  var being = Game.beingAt(newX, newY);
  if (being) {
    if (being.hostile) { return this.attackTarget(being); }
    being.interact(this); // talk, or trade with a shopkeeper
    return false;
  }

  UI.clear();
  this._moveTo(newX, newY);
  this._describeHere();
  this._endTurn();
  return true;
};

// ---- Combat ----

// F: attack an enemy next to you, or (with a bow) the nearest one you can see.
Player.prototype.attackCommand = function () {
  var self = this;
  var adjacent = (Game.level.beings || []).filter(function (b) { return b.hostile && b.isAlive() && self.distanceTo(b) <= 1; });
  var enemy = adjacent[0] || Game.enemyInSight();
  if (!enemy) { UI.show("There's nothing to attack."); return false; }
  return this.attackTarget(enemy);
};

Player.prototype.attackTarget = function (target) {
  var atk = Combat.playerAttack(this);
  var dist = this.distanceTo(target);
  var opts = { advantage: !!target.offBalance };
  if (atk.ranged) {
    var ammo = Items.get(atk.ammo);
    if (this.inventory.count(atk.ammo) === 0) { UI.show("You have no " + ammo.name.toLowerCase() + " for your " + atk.name.toLowerCase() + "."); return false; }
    if (dist > atk.range) { UI.show(target.stats.name + " is out of range."); return false; }
    this.inventory.remove(atk.ammo, 1);
    InventoryUI.refresh();
    // 5e: a ranged attack with an enemy right next to you has disadvantage.
    if (dist <= 1) { opts.disadvantage = true; }
  } else if (dist > 1) {
    UI.show(target.stats.name + " is out of reach. Get next to it first.");
    return false;
  }
  UI.clear();
  if (opts.advantage) { UI.log(target.stats.name + " is off balance: you attack with advantage.", "hit"); }
  if (opts.disadvantage) { UI.log("Shooting point-blank: disadvantage.", "miss"); }
  Combat.attack(this, target, atk, opts);
  if (target.isAlive() && target.noticeAttack) { target.noticeAttack(this); }
  this._endTurn();
  return true;
};

// Q: the 5e Dodge action.
Player.prototype.dodge = function () {
  UI.show("You dodge: until your next turn, attacks against you have disadvantage.");
  this.dodging = true;
  this._endTurn();
  return true;
};

Player.prototype.die = function (from) {
  if (from && from.stats) {
    var name = from.stats.name;
    Game.gameOver(name === "Pedro" ? "Pedro's greataxe cuts you down." : "The " + name.toLowerCase() + " kills you.", "You died", "Pedro keeps his ananas.");
  } else {
    Game.gameOver("You starve to death.", "You died", "Should have packed more bread.");
  }
};

// ---- Food, drink and sleep ----

// Eat or drink the item in bag slot `index`. Uses your turn.
Player.prototype.eat = function (index) {
  var stack = this.inventory.slots[index];
  if (!stack || !Items.FOOD[stack.id] || !Game.running) { return false; }
  var item = Items.get(stack.id);
  var before = Math.round(this.satiation);
  this.satiation = Math.min(100, this.satiation + Items.FOOD[stack.id]);
  stack.qty -= 1;
  if (stack.qty <= 0) { this.inventory.slots[index] = null; }
  UI.show("You " + (item.category === "Drink" ? "drink" : "eat") + " the " + item.name.toLowerCase() + ". Satiation " + before + " -> " + Math.round(this.satiation) + ".");
  InventoryUI.refresh();
  if (this._myTurn) { this._endTurn(); } else { Game.render(); }
  return true;
};

// Sleep 8 hours: fatigue back to 0 and all HP back (a 5e long rest). Hunger still grows.
// Not with an enemy in sight. `where` is "inn" or "camp".
Player.prototype.sleep = function (where) {
  if (!Game.running) { return false; }
  var enemy = Game.enemyInSight();
  if (enemy) { UI.show("You can't sleep with " + (enemy.stats.boss ? "Pedro" : "a " + enemy.stats.name.toLowerCase()) + " watching you!"); return false; }
  this.stopTravel();
  Game.passTime(480, true);
  if (!Game.running) { return true; }
  this.fatigue = 0;
  this.stats.hp = this.stats.maxHp;
  UI.log((where === "inn" ? "You sleep soundly in a tavern bed." : "You pitch your tent and sleep.") +
    " 8 hours pass. It's now " + Clock.text() + ". You feel rested (HP " + this.stats.hp + ").", "hit");
  // Townsfolk have moved on while you slept.
  if (Game.level.name === "town") { Game.level.beings.forEach(function (b) { b.placeForTime(); }); }
  InventoryUI.refresh();
  if (this._myTurn) {
    this._myTurn = false;
    window.removeEventListener("keydown", this);
    Game.engine.unlock();
  } else {
    Game.render();
  }
  return true;
};

// ---- Items: potions and equipment ----

// Drink a healing potion from bag slot `index` (2d4+2, like the 5e Potion of Healing).
// Uses your turn when it's your turn.
Player.prototype.drinkPotion = function (index) {
  var stack = this.inventory.slots[index];
  if (!stack || stack.id !== "potion_heal" || !Game.running) { return false; }
  var heal = Dice.roll("2d4+2").total;
  var before = this.stats.hp;
  this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + heal);
  stack.qty -= 1;
  if (stack.qty <= 0) { this.inventory.slots[index] = null; }
  UI.show("You drink a healing potion: 2d4+2 = " + heal + ". HP " + before + " -> " + this.stats.hp + ".");
  InventoryUI.refresh();
  if (this._myTurn) { this._endTurn(); } else { Game.render(); }
  return true;
};

Player.prototype._isTwoHanded = function (id) {
  var w = id && Combat.WEAPONS[id];
  return !!(w && w.props.indexOf("two-handed") >= 0);
};

Player.prototype._freeSlots = function () {
  return this.inventory.slots.filter(function (s) { return !s; }).length;
};

// Equip the item in bag slot `index`. Whatever was in that equipment slot goes back to the bag.
// `slot` (optional) is where it was dropped; it must match the item.
Player.prototype.equipFromBag = function (index, slot) {
  var stack = this.inventory.slots[index];
  if (!stack) { return false; }
  var item = Items.get(stack.id);
  var s = Combat.slotFor(stack.id);
  if (!s) { UI.show(item.name + " can't be equipped."); return false; }
  if (slot && slot !== s) { UI.show(item.name + " goes in the " + Combat.SLOT_NAMES[s].toLowerCase() + " slot."); return false; }

  // A two-handed weapon and a shield don't go together: the other one comes off.
  var conflict = null;
  if (s === "weapon" && this._isTwoHanded(stack.id) && this.equipment.shield) { conflict = "shield"; }
  if (s === "shield" && this._isTwoHanded(this.equipment.weapon)) { conflict = "weapon"; }
  var old = this.equipment[s];
  var needed = (old ? 1 : 0) + (conflict ? 1 : 0);
  if (needed > this._freeSlots() + 1) { UI.show("Your bag is too full to swap that."); return false; }

  this.inventory.slots[index] = null;
  this.equipment[s] = stack.id;
  if (old) { this.inventory.slots[index] = { id: old, qty: 1 }; }
  var text = "You equip the " + item.name + ".";
  if (conflict) {
    var off = this.equipment[conflict];
    this.equipment[conflict] = null;
    this.inventory.add(off, 1);
    text += " You put away the " + Items.get(off).name + " (" + (conflict === "shield" ? "you need both hands" : "it needs both hands") + ").";
  }
  var a = Combat.ARMOR[stack.id];
  if (a && a.str && this.stats.abilities.str < a.str) {
    text += " It's heavy for you (Str " + a.str + " recommended).";
  }
  UI.show(text);
  InventoryUI.refresh();
  Game.render();
  return true;
};

// Take off what's in an equipment slot and put it in the bag (at `index` if that slot is free).
Player.prototype.unequip = function (slot, index) {
  var id = this.equipment[slot];
  if (!id) { return false; }
  if (index !== undefined && index !== null && !this.inventory.slots[index]) {
    this.inventory.slots[index] = { id: id, qty: 1 };
  } else if (this.inventory.add(id, 1) > 0) {
    UI.show("Your bag is full.");
    return false;
  }
  this.equipment[slot] = null;
  UI.show("You take off the " + Items.get(id).name + ".");
  InventoryUI.refresh();
  Game.render();
  return true;
};

// ---- Click-to-move ----

// Walk to (x, y) along the shortest path through cells you know about (8 directions).
// Clicking yourself uses what's here; clicking a visible enemy attacks it if you can.
Player.prototype.travelTo = function (x, y) {
  if (!this._myTurn) { return false; }
  this.stopTravel();
  if (x === this._x && y === this._y) { this._interact(); return true; }

  var enemy = Game.beingAt(x, y);
  if (enemy && !enemy.hostile && this.distanceTo(enemy) <= 1) { enemy.interact(this); return true; }
  if (enemy && enemy.hostile && Game.canPlayerSee(enemy)) {
    var atk = Combat.playerAttack(this);
    if (this.distanceTo(enemy) <= 1 || (atk.ranged && this.inventory.count(atk.ammo) > 0)) {
      return this.attackTarget(enemy);
    }
  }

  var level = Game.level;
  var self = this;
  var known = function (cx, cy) {
    var key = cx + "," + cy;
    var cell = level.cells[key];
    if (!cell || !cell.passable) { return false; }
    if (level.fog && !level.memory[key]) { return false; } // can't plan through unexplored places
    return true;
  };
  if (!known(x, y)) { UI.show(level.fog && !level.memory[x + "," + y] ? "You don't know what's there." : "You can't go there."); return false; }

  var path = [];
  var astar = new ROT.Path.AStar(x, y, function (cx, cy) {
    return (cx === self._x && cy === self._y) || known(cx, cy);
  }, { topology: 8 });
  astar.compute(this._x, this._y, function (cx, cy) { path.push([cx, cy]); });
  path.shift(); // where we stand
  if (!path.length) { UI.show("You can't find a way there."); return false; }

  // With an enemy already in view, a click only takes one step: no long walks under its nose.
  if (Game.enemyInSight()) { path = path.slice(0, 1); }
  this.path = path;
  this._travelStep();
  return true;
};

// At the start of each turn while walking: stop if an enemy is in view, otherwise take the next step.
Player.prototype._continueTravel = function () {
  var enemy = Game.enemyInSight();
  if (enemy) {
    this.stopTravel();
    UI.log("You see " + enemy.stats.name + " and stop.", "warn");
    return;
  }
  var self = this;
  this._travelTimer = setTimeout(function () {
    self._travelTimer = null;
    self._travelStep();
  }, 60);
};

Player.prototype._travelStep = function () {
  if (!this._myTurn || !this.path || !Game.running || UI.isBlocking()) { this.stopTravel(); return; }
  var next = this.path.shift();
  if (!this.path.length) { this.path = null; }
  var dx = next[0] - this._x, dy = next[1] - this._y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1) { this.stopTravel(); return; }
  var blocker = Game.beingAt(next[0], next[1]);
  if (blocker) {
    var dest = this.path ? this.path[this.path.length - 1] : next;
    if (!this.path && !blocker.hostile) { this.stopTravel(); blocker.interact(this); return; } // walked up to them
    // Someone's in the way: walk around them.
    var around = this._pathAround(dest);
    if (!around) { this.stopTravel(); UI.show("Someone is in the way."); return; }
    this.path = around.length > 1 ? around.slice(1) : null;
    next = around[0];
    dx = next[0] - this._x; dy = next[1] - this._y;
  }
  if (!this.tryStep(dx, dy)) { this.stopTravel(); }
};

// A path to `dest` that steps around everyone standing in the way (or null).
Player.prototype._pathAround = function (dest) {
  var level = Game.level;
  var self = this;
  var path = [];
  var astar = new ROT.Path.AStar(dest[0], dest[1], function (cx, cy) {
    if (cx === self._x && cy === self._y) { return true; }
    var key = cx + "," + cy;
    var cell = level.cells[key];
    if (!cell || !cell.passable || (level.fog && !level.memory[key])) { return false; }
    return !Game.beingAt(cx, cy) || (cx === dest[0] && cy === dest[1]);
  }, { topology: 8 });
  astar.compute(this._x, this._y, function (cx, cy) { path.push([cx, cy]); });
  path.shift();
  if (!path.length || Game.beingAt(path[0][0], path[0][1])) { return null; }
  return path;
};

Player.prototype.stopTravel = function () {
  if (this._travelTimer) { clearTimeout(this._travelTimer); }
  this._travelTimer = null;
  this.path = null;
};

// ---- Using things ----

// Say what's under the player's feet, and how to use it.
Player.prototype._describeHere = function () {
  var key = this._x + "," + this._y;
  var cell = Game.cellAt(this._x, this._y);
  var chest = Game.level.chests[key];
  var poi = Game.level === Game.overworld && Game.poiAt(this._x, this._y);
  var traveller = Game.level === Game.overworld && Game.beingAt(this._x, this._y);
  if (poi) {
    UI.show(poi.kind === "town" ? (poi.capital ? "The capital, " : "The town of ") + poi.name + " (" + Economy.faction(poi.faction).name + ", pop. " + Economy.popText(poi) +
      ", makes " + Economy.goodsText(poi) + "). Press E to go in." : poi.name + ", a dungeon. Press E to go down.");
  } else if (traveller) {
    UI.show("The " + traveller.name + " is here. Press E to " + (traveller instanceof Caravan ? "trade." : "talk."));
  } else if (cell.type === "bed") {
    UI.show("A tavern bed. Press E to rent it for the night (1 gold) and sleep 8 hours.");
  } else if (cell.type === "stairsDown") {
    UI.show("Stairs lead further down. Press E to descend.");
  } else if (chest) {
    var what = chest.name === "Chest" ? "A chest" : chest.name;
    UI.show(chest.isEmpty() ? what + ", empty." : what + ". Press E to open it.");
  } else if (cell.type === "entrance") {
    UI.show("A dark stairway leads down into a dungeon. Press E to enter.");
  } else if (cell.type === "stairsUp") {
    UI.show(Game.level.depth > 1 ? "Stairs lead up. Press E to climb." : "Stairs lead back up to the surface. Press E to climb out.");
  } else if (cell.type === "door") {
    UI.show("You pass through a door.");
  }
};

// The interact key: open a chest, go down the entrance, or climb the stairs.
Player.prototype._interact = function () {
  var key = this._x + "," + this._y;
  var cell = Game.cellAt(this._x, this._y);
  var chest = Game.level.chests[key];
  var poi = Game.level === Game.overworld && Game.poiAt(this._x, this._y);
  var traveller = Game.level === Game.overworld && !poi && Game.beingAt(this._x, this._y);
  if (chest) {
    InventoryUI.openChest(chest);
  } else if (traveller) {
    traveller.interact(this);
  } else if (poi) {
    this.stopListening();
    if (poi.kind === "town") { Game.enterTown([this._x, this._y]); } else { Game.enterDungeon([this._x, this._y]); }
  } else if (cell.type === "stairsUp" || cell.type === "stairsDown") {
    this.stopListening();
    Game.takeStairs(cell.type === "stairsDown" ? 1 : -1);
  } else if (cell.type === "bed") {
    if (this.inventory.count("gold") < 1) { UI.show("The innkeeper wants 1 gold for the bed, and you're broke."); return; }
    this.inventory.remove("gold", 1);
    UI.show("You pay 1 gold for the bed.");
    this.sleep("inn");
  } else {
    UI.show("There's nothing here to use.");
  }
};

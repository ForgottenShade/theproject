// Part 3, reworked: the dungeon's monsters. Pedro, the angry owner of the ananas, is a named orc
// who waits on the deepest level of his cellar. Every monster has a 5e stat block (src/systems/Combat.js)
// and only hunts you once it has actually seen you.
//   - Not seen you yet: it wanders between random spots on its level.
//   - Sees you (within 8 cells, line of sight blocked by walls): it chases you with A*, diagonals allowed.
//   - Loses sight of you: it goes to where it last saw you, then goes back to wandering.
//   - Next to you: a normal attack. Monsters with a heavy attack (orcs, Pedro) sometimes wind up
//     for a turn first (30%). The wind-up is telegraphed: a message, an orange glyph, and the target
//     cell turns red. Step off that cell or press Q to dodge. If the heavy swing misses, the monster
//     is off balance, and your next attack against it has advantage.
// Monsters stay on their own dungeon level.
var Monster = function (x, y, kind, level) {
  this.stats = kind === "pedro" ? Combat.orc() : Combat.monster(kind);
  Entity.call(this, x, y, this.stats.ch, this.stats.color);
  this.kind = kind;
  this.level = level;
  this.hostile = true;
  this.alerted = false;   // has it ever seen you?
  this.lastSeen = null;   // [x, y] where it last saw you
  this.windup = null;     // { x, y }: where its heavy attack will land next turn
  this.offBalance = false;
  this.wanderGoal = null;
};
Monster.prototype = Object.create(Entity.prototype);
Monster.prototype.constructor = Monster;

Monster.SIGHT = 8;
Monster.HEAVY_CHANCE = 0.3;

Monster.prototype.getColor = function () {
  return this.windup ? "#ffa020" : this._color;
};

Monster.prototype.canSee = function (being) {
  if (Game.level !== this.level) { return false; }
  return Sight.canSee(this.level, this._x, this._y, being.getX(), being.getY(), Monster.SIGHT);
};

Monster.prototype.act = function () {
  if (!this.isAlive() || !Game.running || Game.level !== this.level) { return; }
  this.offBalance = false;
  var p = Game.player;
  var name = this.stats.name;

  if (this.windup) { this._heavySwing(); return; }

  if (this.canSee(p)) {
    if (!this.alerted) {
      this.alerted = true;
      UI.log(Game.canPlayerSee(this) ? name + " spots you!" : "You hear something stir nearby.", "warn");
    }
    this.lastSeen = [p.getX(), p.getY()];
    if (this.distanceTo(p) <= 1) {
      if (this.stats.heavy && ROT.RNG.getUniform() < Monster.HEAVY_CHANCE) { this._startWindup(p); }
      else { Combat.attack(this, p, this.stats.attack, { disadvantage: p.dodging }); }
      return;
    }
    this._stepToward(p.getX(), p.getY());
    return;
  }

  // Can't see you: check where you were last seen, then give up.
  if (this.lastSeen) {
    if ((this._x === this.lastSeen[0] && this._y === this.lastSeen[1]) || !this._stepToward(this.lastSeen[0], this.lastSeen[1])) {
      this.lastSeen = null;
    }
    return;
  }
  this._wander();
};

// One step along the shortest path to (tx, ty), diagonals allowed, around other monsters.
// Returns false if there's no way.
Monster.prototype._stepToward = function (tx, ty) {
  var self = this;
  var level = this.level;
  var passable = function (x, y) {
    var cell = level.cells[x + "," + y];
    if (!cell || !cell.passable) { return false; }
    if (x === tx && y === ty) { return true; }
    var b = Game.beingAt(x, y, level);
    return !b || b === self;
  };
  var astar = new ROT.Path.AStar(tx, ty, passable, { topology: 8 });
  var path = [];
  astar.compute(this._x, this._y, function (x, y) { path.push([x, y]); });
  path.shift(); // where it stands
  if (!path.length) { return false; }
  var next = path[0];
  if (next[0] === Game.player.getX() && next[1] === Game.player.getY()) { return true; } // already next to you
  if (Game.beingAt(next[0], next[1], level)) { return true; } // someone in the way: wait
  this._moveTo(next[0], next[1]);
  return true;
};

// Amble towards a random spot on the level, about every other turn.
Monster.prototype._wander = function () {
  if (ROT.RNG.getUniform() < 0.5) { return; }
  if (!this.wanderGoal || (this._x === this.wanderGoal[0] && this._y === this.wanderGoal[1])) {
    var cells = this.level.freeCellsAll;
    this.wanderGoal = cells[Math.floor(ROT.RNG.getUniform() * cells.length)].split(",").map(Number);
  }
  if (!this._stepToward(this.wanderGoal[0], this.wanderGoal[1])) { this.wanderGoal = null; }
};

// The tell: it lifts its weapon and picks the cell you're standing on.
Monster.prototype._startWindup = function (p) {
  this.windup = { x: p.getX(), y: p.getY() };
  UI.log(this.stats.name + " heaves the " + this.stats.attack.name + " high overhead! Step off the red square or press Q to dodge.", "warn");
};

// The heavy attack lands on the cell it picked last turn.
Monster.prototype._heavySwing = function () {
  var w = this.windup;
  var p = Game.player;
  this.windup = null;
  var hit = false;
  if (p.getX() === w.x && p.getY() === w.y && this.distanceTo(p) <= 1) {
    hit = Combat.attack(this, p, this.stats.heavy, { disadvantage: p.dodging }).hit;
  } else {
    UI.log(this.stats.name + "'s " + this.stats.attack.name + " smashes into the floor where you stood!", "hit");
  }
  if (!hit && this.isAlive()) {
    this.offBalance = true;
    if (Game.canPlayerSee(this)) { UI.log(this.stats.name + " is off balance: your next attack has advantage.", "hit"); }
  }
};

// Being attacked tells it where you are, even if it couldn't see you.
Monster.prototype.noticeAttack = function (attacker) {
  this.alerted = true;
  this.lastSeen = [attacker.getX(), attacker.getY()];
};

Monster.prototype.die = function () {
  this.windup = null;
  UI.log(this.stats.boss ? "Pedro collapses with a last furious grunt. He drops his greataxe." : "The " + this.stats.name.toLowerCase() + " dies.", "hit");
  Game.monsterDied(this);
};

// Pedro is a monster like the others, with his own stat block (Combat.orc).
var Pedro = function (x, y, level) {
  return new Monster(x, y, "pedro", level);
};
Pedro.SIGHT = Monster.SIGHT;

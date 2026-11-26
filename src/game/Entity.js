// Shared bits for anything that stands on the map (the player and Pedro).
var Entity = function (x, y, ch, color) {
  this._x = x;
  this._y = y;
  this._ch = ch;
  this._color = color;
};

Entity.prototype.getX = function () { return this._x; };
Entity.prototype.getY = function () { return this._y; };
Entity.prototype.getChar = function () { return this._ch; };
Entity.prototype.getColor = function () { return this._color; };

// Move to (x, y). The screen is redrawn when the player's turn comes round,
// because what you can see depends on where everyone is.
Entity.prototype._moveTo = function (x, y) {
  this._x = x;
  this._y = y;
};

// Combat basics shared by the player and monsters. `this.stats` is a 5e-style stat block
// (see src/systems/Combat.js).
Entity.prototype.getAC = function () { return this.stats.ac; };

Entity.prototype.isAlive = function () { return this.stats.hp > 0; };

// Chebyshev distance: diagonal steps count as one, as on a 5e grid.
Entity.prototype.distanceTo = function (other) {
  return Math.max(Math.abs(this._x - other.getX()), Math.abs(this._y - other.getY()));
};

Entity.prototype.takeDamage = function (amount, from) {
  this.stats.hp = Math.max(0, this.stats.hp - amount);
  if (this.stats.hp === 0) { this.die(from); }
};

Entity.prototype.die = function () {};

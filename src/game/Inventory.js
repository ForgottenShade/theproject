// A grid of slots holding stacks: { id, qty }. Used for the player's 4x4 bag and for chests.
var Container = function (name, cols, rows) {
  this.name = name;
  this.cols = cols;
  this.rows = rows;
  this.slots = new Array(cols * rows).fill(null);
};

Container.prototype.isEmpty = function () {
  return this.slots.every(function (s) { return !s; });
};

Container.prototype.count = function (id) {
  return this.slots.reduce(function (n, s) { return n + (s && s.id === id ? s.qty : 0); }, 0);
};

// Add qty of an item: top up existing stacks first, then use empty slots.
// Returns how many didn't fit.
Container.prototype.add = function (id, qty) {
  var max = Items.get(id).maxStack;
  for (var i = 0; i < this.slots.length && qty > 0; i++) {
    var s = this.slots[i];
    if (s && s.id === id && s.qty < max) {
      var move = Math.min(qty, max - s.qty);
      s.qty += move;
      qty -= move;
    }
  }
  for (var j = 0; j < this.slots.length && qty > 0; j++) {
    if (!this.slots[j]) {
      var put = Math.min(qty, max);
      this.slots[j] = { id: id, qty: put };
      qty -= put;
    }
  }
  return qty;
};

// Move the stack in src slot si onto dst slot di (drag and drop):
//   empty target      -> the stack moves there
//   same stackable    -> merge as much as fits, the rest stays behind
//   anything else     -> the two stacks swap places
Container.transfer = function (src, si, dst, di) {
  var a = src.slots[si];
  if (!a || (src === dst && si === di)) { return; }
  var b = dst.slots[di];
  if (!b) {
    dst.slots[di] = a;
    src.slots[si] = null;
  } else if (b.id === a.id && Items.get(a.id).maxStack > 1) {
    var move = Math.min(a.qty, Items.get(a.id).maxStack - b.qty);
    b.qty += move;
    a.qty -= move;
    if (a.qty <= 0) { src.slots[si] = null; }
  } else {
    dst.slots[di] = a;
    src.slots[si] = b;
  }
};

// Shift-click: send a whole stack to wherever it fits in the other container.
Container.quickMove = function (src, si, dst) {
  var a = src.slots[si];
  if (!a) { return; }
  var left = dst.add(a.id, a.qty);
  if (left > 0) { a.qty = left; } else { src.slots[si] = null; }
  return left;
};

// Take qty of an item out (last stacks first). Returns how many were actually removed.
Container.prototype.remove = function (id, qty) {
  var removed = 0;
  for (var i = this.slots.length - 1; i >= 0 && removed < qty; i--) {
    var s = this.slots[i];
    if (s && s.id === id) {
      var take = Math.min(s.qty, qty - removed);
      s.qty -= take;
      removed += take;
      if (s.qty <= 0) { this.slots[i] = null; }
    }
  }
  return removed;
};

// A dungeon level. Part 1 of the tutorial (ROT.Map.Digger + boxes, now chests of loot), plus terrain:
// each room gets a wood or stone floor, corridors are rough stone, room exits become
// doors, and every wall that touches open ground is drawn with a brick texture.
// Each dungeon has DEPTH levels joined by stairs: < goes up (from the first level, back to the
// world map), > goes down. Deeper levels have more monsters and better loot. The ananas and
// Pedro are on the deepest level of Pedro's Cellar.
var GameMap = {
  DEPTH: 3,
  MONSTERS_PER_LEVEL: [3, 5, 7],
  MONSTER_WEIGHTS: [
    { giant_rat: 5, goblin: 3 },
    { giant_rat: 1, goblin: 4, skeleton: 3, orc: 2 },
    { goblin: 2, skeleton: 3, orc: 4 }
  ],

  // opts: { depth, deepest, ananas, dungeon }
  generate: function (W, H, opts) {
    opts = opts || { depth: 1, deepest: true, ananas: true };
    var depth = opts.depth || 1;
    var cells = {};
    var freeCells = [];

    var digger = new ROT.Map.Digger(W, H);
    digger.create(function (x, y, value) {
      if (value) { return; } // walls are added below, only where they're visible
      var key = x + "," + y;
      cells[key] = Tiles.make("corridor", x, y);
      freeCells.push(key);
    });

    // Rooms: pick a floor material per room, and turn the room's exits into doors.
    digger.getRooms().forEach(function (room) {
      var material = ROT.RNG.getUniform() < 0.5 ? "wood" : "stone";
      for (var x = room.getLeft(); x <= room.getRight(); x++) {
        for (var y = room.getTop(); y <= room.getBottom(); y++) {
          cells[x + "," + y] = Tiles.make(material, x, y);
        }
      }
      room.getDoors(function (x, y) {
        cells[x + "," + y] = Tiles.make("door", x, y);
      });
    });

    // Walls: any solid cell next to open ground.
    for (var key in Object.assign({}, cells)) {
      var p = key.split(",").map(Number);
      for (var i = 0; i < 8; i++) {
        var wx = p[0] + ROT.DIRS[8][i][0];
        var wy = p[1] + ROT.DIRS[8][i][1];
        var wk = wx + "," + wy;
        if (!cells[wk] && wx >= 0 && wy >= 0 && wx < W && wy < H) {
          cells[wk] = Tiles.make("wall", wx, wy);
        }
      }
    }

    // Doors aren't good places for boxes or for starting.
    freeCells = freeCells.filter(function (k) { return cells[k].type !== "door"; });

    var level = {
      name: "dungeon", width: W, height: H, cells: cells, chests: {}, fog: true, memory: {},
      depth: depth, dungeon: opts.dungeon || null, minutesPerTurn: 1, beings: []
    };
    level.freeCellsAll = freeCells.slice();
    this._generateChests(level, freeCells, depth, opts.ananas && opts.deepest);

    // The way back up is where the player arrives; the way down is far from it.
    level.start = this.takeFreeCell(freeCells);
    cells[level.start.join(",")] = Tiles.make("stairsUp", level.start[0], level.start[1]);
    if (!opts.deepest) {
      level.down = this._farFrom(freeCells, level.start, 25);
      cells[level.down.join(",")] = Tiles.make("stairsDown", level.down[0], level.down[1]);
    }
    level.freeCells = freeCells;

    // Monsters, where they can't see the stairs you arrive on.
    var count = this.MONSTERS_PER_LEVEL[Math.min(depth, this.MONSTERS_PER_LEVEL.length) - 1];
    var weights = this.MONSTER_WEIGHTS[Math.min(depth, this.MONSTER_WEIGHTS.length) - 1];
    for (var m = 0; m < count; m++) {
      var pos = this._hiddenCell(level, freeCells);
      level.beings.push(new Monster(pos[0], pos[1], ROT.RNG.getWeightedValue(weights), level));
    }
    if (opts.ananas && opts.deepest) {
      var pp = this._hiddenCell(level, freeCells);
      level.pedro = new Monster(pp[0], pp[1], "pedro", level);
      level.beings.push(level.pedro);
    }
    return level;
  },

  // A free cell at least 12 steps from the arrival stairs, out of sight of them (or any far cell).
  _hiddenCell: function (level, freeCells) {
    var s = level.start;
    // What can be seen from the stairs (sight works both ways, near enough).
    if (!level._startView) { level._startView = Sight.compute(level, s[0], s[1], Monster.SIGHT + 1); }
    var ok = freeCells.filter(function (k) {
      var q = k.split(",").map(Number);
      return Math.abs(q[0] - s[0]) + Math.abs(q[1] - s[1]) >= 12 && !level._startView[k];
    });
    var list = ok.length ? ok : freeCells;
    var key = list[Math.floor(ROT.RNG.getUniform() * list.length)];
    freeCells.splice(freeCells.indexOf(key), 1);
    return key.split(",").map(Number);
  },

  _farFrom: function (freeCells, from, minDist) {
    var far = freeCells.filter(function (k) {
      var q = k.split(",").map(Number);
      return Math.abs(q[0] - from[0]) + Math.abs(q[1] - from[1]) >= minDist;
    });
    var list = far.length ? far : freeCells;
    var key = list[Math.floor(ROT.RNG.getUniform() * list.length)];
    freeCells.splice(freeCells.indexOf(key), 1);
    return key.split(",").map(Number);
  },

  // Put 10 chests on random free cells, each filled with random loot for this depth.
  // With `ananas`, the first one also gets it (the box with the ananas, from tutorial parts 1 and 3).
  _generateChests: function (level, freeCells, depth, ananas) {
    for (var i = 0; i < 10; i++) {
      var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
      var key = freeCells.splice(index, 1)[0];
      var chest = new Container("Chest", 4, 2);
      if (!i && ananas) { chest.add("ananas", 1); }
      Items.fillChest(chest, depth);
      level.chests[key] = chest;
    }
  },

  // Pick (and remove) a random free cell, returned as [x, y].
  takeFreeCell: function (freeCells) {
    var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
    return freeCells.splice(index, 1)[0].split(",").map(Number);
  }
};

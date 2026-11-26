// The overworld: terrain grown with cellular automata (ROT.Map.Cellular).
//   layer 1 decides land vs water,
//   layer 2 raises some land into hills,
//   layer 3 pushes the highest hills up into mountains (which can't be crossed).
// Then the political map:
//   - 3 factions. Each has a capital (Ω, a big town with a castle) far from the other capitals,
//     and 3 regional towns (⌂) around it.
//   - Roads (cheapest paths, preferring plains, reusing roads already built) join every regional
//     town to its capital, and the capitals to each other.
//   - Every cell belongs to the faction of the nearest town (walking distance, mountains count).
//   - Two dungeons go far away from the towns.
// The economy (goods, population, caravans, taxes) lives in src/systems/Economy.js.
var Overworld = {
  FACTIONS: 3,
  TOWNS_PER_FACTION: 3, // regional towns, besides the capital
  TOWN_NAMES: ["Maracay", "Valencia", "Barquisimeto", "Merida", "Cumana", "Coro", "Barinas", "Maturin",
    "San Cristobal", "Puerto Cabello", "Los Teques", "Carora", "Tucupita", "Guanare", "El Tocuyo", "Calabozo"],

  generate: function (W, H) {
    for (var attempt = 0; attempt < 40; attempt++) {
      var level = this._try(W, H);
      if (level) { return level; }
    }
    throw new Error("Could not generate a usable overworld");
  },

  // Run a cellular automaton and return a lookup "x,y" -> true for live cells.
  _cellular: function (W, H, fill, iterations, options) {
    var alive = {};
    var cellular = new ROT.Map.Cellular(W, H, options);
    cellular.randomize(fill);
    for (var i = 0; i < iterations - 1; i++) { cellular.create(); }
    cellular.create(function (x, y, value) {
      if (value) { alive[x + "," + y] = true; }
    });
    return alive;
  },

  _cheb: function (a, b) {
    var p = a.split(",").map(Number), q = b.split(",").map(Number);
    return Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]));
  },

  _try: function (W, H) {
    var smooth = { born: [5, 6, 7, 8], survive: [4, 5, 6, 7, 8] };
    var land = this._cellular(W, H, 0.6, 5, smooth);
    var high = this._cellular(W, H, 0.45, 5, smooth);
    var peak = this._cellular(W, H, 0.42, 4, smooth);
    var self = this;
    var rnd = function (list) { return list[Math.floor(ROT.RNG.getUniform() * list.length)]; };

    var cells = {};
    for (var x = 0; x < W; x++) {
      for (var y = 0; y < H; y++) {
        var key = x + "," + y;
        var type = "water";
        if (land[key]) {
          type = "plain";
          if (high[key]) { type = peak[key] ? "mountain" : "hill"; }
        }
        cells[key] = Tiles.make(type, x, y);
      }
    }

    // Everything must be reachable from one big walkable area.
    var plains = Object.keys(cells).filter(function (k) { return cells[k].type === "plain"; });
    if (plains.length < 400) { return null; }
    var reach = this._distances(cells, rnd(plains), W, H);
    var spots = Object.keys(reach).filter(function (k) {
      var t = cells[k].type;
      var q = k.split(",").map(Number);
      return (t === "plain" || t === "hill") && q[0] > 2 && q[1] > 2 && q[0] < W - 3 && q[1] < H - 3;
    });
    if (spots.length < 1500) { return null; }

    // Capitals: spread out, each as far as possible from the others.
    var capitals = [rnd(spots)];
    while (capitals.length < this.FACTIONS) {
      var best = null, bestScore = -1;
      for (var i = 0; i < spots.length; i += 2) {
        var score = Math.min.apply(null, capitals.map(function (c) { return self._cheb(c, spots[i]); })) + ROT.RNG.getUniform() * 8;
        if (score > bestScore) { bestScore = score; best = spots[i]; }
      }
      capitals.push(best);
    }
    for (var a = 0; a < capitals.length; a++) {
      for (var b = a + 1; b < capitals.length; b++) { if (this._cheb(capitals[a], capitals[b]) < 36) { return null; } }
    }

    // Regional towns around each capital: 10-26 squares away, nearer their own capital than any
    // other, and not too close to another town.
    var towns = capitals.map(function (c, f) { return { key: c, faction: f, capital: true }; });
    for (var f = 0; f < capitals.length; f++) {
      var cand = spots.filter(function (k) {
        var d = self._cheb(k, capitals[f]);
        if (d < 10 || d > 26) { return false; }
        for (var o = 0; o < capitals.length; o++) { if (o !== f && self._cheb(k, capitals[o]) <= d + 4) { return false; } }
        return true;
      });
      for (var n = 0; n < this.TOWNS_PER_FACTION; n++) {
        cand = cand.filter(function (k) { return towns.every(function (t) { return self._cheb(t.key, k) >= 9; }); });
        if (!cand.length) { return null; }
        towns.push({ key: rnd(cand), faction: f, capital: false });
      }
    }

    // The home town (Caracas) is a regional town of the first faction; you start a few steps away.
    var home = towns.filter(function (t) { return !t.capital && t.faction === 0; })[0];
    var fromHome = this._distances(cells, home.key, W, H);
    var near = Object.keys(fromHome).filter(function (k) {
      var t = cells[k].type;
      return fromHome[k] >= 3 && fromHome[k] <= 6 && (t === "plain" || t === "hill") && towns.every(function (tw) { return tw.key !== k; });
    });
    if (!near.length) { return null; }
    var startKey = rnd(near);

    // Two dungeons, far from all towns and from each other.
    var placed = towns.map(function (t) { return t.key; });
    var far = function () {
      var best = null, bestScore = -1;
      for (var i = 0; i < spots.length; i += 3) {
        var score = Math.min.apply(null, placed.map(function (pk) { return self._cheb(pk, spots[i]); }));
        score = Math.min(score, 30) + ROT.RNG.getUniform() * 6;
        if (score > bestScore) { bestScore = score; best = spots[i]; }
      }
      placed.push(best);
      return best;
    };
    var dungeon1 = far(), dungeon2 = far();
    if (this._cheb(dungeon1, startKey) < 6) { return null; }

    // Names: Caracas for home, the rest from the list.
    var names = this.TOWN_NAMES.slice();
    var takeName = function () { return names.splice(Math.floor(ROT.RNG.getUniform() * names.length), 1)[0]; };
    var pois = {};
    var put = function (key, type, poi) {
      var q = key.split(",").map(Number);
      cells[key] = Tiles.make(type, q[0], q[1]);
      pois[key] = poi;
      poi.pos = q;
    };
    var townPois = towns.map(function (t, i) {
      var poi = { kind: "town", name: t === home ? "Caracas" : takeName(), faction: t.faction, capital: t.capital, index: i };
      put(t.key, t.capital ? "capital" : "town", poi);
      return poi;
    });
    put(dungeon1, "entrance", { kind: "dungeon", name: "Pedro's Cellar", ananas: true });
    put(dungeon2, "entrance", { kind: "dungeon", name: "The Old Mine", ananas: false });

    var level = {
      name: "overworld",
      width: W,
      height: H,
      cells: cells,
      chests: {},
      fog: false,
      outdoor: true,
      minutesPerTurn: 30,
      roadMinutes: 15, // a step along a road
      beings: [],
      pois: pois,
      towns: townPois,
      start: startKey.split(",").map(Number),
      entrance: dungeon1.split(",").map(Number), // the dungeon with the ananas
      town: home.key.split(",").map(Number)      // the home town next to the start
    };

    // Roads: each regional town to its capital, then the capitals to each other.
    var roads = [];
    townPois.forEach(function (t) {
      if (!t.capital) { roads.push([t, townPois[t.faction]]); }
    });
    for (var c1 = 0; c1 < this.FACTIONS; c1++) {
      for (var c2 = c1 + 1; c2 < this.FACTIONS; c2++) { roads.push([townPois[c1], townPois[c2]]); }
    }
    roads.forEach(function (r) {
      var path = Overworld.cheapestPath(level, r[0].pos, r[1].pos, Overworld.buildCost);
      if (!path) { return; }
      path.forEach(function (p) {
        var k = p[0] + "," + p[1];
        if (!pois[k] && !cells[k].road) { cells[k] = Tiles.make("wroad", p[0], p[1]); cells[k].road = true; }
      });
    });
    if (townPois.some(function (t) { return !Overworld.cheapestPath(level, t.pos, townPois[t.faction].pos, Overworld.travelCost); })) { return null; }

    // Territory: every cell belongs to the faction of the nearest town (8-way steps over any ground).
    level.owner = this._territory(cells, townPois, W, H);
    return level;
  },

  // Building a road: plains are cheapest, hills and fords cost more, existing roads are nearly free.
  buildCost: function (cell) {
    if (!cell.passable) { return 0; }
    if (cell.road) { return 0.3; }
    return { plain: 1, hill: 2.5, water: 5 }[cell.type] || 1;
  },

  // Travelling (caravans, the tax collector): roads are much quicker than open country.
  travelCost: function (cell) {
    if (!cell.passable) { return 0; }
    return cell.road ? 1 : 4;
  },

  // Dijkstra from `from` to `to` (8 directions), cost(cell) per step (0 = impassable).
  // Returns the list of cells from `from` to `to`, or null.
  cheapestPath: function (level, from, to, cost) {
    var tree = this.costTree(level, from, cost);
    var key = to[0] + "," + to[1];
    if (!(key in tree.dist)) { return null; }
    var path = [];
    while (key) { path.push(key.split(",").map(Number)); key = tree.prev[key]; }
    return path.reverse();
  },

  // All cheapest paths out of `from`: { dist: "x,y" -> cost, prev: "x,y" -> previous "x,y" }.
  costTree: function (level, from, cost) {
    var dist = {}, prev = {};
    var start = from[0] + "," + from[1];
    dist[start] = 0;
    var heap = new MinHeap();
    heap.push(0, start);
    while (heap.size()) {
      var top = heap.pop();
      var key = top.value;
      if (top.priority > dist[key]) { continue; }
      var p = key.split(",").map(Number);
      for (var i = 0; i < 8; i++) {
        var nx = p[0] + ROT.DIRS[8][i][0], ny = p[1] + ROT.DIRS[8][i][1];
        var nk = nx + "," + ny;
        var cell = level.cells[nk];
        if (!cell) { continue; }
        var c = cost(cell);
        if (!c) { continue; }
        if (i % 2) { c *= 1.01; } // prefer straight steps when it's a tie
        var nd = dist[key] + c;
        if (!(nk in dist) || nd < dist[nk]) {
          dist[nk] = nd;
          prev[nk] = key;
          heap.push(nd, nk);
        }
      }
    }
    return { dist: dist, prev: prev };
  },

  // Multi-source breadth-first search from every town over all cells: "x,y" -> faction index.
  _territory: function (cells, towns, W, H) {
    var owner = {};
    var queue = [];
    towns.forEach(function (t) { var k = t.pos[0] + "," + t.pos[1]; owner[k] = t.faction; queue.push(k); });
    for (var qi = 0; qi < queue.length; qi++) {
      var key = queue[qi];
      var p = key.split(",").map(Number);
      for (var i = 0; i < 8; i++) {
        var nk = (p[0] + ROT.DIRS[8][i][0]) + "," + (p[1] + ROT.DIRS[8][i][1]);
        if (nk in owner || !cells[nk]) { continue; }
        owner[nk] = owner[key];
        queue.push(nk);
      }
    }
    return owner;
  },

  // Breadth-first search over passable cells (8 directions). Returns "x,y" -> steps.
  _distances: function (cells, startKey, W, H) {
    var dist = {};
    dist[startKey] = 0;
    var queue = [startKey];
    for (var qi = 0; qi < queue.length; qi++) {
      var key = queue[qi];
      var p = key.split(",").map(Number);
      for (var i = 0; i < 8; i++) {
        var nx = p[0] + ROT.DIRS[8][i][0];
        var ny = p[1] + ROT.DIRS[8][i][1];
        var nk = nx + "," + ny;
        if (nk in dist || !cells[nk] || !cells[nk].passable) { continue; }
        dist[nk] = dist[key] + 1;
        queue.push(nk);
      }
    }
    return dist;
  }
};

// A small binary heap (lowest priority first) for the path searches.
var MinHeap = function () { this._items = []; };
MinHeap.prototype.size = function () { return this._items.length; };
MinHeap.prototype.push = function (priority, value) {
  var a = this._items;
  a.push({ priority: priority, value: value });
  var i = a.length - 1;
  while (i > 0) {
    var parent = (i - 1) >> 1;
    if (a[parent].priority <= a[i].priority) { break; }
    var t = a[parent]; a[parent] = a[i]; a[i] = t;
    i = parent;
  }
};
MinHeap.prototype.pop = function () {
  var a = this._items;
  var top = a[0];
  var last = a.pop();
  if (a.length) {
    a[0] = last;
    var i = 0;
    for (;;) {
      var l = 2 * i + 1, r = l + 1, m = i;
      if (l < a.length && a[l].priority < a[m].priority) { m = l; }
      if (r < a.length && a[r].priority < a[m].priority) { m = r; }
      if (m === i) { break; }
      var t = a[m]; a[m] = a[i]; a[i] = t;
      i = m;
    }
  }
  return top;
};

// A town level.
//   1. The background is grown with ROT.Map.Cellular: open grass with clumps of trees.
//   2. Buildings and roads use the same generator as the dungeon, ROT.Map.Digger: every Digger
//      room becomes a building (floor inside, walls around, its exits become doors) and every
//      Digger corridor becomes a dirt road, so all buildings are joined up.
//   3. The biggest building is the tavern (beds and a hearth), then the blacksmith (an anvil) and
//      the general store. Each has a shopkeeper. The other buildings are homes.
//   4. A few fields are laid out on open grass, and a road leads to the west edge of the map.
// Villagers live in the homes and walk to work at the shops or in the fields (src/systems/NPC.js).
// Walk off any edge of the map, or press X, to go back to the world map.
//
// Factions and trade (src/systems/Economy.js):
//   - Each town has businesses for the goods it makes: a granary (and more fields) for grain, a
//     stonecutter's yard for stone, a smelter for metal, a weavers' hall for luxury goods.
//   - The general store also buys and sells the four trade goods at the town's market price.
//   - A capital is twice the area of a town, with a walled castle in the middle: a courtyard where
//     the soldiers drill (one guard shown for every 4 soldiers) and a keep where the faction's
//     leader sits on the throne.
var Town = {
  NAMES: ["Ana", "Bruno", "Carla", "Diego", "Elena", "Felipe", "Gloria", "Hugo", "Ines", "Jorge", "Lucia", "Mateo", "Nora", "Oscar", "Paula", "Rafael", "Sofia", "Tomas"],

  BUSINESS: {
    grain:  { kind: "granary",  name: "Granary",             tile: "granary" },
    stone:  { kind: "quarry",   name: "Stonecutter's Yard",  tile: "rock" },
    metal:  { kind: "smelter",  name: "Smelter",             tile: "furnace" },
    luxury: { kind: "weavers",  name: "Weavers' Hall",       tile: "loom" }
  },

  // `poi` is the town's entry on the world map (its goods, faction, whether it's a capital).
  generate: function (W, H, name, poi) {
    for (var attempt = 0; attempt < 30; attempt++) {
      var town = this._try(W, H, name, poi || {});
      if (town) { return town; }
    }
    throw new Error("Could not generate a town");
  },

  _try: function (W, H, name, poi) {
    var cells = {};
    var goods = poi.goods || [];

    // 1. Background: grass and trees.
    var trees = {};
    var cellular = new ROT.Map.Cellular(W, H, { born: [5, 6, 7, 8], survive: [4, 5, 6, 7, 8] });
    cellular.randomize(0.4);
    for (var i = 0; i < 3; i++) { cellular.create(); }
    cellular.create(function (x, y, v) { if (v) { trees[x + "," + y] = true; } });
    for (var x = 0; x < W; x++) {
      for (var y = 0; y < H; y++) {
        cells[x + "," + y] = Tiles.make(trees[x + "," + y] ? "tree" : "grass", x, y);
      }
    }

    // 2. Buildings and roads from the Digger. Digger rooms can share walls, so each building is
    //    the room shrunk by one cell: its walls stand on the room's edge, and the room's old walls
    //    become a road all the way round. Each room exit becomes the building door next to it.
    var digger = new ROT.Map.Digger(W - 2, H - 2, { roomWidth: [7, 12], roomHeight: [5, 8], corridorLength: [3, 14], dugPercentage: 0.24 });
    var open = [];
    digger.create(function (x, y, v) { if (!v) { open.push([x + 1, y + 1]); } });
    open.forEach(function (p) { cells[p[0] + "," + p[1]] = Tiles.make("road", p[0], p[1]); });

    var rooms = digger.getRooms();
    if (rooms.length < 6) { return null; }
    var buildings = rooms.map(function (room) {
      var L = room.getLeft() + 1, R = room.getRight() + 1, T = room.getTop() + 1, B = room.getBottom() + 1;
      var b = { left: L + 1, right: R - 1, top: T + 1, bottom: B - 1, inside: [], doors: [] };
      for (var rx = L - 1; rx <= R + 1; rx++) {
        for (var ry = T - 1; ry <= B + 1; ry++) {
          var ring = rx < L || rx > R || ry < T || ry > B;
          var inside = rx >= b.left && rx <= b.right && ry >= b.top && ry <= b.bottom;
          var type = ring ? "road" : inside ? "floor" : "bwall";
          cells[rx + "," + ry] = Tiles.make(type, rx, ry);
          if (inside) { b.inside.push([rx, ry]); }
        }
      }
      room.getDoors(function (dx, dy) {
        var x = dx + 1, y = dy + 1;
        // One step in from the old door, onto the new wall; not on a corner.
        if (y < T) { y = T; } else if (y > B) { y = B; } else if (x < L) { x = L; } else if (x > R) { x = R; }
        if ((x === L || x === R) && (y === T || y === B)) {
          if (y === T || y === B) { x = Math.min(Math.max(x, L + 1), R - 1); }
        }
        b.doors.push([x, y]);
      });
      b.area = b.inside.length;
      return b;
    });
    // A capital: clear the middle of the map for the castle, with a road all round it.
    var castle = null;
    if (poi.capital) {
      var cw = 30, chh = 14;
      var x0 = Math.floor(W / 2 - cw / 2), y0 = Math.floor(H / 2 - chh / 2), x1 = x0 + cw - 1, y1 = y0 + chh - 1;
      var hit = function (b) { return b.right + 2 >= x0 - 2 && b.left - 2 <= x1 + 2 && b.bottom + 2 >= y0 - 2 && b.top - 2 <= y1 + 2; };
      buildings.filter(hit).forEach(function (b) {
        for (var gx = b.left - 2; gx <= b.right + 2; gx++) {
          for (var gy = b.top - 2; gy <= b.bottom + 2; gy++) { cells[gx + "," + gy] = Tiles.make("grass", gx, gy); }
        }
      });
      buildings = buildings.filter(function (b) { return !hit(b); });
      for (var zx = x0 - 2; zx <= x1 + 2; zx++) {
        for (var zy = y0 - 2; zy <= y1 + 2; zy++) { cells[zx + "," + zy] = Tiles.make("road", zx, zy); }
      }
      castle = this._castle(cells, x0, y0, x1, y1);
    }

    // Doors go in after all the walls.
    buildings.forEach(function (b) {
      b.doors.forEach(function (d) { cells[d[0] + "," + d[1]] = Tiles.make("bdoor", d[0], d[1]); });
    });

    buildings.sort(function (a, b) { return b.area - a.area; });
    var tavern = buildings[0], smith = buildings[1], store = buildings[2];
    if (buildings.length < 4 + goods.length) { return null; }
    var businesses = goods.map(function (g, i) {
      var b = buildings[3 + i];
      var def = Town.BUSINESS[g];
      b.kind = def.kind; b.name = def.name; b.good = g;
      return b;
    });
    var homes = buildings.slice(3 + goods.length, 3 + goods.length + (poi.capital ? 16 : 8));
    tavern.kind = "tavern"; tavern.name = "The Prickly Pineapple";
    smith.kind = "blacksmith"; smith.name = "Forge";
    store.kind = "general"; store.name = "General Store";
    homes.forEach(function (h) { h.kind = "home"; });

    var level = {
      name: "town", townName: name, width: W, height: H, cells: cells, chests: {}, fog: false, outdoor: true,
      minutesPerTurn: 1, exitOnEdge: true, beings: [], buildings: buildings, shops: {}, fields: [],
      poi: poi, castle: castle, businesses: businesses
    };

    // 3. Furniture and shopkeepers. A shopkeeper stands at a spot inside, near the middle.
    var furnish = function (b, tile, cell) { cells[cell[0] + "," + cell[1]] = Tiles.make(tile, cell[0], cell[1]); };
    var isDoorSide = function (b, c) {
      return b.doors.some(function (d) { return Math.abs(d[0] - c[0]) <= 1 && Math.abs(d[1] - c[1]) <= 1; });
    };
    // Tavern: beds along the top wall, a hearth in a bottom corner.
    tavern.beds = [];
    for (var bx2 = tavern.left; bx2 <= tavern.right && tavern.beds.length < 3; bx2 += 2) {
      var bc = [bx2, tavern.top];
      if (!isDoorSide(tavern, bc)) { furnish(tavern, "bed", bc); tavern.beds.push(bc); }
    }
    if (!tavern.beds.length) { return null; }
    var hc = [tavern.right, tavern.bottom];
    if (!isDoorSide(tavern, hc)) { furnish(tavern, "hearth", hc); }
    var ac = [smith.left + 1, smith.top + 1];
    if (!isDoorSide(smith, ac)) { furnish(smith, "anvil", ac); }
    // Businesses: a row of their equipment (grain bins, stone blocks, furnaces, looms) along the top wall.
    businesses.forEach(function (b) {
      for (var fx2 = b.left + 1; fx2 < b.right; fx2 += 2) {
        var fc = [fx2, b.top];
        if (!isDoorSide(b, fc)) { furnish(b, Town.BUSINESS[b.good].tile, fc); }
      }
    });

    var names = this.NAMES.slice();
    var takeName = function () { return names.splice(Math.floor(ROT.RNG.getUniform() * names.length), 1)[0] || "Someone"; };
    [tavern, smith, store].forEach(function (b) {
      var spot = Town._centerSpot(level, b);
      var keeper = new Villager(spot[0], spot[1], { name: takeName(), role: "shopkeeper", shop: b.kind, work: b, home: b, level: level });
      level.beings.push(keeper);
      level.shops[b.kind] = Shops.create(b.kind, b.name, keeper);
      if (b.kind === "general" && poi.stock) { Shops.withMarket(level.shops[b.kind], Economy.townMarket(poi)); }
      b.keeper = keeper;
    });

    // 4. Fields on open grass.
    var nFields = goods.indexOf("grain") >= 0 ? 7 : 3;
    for (var f = 0; f < 90 && level.fields.length < nFields; f++) {
      var fw = ROT.RNG.getUniformInt(6, 10), fh = ROT.RNG.getUniformInt(3, 5);
      var fx = ROT.RNG.getUniformInt(2, W - fw - 3), fy = ROT.RNG.getUniformInt(2, H - fh - 3);
      if (this._clear(cells, fx - 1, fy - 1, fw + 2, fh + 2)) {
        var field = { left: fx, top: fy, right: fx + fw - 1, bottom: fy + fh - 1, inside: [] };
        for (var cx = fx; cx < fx + fw; cx++) {
          for (var cy = fy; cy < fy + fh; cy++) {
            cells[cx + "," + cy] = Tiles.make("field", cx, cy);
            field.inside.push([cx, cy]);
          }
        }
        level.fields.push(field);
      }
    }

    // A road from the west edge to the town's roads: that's where you arrive.
    var row = Math.floor(H / 2);
    var target = null;
    for (var tx = 0; tx < W && !target; tx++) {
      for (var dy2 = 0; dy2 < H / 2 && !target; dy2++) {
        [row + dy2, row - dy2].forEach(function (ty) {
          var c = cells[tx + "," + ty];
          if (!target && c && c.type === "road") { target = [tx, ty]; }
        });
      }
    }
    if (!target) { return null; }
    var path = [];
    var astar = new ROT.Path.AStar(target[0], target[1], function (px, py) {
      var c = cells[px + "," + py];
      return !!c && c.type !== "bwall" && c.type !== "floor" && c.type !== "bdoor" && !c.indoor;
    }, { topology: 4 });
    astar.compute(0, target[1], function (px, py) { path.push([px, py]); });
    if (!path.length) { return null; }
    path.forEach(function (p) { if (cells[p[0] + "," + p[1]].type !== "road") { cells[p[0] + "," + p[1]] = Tiles.make("road", p[0], p[1]); } });
    level.start = [0, target[1]];

    // Villagers: one per home, working at a shop or in a field.
    var jobs = level.fields.concat([tavern, smith, store]).concat(businesses).concat(businesses);
    homes.forEach(function (h) {
      var work = jobs[Math.floor(ROT.RNG.getUniform() * jobs.length)];
      var spot = h.inside[Math.floor(ROT.RNG.getUniform() * h.inside.length)];
      level.beings.push(new Villager(spot[0], spot[1], { name: takeName(), role: work.kind ? "helper" : "farmer", work: work, home: h, level: level }));
    });

    // The castle: the leader on the throne, and guards in the courtyard.
    if (castle) {
      var fac = Economy.faction(poi.faction);
      var leader = new Villager(castle.throneSpot[0], castle.throneSpot[1], { name: fac.leader, role: "leader", work: castle.keep, home: castle.keep, level: level, faction: fac });
      level.beings.push(leader);
      castle.leader = leader;
      castle.guards = [];
    }

    level.freeCellsAll = Object.keys(cells).filter(function (k) { return cells[k].passable; });
    return level;
  },

  // Build the castle in the rectangle (x0, y0)-(x1, y1): an outer wall with a gate in each side,
  // a cobbled courtyard, and a keep in the middle with the throne.
  _castle: function (cells, x0, y0, x1, y1) {
    var courtyard = { kind: "castle", name: "Castle courtyard", inside: [] };
    var keep = { kind: "keep", name: "Keep", inside: [] };
    var cx = Math.floor((x0 + x1) / 2), cy = Math.floor((y0 + y1) / 2);
    var kx0 = cx - 6, kx1 = cx + 6, ky0 = cy - 3, ky1 = cy + 3;
    for (var x = x0; x <= x1; x++) {
      for (var y = y0; y <= y1; y++) {
        var edge = x === x0 || x === x1 || y === y0 || y === y1;
        var inKeep = x >= kx0 && x <= kx1 && y >= ky0 && y <= ky1;
        var keepEdge = inKeep && (x === kx0 || x === kx1 || y === ky0 || y === ky1);
        var type = edge || keepEdge ? "cwall" : inKeep ? "floor" : "cobble";
        cells[x + "," + y] = Tiles.make(type, x, y);
        if (type === "cobble") { courtyard.inside.push([x, y]); }
        if (type === "floor") { keep.inside.push([x, y]); }
      }
    }
    // Gates in the outer wall, and the keep's door facing south.
    [[cx, y0], [cx, y1], [x0, cy], [x1, cy]].forEach(function (g) { cells[g[0] + "," + g[1]] = Tiles.make("cobble", g[0], g[1]); });
    cells[cx + "," + ky1] = Tiles.make("bdoor", cx, ky1);
    cells[cx + "," + (ky0 + 1)] = Tiles.make("throne", cx, ky0 + 1);
    keep.inside = keep.inside.filter(function (c) { return !(c[0] === cx && c[1] === ky0 + 1); });
    return { left: x0, right: x1, top: y0, bottom: y1, courtyard: courtyard, keep: keep, throneSpot: [cx, ky0 + 2], gate: [cx, y1] };
  },

  // One guard in the courtyard for every 4 soldiers the faction pays (fired soldiers go home).
  syncGuards: function (level) {
    var castle = level.castle;
    if (!castle) { return; }
    var f = Economy.faction(level.poi.faction);
    var want = Math.min(10, Math.ceil(f.soldiers / 4));
    while (castle.guards.length > want) {
      var g = castle.guards.pop();
      level.beings.splice(level.beings.indexOf(g), 1);
      if (level.scheduler) { level.scheduler.remove(g); }
    }
    var spots = castle.courtyard.inside.filter(function (c) { return !Game.beingAt(c[0], c[1], level); });
    while (castle.guards.length < want && spots.length) {
      var c = spots.splice(Math.floor(ROT.RNG.getUniform() * spots.length), 1)[0];
      var guard = new Villager(c[0], c[1], { name: "Guard", role: "soldier", work: castle.courtyard, home: castle.courtyard, level: level, faction: f });
      castle.guards.push(guard);
      level.beings.push(guard);
      if (level.scheduler) { level.scheduler.add(guard, true); }
    }
  },

  // A floor cell near the middle of a building that isn't furniture.
  _centerSpot: function (level, b) {
    var cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2;
    var best = null, bd = Infinity;
    b.inside.forEach(function (c) {
      var cell = level.cells[c[0] + "," + c[1]];
      if (cell.type !== "floor") { return; }
      var d = Math.abs(c[0] - cx) + Math.abs(c[1] - cy);
      if (d < bd) { bd = d; best = c; }
    });
    return best;
  },

  // Is the rectangle all grass or trees (nothing built)?
  _clear: function (cells, x0, y0, w, h) {
    for (var x = x0; x < x0 + w; x++) {
      for (var y = y0; y < y0 + h; y++) {
        var c = cells[x + "," + y];
        if (!c || (c.type !== "grass" && c.type !== "tree")) { return false; }
      }
    }
    return true;
  }
};

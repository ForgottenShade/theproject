// Factions, towns, goods, caravans and taxes. Everything here runs on the clock: once every game
// hour, wherever the player is (world map, a town or a dungeon).
//
// Goods: grain, stone, metal and luxury goods. Each town produces one or two of them (that's what
// its businesses are: farms, a quarry, a smelter, a weavers' hall). Every hour each town:
//   - produces its goods (more people, more goods),
//   - grows if it has grain in store (growing towns eat into it); with none, it slowly shrinks as
//     people leave for towns with bread,
//   - builds houses with stone when it runs out of room (no stone, no growth), and uses a little
//     stone for upkeep,
//   - feeds its blacksmith metal (no metal, the forge stands idle and earns nothing),
//   - (capital only) consumes luxury goods at court.
// Prices follow supply and demand: price = base x demand / supply, kept between 0.25x and 4x.
// Demand is two days of what the town uses; supply is what's in its stores. Only the four trade
// goods have floating prices: everything else in the shops keeps its fixed price.
//
// Wealth: a town's income per hour is its people (crafts and trade) plus the value of what it made
// at local prices. A tenth of that is owed as tax. Each faction's tax collector walks the roads from
// the capital round its towns, collects, and pays it into the treasury at the capital.
//
// The capital pays its own tax straight into the treasury every midnight; the collector, on
// horseback, covers two squares an hour.
//
// The treasury pays the soldiers at the castle (2 gold a day each, at midnight). Soldiers it can't
// pay are fired. It also buys metal for their gear and stone to keep the castle in repair, from the
// capital's market (so the capital wants metal and stone, and caravans bring them). With money to
// spare it hires more soldiers, up to the castle's 40. Caravans pay a tenth of their profit on
// each load to their own treasury (and the merchants spend anything over 1000 gold).
//
// Caravans: one per castle (so one per faction). A caravan looks for the best deal it can make:
// buy a good where it's cheap, carry it to a town (of any faction) where it's dearest compared
// with here (the biggest price ratio, for the biggest load, not too far), sell. Luxury goods for
// its own capital count half again. It moves one square per game hour, so you can catch it.
// Walk into a caravan on the world map to trade with it.
var Economy = {
  GOODS: ["grain", "stone", "metal", "luxury"],
  BASE: { grain: 4, stone: 6, metal: 20, luxury: 50 },          // gold per unit at normal demand
  PRODUCE: { grain: 1.2, stone: 0.6, metal: 0.4, luxury: 0.25 }, // units per hour per 1000 people
  BUSINESS: { grain: "farms", stone: "a quarry", metal: "a smelter", luxury: "a weavers' hall" },
  FACTION_STYLE: [
    { color: "#e04848", leader: "King Alonso" },
    { color: "#4a7ae8", leader: "Queen Beatriz" },
    { color: "#e8b830", leader: "Duke Ramiro" }
  ],
  MAX_STOCK: 400,
  WAGE: 2,            // gold per soldier per day
  MAX_SOLDIERS: 40,
  TAX: 0.1,

  factions: [],
  towns: [],
  caravans: [],
  collectors: [],
  news: [],          // recent events, newest last: { day, text }
  _minutes: 0,
  _trees: {},

  // ---- Setting up a new world ----

  init: function (overworld) {
    this.overworld = overworld;
    this.towns = overworld.towns;
    this.factions = [];
    this.caravans = [];
    this.collectors = [];
    this.news = [];
    this._minutes = 0;
    this._trees = {};
    var self = this;

    for (var f = 0; f < Overworld.FACTIONS; f++) {
      var capital = this.towns.filter(function (t) { return t.faction === f && t.capital; })[0];
      var style = this.FACTION_STYLE[f];
      this.factions.push({
        index: f, name: "Kingdom of " + capital.name, color: style.color, leader: style.leader,
        capital: capital, treasury: 400, soldiers: 20, castle: 100, unpaid: 0, taxToday: 0, todayTax: 0,
        towns: this.towns.filter(function (t) { return t.faction === f; })
      });
    }

    // Goods: a capital farms grain (it has the most mouths to feed). Each faction's regional towns
    // share out stone, metal and luxury goods (one each, in some order), and each also gets a
    // second good at random, often grain.
    this.factions.forEach(function (fac) {
      var regional = fac.towns.filter(function (t) { return !t.capital; });
      var main = ROT.RNG.shuffle(["stone", "metal", "luxury"]);
      regional.forEach(function (t, i) {
        t.goods = [main[i % 3]];
        var extra = ROT.RNG.getItem(["grain", "grain", "stone", "metal"]);
        if (t.goods.indexOf(extra) < 0) { t.goods.push(extra); }
      });
      fac.capital.goods = ["grain"];
    });

    this.towns.forEach(function (t) {
      t.pop = t.capital ? ROT.RNG.getUniformInt(2600, 3600) : ROT.RNG.getUniformInt(350, 1100);
      t.housing = Math.round(t.pop * 1.05);
      t.stock = {};
      self.GOODS.forEach(function (g) { t.stock[g] = Math.round(self.target(t, g) * (0.4 + ROT.RNG.getUniform() * 0.8)); });
      t.goods.forEach(function (g) { t.stock[g] += 30; });
      t.taxOwed = 0;
      t.income = 0;       // gold per day (a running average)
      t.forgeIdle = false;
      t.hungry = false;
    });

    this.factions.forEach(function (fac) {
      var c = new Caravan(fac);
      self.caravans.push(c);
      overworld.beings.push(c);
      var tc = new TaxCollector(fac);
      self.collectors.push(tc);
      overworld.beings.push(tc);
    });
  },

  faction: function (i) { return this.factions[i]; },

  // ---- Prices ----

  // How much of good g the town uses per hour.
  use: function (t, g) {
    var k = t.pop / 1000;
    if (g === "grain") { return 0.5 * k; }
    if (g === "stone") { return 0.12 * k + (t.capital ? 0.15 : 0); }
    if (g === "metal") { return 0.08 + (t.capital ? this.factions[t.faction].soldiers * 0.001 : 0); }
    return t.capital ? 0.15 * k : 0.02; // luxury: the court
  },

  // Demand: two days' use (at least a little).
  target: function (t, g) { return Math.max(8, 48 * this.use(t, g)); },

  // The going rate for one unit of g in town t (not rounded).
  rawPrice: function (t, g) {
    var ratio = this.target(t, g) / Math.max(0.5, t.stock[g]);
    return this.BASE[g] * Math.max(0.25, Math.min(4, ratio));
  },

  // What the player pays for one unit, and what they get for one.
  buyPrice: function (t, g) { return Math.max(1, Math.round(this.rawPrice(t, g))); },
  sellPrice: function (t, g) { return Math.max(1, Math.floor(this.rawPrice(t, g) * 0.8)); },

  isGood: function (id) { return this.GOODS.indexOf(id) >= 0; },

  // ---- Time ----

  // Called whenever the clock moves. Runs one economy tick per whole game hour.
  advance: function (minutes) {
    if (!this.factions.length) { return; }
    this._minutes += minutes;
    while (this._minutes >= 60) {
      this._minutes -= 60;
      this.tick();
    }
  },

  tick: function () {
    var self = this;
    var newDay = Math.floor(Clock.minutes / 60) % 24 === 0;
    this.towns.forEach(function (t) { self._townHour(t); });
    this.caravans.forEach(function (c) { c.hour(); });
    this.collectors.forEach(function (c) { c.hour(); });
    if (newDay) { this.factions.forEach(function (f) { self._payday(f); }); }
  },

  _townHour: function (t) {
    var self = this;
    var k = t.pop / 1000;
    var made = 0;
    t.goods.forEach(function (g) {
      var q = self.PRODUCE[g] * k;
      t.stock[g] += q;
      made += q * self.rawPrice(t, g);
    });

    // Grain: a town with grain in store grows (if it has room, or the stone to build), and the
    // growing eats into the store. Without grain people drift away to other towns.
    var need = this.use(t, "grain");
    var eaten = Math.min(t.stock.grain, need);
    t.stock.grain -= eaten;
    t.hungry = eaten < need * 0.999;
    t.stock.stone = Math.max(0, t.stock.stone - 0.05 * k); // upkeep: patching roofs and walls
    if (!t.hungry) {
      var grow = t.pop * 0.0008;
      if (t.pop + grow > t.housing) {
        // Build houses: 1 stone houses 20 people.
        var stone = Math.min(t.stock.stone, (t.pop + grow - t.housing) / 20 + 0.1 * k);
        t.stock.stone -= stone;
        t.housing += stone * 20;
      }
      t.pop = Math.min(t.housing, t.pop + grow);
    } else {
      t.pop -= t.pop * 0.0005 * (1 - eaten / need);
    }
    t.pop = Math.max(50, t.pop);

    // The blacksmith needs metal to work.
    var metal = 0.08;
    t.forgeIdle = t.stock.metal < metal;
    if (!t.forgeIdle) { t.stock.metal -= metal; made += 2; }

    // The court eats luxury goods.
    if (t.capital) { t.stock.luxury = Math.max(0, t.stock.luxury - this.use(t, "luxury")); }

    this.GOODS.forEach(function (g) { t.stock[g] = Math.min(self.MAX_STOCK, t.stock[g]); });

    var income = k * 4 + made * 0.5;
    t.income = t.income * 23 / 24 + income; // ~ gold per day
    t.taxOwed += income * this.TAX;
  },

  // Midnight at the castle: pay the soldiers (or fire them), buy their metal, repair the castle,
  // maybe hire.
  _payday: function (f) {
    var cap = f.capital;
    // The capital's own tax goes straight in.
    var own = Math.floor(cap.taxOwed);
    cap.taxOwed -= own;
    f.treasury += own;
    f.todayTax = (f.todayTax || 0) + own;
    var wages = f.soldiers * this.WAGE;
    if (f.treasury < wages) {
      var keep = Math.floor(f.treasury / this.WAGE);
      var fired = f.soldiers - keep;
      f.soldiers = keep;
      f.unpaid = fired;
      this.addNews(f.name + " couldn't pay its soldiers: " + fired + " were sent home.");
      wages = keep * this.WAGE;
    } else {
      f.unpaid = 0;
    }
    f.treasury -= wages;

    // Gear for the soldiers: 0.02 metal each a day, bought at the capital's price.
    this._buyForCastle(f, "metal", f.soldiers * 0.02);
    // Castle upkeep: 3 stone a day. Without it the walls crumble a little.
    var got = this._buyForCastle(f, "stone", 3);
    f.castle = Math.max(0, Math.min(100, f.castle + (got >= 3 ? 2 : -3)));

    // Hire: with a week of wages in hand, 2 more soldiers a day (3 metal each for their gear).
    if (f.soldiers < this.MAX_SOLDIERS && f.treasury > (f.soldiers + 2) * this.WAGE * 7) {
      var hired = 0;
      while (hired < 2 && f.soldiers < this.MAX_SOLDIERS && this._buyForCastle(f, "metal", 3) >= 3) { f.soldiers++; hired++; }
    }
    // The court spends a tenth of anything over 2000 gold on feasts and finery (it goes to the
    // capital's craftsmen, so it comes back as their income).
    if (f.treasury > 2000) {
      var spend = (f.treasury - 2000) * 0.1;
      f.treasury -= spend;
      cap.income += spend * 0.1;
    }
    f.taxToday = f.todayTax || 0; // what came in during the last day
    f.taxRate = (f.taxRate || f.taxToday) * 6 / 7 + f.taxToday / 7; // a running average, per day
    f.todayTax = 0;
  },

  // The treasury buys up to `qty` of good g from the capital's stores. Returns how much it got.
  _buyForCastle: function (f, g, qty) {
    var cap = f.capital;
    var price = this.rawPrice(cap, g);
    var q = Math.min(qty, cap.stock[g], f.treasury / price);
    if (q <= 0) { return 0; }
    cap.stock[g] -= q;
    f.treasury -= q * price;
    cap.income += q * price * 0.1;
    return q;
  },

  addNews: function (text) {
    this.news.push({ day: Clock.day(), text: text });
    if (this.news.length > 6) { this.news.shift(); }
  },

  // ---- Getting around ----

  // Cheapest travel route between two towns (along roads where possible), as a list of cells
  // from the first town to the second. Cached per starting town.
  route: function (from, to) {
    var tree = this._trees[from.index];
    if (!tree) { tree = this._trees[from.index] = Overworld.costTree(this.overworld, from.pos, Overworld.travelCost); }
    var key = to.pos[0] + "," + to.pos[1];
    if (!(key in tree.dist)) { return null; }
    var path = [];
    while (key) { path.push(key.split(",").map(Number)); key = tree.prev[key]; }
    return path.reverse();
  },

  routeLength: function (from, to) {
    var r = this.route(from, to);
    return r ? r.length : Infinity;
  },

  // Where a caravan or collector waits at a town: the first square of the road out of it.
  besideTown: function (t) {
    var w = this.overworld;
    for (var i = 0; i < 8; i++) {
      var x = t.pos[0] + ROT.DIRS[8][i][0], y = t.pos[1] + ROT.DIRS[8][i][1];
      var c = w.cells[x + "," + y];
      if (c && c.road && !w.pois[x + "," + y]) { return [x, y]; }
    }
    for (var j = 0; j < 8; j++) {
      var x2 = t.pos[0] + ROT.DIRS[8][j][0], y2 = t.pos[1] + ROT.DIRS[8][j][1];
      var c2 = w.cells[x2 + "," + y2];
      if (c2 && c2.passable && !w.pois[x2 + "," + y2]) { return [x2, y2]; }
    }
    return t.pos.slice();
  },

  // The town whose market prices apply where you stand (the nearest one).
  nearestTown: function (x, y) {
    var best = null, bd = Infinity;
    this.towns.forEach(function (t) {
      var d = Math.max(Math.abs(t.pos[0] - x), Math.abs(t.pos[1] - y));
      if (d < bd) { bd = d; best = t; }
    });
    return best;
  },

  // ---- The player's trade ----

  // A market the player can trade goods with: a town's stores, or a caravan's cargo.
  // { name, prices: town, stock: {g: qty}, purse (Infinity for towns), owner }
  townMarket: function (t) {
    return { kind: "town", name: t.name, prices: t, stock: t.stock, town: t };
  },

  caravanMarket: function (c) {
    return { kind: "caravan", name: c.name, prices: this.nearestTown(c._x, c._y), stock: c.cargo, caravan: c };
  },

  marketBuyPrice: function (m, g) { return this.buyPrice(m.prices, g) + (m.kind === "caravan" ? 1 : 0); },
  marketSellPrice: function (m, g) { return this.sellPrice(m.prices, g); },

  // The player buys one unit of g. Returns an error message, or null when it worked.
  playerBuy: function (m, g) {
    var inv = Game.player.inventory;
    var price = this.marketBuyPrice(m, g);
    if (m.stock[g] < 1) { return "There's no " + Items.get(g).name.toLowerCase() + " left to buy."; }
    if (inv.count("gold") < price) { return "You can't afford it (" + price + " gold, you have " + inv.count("gold") + ")."; }
    var test = new Container("test", inv.cols, inv.rows);
    test.slots = inv.slots.map(function (s) { return s && { id: s.id, qty: s.qty }; });
    test.remove("gold", price);
    if (test.add(g, 1) > 0) { return "Your bag is full."; }
    inv.remove("gold", price);
    inv.add(g, 1);
    m.stock[g] -= 1;
    if (m.caravan) { m.caravan.purse += price; } else { m.town.income += price * 0.1; }
    return null;
  },

  // The player sells `qty` units of g. Returns { gold, error }.
  playerSell: function (m, g, qty) {
    var price = this.marketSellPrice(m, g);
    if (m.caravan) {
      var room = m.caravan.capacity - m.caravan.load();
      qty = Math.min(qty, room, Math.floor(m.caravan.purse / price));
      if (qty < 1) { return { gold: 0, error: m.caravan.purse < price ? "The caravan master is out of money." : "The caravan is fully loaded." }; }
      m.caravan.purse -= qty * price;
    } else {
      m.town.income += qty * price * 0.1;
    }
    m.stock[g] += qty;
    return { gold: qty * price, qty: qty };
  },

  // ---- Bits for the screen ----

  popText: function (t) { return Math.round(t.pop).toLocaleString("en-US"); },
  GOOD_NAMES: { grain: "grain", stone: "stone", metal: "metal", luxury: "luxury goods" },
  goodsText: function (t) { var n = this.GOOD_NAMES; return t.goods.map(function (g) { return n[g]; }).join(", "); }
};

// ---- People on the roads ----

// Something that walks the world map one square per game hour, along a route of cells.
var Traveller = function (faction, ch) {
  this.faction = faction;
  var spot = Economy.besideTown(faction.capital);
  Entity.call(this, spot[0], spot[1], ch, faction.color);
  this.hostile = false;
  this.level = null; // set once it's on the overworld (it is never anywhere else)
  this.path = null;
  this.at = faction.capital; // the town it's at (or heading for)
  this.wait = 2;
};
Traveller.prototype = Object.create(Entity.prototype);
Traveller.prototype.constructor = Traveller;
Traveller.prototype.isAlive = function () { return true; };
Traveller.prototype.act = function () {};

// Head for town `t`.
Traveller.prototype.goTo = function (t) {
  var route = Economy.route(this.at, t);
  this.path = route ? route.slice(1, -1) : [];
  // From where it waited beside the town, walk back through the town if the road leaves elsewhere.
  var first = this.path[0];
  if (first && Math.max(Math.abs(first[0] - this._x), Math.abs(first[1] - this._y)) > 1) { this.path.unshift(this.at.pos.slice()); }
  this.at = t;
  if (!this.path.length) { this.path = null; }
};

// One hour: wait, or take a step. Returns true when it just arrived.
Traveller.prototype.hour = function () {
  if (this.wait > 0) { this.wait--; if (!this.wait) { this.depart(); } return false; }
  if (!this.path) { this.arrive(); return true; }
  var next = this.path.shift();
  this._moveTo(next[0], next[1]);
  if (!this.path.length) { this.path = null; this.arrive(); return true; }
  return false;
};

// A trade caravan.
var Caravan = function (faction) {
  Traveller.call(this, faction, "C");
  this.name = faction.capital.name + " caravan";
  this.stats = { name: this.name };
  this.capacity = 60;
  this.purse = 250;
  this.cargo = { grain: 0, stone: 0, metal: 0, luxury: 0 };
  this.paid = 0;    // what this load cost
  this.plan = null; // { good, qty, to }
};
Caravan.prototype = Object.create(Traveller.prototype);
Caravan.prototype.constructor = Caravan;

Caravan.prototype.load = function () {
  var c = this.cargo;
  return Economy.GOODS.reduce(function (n, g) { return n + c[g]; }, 0);
};

// At a town: sell everything, then plan and buy for the next leg.
Caravan.prototype.arrive = function () {
  var t = this.at;
  var self = this;
  var takings = 0;
  Economy.GOODS.forEach(function (g) {
    var q = self.cargo[g];
    if (!q) { return; }
    var price = Economy.rawPrice(t, g);
    t.stock[g] = Math.min(Economy.MAX_STOCK, t.stock[g] + q);
    takings += q * price;
    t.income += q * price * 0.1;
    self.cargo[g] = 0;
  });
  // A tenth of the profit goes to the faction's treasury; the merchants spend anything over 1000.
  var profit = takings - (this.paid || 0);
  if (profit > 0) { this.faction.treasury += profit * 0.1; this.faction.todayTax = (this.faction.todayTax || 0) + profit * 0.1; takings -= profit * 0.1; }
  this.purse = Math.min(1000, this.purse + takings);
  this.paid = 0;
  this.wait = 3;
};

// Pick the best deal from here: buy where it's cheap, sell where it's dear.
Caravan.prototype.depart = function () {
  var t = this.at;
  var self = this;
  var best = null;
  Economy.GOODS.forEach(function (g) {
    var spare = t.stock[g] - Economy.target(t, g) * 0.5;
    var cost = Economy.rawPrice(t, g);
    var qty = Math.floor(Math.min(self.capacity, spare, self.purse / cost));
    if (qty < 3) { return; }
    Economy.towns.forEach(function (d) {
      if (d === t) { return; }
      // Supply and demand: go where the good is scarcest compared with here (price ratio), for
      // as big a load as possible, and not too far.
      var ratio = Economy.rawPrice(d, g) * 0.9 / cost;
      if (ratio < 1.3) { return; }
      var value = (ratio - 1) * qty / (Economy.routeLength(t, d) + 24);
      if (g === "luxury" && d === self.faction.capital) { value *= 1.5; } // tribute to the court
      if (!best || value > best.value) { best = { value: value, good: g, qty: qty, to: d, cost: cost }; }
    });
  });
  if (best) {
    this.cargo[best.good] += best.qty;
    t.stock[best.good] -= best.qty;
    this.purse -= best.qty * best.cost;
    this.paid = best.qty * best.cost;
    t.income += best.qty * best.cost * 0.1;
    this.plan = best;
    this.goTo(best.to);
  } else {
    // Nothing worth carrying: go and look in another of our own towns.
    var others = this.faction.towns.filter(function (o) { return o !== t; });
    this.plan = null;
    this.goTo(ROT.RNG.getItem(others));
  }
};

// The tax collector: capital -> each regional town -> capital, collecting what each town owes.
var TaxCollector = function (faction) {
  Traveller.call(this, faction, "$");
  this.name = "Tax collector of the " + faction.name;
  this.stats = { name: "Tax collector" };
  this.purse = 0;
  this.round = [];
};
TaxCollector.prototype = Object.create(Traveller.prototype);
TaxCollector.prototype.constructor = TaxCollector;

// On horseback: two squares an hour.
TaxCollector.prototype.hour = function () {
  if (Traveller.prototype.hour.call(this) || this.wait > 0) { return; }
  Traveller.prototype.hour.call(this);
};

TaxCollector.prototype.arrive = function () {
  var t = this.at;
  var f = this.faction;
  if (t === f.capital) {
    f.treasury += this.purse;
    f.todayTax = (f.todayTax || 0) + this.purse;
    this.purse = 0;
    this.wait = 6;
  } else {
    var tax = Math.floor(t.taxOwed);
    this.purse += tax;
    t.taxOwed -= tax;
    this.wait = 1;
  }
};

TaxCollector.prototype.depart = function () {
  var f = this.faction;
  if (!this.round.length) {
    if (this.at !== f.capital) { this.goTo(f.capital); return; }
    // A new round: the capital pays its own tax straight in, then off round the towns (nearest first).
    var tax = Math.floor(f.capital.taxOwed);
    f.treasury += tax; f.todayTax = (f.todayTax || 0) + tax;
    f.capital.taxOwed -= tax;
    var from = f.capital;
    var left = f.towns.filter(function (t) { return !t.capital; });
    while (left.length) {
      left.sort(function (a, b) { return Economy.routeLength(from, a) - Economy.routeLength(from, b); });
      from = left.shift();
      this.round.push(from);
    }
  }
  this.goTo(this.round.shift());
};

// Walking into a caravan opens its trading window; the tax collector just talks.
Caravan.prototype.interact = function () {
  var where = this.plan ? " Carrying " + this.plan.qty + " x " + Items.get(this.plan.good).name.toLowerCase() + " to " + this.plan.to.name + "." :
    " Heading for " + this.at.name + ".";
  InventoryUI.openShop(Shops.caravan(this));
  UI.log("The " + this.name + " (" + this.faction.name + ")." + where + " Prices are " + Economy.nearestTown(this._x, this._y).name + "'s.");
};

TaxCollector.prototype.interact = function () {
  UI.show("The " + this.name + ": \u201cI'm on my way to " + this.at.name + ". " + Math.floor(this.purse) +
    " gold in the bag so far, and every coin of it belongs to " + this.faction.leader + ". Move along.\u201d");
};

// Shops in town. Each shop shows its stock as a grid of lots: one item, or a bundle of cheap
// things (arrows come in twenties), each with a price in gold coins. Stock never runs out.
// Buying takes gold coins from your bag; selling gives you half the item's price, rounded down.
var Shops = {
  STOCK: {
    // The tavern: food and drink (beds are rented by pressing E on one, 1 gold a night).
    tavern: [["hot_meal", 1, 1], ["ale", 2, 1], ["wine", 1, 2], ["bread", 5, 1], ["cheese", 5, 1], ["waterskin", 3, 1]],
    // The blacksmith: 5e weapons, armour and shields.
    blacksmith: [
      ["club", 1], ["dagger", 1], ["handaxe", 1], ["mace", 1], ["quarterstaff", 1], ["spear", 1],
      ["short_sword", 1], ["scimitar", 1], ["rapier", 1], ["longsword", 1], ["battle_axe", 1], ["war_hammer", 1],
      ["morningstar", 1], ["flail", 1], ["glaive", 1], ["halberd", 1], ["greataxe", 1], ["greatsword", 1],
      ["maul", 1], ["shortbow", 1], ["longbow", 1], ["light_crossbow", 1], ["heavy_crossbow", 1],
      ["padded_armor", 1], ["leather_armor", 1], ["studded_leather", 1], ["hide_armor", 1], ["chain_shirt", 1],
      ["scale_mail", 1], ["breastplate", 1], ["half_plate", 1], ["ring_mail", 1], ["chainmail", 1],
      ["splint_armor", 1], ["plate_armor", 1], ["wooden_shield", 1], ["iron_shield", 1]
    ],
    // The general store: provisions, adventuring gear, ammunition and potions.
    general: [
      ["rations", 2, 1], ["bread", 5, 1], ["apple", 10, 1], ["dried_meat", 5, 1], ["waterskin", 3, 1],
      ["camp_kit", 1], ["torch", 10, 1], ["rope", 1], ["bandage", 10, 1], ["lockpick", 1],
      ["arrows", 20, 1], ["bolts", 20, 1], ["potion_heal", 1], ["antidote", 1]
    ]
  },

  // Build a shop: { kind, name, keeper, stock: Container of lots { id, qty, price } }.
  create: function (kind, name, keeper) {
    var lots = this.STOCK[kind];
    var cols = 6;
    var stock = new Container(name, cols, Math.ceil(lots.length / cols));
    lots.forEach(function (l, i) {
      var qty = l[1];
      var price = l.length > 2 ? l[2] : Math.max(1, Math.ceil(Items.price(l[0]) * qty));
      stock.slots[i] = { id: l[0], qty: qty, price: price };
    });
    return { kind: kind, name: name, keeper: keeper, stock: stock, lots: stock.slots.slice() };
  },

  // A shop that also deals in trade goods (a town's general store, or a caravan): after the fixed
  // lots come the four goods at today's market price, with how many are in stock.
  withMarket: function (shop, market) {
    shop.market = market;
    this.refreshMarket(shop);
    return shop;
  },

  // A caravan's trading window: only the goods it carries.
  caravan: function (c) {
    var shop = { kind: "caravan", name: c.name, keeper: { name: "The caravan master" }, lots: [], stock: null };
    return this.withMarket(shop, Economy.caravanMarket(c));
  },

  refreshMarket: function (shop) {
    if (!shop.market) { return; }
    if (shop.market.caravan) { shop.market = Economy.caravanMarket(shop.market.caravan); } // prices of the nearest town
    var cols = 6;
    var lots = shop.lots.slice();
    var m = shop.market;
    Economy.GOODS.forEach(function (g) {
      lots.push({ id: g, qty: Math.floor(m.stock[g]), price: Economy.marketBuyPrice(m, g), market: true });
    });
    var stock = new Container(shop.name, cols, Math.ceil(lots.length / cols));
    lots.forEach(function (l, i) { stock.slots[i] = l; });
    shop.stock = stock;
  },

  gold: function () { return Game.player.inventory.count("gold"); },

  // Buy the lot in stock slot `index`. Returns true if it worked.
  buy: function (shop, index) {
    var lot = shop.stock.slots[index];
    if (!lot) { return false; }
    if (lot.market) {
      var err = Economy.playerBuy(shop.market, lot.id);
      UI.show(err || "You buy a " + Items.get(lot.id).name.toLowerCase() + " for " + lot.price + " gold.");
      this.refreshMarket(shop);
      return !err;
    }
    var item = Items.get(lot.id);
    var inv = Game.player.inventory;
    if (this.gold() < lot.price) {
      UI.show("You can't afford the " + item.name + " (" + lot.price + " gold, you have " + this.gold() + ").");
      return false;
    }
    // Does it fit? Try on a copy of the bag first (paying might also free a slot).
    var test = new Container("test", inv.cols, inv.rows);
    test.slots = inv.slots.map(function (s) { return s && { id: s.id, qty: s.qty }; });
    test.remove("gold", lot.price);
    if (test.add(lot.id, lot.qty) > 0) { UI.show("Your bag is full."); return false; }
    inv.remove("gold", lot.price);
    inv.add(lot.id, lot.qty);
    UI.show("You buy " + (lot.qty > 1 ? lot.qty + " x " : "the ") + item.name + " for " + lot.price + " gold.");
    return true;
  },

  // What they'd pay for a stack: half price, rounded down.
  // In a market (general store, caravan), trade goods sell at the local market price.
  offer: function (stack, shop) {
    if (stack.id === "gold" || stack.id === "ananas") { return 0; }
    if (shop && shop.market && Economy.isGood(stack.id)) { return Economy.marketSellPrice(shop.market, stack.id) * stack.qty; }
    if (shop && shop.kind === "caravan") { return 0; }
    return Math.floor(Items.price(stack.id) * stack.qty / 2);
  },

  // Sell the stack in bag slot `index`.
  sell: function (shop, index) {
    var inv = Game.player.inventory;
    var stack = inv.slots[index];
    if (!stack) { return false; }
    var item = Items.get(stack.id);
    if (stack.id === "ananas") { UI.show("You're not selling the ananas!"); return false; }
    if (stack.id === "gold") { return false; }
    if (shop.market && Economy.isGood(stack.id)) {
      var r = Economy.playerSell(shop.market, stack.id, stack.qty);
      if (r.error) { UI.show(r.error); return false; }
      stack.qty -= r.qty;
      if (stack.qty <= 0) { inv.slots[index] = null; }
      inv.add("gold", r.gold);
      UI.show("You sell " + r.qty + " x " + item.name + " for " + r.gold + " gold.");
      this.refreshMarket(shop);
      return true;
    }
    if (shop.kind === "caravan") { UI.show("The caravan only deals in grain, stone, metal and luxury goods."); return false; }
    var value = this.offer(stack, shop);
    if (value < 1) { UI.show(shop.keeper.name + " won't give you anything for that."); return false; }
    inv.slots[index] = null;
    var left = inv.add("gold", value);
    if (left > 0) { inv.slots[index] = stack; inv.remove("gold", value - left); UI.show("No room for the gold."); return false; }
    UI.show("You sell " + (stack.qty > 1 ? stack.qty + " x " : "the ") + item.name + " for " + value + " gold.");
    return true;
  }
};

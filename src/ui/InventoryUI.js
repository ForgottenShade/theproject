// The inventory window (4x4 bag) and the chest window, with drag and drop between them.
//   drag a stack onto an empty slot      -> it moves there
//   drag onto the same (stackable) item  -> they merge, up to the stack limit
//   drag onto a different item           -> the two swap places
//   shift-click (or double-click) a stack -> it jumps to the other window
// Next to the bag is the character sheet: your 5e stats and four equipment slots
// (weapon, armour, shield, cloak). Drag gear onto a slot, or double-click it in the bag,
// to equip it; drag it back (or double-click the slot) to take it off. Double-clicking a
// healing potion in the bag drinks it.
var InventoryUI = {
  open: false,  // is the bag window showing?
  chest: null,  // the chest being looted, if any
  shop: null,   // the shop you're trading with, if any (src/game/Shops.js)

  init: function () {
    var self = this;
    document.getElementById("chest-takeall").addEventListener("click", function () { self.takeAll(); });
    document.getElementById("chest-close").addEventListener("click", function () { self.closeChest(); });
    document.getElementById("inv-close").addEventListener("click", function () { self.toggle(false); });
    document.getElementById("shop-close").addEventListener("click", function () { self.closeShop(); });
    this.tooltip = document.getElementById("tooltip");
  },

  toggle: function (show) {
    this.open = (show === undefined) ? !this.open : show;
    if (!this.open) { this.closeChest(); this.closeShop(); }
    this.refresh();
  },

  openChest: function (chest) {
    this.chest = chest;
    this.open = true;
    this.refresh();
  },

  // Trading: the shop window and your bag side by side.
  openShop: function (shop) {
    this.shop = shop;
    Shops.refreshMarket(shop);
    this.open = true;
    UI.show(shop.keeper.name + " at the " + shop.name + ": \u201cHave a look.\u201d Double-click to buy; drag or shift-click your things here to sell." +
      (shop.market ? " Trade goods go at today's " + shop.market.prices.name + " price, one at a time." : ""));
    this.refresh();
  },

  closeShop: function () {
    if (!this.shop) { return; }
    this.shop = null;
    this.refresh();
    if (Game.running) { Game.render(); }
  },

  closeChest: function () {
    if (!this.chest) { return; }
    this.chest = null;
    this.refresh();
    if (Game.running) { Game.render(); } // an emptied chest looks different on the map
  },

  takeAll: function () {
    if (!this.chest) { return; }
    var inv = Game.player.inventory;
    var full = false;
    for (var i = 0; i < this.chest.slots.length; i++) {
      if (this.chest.slots[i] && Container.quickMove(this.chest, i, inv) > 0) { full = true; }
    }
    if (full) { UI.show("Your bag is full."); }
    this.changed();
  },

  // After any move: redraw both grids and see if the ananas is in the bag.
  changed: function () {
    this.refresh();
    Game.checkWin();
  },

  _containers: function () {
    return { inv: Game.player && Game.player.inventory, chest: this.chest, shop: this.shop && this.shop.stock };
  },

  refresh: function () {
    var invWin = document.getElementById("inventory");
    var chestWin = document.getElementById("chest");
    invWin.hidden = !this.open || !Game.player;
    document.getElementById("gear").hidden = invWin.hidden || !!this.shop; // the shop takes its place
    chestWin.hidden = !this.chest;
    if (this.chest) { document.getElementById("chest-title").textContent = this.chest.name; }
    var shopWin = document.getElementById("shop");
    shopWin.hidden = !this.shop;
    if (this.shop) {
      document.getElementById("shop-title").textContent = this.shop.name + " \u00b7 " + this.shop.keeper.name;
      document.getElementById("shop-gold").textContent = "Your gold: " + Game.player.inventory.count("gold");
      this._renderGrid(document.getElementById("shop-grid"), this.shop.stock, "shop");
    }
    if (Game.player && this.open) { this._renderSheet(); }
    document.getElementById("windows").classList.toggle("modal", !!(this.chest || this.shop));
    if (Game.player) { this._renderGrid(document.getElementById("inv-grid"), Game.player.inventory, "inv"); }
    if (this.chest) { this._renderGrid(document.getElementById("chest-grid"), this.chest, "chest"); }
    this.hideTooltip();
  },

  _renderGrid: function (gridEl, container, name) {
    var self = this;
    gridEl.innerHTML = "";
    gridEl.style.gridTemplateColumns = "repeat(" + container.cols + ", 52px)";
    container.slots.forEach(function (stack, index) {
      var slot = document.createElement("div");
      slot.className = "slot";
      slot.dataset.container = name;
      slot.dataset.index = index;

      if (stack) {
        var item = Items.get(stack.id);
        slot.draggable = true;
        slot.classList.add("filled", "rarity-" + item.rarity);
        var glyph = document.createElement("span");
        glyph.className = "glyph";
        glyph.textContent = item.glyph;
        glyph.style.color = item.color;
        slot.appendChild(glyph);
        if (stack.price !== undefined) {
          var price = document.createElement("span");
          price.className = "price";
          price.textContent = stack.price + "g";
          slot.appendChild(price);
        }
        if (stack.qty > 1 || stack.market) {
          var qty = document.createElement("span");
          qty.className = "qty";
          qty.textContent = stack.qty;
          slot.appendChild(qty);
        }
        slot.addEventListener("dragstart", function (e) {
          e.dataTransfer.setData("text/plain", name + ":" + index);
          e.dataTransfer.effectAllowed = "move";
          slot.classList.add("dragging");
          self.hideTooltip();
        });
        slot.addEventListener("dragend", function () { slot.classList.remove("dragging"); });
        slot.addEventListener("mousemove", function (e) { self.showTooltip(stack, e); });
        slot.addEventListener("mouseleave", function () { self.hideTooltip(); });
        slot.addEventListener("click", function (e) { if (e.shiftKey) { self.quickMove(name, index); } });
        slot.addEventListener("dblclick", function () { self.quickMove(name, index, true); });
      }

      slot.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        slot.classList.add("over");
      });
      slot.addEventListener("dragleave", function () { slot.classList.remove("over"); });
      slot.addEventListener("drop", function (e) {
        e.preventDefault();
        var src = e.dataTransfer.getData("text/plain").split(":");
        if (src[0] === "equip") {
          if (name === "inv") { Game.player.unequip(src[1], index); }
          return;
        }
        self.move(src[0], parseInt(src[1]), name, index);
      });
      gridEl.appendChild(slot);
    });
  },

  // Move a stack between (or within) the bag and the open chest. With a shop open,
  // dragging from the shop buys and dragging to the shop sells.
  move: function (srcName, srcIndex, dstName, dstIndex) {
    if (srcName === "shop" || dstName === "shop") {
      if (srcName === "shop" && dstName === "inv") { Shops.buy(this.shop, srcIndex); }
      if (srcName === "inv" && dstName === "shop") { Shops.sell(this.shop, srcIndex); }
      this.changed();
      return;
    }
    var c = this._containers();
    if (!c[srcName] || !c[dstName]) { return; }
    Container.transfer(c[srcName], srcIndex, c[dstName], dstIndex);
    this.changed();
  },

  // Shift-click or double-click. In a shop: double-click buys; in the bag, shift-click sells and
  // double-click still uses the item.
  quickMove: function (srcName, srcIndex, dbl) {
    if (srcName === "shop") { Shops.buy(this.shop, srcIndex); this.changed(); return; }
    if (srcName === "inv" && this.shop) {
      if (dbl) { this.useItem(srcIndex); } else { Shops.sell(this.shop, srcIndex); this.changed(); }
      return;
    }
    var c = this._containers();
    var dstName = srcName === "inv" ? "chest" : "inv";
    if (!c[dstName]) { // no chest open: use the item instead (equip it, or drink it)
      if (srcName === "inv") { this.useItem(srcIndex); }
      return;
    }
    if (Container.quickMove(c[srcName], srcIndex, c[dstName]) > 0) {
      UI.show(dstName === "inv" ? "Your bag is full." : "The chest is full.");
    }
    this.changed();
  },

  // Double-click in the bag: equip weapons and armour, drink healing potions, eat and drink
  // provisions, or sleep with the camping kit.
  useItem: function (index) {
    var p = Game.player;
    var stack = p && p.inventory.slots[index];
    if (!stack || !Game.running) { return; }
    if (stack.id === "potion_heal") { p.drinkPotion(index); }
    else if (Items.FOOD[stack.id]) { p.eat(index); }
    else if (stack.id === "camp_kit") {
      if (Game.level.name === "town") { UI.show("No camping in town: the tavern has beds."); }
      else { p.sleep("camp"); }
    }
    else if (Combat.slotFor(stack.id)) { p.equipFromBag(index); }
    else { UI.show(Items.get(stack.id).name + " can't be used here."); }
    this.refresh();
  },

  // The character sheet: class, HP, AC, attack, the six abilities, and the equipment slots.
  _renderSheet: function () {
    var self = this;
    var p = Game.player;
    var st = p.stats;
    var sheet = document.getElementById("sheet");
    sheet.innerHTML = "";
    var atk = Combat.playerAttack(p);
    var line = document.createElement("div");
    line.className = "sheet-line";
    line.textContent = st.cls + " · HP " + st.hp + "/" + st.maxHp + " · AC " + p.getAC() + " · Prof +" + st.prof +
      " · " + atk.name + " " + Combat.signed(atk.bonus) + " to hit, " + atk.dice + (atk.extra ? " + " + atk.extra : "") + " " + atk.type;
    var abil = document.createElement("div");
    abil.className = "abilities";
    Combat.ABILITIES.forEach(function (k) {
      var box = document.createElement("div");
      box.className = "ability";
      var label = document.createElement("b");
      label.textContent = k.toUpperCase();
      var score = document.createElement("div");
      score.className = "score";
      score.textContent = st.abilities[k];
      var m = document.createElement("div");
      m.className = "amod";
      m.textContent = Combat.signed(Combat.mod(st.abilities[k]));
      box.append(label, score, m);
      abil.appendChild(box);
    });
    sheet.append(line, abil);

    var grid = document.getElementById("equip-grid");
    grid.innerHTML = "";
    var hints = { weapon: ")", armor: "[", shield: "]", cloak: "(" };
    Combat.SLOTS.forEach(function (slotName) {
      var wrap = document.createElement("div");
      wrap.className = "equip";
      var label = document.createElement("label");
      label.textContent = Combat.SLOT_NAMES[slotName];
      var slot = document.createElement("div");
      slot.className = "slot";
      slot.dataset.container = "equip";
      slot.dataset.slot = slotName;
      var id = p.equipment[slotName];
      if (id) {
        var item = Items.get(id);
        slot.classList.add("filled", "rarity-" + item.rarity);
        slot.draggable = true;
        var glyph = document.createElement("span");
        glyph.className = "glyph";
        glyph.textContent = item.glyph;
        glyph.style.color = item.color;
        slot.appendChild(glyph);
        slot.addEventListener("dragstart", function (e) {
          e.dataTransfer.setData("text/plain", "equip:" + slotName);
          e.dataTransfer.effectAllowed = "move";
          self.hideTooltip();
        });
        slot.addEventListener("mousemove", function (e) { self.showTooltip({ id: id, qty: 1 }, e); });
        slot.addEventListener("mouseleave", function () { self.hideTooltip(); });
        slot.addEventListener("dblclick", function () { p.unequip(slotName); });
      } else {
        slot.classList.add("empty-slot");
        slot.dataset.hint = hints[slotName];
      }
      slot.addEventListener("dragover", function (e) { e.preventDefault(); slot.classList.add("over"); });
      slot.addEventListener("dragleave", function () { slot.classList.remove("over"); });
      slot.addEventListener("drop", function (e) {
        e.preventDefault();
        var src = e.dataTransfer.getData("text/plain").split(":");
        if (src[0] === "inv") { p.equipFromBag(parseInt(src[1]), slotName); }
        self.refresh();
      });
      wrap.append(label, slot);
      grid.appendChild(wrap);
    });
  },

  showTooltip: function (stack, e) {
    var item = Items.get(stack.id);
    var t = this.tooltip;
    t.innerHTML = "";
    var name = document.createElement("div");
    name.className = "tt-name";
    name.textContent = item.name + (stack.qty > 1 ? " ×" + stack.qty : "");
    name.style.color = Items.RARITY[item.rarity].color;
    var meta = document.createElement("div");
    meta.className = "tt-meta";
    meta.textContent = item.rarity + " " + item.category.toLowerCase() + (item.maxStack > 1 ? " · stacks to " + item.maxStack : "");
    if (stack.price !== undefined) { meta.textContent += " · costs " + stack.price + " gold" + (stack.market ? " each, " + stack.qty + " in stock" : ""); }
    else if (this.shop && Shops.offer(stack, this.shop) > 0) { meta.textContent += " · sells for " + Shops.offer(stack, this.shop) + " gold"; }
    if (Items.FOOD[item.id]) { meta.textContent += " · +" + Items.FOOD[item.id] + " food"; }
    var desc = document.createElement("div");
    desc.className = "tt-desc";
    desc.textContent = item.desc;
    t.append(name, meta);
    var rules = Combat.describeItem(item.id);
    if (rules || item.category === "Armour") {
      var r = document.createElement("div");
      r.className = "tt-rules";
      r.textContent = rules || "Worn for looks: it doesn't change your AC.";
      t.append(r);
    }
    t.append(desc);
    t.hidden = false;
    // Keep it on screen: flip to the other side of the cursor near the right or bottom edge.
    var x = e.clientX + 16, y = e.clientY + 16;
    if (x + t.offsetWidth > window.innerWidth - 8) { x = e.clientX - t.offsetWidth - 12; }
    if (y + t.offsetHeight > window.innerHeight - 8) { y = e.clientY - t.offsetHeight - 12; }
    t.style.left = x + "px";
    t.style.top = y + "px";
  },

  hideTooltip: function () {
    if (this.tooltip) { this.tooltip.hidden = true; }
  }
};

// A generic fantasy item list, and the loot table that fills the dungeon's chests.
// maxStack > 1 means the item stacks in one inventory slot up to that many.
var Items = {
  RARITY: {
    common:   { weight: 60, color: "#d8d8d8" },
    uncommon: { weight: 28, color: "#6fdc6f" },
    rare:     { weight: 10, color: "#6fa8ff" },
    epic:     { weight: 2,  color: "#c77dff" }
  },

  list: [
    // Weapons
    { id: "dagger",        name: "Dagger",               glyph: ")", color: "#c0c0c0", category: "Weapon",    rarity: "common",   maxStack: 1,   desc: "A short blade. Quick, quiet and easy to hide." },
    { id: "short_sword",   name: "Short Sword",          glyph: ")", color: "#d0d0e0", category: "Weapon",    rarity: "common",   maxStack: 1,   desc: "A reliable one-handed sword." },
    { id: "longsword",     name: "Longsword",            glyph: ")", color: "#e8e8ff", category: "Weapon",    rarity: "uncommon", maxStack: 1,   desc: "A knight's blade, balanced and keen." },
    { id: "battle_axe",    name: "Battle Axe",           glyph: ")", color: "#c89060", category: "Weapon",    rarity: "uncommon", maxStack: 1,   desc: "Heavy, brutal, and very good at doors." },
    { id: "war_hammer",    name: "War Hammer",           glyph: ")", color: "#a0a0a0", category: "Weapon",    rarity: "uncommon", maxStack: 1,   desc: "Crushes armour like tin." },
    { id: "greataxe",      name: "Greataxe",             glyph: ")", color: "#b8b8a0", category: "Weapon",    rarity: "uncommon", maxStack: 1,   desc: "A huge two-handed axe, the kind orcs like." },
    { id: "spear",         name: "Spear",                glyph: "/", color: "#c8a46e", category: "Weapon",    rarity: "common",   maxStack: 1,   desc: "Keeps trouble at arm's length, and then some." },
    { id: "shortbow",      name: "Shortbow",             glyph: "}", color: "#b07a40", category: "Weapon",    rarity: "common",   maxStack: 1,   desc: "A simple hunting bow." },
    { id: "arrows",        name: "Arrows",               glyph: "|", color: "#c8a46e", category: "Ammo",      rarity: "common",   maxStack: 50,  qty: [5, 20], desc: "Fletched with grey goose feathers." },
    { id: "bolts",         name: "Crossbow Bolts",       glyph: "|", color: "#9a9a9a", category: "Ammo",      rarity: "uncommon", maxStack: 50,  qty: [5, 15], desc: "Short, heavy, iron-tipped." },
    { id: "flame_blade",   name: "Flametongue",          glyph: ")", color: "#ff7030", category: "Weapon",    rarity: "epic",     maxStack: 1,   desc: "Its edge glows like a forge and never cools." },

    // Armour
    { id: "leather_cap",   name: "Leather Cap",          glyph: "[", color: "#a0703c", category: "Armour",    rarity: "common",   maxStack: 1,   desc: "Better than nothing. Slightly." },
    { id: "iron_helm",     name: "Iron Helm",            glyph: "[", color: "#b0b0b8", category: "Armour",    rarity: "uncommon", maxStack: 1,   desc: "A dented but sturdy helmet." },
    { id: "leather_armor", name: "Leather Armour",       glyph: "[", color: "#a0703c", category: "Armour",    rarity: "common",   maxStack: 1,   desc: "Boiled leather, light and quiet." },
    { id: "chainmail",     name: "Chainmail",            glyph: "[", color: "#c0c0d0", category: "Armour",    rarity: "uncommon", maxStack: 1,   desc: "Thousands of tiny rings. Jingles a bit." },
    { id: "plate_armor",   name: "Plate Armour",         glyph: "[", color: "#e0e0f0", category: "Armour",    rarity: "rare",     maxStack: 1,   desc: "Gleaming steel plates. You'll hear yourself coming." },
    { id: "wooden_shield", name: "Wooden Shield",        glyph: "]", color: "#b07a40", category: "Armour",    rarity: "common",   maxStack: 1,   desc: "Oak boards bound with iron." },
    { id: "iron_shield",   name: "Iron Shield",          glyph: "]", color: "#b0b0b8", category: "Armour",    rarity: "uncommon", maxStack: 1,   desc: "Heavy, but it stops arrows." },
    { id: "boots",         name: "Traveller's Boots",    glyph: "[", color: "#8a6040", category: "Armour",    rarity: "common",   maxStack: 1,   desc: "Worn soft from many roads." },
    { id: "gauntlets",     name: "Gauntlets",            glyph: "[", color: "#a0a0a8", category: "Armour",    rarity: "uncommon", maxStack: 1,   desc: "Steel gloves with leather palms." },
    { id: "elven_cloak",   name: "Elven Cloak",          glyph: "(", color: "#5fd08f", category: "Armour",    rarity: "rare",     maxStack: 1,   desc: "It seems to shift colour to match its surroundings." },

    // Potions
    { id: "potion_heal",   name: "Healing Potion",       glyph: "!", color: "#ff4a5a", category: "Potion",    rarity: "common",   maxStack: 10,  qty: [1, 3], desc: "Tastes of cherries and iron. Heals 2d4+2. Double-click in your bag to drink." },
    { id: "potion_mana",   name: "Mana Potion",          glyph: "!", color: "#4a7aff", category: "Potion",    rarity: "uncommon", maxStack: 10,  qty: [1, 2], desc: "Fizzes with arcane energy." },
    { id: "antidote",      name: "Antidote",             glyph: "!", color: "#7ae05a", category: "Potion",    rarity: "common",   maxStack: 10,  qty: [1, 2], desc: "Cures most poisons, and some hangovers." },
    { id: "potion_str",    name: "Potion of Strength",   glyph: "!", color: "#ffb030", category: "Potion",    rarity: "rare",     maxStack: 5,   desc: "For a while, you could lift an ox." },

    // Scrolls & books
    { id: "scroll_fire",   name: "Scroll of Fireball",   glyph: "?", color: "#ff7030", category: "Scroll",    rarity: "uncommon", maxStack: 10,  desc: "Read aloud, then duck." },
    { id: "scroll_tele",   name: "Scroll of Teleport",   glyph: "?", color: "#c77dff", category: "Scroll",    rarity: "rare",     maxStack: 10,  desc: "Takes you somewhere else. Anywhere else." },
    { id: "scroll_ident",  name: "Scroll of Identify",   glyph: "?", color: "#e8e8a0", category: "Scroll",    rarity: "common",   maxStack: 10,  qty: [1, 2], desc: "Reveals the true nature of an item." },
    { id: "spellbook",     name: "Dusty Spellbook",      glyph: "+", color: "#9a6aff", category: "Scroll",    rarity: "rare",     maxStack: 1,   desc: "Most pages are blank. The rest are unsettling." },

    // Food
    { id: "bread",         name: "Loaf of Bread",        glyph: "%", color: "#e0b070", category: "Food",      rarity: "common",   maxStack: 20,  qty: [1, 3], desc: "A bit stale, still filling." },
    { id: "apple",         name: "Apple",                glyph: "%", color: "#ff5040", category: "Food",      rarity: "common",   maxStack: 20,  qty: [1, 5], desc: "Crisp and red." },
    { id: "cheese",        name: "Wheel of Cheese",      glyph: "%", color: "#ffd84a", category: "Food",      rarity: "common",   maxStack: 10,  desc: "Pungent. Very pungent." },
    { id: "dried_meat",    name: "Dried Meat",           glyph: "%", color: "#a05030", category: "Food",      rarity: "common",   maxStack: 20,  qty: [1, 4], desc: "Salty strips of something. Probably beef." },

    // Valuables
    { id: "gold",          name: "Gold Coins",           glyph: "$", color: "#ffd700", category: "Valuable",  rarity: "common",   maxStack: 999, qty: [5, 60], desc: "Shiny and heavy." },
    { id: "silver_ring",   name: "Silver Ring",          glyph: "=", color: "#e0e0f0", category: "Valuable",  rarity: "uncommon", maxStack: 1,   desc: "A plain band with a tiny inscription." },
    { id: "ruby",          name: "Ruby",                 glyph: "*", color: "#ff2050", category: "Valuable",  rarity: "rare",     maxStack: 20,  desc: "A deep red gem." },
    { id: "emerald",       name: "Emerald",              glyph: "*", color: "#20e070", category: "Valuable",  rarity: "rare",     maxStack: 20,  desc: "A clear green gem." },
    { id: "sapphire",      name: "Sapphire",             glyph: "*", color: "#3070ff", category: "Valuable",  rarity: "rare",     maxStack: 20,  desc: "A cold blue gem." },
    { id: "amulet",        name: "Amulet of the Moon",   glyph: "\"", color: "#c0e0ff", category: "Valuable", rarity: "epic",     maxStack: 1,   desc: "Glows faintly when nobody is looking at it." },

    // Tools & misc
    { id: "torch",         name: "Torch",                glyph: "~", color: "#ffa030", category: "Tool",      rarity: "common",   maxStack: 10,  qty: [1, 3], desc: "Pitch-soaked rags on a stick." },
    { id: "rope",          name: "Coil of Rope",         glyph: "&", color: "#c8a46e", category: "Tool",      rarity: "common",   maxStack: 5,   desc: "Fifty feet of hemp rope." },
    { id: "lockpick",      name: "Lockpick",             glyph: "-", color: "#b0b0b8", category: "Tool",      rarity: "uncommon", maxStack: 20,  qty: [1, 4], desc: "Thin, bendy, and not entirely legal." },
    { id: "iron_key",      name: "Iron Key",             glyph: "-", color: "#9a9a9a", category: "Tool",      rarity: "uncommon", maxStack: 5,   desc: "It must open something down here." },
    { id: "bandage",       name: "Bandage",              glyph: "~", color: "#f0f0e0", category: "Tool",      rarity: "common",   maxStack: 20,  qty: [1, 4], desc: "Clean linen strips." },

    // The goal of the game
    // More 5e weapons (stats in src/systems/Combat.js)
    { id: "club", name: "Club", glyph: ")", color: "#a07850", category: "Weapon", rarity: "common", maxStack: 1, desc: "A knobbly length of oak." },
    { id: "handaxe", name: "Handaxe", glyph: ")", color: "#b0a090", category: "Weapon", rarity: "common", maxStack: 1, desc: "Light enough to swing all day." },
    { id: "mace", name: "Mace", glyph: ")", color: "#a8a8b0", category: "Weapon", rarity: "common", maxStack: 1, desc: "A flanged iron head on a short haft." },
    { id: "quarterstaff", name: "Quarterstaff", glyph: "/", color: "#b08850", category: "Weapon", rarity: "common", maxStack: 1, desc: "A traveller's staff, iron-shod." },
    { id: "scimitar", name: "Scimitar", glyph: ")", color: "#d8d8e8", category: "Weapon", rarity: "uncommon", maxStack: 1, desc: "A curved blade, quick in the hand." },
    { id: "rapier", name: "Rapier", glyph: ")", color: "#e0e0f0", category: "Weapon", rarity: "uncommon", maxStack: 1, desc: "A thin, elegant thrusting sword." },
    { id: "morningstar", name: "Morningstar", glyph: ")", color: "#a0a0a8", category: "Weapon", rarity: "uncommon", maxStack: 1, desc: "A spiked ball on a stout handle." },
    { id: "flail", name: "Flail", glyph: ")", color: "#9a9aa0", category: "Weapon", rarity: "uncommon", maxStack: 1, desc: "An iron ball on a chain." },
    { id: "glaive", name: "Glaive", glyph: "/", color: "#c8c8d0", category: "Weapon", rarity: "uncommon", maxStack: 1, desc: "A long blade on a pole." },
    { id: "halberd", name: "Halberd", glyph: "/", color: "#c0c0c8", category: "Weapon", rarity: "uncommon", maxStack: 1, desc: "Axe, spike and hook on a pole." },
    { id: "greatsword", name: "Greatsword", glyph: ")", color: "#f0f0ff", category: "Weapon", rarity: "rare", maxStack: 1, desc: "Taller than some people." },
    { id: "maul", name: "Maul", glyph: ")", color: "#909098", category: "Weapon", rarity: "uncommon", maxStack: 1, desc: "A sledgehammer for people." },
    { id: "longbow", name: "Longbow", glyph: "}", color: "#c08a48", category: "Weapon", rarity: "uncommon", maxStack: 1, desc: "Yew, as tall as you are." },
    { id: "light_crossbow", name: "Light Crossbow", glyph: "}", color: "#a07040", category: "Weapon", rarity: "common", maxStack: 1, desc: "Point, pull, hope." },
    { id: "heavy_crossbow", name: "Heavy Crossbow", glyph: "}", color: "#806040", category: "Weapon", rarity: "uncommon", maxStack: 1, desc: "Takes a while to wind. Worth it." },
    // More 5e armour
    { id: "padded_armor", name: "Padded Armour", glyph: "[", color: "#c0a080", category: "Armour", rarity: "common", maxStack: 1, desc: "Quilted layers of cloth." },
    { id: "studded_leather", name: "Studded Leather", glyph: "[", color: "#b08050", category: "Armour", rarity: "uncommon", maxStack: 1, desc: "Leather toughened with rivets." },
    { id: "hide_armor", name: "Hide Armour", glyph: "[", color: "#8a6a40", category: "Armour", rarity: "common", maxStack: 1, desc: "Thick furs and pelts." },
    { id: "chain_shirt", name: "Chain Shirt", glyph: "[", color: "#c8c8d8", category: "Armour", rarity: "uncommon", maxStack: 1, desc: "Mail worn under clothes." },
    { id: "scale_mail", name: "Scale Mail", glyph: "[", color: "#b0b0a0", category: "Armour", rarity: "uncommon", maxStack: 1, desc: "Overlapping steel scales." },
    { id: "breastplate", name: "Breastplate", glyph: "[", color: "#e0e0f0", category: "Armour", rarity: "rare", maxStack: 1, desc: "A fitted steel chest piece." },
    { id: "half_plate", name: "Half Plate", glyph: "[", color: "#e8e8f8", category: "Armour", rarity: "rare", maxStack: 1, desc: "Plates over most of the body." },
    { id: "ring_mail", name: "Ring Mail", glyph: "[", color: "#a8a8b0", category: "Armour", rarity: "common", maxStack: 1, desc: "Rings sewn onto leather." },
    { id: "splint_armor", name: "Splint Armour", glyph: "[", color: "#d0d0e0", category: "Armour", rarity: "rare", maxStack: 1, desc: "Strips of metal riveted to leather." },
    // Provisions (eat or drink from your bag to fill your satiation bar)
    { id: "rations", name: "Trail Rations", glyph: "%", color: "#c8a070", category: "Food", rarity: "common", maxStack: 20, qty: [1, 3], desc: "A day's worth of dried food." },
    { id: "waterskin", name: "Waterskin", glyph: "!", color: "#6ab0ff", category: "Drink", rarity: "common", maxStack: 5, desc: "Clean water. Quenches thirst." },
    { id: "ale", name: "Mug of Ale", glyph: "!", color: "#e0a030", category: "Drink", rarity: "common", maxStack: 10, desc: "Brown, foamy and a bit warm." },
    { id: "wine", name: "Bottle of Wine", glyph: "!", color: "#a02040", category: "Drink", rarity: "uncommon", maxStack: 5, qty: [1, 2], desc: "A respectable vintage." },
    { id: "hot_meal", name: "Hot Stew", glyph: "%", color: "#d07a3a", category: "Food", rarity: "common", maxStack: 5, desc: "The tavern's stew of the day. Very filling." },
    // Camping
    { id: "camp_kit", name: "Camping Kit", glyph: "&", color: "#9ac070", category: "Tool", rarity: "common", maxStack: 1, desc: "Bedroll and tent. Double-click in your bag to sleep 8 hours." },
    // Trade goods (prices float with supply and demand, see src/systems/Economy.js)
    { id: "grain",  name: "Sack of Grain",   glyph: "\u2234", color: "#e8d070", category: "Trade", rarity: "common", maxStack: 50, desc: "Wheat and maize. Towns need it to grow." },
    { id: "stone",  name: "Block of Stone",  glyph: "\u25a0", color: "#b8b0a0", category: "Trade", rarity: "common", maxStack: 50, desc: "Cut stone for houses and castle walls." },
    { id: "metal",  name: "Iron Ingot",      glyph: "\u2550", color: "#c0c8d8", category: "Trade", rarity: "common", maxStack: 50, desc: "Smiths and soldiers can never get enough." },
    { id: "luxury", name: "Bale of Silk and Spice", glyph: "\u00a7", color: "#e070e0", category: "Trade", rarity: "uncommon", maxStack: 50, desc: "Luxury goods. The court at the capital pays best." },
    { id: "ananas",        name: "The Ananas",           glyph: "A", color: "#ffe14a", category: "Quest",     rarity: "epic",     maxStack: 1,   desc: "Pedro's prized pineapple. Get it out of here!" }
  ],

  byId: {},

  // Prices in gold coins (the 5e Player's Handbook prices; under 1 gp is a fraction of a coin,
  // so shops sell cheap things in lots). Items not listed cost by rarity.
  PRICES: {
    club: 1, dagger: 2, handaxe: 5, mace: 5, quarterstaff: 1, spear: 1, short_sword: 10, scimitar: 25,
    rapier: 25, longsword: 15, battle_axe: 10, war_hammer: 15, morningstar: 15, flail: 10, glaive: 20,
    halberd: 20, greataxe: 30, greatsword: 50, maul: 10, shortbow: 25, longbow: 50, light_crossbow: 25,
    heavy_crossbow: 50, arrows: 0.05, bolts: 0.05, flame_blade: 2000,
    padded_armor: 5, leather_armor: 10, studded_leather: 45, hide_armor: 10, chain_shirt: 50, scale_mail: 50,
    breastplate: 400, half_plate: 750, ring_mail: 30, chainmail: 75, splint_armor: 200, plate_armor: 1500,
    wooden_shield: 10, iron_shield: 10, elven_cloak: 500, leather_cap: 1, iron_helm: 5, boots: 1, gauntlets: 2,
    potion_heal: 50, potion_mana: 50, antidote: 50, potion_str: 200, scroll_fire: 150, scroll_tele: 300, scroll_ident: 50,
    spellbook: 50, bread: 0.02, apple: 0.01, cheese: 0.1, dried_meat: 0.1, rations: 0.5, waterskin: 0.2, ale: 0.04,
    wine: 2, hot_meal: 0.3, gold: 1, silver_ring: 25, ruby: 100, emerald: 100, sapphire: 100, amulet: 1000,
    torch: 0.01, rope: 1, lockpick: 5, iron_key: 1, bandage: 0.1, camp_kit: 3,
    grain: 4, stone: 6, metal: 20, luxury: 50
  },

  // How much of the satiation bar (0-100) each food or drink fills.
  FOOD: { bread: 25, apple: 10, cheese: 30, dried_meat: 20, rations: 40, hot_meal: 50, waterskin: 15, ale: 8, wine: 10 },

  price: function (id) {
    if (id in this.PRICES) { return this.PRICES[id]; }
    return { common: 2, uncommon: 10, rare: 50, epic: 200 }[this.get(id).rarity];
  },

  get: function (id) { return this.byId[id]; },

  // Pick a random item (never the ananas), weighted by rarity. Deeper dungeon levels
  // (depth 2, 3...) make uncommon, rare and epic finds more likely.
  randomItem: function (depth) {
    var boost = { common: 1, uncommon: 1, rare: 1, epic: 1 };
    var d = Math.max(0, (depth || 1) - 1);
    boost.uncommon += 0.6 * d; boost.rare += 1.5 * d; boost.epic += 2.5 * d;
    var weights = {};
    this.list.forEach(function (item) {
      if (item.category !== "Quest" && item.category !== "Trade") { weights[item.id] = Items.RARITY[item.rarity].weight * boost[item.rarity]; }
    });
    return this.get(ROT.RNG.getWeightedValue(weights));
  },

  // A quantity to put in a chest for this item.
  randomQty: function (item) {
    if (item.maxStack === 1) { return 1; }
    var range = item.qty || [1, 1];
    return ROT.RNG.getUniformInt(range[0], range[1]);
  },

  // Fill a container with 2-5 random stacks (one more per dungeon level below the first),
  // and gold that grows with depth.
  fillChest: function (container, depth) {
    depth = depth || 1;
    var count = ROT.RNG.getUniformInt(2, 5) + (depth - 1);
    for (var i = 0; i < count; i++) {
      var item = this.randomItem(depth);
      var qty = this.randomQty(item);
      if (item.id === "gold") { qty *= depth; }
      container.add(item.id, qty);
    }
  }
};
Items.list.forEach(function (item) { Items.byId[item.id] = item; });

// Combat, loosely following the D&D 5e rules (SRD 5.1).
//   - Every fighter has a stat block: six ability scores, hit points, armour class, proficiency bonus.
//   - An attack is d20 + ability modifier + proficiency against the target's AC.
//     A natural 20 always hits and doubles the damage dice; a natural 1 always misses.
//   - Advantage / disadvantage: roll two d20s and keep the higher / lower.
//   - Dodge (the 5e Dodge action): until your next turn, attacks against you have disadvantage.
// Simplifications: no initiative (the scheduler runs everyone in order), one action per turn,
// a turn is one step or one action, and dropping to 0 HP ends the game (no death saves).
var Dice = {
  // Roll "NdS+M" (e.g. "2d6+3", "1d20", "1d4-1"). Returns { total, rolls, text }.
  roll: function (expr, critical) {
    var m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(expr.replace(/\s/g, ""));
    if (!m) { throw new Error("Bad dice: " + expr); }
    var n = parseInt(m[1]) * (critical ? 2 : 1);
    var sides = parseInt(m[2]);
    var mod = m[3] ? parseInt(m[3]) : 0;
    var rolls = [];
    for (var i = 0; i < n; i++) { rolls.push(ROT.RNG.getUniformInt(1, sides)); }
    var total = rolls.reduce(function (a, b) { return a + b; }, 0) + mod;
    return { total: total, rolls: rolls, mod: mod };
  },

  d20: function () { return ROT.RNG.getUniformInt(1, 20); },

  // 4d6, drop the lowest: the 5e way to roll an ability score.
  abilityScore: function () {
    var r = [1, 2, 3, 4].map(function () { return ROT.RNG.getUniformInt(1, 6); });
    r.sort(function (a, b) { return a - b; });
    return r[1] + r[2] + r[3];
  }
};

var Combat = {
  ABILITIES: ["str", "dex", "con", "int", "wis", "cha"],

  mod: function (score) { return Math.floor((score - 10) / 2); },
  signed: function (n) { return (n >= 0 ? "+" : "") + n; },

  // ---- Equipment, with 5e numbers. Items not listed here can't be equipped. ----
  WEAPONS: {
    unarmed:     { name: "Unarmed strike", dice: "1d1", type: "bludgeoning", props: [] },
    dagger:      { dice: "1d4",  type: "piercing",    props: ["finesse", "light"] },
    short_sword: { dice: "1d6",  type: "piercing",    props: ["finesse", "light"] },
    longsword:   { dice: "1d8",  type: "slashing",    props: ["versatile"], versatile: "1d10" },
    battle_axe:  { dice: "1d8",  type: "slashing",    props: ["versatile"], versatile: "1d10" },
    war_hammer:  { dice: "1d8",  type: "bludgeoning", props: ["versatile"], versatile: "1d10" },
    spear:       { dice: "1d6",  type: "piercing",    props: ["versatile"], versatile: "1d8" },
    greataxe:    { dice: "1d12", type: "slashing",    props: ["heavy", "two-handed"] },
    shortbow:    { dice: "1d6",  type: "piercing",    props: ["ranged", "two-handed"], range: 16, ammo: "arrows" },
    club:           { dice: "1d4",  type: "bludgeoning", props: ["light"] },
    handaxe:        { dice: "1d6",  type: "slashing",    props: ["light"] },
    mace:           { dice: "1d6",  type: "bludgeoning", props: [] },
    quarterstaff:   { dice: "1d6",  type: "bludgeoning", props: ["versatile"], versatile: "1d8" },
    scimitar:       { dice: "1d6",  type: "slashing",    props: ["finesse", "light"] },
    rapier:         { dice: "1d8",  type: "piercing",    props: ["finesse"] },
    morningstar:    { dice: "1d8",  type: "piercing",    props: [] },
    flail:          { dice: "1d8",  type: "bludgeoning", props: [] },
    glaive:         { dice: "1d10", type: "slashing",    props: ["heavy", "reach", "two-handed"] },
    halberd:        { dice: "1d10", type: "slashing",    props: ["heavy", "reach", "two-handed"] },
    greatsword:     { dice: "2d6",  type: "slashing",    props: ["heavy", "two-handed"] },
    maul:           { dice: "2d6",  type: "bludgeoning", props: ["heavy", "two-handed"] },
    longbow:        { dice: "1d8",  type: "piercing",    props: ["ranged", "heavy", "two-handed"], range: 30, ammo: "arrows" },
    light_crossbow: { dice: "1d8",  type: "piercing",    props: ["ranged", "two-handed"], range: 16, ammo: "bolts" },
    heavy_crossbow: { dice: "1d10", type: "piercing",    props: ["ranged", "heavy", "two-handed"], range: 20, ammo: "bolts" },
    // Flametongue: a longsword whose burning blade adds 2d6 fire damage.
    flame_blade: { dice: "1d8",  type: "slashing",    props: ["versatile", "magic"], versatile: "1d10", extra: "2d6", extraType: "fire" }
  },

  // slot: armor | shield | cloak. Body armour: AC = base + Dex mod (light), + Dex mod up to 2 (medium),
  // or just base (heavy).
  ARMOR: {
    padded_armor:    { slot: "armor", base: 11, dex: true, kind: "light armour" },
    leather_armor:   { slot: "armor", base: 11, dex: true, kind: "light armour" },
    studded_leather: { slot: "armor", base: 12, dex: true, kind: "light armour" },
    hide_armor:      { slot: "armor", base: 12, dex: true, dexMax: 2, kind: "medium armour" },
    chain_shirt:     { slot: "armor", base: 13, dex: true, dexMax: 2, kind: "medium armour" },
    scale_mail:      { slot: "armor", base: 14, dex: true, dexMax: 2, kind: "medium armour" },
    breastplate:     { slot: "armor", base: 14, dex: true, dexMax: 2, kind: "medium armour" },
    half_plate:      { slot: "armor", base: 15, dex: true, dexMax: 2, kind: "medium armour" },
    ring_mail:       { slot: "armor", base: 14, dex: false, kind: "heavy armour" },
    splint_armor:    { slot: "armor", base: 17, dex: false, kind: "heavy armour", str: 15 },
    chainmail:     { slot: "armor",  base: 16, dex: false, kind: "heavy armour", str: 13 },
    plate_armor:   { slot: "armor",  base: 18, dex: false, kind: "heavy armour", str: 15 },
    wooden_shield: { slot: "shield", bonus: 2, kind: "shield" },
    iron_shield:   { slot: "shield", bonus: 2, kind: "shield" },
    elven_cloak:   { slot: "cloak",  bonus: 1, kind: "magic cloak" }
  },

  SLOTS: ["weapon", "armor", "shield", "cloak"],
  SLOT_NAMES: { weapon: "Weapon", armor: "Armour", shield: "Shield", cloak: "Cloak" },

  slotFor: function (itemId) {
    if (this.WEAPONS[itemId]) { return "weapon"; }
    if (this.ARMOR[itemId]) { return this.ARMOR[itemId].slot; }
    return null;
  },

  // One line of rules text for an item's tooltip.
  describeItem: function (itemId) {
    var w = this.WEAPONS[itemId];
    if (w) {
      var s = w.dice + " " + w.type;
      if (w.versatile) { s += " (" + w.versatile + " two-handed)"; }
      if (w.extra) { s += " + " + w.extra + " " + w.extraType; }
      return s + (w.props.length ? " · " + w.props.join(", ") : "");
    }
    var a = this.ARMOR[itemId];
    if (a) {
      if (a.slot === "armor") {
        return a.kind + " · AC " + a.base + (a.dex ? (a.dexMax ? " + Dex (max " + a.dexMax + ")" : " + Dex") : "") + (a.str ? " · needs Str " + a.str : "");
      }
      return a.kind + " · +" + a.bonus + " AC";
    }
    return null;
  },

  // ---- Stat blocks ----

  // The player: a level 1 fighter. Abilities are 4d6-drop-lowest, rolled six times and
  // assigned fighter-style (best roll to Str, then Con, Dex, Wis, Cha, Int).
  // HP = 10 + Con modifier, proficiency +2, proficient with every weapon and armour here.
  rollPlayer: function () {
    var rolls = [0, 1, 2, 3, 4, 5].map(Dice.abilityScore).sort(function (a, b) { return b - a; });
    var order = ["str", "con", "dex", "wis", "cha", "int"];
    var abilities = {};
    order.forEach(function (ab, i) { abilities[ab] = rolls[i]; });
    var maxHp = Math.max(1, 10 + this.mod(abilities.con));
    return { name: "You", cls: "Fighter 1", abilities: abilities, maxHp: maxHp, hp: maxHp, prof: 2 };
  },

  // Monster stat blocks (5e SRD). `ch`/`color` is how they look on the map, `drops` what they may leave.
  MONSTERS: {
    giant_rat: {
      name: "Giant rat", cls: "Beast, CR 1/8", ch: "r", color: "#c09070",
      abilities: { str: 7, dex: 15, con: 11, int: 2, wis: 10, cha: 4 }, maxHp: 7, ac: 12, acNote: "natural",
      attack: { name: "bite", bonus: 4, dice: "1d4+2", type: "piercing" }, drops: []
    },
    goblin: {
      name: "Goblin", cls: "Humanoid, CR 1/4", ch: "g", color: "#70d050",
      abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 }, maxHp: 7, ac: 15, acNote: "leather, shield",
      attack: { name: "scimitar", bonus: 4, dice: "1d6+2", type: "slashing" }, drops: ["scimitar", "shortbow"]
    },
    skeleton: {
      name: "Skeleton", cls: "Undead, CR 1/4", ch: "s", color: "#ecebd8",
      abilities: { str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5 }, maxHp: 13, ac: 13, acNote: "armour scraps",
      attack: { name: "shortsword", bonus: 4, dice: "1d6+2", type: "piercing" }, drops: ["short_sword"]
    },
    orc: {
      name: "Orc", cls: "Humanoid, CR 1/2", ch: "o", color: "#e06a3a",
      abilities: { str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10 }, maxHp: 15, ac: 13, acNote: "hide armour",
      attack: { name: "greataxe", bonus: 5, dice: "1d12+3", type: "slashing" },
      heavy: { name: "heavy greataxe swing", bonus: 5, dice: "2d12+3", type: "slashing" }, drops: ["greataxe", "hide_armor"]
    }
  },

  // A fresh copy of a monster's stat block, ready to take damage.
  monster: function (kind) {
    var m = JSON.parse(JSON.stringify(this.MONSTERS[kind]));
    m.kind = kind;
    m.hp = m.maxHp;
    m.prof = 2;
    return m;
  },

  // Pedro's stat block: an Orc (Monster Manual / SRD, CR 1/2).
  // AC 13 (hide armour), HP 15 (2d8+6), Str 16 Dex 12 Con 16 Int 7 Wis 11 Cha 10.
  // Greataxe: +5 to hit, 1d12+3 slashing. Our addition: a telegraphed heavy swing (see AI.js).
  orc: function () {
    return {
      name: "Pedro", cls: "Orc, CR 1/2",
      abilities: { str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10 },
      maxHp: 15, hp: 15, prof: 2, ac: 13, acNote: "hide armour",
      attack: { name: "greataxe", bonus: 5, dice: "1d12+3", type: "slashing" },
      heavy: { name: "heavy greataxe swing", bonus: 5, dice: "2d12+3", type: "slashing" },
      kind: "orc", ch: "P", color: "#ff3030", drops: ["greataxe"], boss: true
    };
  },

  // ---- Numbers derived from a player's stats and gear ----

  armorClass: function (player) {
    var dex = this.mod(player.stats.abilities.dex);
    var eq = player.equipment;
    var ac = 10 + dex; // unarmoured
    var body = eq.armor && this.ARMOR[eq.armor];
    if (body) { ac = body.base + (body.dex ? Math.min(dex, body.dexMax === undefined ? 99 : body.dexMax) : 0); }
    if (eq.shield) { ac += this.ARMOR[eq.shield].bonus; }
    if (eq.cloak) { ac += this.ARMOR[eq.cloak].bonus; }
    return ac;
  },

  // The player's current attack: { name, bonus, dice, type, ranged, extra }.
  playerAttack: function (player) {
    var id = player.equipment.weapon || "unarmed";
    var w = this.WEAPONS[id];
    var ab = player.stats.abilities;
    var str = this.mod(ab.str), dex = this.mod(ab.dex);
    var ranged = w.props.indexOf("ranged") >= 0;
    var abMod = ranged ? dex : (w.props.indexOf("finesse") >= 0 ? Math.max(str, dex) : str);
    var dice = w.dice;
    if (w.versatile && !player.equipment.shield) { dice = w.versatile; } // both hands free
    var name = id === "unarmed" ? w.name : Items.get(id).name;
    if (id === "unarmed") {
      // 5e unarmed strike: 1 + Str modifier.
      return { name: name, bonus: str + player.stats.prof, dice: "1d1" + this._modStr(str), type: w.type, ranged: false };
    }
    return {
      name: name, bonus: abMod + player.stats.prof, dice: dice + this._modStr(abMod), type: w.type,
      ranged: ranged, range: w.range, ammo: w.ammo, extra: w.extra, extraType: w.extraType
    };
  },

  _modStr: function (m) { return m ? (m > 0 ? "+" + m : String(m)) : ""; },

  // ---- Resolving an attack ----
  // attacker/defender are beings with .stats; `attack` is { name, bonus, dice, type, extra }.
  // opts: { advantage, disadvantage }. Returns a result and writes a line to the message log.
  attack: function (attacker, defender, attack, opts) {
    opts = opts || {};
    var adv = !!opts.advantage, dis = !!opts.disadvantage;
    // Exhaustion (fatigue bar full): disadvantage on your attack rolls.
    if (attacker === Game.player && attacker.isExhausted && attacker.isExhausted()) { dis = true; }
    if (adv && dis) { adv = dis = false; } // they cancel out
    var r1 = Dice.d20();
    var r2 = (adv || dis) ? Dice.d20() : r1;
    var d20 = adv ? Math.max(r1, r2) : dis ? Math.min(r1, r2) : r1;
    var ac = defender.getAC();
    var total = d20 + attack.bonus;
    var crit = d20 === 20;
    var hit = crit || (d20 !== 1 && total >= ac);

    var rollText = (adv || dis) ? "d20 (" + r1 + ", " + r2 + " " + (adv ? "adv" : "dis") + ") " : "d20 " + d20 + " ";
    var who = attacker === Game.player ? "You" : attacker.stats.name;
    var whom = defender === Game.player ? "you" : defender.stats.name;
    var line = who + " " + (attacker === Game.player ? "attack " : "attacks ") + whom + " (" + attack.name + "): " +
      rollText + this.signed(attack.bonus) + " = " + total + " vs AC " + ac + ". ";

    var result = { hit: hit, crit: crit, d20: d20, total: total, damage: 0 };
    if (!hit) {
      UI.log(line + (d20 === 1 ? "Natural 1, a clumsy miss." : "Miss."), "miss");
      return result;
    }
    var dmg = Dice.roll(attack.dice, crit);
    var damage = Math.max(0, dmg.total);
    var dmgText = attack.dice + (crit ? " (crit, dice doubled)" : "") + " = " + damage + " " + attack.type;
    if (attack.extra) {
      var extra = Dice.roll(attack.extra, crit);
      damage += extra.total;
      dmgText += " + " + extra.total + " " + attack.extraType;
    }
    result.damage = damage;
    UI.log(line + (crit ? "CRITICAL HIT! " : "Hit! ") + dmgText + " damage.", attacker === Game.player ? "hit" : "hurt");
    defender.takeDamage(damage, attacker);
    return result;
  }
};

// Every kind of ground in the game. Each map cell stores { type, ch, fg, bg, passable },
// built from these definitions with a little random colour variation for texture.
var Tiles = {
  // Overworld
  water:    { ch: "~", fg: "#5aa0e8", bg: "#12305a", passable: true,  vary: 18 },
  plain:    { ch: ".", fg: "#8fd07a", bg: "#1d3a1a", passable: true,  vary: 10, alt: '"' },
  hill:     { ch: "n", fg: "#c8ac6a", bg: "#3a3418", passable: true,  vary: 12 },
  mountain: { ch: "^", fg: "#e8e8e8", bg: "#56524e", passable: false, vary: 14 },
  entrance: { ch: ">", fg: "#ffffff", bg: "#7a2a10", passable: true,  vary: 0 },

  // Dungeon
  wood:     { ch: ".", fg: "#c08850", bg: "#3b2614", passable: true,  vary: 6, alt: "_" },
  stone:    { ch: ".", fg: "#9a9a9a", bg: "#2a2a2c", passable: true,  vary: 8, alt: "," },
  corridor: { ch: ".", fg: "#777777", bg: "#1c1c1e", passable: true,  vary: 6 },
  door:     { ch: "+", fg: "#e0a050", bg: "#4a2c10", passable: true,  vary: 0 },
  wall:     { ch: "#", fg: "#9c8670", bg: "#3a3028", passable: false, vary: 16 },
  stairsUp:   { ch: "<", fg: "#ffffff", bg: "#3a4a6a", passable: true,  vary: 0 },
  stairsDown: { ch: ">", fg: "#ffffff", bg: "#6a3a1a", passable: true,  vary: 0 },

  // Overworld: a town you can enter
  town:     { ch: "\u2302", fg: "#ffe0a0", bg: "#6a4a20", passable: true, vary: 0 },
  // A capital (a town with a castle) and the roads between towns
  capital:  { ch: "\u03a9", fg: "#fff4c0", bg: "#7a5a28", passable: true, vary: 0 },
  wroad:    { ch: "\u00b7", fg: "#e0c090", bg: "#5a4628", passable: true, vary: 8, alt: ":" },

  // Towns (indoor tiles keep their own light at night)
  grass:    { ch: ".", fg: "#7cc46a", bg: "#1f3d1a", passable: true,  vary: 10, alt: '"' },
  tree:     { ch: "\u2663", fg: "#3f9a3a", bg: "#16301a", passable: true,  vary: 16 },
  road:     { ch: ".", fg: "#c8a878", bg: "#4a3a26", passable: true,  vary: 8, alt: ":" },
  field:    { ch: "\u2248", fg: "#d8c050", bg: "#3d3416", passable: true,  vary: 10 },
  bwall:    { ch: "#", fg: "#d0b890", bg: "#5a4630", passable: false, vary: 10 },
  floor:    { ch: ".", fg: "#c09060", bg: "#3b2a18", passable: true,  vary: 6, indoor: true },
  bdoor:    { ch: "+", fg: "#ffd080", bg: "#5a3410", passable: true,  vary: 0, indoor: true },
  bed:      { ch: "\u0398", fg: "#e0e0ff", bg: "#3a3060", passable: true,  vary: 0, indoor: true },
  counter:  { ch: "=", fg: "#e0b070", bg: "#4a2c10", passable: false, vary: 0, indoor: true },
  anvil:    { ch: "\u03c0", fg: "#c0c0d0", bg: "#3b2a18", passable: false, vary: 0, indoor: true },
  hearth:   { ch: "&", fg: "#ff8030", bg: "#4a1a08", passable: false, vary: 0, indoor: true },
  // Capitals: the castle
  cwall:    { ch: "#", fg: "#c8c8d0", bg: "#55555e", passable: false, vary: 8 },
  cobble:   { ch: ".", fg: "#b0b0b8", bg: "#3a3a40", passable: true,  vary: 6, alt: "," },
  throne:   { ch: "\u03a8", fg: "#ffd24a", bg: "#4a1a4a", passable: false, vary: 0, indoor: true },
  // Town businesses for the trade goods
  rock:     { ch: "*", fg: "#b8b0a0", bg: "#4a4540", passable: false, vary: 10 },
  furnace:  { ch: "&", fg: "#ffb040", bg: "#4a2010", passable: false, vary: 0, indoor: true },
  loom:     { ch: "\u00a7", fg: "#e070e0", bg: "#3b2a18", passable: false, vary: 0, indoor: true },
  granary:  { ch: "o", fg: "#e8d070", bg: "#3b2a18", passable: false, vary: 0, indoor: true },

  // Make one cell of a given type. Colours are nudged randomly so large areas look textured.
  make: function (type, x, y) {
    var t = this[type];
    var cell = { type: type, ch: t.ch, fg: t.fg, bg: t.bg, passable: t.passable, indoor: !!t.indoor };
    if (t.vary) {
      cell.fg = ROT.Color.toHex(ROT.Color.randomize(ROT.Color.fromString(t.fg), t.vary));
      cell.bg = ROT.Color.toHex(ROT.Color.randomize(ROT.Color.fromString(t.bg), Math.round(t.vary / 2)));
    }
    if (t.alt && ROT.RNG.getUniform() < 0.15) { cell.ch = t.alt; }
    // Wood floors: darken every other row so they read as planks.
    if (type === "wood" && y % 2) {
      cell.bg = ROT.Color.toHex(ROT.Color.multiply(ROT.Color.fromString(cell.bg), [200, 200, 200]));
    }
    // Walls: a brick pattern, mortar lines on alternating columns per row.
    if (type === "wall" && (x + (y % 2) * 2) % 4 === 0) {
      cell.bg = ROT.Color.toHex(ROT.Color.multiply(ROT.Color.fromString(cell.bg), [170, 170, 170]));
    }
    return cell;
  }
};

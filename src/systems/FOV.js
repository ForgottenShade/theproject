// Line of sight and fog of war (used in the dungeon).
// Each turn we compute what the player can see with ROT.FOV.PreciseShadowcasting.
// Everything seen is copied into the level's memory exactly as it looked; cells that
// are remembered but not visible now are drawn from memory, dimmed. Pedro is only
// drawn when he is actually in view, because memory only keeps the scenery.
var Sight = {
  RADIUS: 9,

  // Returns a set ("x,y" -> true) of the cells the player can see right now.
  compute: function (level, x, y, radius) {
    var visible = {};
    var fov = new ROT.FOV.PreciseShadowcasting(function (cx, cy) {
      var cell = level.cells[cx + "," + cy];
      return !!(cell && cell.passable); // walls block sight, floors and open doors don't
    });
    fov.compute(x, y, radius || this.RADIUS, function (cx, cy) {
      visible[cx + "," + cy] = true;
    });
    return visible;
  },

  // Can someone standing at (fx, fy) see (tx, ty)? Same walls-block-sight rule, used by monsters.
  canSee: function (level, fx, fy, tx, ty, radius) {
    if (Math.max(Math.abs(fx - tx), Math.abs(fy - ty)) > radius) { return false; }
    var seen = this.compute(level, fx, fy, radius);
    return !!seen[tx + "," + ty];
  },

  // How a remembered cell is drawn: same character, colours faded towards dark blue-grey.
  dim: function (look) {
    var fog = [10, 12, 22];
    var fg = ROT.Color.interpolate(ROT.Color.fromString(look.fg), [70, 74, 90], 0.65);
    var bg = ROT.Color.interpolate(ROT.Color.fromString(look.bg), fog, 0.75);
    return { ch: look.ch, fg: ROT.Color.toHex(fg), bg: ROT.Color.toHex(bg) };
  }
};

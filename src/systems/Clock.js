// Time of day, daylight, hunger and tiredness.
//   - The game starts on day 1 at 08:00. Each of your turns takes 30 minutes on the world map,
//     and 1 minute in a town or a dungeon. Sleeping takes 8 hours.
//   - Outdoors (world map and towns) the colours follow the time: full colour by day, warm at
//     dawn and dusk, dark blue at night. Indoor tiles in town keep their own (lamp) light.
//   - Satiation (0-100) drops 1 point every 15 minutes: eat or drink to fill it. At 25 you're hungry,
//     at 0 you're starving and lose 1 HP an hour.
//   - Fatigue (0-100) rises 1 point every 10 minutes awake. At 75 you're tired; at 100 you're
//     exhausted and have disadvantage on attack rolls (like 5e exhaustion). Sleep 8 hours to reset it
//     (it's also a 5e long rest: you get all your HP back).
var Clock = {
  START: 8 * 60,
  minutes: 0, // minutes since midnight on day 1

  reset: function () { this.minutes = this.START; },

  day: function () { return Math.floor(this.minutes / 1440) + 1; },
  hour: function () { return (this.minutes % 1440) / 60; },

  text: function () {
    var m = this.minutes % 1440;
    var hh = Math.floor(m / 60), mm = m % 60;
    return "Day " + this.day() + " " + (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm;
  },

  isNight: function () { var h = this.hour(); return h >= 21 || h < 5; },

  // Light colour over the day: [hour, [r, g, b]] key frames, blended in between.
  KEYS: [
    [0, [70, 80, 150]], [4.5, [70, 80, 150]], [6.5, [255, 190, 150]], [8, [255, 255, 255]],
    [17, [255, 255, 255]], [19, [255, 170, 110]], [21, [70, 80, 150]], [24, [70, 80, 150]]
  ],

  light: function () {
    var h = this.hour();
    for (var i = 0; i < this.KEYS.length - 1; i++) {
      var a = this.KEYS[i], b = this.KEYS[i + 1];
      if (h >= a[0] && h <= b[0]) {
        return ROT.Color.interpolate(a[1], b[1], (h - a[0]) / (b[0] - a[0]));
      }
    }
    return [255, 255, 255];
  },

  // Let time pass: the clock moves, and the player gets hungrier and (unless asleep) more tired.
  advance: function (minutes, asleep) {
    var before = this.minutes;
    this.minutes += minutes;
    var p = Game.player;
    if (!p) { return; }
    var oldSat = p.satiation, oldFat = p.fatigue;
    p.satiation = Math.max(0, p.satiation - minutes / 15);
    if (!asleep) { p.fatigue = Math.min(100, p.fatigue + minutes / 10); }

    if (oldSat > 25 && p.satiation <= 25 && p.satiation > 0) { UI.log("You're getting hungry.", "warn"); }
    if (oldSat > 0 && p.satiation === 0) { UI.log("You're starving! Eat something.", "hurt"); }
    if (oldFat < 75 && p.fatigue >= 75 && p.fatigue < 100) { UI.log("You're getting tired.", "warn"); }
    if (oldFat < 100 && p.fatigue >= 100) { UI.log("You're exhausted: disadvantage on attacks until you sleep.", "hurt"); }

    // Starving: 1 HP for every full hour spent at 0.
    if (p.satiation === 0) {
      p._starveMinutes = (p._starveMinutes || 0) + minutes;
      var lost = Math.floor(p._starveMinutes / 60);
      if (lost > 0) {
        p._starveMinutes -= lost * 60;
        UI.log("Hunger gnaws at you (-" + lost + " HP).", "hurt");
        p.takeDamage(lost, null);
      }
    } else {
      p._starveMinutes = 0;
    }
    return before;
  }
};

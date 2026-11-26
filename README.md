# Ananas aus Caracas

The small roguelike from the three-part
[RogueBasin rot.js tutorial](https://roguebasin.com/index.php/Rot.js_tutorial),
built with [rot.js](https://ondras.github.io/rot.js/hp/) and running as an Electron desktop app.

A main menu lets you enter a new world. Every map (world, towns, dungeon levels) is 160 x 50 cells
(capitals are bigger); the camera follows you, and `+` / `-` or the mouse wheel zoom from the whole map
down to a close-up. The map view fills the window and refits whenever you resize it: a zoom level sets
the smallest part of the map that must be visible, and the view grows to fill the rest of the screen.

**The world map** is water (`~`), plains (`.`), hills (`n`) and mountains (`^`, impassable), grown with
`ROT.Map.Cellular`. Three kingdoms share it, each with a capital (`Ω`) and three towns (`⌂`) joined by
roads (`·`). You start next to the town of Caracas. There are two dungeons (`>`): stand on a town or
dungeon and press E to go in. Each step on the world map takes 30 minutes, or 15 along a road.

**Towns** have a cellular background of grass and trees. Buildings and dirt roads come from
`ROT.Map.Digger`, the dungeon generator: its rooms become buildings, its corridors become roads.
The tavern (beds, a hearth), the blacksmith (an anvil) and the general store each have a shopkeeper
(pink `@`): walk into them to trade with the gold coins you find in dungeons. Villagers (blue and green
`@`) live in the other houses and walk to work at the shops or in the fields (`≈`) from 7:00 to 18:00,
then go home. Walk off any edge of the map, or press X, to go back to the world map. A step takes 1 minute.

**Dungeons** have 3 levels joined by stairs: `>` goes down, `<` goes up (from level 1, back to the world map).
Deeper levels have more monsters (3, 5, then 7: giant rats, goblins, skeletons, orcs) and better loot.
Rooms have wood or stone floors, doors (`+`) and brick walls; you only see what's in your line of sight,
and places you've seen stay on the map, dimmed. Chests (`*`) hold loot. On the bottom level of Pedro's Cellar
one chest holds the ananas: get it into your bag to win. Pedro (`P`), its angry owner, is an orc who waits
down there. Monsters only come after you once they've seen you (8 squares, walls block their view), and if
they lose you they check where they last saw you, then go back to wandering. A step takes 1 minute.

## Kingdoms, trade and taxes

All of this runs on the clock, once per game hour, wherever you are (`src/systems/Economy.js`).

- **Kingdoms.** Three factions, each named after its capital. The capital is twice the area of a town and
  has a walled castle in the middle: guards drill in the courtyard (one shown for every 4 soldiers) and
  the faction leader sits on the throne in the keep. Walk up to the leader to hear the state of the realm.
  Every square of the world belongs to the faction of the nearest town. Press **B** (or the button in the
  status bar) on the world map to colour the map by faction and open the faction panel: each kingdom's
  treasury, tax income, soldiers and castle, and its towns with their people, goods and income.
- **Goods.** Grain, stone, metal and luxury goods. Each town makes one or two of them, and you can see
  it in town: a granary and extra fields (grain), a stonecutter's yard (stone), a smelter (metal), a
  weavers' hall (luxury goods). Capitals farm grain. The goods are items you can carry (they stack to 50).
- **Population.** Every town has a population (shown in the status bar in town and in the faction panel);
  only a few of them walk about as villagers. A town with grain in store grows, and growing eats into the
  store; with no grain people drift away. New people need houses: 1 stone houses 20, and towns also use a
  little stone for upkeep. Each town's blacksmith needs metal; without it the forge goes cold.
  The court at the capital uses up luxury goods.
- **Prices** follow supply and demand, for the four trade goods only: price = base price x demand /
  supply, kept between 0.25x and 4x. Demand is two days of what the town uses; supply is what it has in
  store. Base prices: grain 4, stone 6, metal 20, luxury goods 50 gold. You pay the price, and get 80% of
  it when you sell. Every other shop price is fixed.
- **Wealth and taxes.** A town's income comes from its people and from what it makes (at local prices);
  a tenth of it is owed as tax. Each kingdom's tax collector (`$`, on horseback: 2 squares an hour) rides
  from the capital round its towns and pays what he collects into the treasury. The capital's own tax goes
  straight in at midnight.
- **Soldiers.** At midnight the treasury pays its soldiers 2 gold each. Soldiers it can't pay are fired.
  It also buys metal for their gear and 3 stone a day for the castle walls (without stone they crumble),
  from the capital's market. With a week's wages to spare it hires 2 more a day, up to 40, if the capital
  has the metal for their gear (3 each). Above 2000 gold the court spends a tenth of the surplus a day.
- **Caravans** (`C`, one per castle, so one per kingdom) move one square per game hour, so you can catch
  them. Each picks its next deal by supply and demand: buy a good where it's plentiful, carry it to the
  town (of any kingdom) where it's scarcest compared with here, for a big load, not too far. Luxury goods
  for its own capital count half again. It pays a tenth of its profit to its treasury. Walk into a caravan
  to trade with it, at the prices of the nearest town (1 gold dearer when you buy). The general store in
  every town also buys and sells the four goods from the town's stores. Caravans and tax collectors can't
  be attacked.

## Time, food and sleep

- The clock starts on day 1 at 08:00 and is shown above the map. Outdoors, colours follow the time of
  day: warm at dawn and dusk, dark blue at night. Building interiors keep their lamplight.
- Satiation (Food bar, 0-100) drops 1 point every 15 minutes. Double-click food or drink in your bag
  to fill it (stew 50, rations 40, bread 25, ale 8...). At 0 you lose 1 HP an hour.
- Fatigue (0-100) rises 1 point every 10 minutes awake. At 100 you're exhausted: disadvantage on
  attack rolls. Sleep 8 hours to reset it and get all your HP back (a 5e long rest): press E on a
  tavern bed (1 gold), or double-click the camping kit in your bag anywhere outside town. Not with an
  enemy in sight.

## Shops

Prices are the 5e Player's Handbook prices in gold coins; cheap things come in lots (20 arrows for 1 gold).
Double-click a shop item to buy it. Drag or shift-click something from your bag onto the shop to sell it
for half price. Stock doesn't run out, except the trade goods at the general store (see above).

- Tavern: stew, ale, wine, bread, cheese, water.
- Blacksmith: 23 weapons (club to heavy crossbow) and 14 armours and shields (padded to plate).
- General store: rations, food, water, camping kit, torches, rope, bandages, arrows, bolts, potions.

## Combat (D&D 5e, simplified)

- You are a level 1 fighter. Your six abilities are rolled 4d6-drop-lowest and assigned best-first to
  Str, Con, Dex, Wis, Cha, Int. HP = 10 + Con modifier, proficiency +2. You start with a dagger,
  leather armour and two healing potions (2d4+2).
- Monsters use 5e stat blocks: giant rat (CR 1/8), goblin and skeleton (CR 1/4), orc (CR 1/2).
  Pedro is an orc: AC 13, 15 HP, greataxe +5 to hit, 1d12+3. An orc can kill a level 1 fighter in
  one or two hits, as in the real game. Dead monsters sometimes drop their weapon and some gold.
- Attacks: d20 + ability modifier + proficiency against AC. Natural 20 doubles the damage dice,
  natural 1 always misses. Finesse weapons use the better of Str and Dex, bows use Dex and arrows.
  Versatile weapons do their bigger die when you have no shield.
- Dodge (Q) is the 5e Dodge action: attacks against you have disadvantage until your next turn.
- Heavy swing (orcs and Pedro): sometimes, next to you, they wind up for a turn first. The tell is a
  message, a red square under you and an orange glyph. It lands next turn for 2d12+3 on that square,
  so step off it or dodge. If it misses they're off balance and your next attack has advantage.
- No initiative: you act, then Pedro, one after the other. A turn is one step or one action.
- At 0 HP the game ends (no death saves). Killing Pedro drops his greataxe and some gold.
- Equipment: the bag window comes with a character sheet and four slots (weapon, armour, shield,
  cloak). Drag gear onto a slot or double-click it in the bag. Two-handed weapons and shields don't
  mix. Helmets, boots and gauntlets don't change AC (5e has no rules for them).

## Run it

Needs Node.js 22.12 or newer.

```sh
npm install
npm start
```

- Move: arrow keys, WASD, or the numpad (Home / PgUp / End / PgDn, or numpad 7 9 1 3, for diagonals)
- Click a square to walk there along the shortest path you know. You stop as soon as an enemy is in
  view (with one already in view, a click takes one step). Any key stops the walk. Click Pedro to
  attack him, click yourself to use what's here.
- Attack: F (or walk into the enemy). Dodge: Q. Wait: `.` or numpad 5
- Use (enter a town or dungeon, take stairs, sleep in a bed, open a chest you stand on): E, Enter or Space
- Leave a town: X, or walk off the edge. Zoom: `+` / `-` or the mouse wheel. Faction borders: B
- Trade with a caravan: walk into it on the world map (or press E when it's on your square)
- Bag and character sheet (4x4, items stack): I. Double-click to equip gear or drink a potion. Esc closes windows, or opens the menu
- In a chest window: drag items into your bag (or back), shift-click or double-click to move a
  whole stack, or press Take all. Hover an item to read about it.

`npm run selftest` plays through 3 worlds (menu, world map, dungeon, chests, bag, stairs down to the ananas, win, random keys
and clicks), then checks the clock, zoom and camera, the window fit, daylight, towns, shops, villagers, food, sleep, dungeon levels,
the kingdoms (capitals, roads, borders, castle, leader, guards), the economy (prices, growth, stone, metal, caravans, trading,
taxes, firing soldiers), the combat rules, monster vision and diagonal moves, the heavy swing, equipment, potions and click-to-move
(about 135 checks). It fails on any page error or failed check.

## Where each tutorial part lives

| Tutorial part | What it adds | File |
|---|---|---|
| Part 1 | `ROT.Display`, `ROT.Map.Digger` dungeon, boxes | `src/game/Map.js`, `src/game/Game.js` |
| Part 2 | Player, `ROT.Scheduler.Simple` + `ROT.Engine`, keyboard movement with `ROT.DIRS` | `src/game/Player.js`, `src/game/Entity.js`, `src/game/Game.js` |
| Part 3 | Opening boxes, Pedro chasing you with `ROT.Path.AStar` | `src/game/Player.js`, `src/systems/AI.js` |

| Beyond the tutorial | Cellular-automaton overworld with towns and dungeons, camera and zoom | `src/game/Overworld.js`, `src/game/Game.js` |
| Beyond the tutorial | Kingdoms: capitals, towns, roads and territory on the world map | `src/game/Overworld.js` |
| Beyond the tutorial | Goods, population, prices, caravans, tax collectors, treasuries and soldiers | `src/systems/Economy.js` |
| Beyond the tutorial | Faction borders and the faction panel | `Game._borderLook` in `src/game/Game.js`, `UI.factions` in `src/ui/UI.js` |
| Beyond the tutorial | Towns (cellular background, Digger buildings and roads), businesses, capitals with castles | `src/game/Town.js` |
| Beyond the tutorial | Shopkeepers, villagers, leaders and guards | `src/systems/NPC.js` |
| Beyond the tutorial | Shop stock, buying and selling, markets for trade goods | `src/game/Shops.js` |
| Beyond the tutorial | Clock, daylight, satiation and fatigue | `src/systems/Clock.js` |
| Beyond the tutorial | Dungeon levels, monsters per depth | `src/game/Map.js`, `src/systems/AI.js` |
| Beyond the tutorial | Wood/stone floors, doors, textured walls | `src/game/Tiles.js`, `src/game/Map.js` |
| Beyond the tutorial | Fantasy item list and chest loot | `src/game/Items.js` |
| Beyond the tutorial | Stacking containers (bag, chests) | `src/game/Inventory.js` |
| Beyond the tutorial | Bag and chest windows, drag and drop | `src/ui/InventoryUI.js`, `src/ui/style.css` |
| Beyond the tutorial | Line of sight, fog of war, map memory | `src/systems/FOV.js`, `Game.render` in `src/game/Game.js` |
| Beyond the tutorial | Main menu | `src/ui/UI.js`, `index.html` |
| Beyond the tutorial | 5e dice, stat blocks, weapons, armour, attacks | `src/systems/Combat.js` |
| Beyond the tutorial | Pedro's sight, wandering, heavy swing | `src/systems/AI.js` |
| Beyond the tutorial | Click-to-move, attack/dodge keys, equipping | `src/game/Player.js`, `src/ui/InventoryUI.js` |
| Beyond the tutorial | Status bar and message log | `src/ui/UI.js` |

`src/ui/UI.js` shows messages under the map, and `src/main.js` starts the game.
`main.js` in the root is the Electron window.

## Small differences from the tutorial

- Keys use `event.key` instead of the deprecated numeric `keyCode`, and arrow keys work as well as the numpad.
- Messages appear under the map instead of in `alert()` pop-ups.
- Pedro doesn't capture you on contact any more: he fights you with 5e rules instead.

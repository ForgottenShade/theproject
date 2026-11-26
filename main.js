// Electron main process: opens one window running the game from index.html.
// `npm start` plays it. `npm run selftest` plays 3 games with random keys and clicks, then
// checks combat, Pedro's vision, the heavy swing, equipment and click-to-move, and
// exits non-zero if the page logged errors or a check failed. (No screenshot: on some Windows GPUs
// capturePage never resolves, which used to hang the test.)
const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const SELFTEST = process.argv.includes('--selftest');

function createWindow() {
  // Open at most of the screen; the map view refits itself whenever the window is resized.
  const area = screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({
    width: SELFTEST ? 1200 : Math.max(900, Math.round(area.width * 0.9)),
    height: SELFTEST ? 760 : Math.max(600, Math.round(area.height * 0.9)),
    minWidth: 640,
    minHeight: 420,
    backgroundColor: '#000000',
    title: 'Ananas aus Caracas',
    // The selftest keeps timers at full speed even when the window is covered (Windows throttles hidden windows).
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: !SELFTEST },
  });
  if (SELFTEST) runSelftest(win);
  else win.loadFile(path.join(__dirname, 'index.html'));
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function runSelftest(win) {
  // Never hang: give up after 4 minutes.
  setTimeout(() => { console.log('SELFTEST FAILED (timed out)'); app.exit(1); }, 240000).unref();
  const errors = [];
  win.webContents.on('console-message', (e) => {
    if (e.level === 'error') errors.push(e.message);
  });
  win.webContents.on('preload-error', (e, p, err) => errors.push(String(err)));
  await win.loadFile(path.join(__dirname, 'index.html'));
  const js = (code) => win.webContents.executeJavaScript(code);
  await js(`window.addEventListener('error', (e) => console.error('page error: ' + e.message))`);
  const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'w', 'a', 's', 'd', 'e', 'i', 'f', 'q', '.', 'x', '+', '-'];
  const key = (k) => js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, cancelable: true }))`);
  // Mostly random keys, sometimes a click on a random map cell (click-to-move).
  // click(x, y) clicks map cell (x, y) where the camera shows it; randomClick() clicks a random spot on the map view.
  const click = (x, y) => js(`(() => { const c = Game.display.getContainer(); const r = c.getBoundingClientRect(); const z = Game.view; const cam = Game.camera();
    c.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + (${x} - cam[0] + 0.5) * r.width / z[0], clientY: r.top + (${y} - cam[1] + 0.5) * r.height / z[1] })); })()`);
  const randomClick = () => js(`(() => { const c = Game.display.getContainer(); const r = c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + Math.random() * r.width, clientY: r.top + Math.random() * r.height })); })()`);
  const press = async (n) => {
    for (let i = 0; i < n; i++) {
      if (Math.random() < 0.1) { await randomClick(); await wait(30); }
      else await key(keys[Math.floor(Math.random() * keys.length)]);
    }
  };
  const shot = async (name) => {
    if (!process.argv.includes('--shots')) return; // capturePage can hang on some Windows GPUs
    await wait(300);
    fs.mkdirSync(path.join(__dirname, 'selftest-output'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, 'selftest-output', name), (await win.webContents.capturePage()).toPNG());
  };
  const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) errors.push('check failed: ' + what); };

  for (let round = 0; round < 3; round++) {
    // Main menu -> new world
    if (round === 0) await shot('menu.png');
    await js(`document.getElementById('menu-new').click()`);
    check(await js(`Game.running && Game.level.name === 'overworld' && document.getElementById('menu').hidden`), `round ${round + 1}: menu starts a world`);
    await shot(`overworld-${round + 1}.png`);
    check(await js(`Game.level.width === 160 && Game.level.height === 50`), 'the world map is 160 x 50');
    await press(30);
    // Random keys may have walked into a town or dungeon, or starved the hero: back to the world map.
    await js(`InventoryUI.closeShop(); InventoryUI.closeChest(); if (!Game.running) { Menu.close(); Game.newWorld(); }
      if (Game.level !== Game.overworld) Game._switchTo(Game.overworld, Game.overworld.entrance); Game.player.satiation = 100; Game.player.fatigue = 0; true`);

    // Standing on the entrance does nothing until E is pressed.
    await js(`InventoryUI.toggle(false); Menu.close(); Game.player.stopTravel(); Game.player._x = Game.overworld.entrance[0]; Game.player._y = Game.overworld.entrance[1]; Game.render()`);
    check(await js(`Game.level.name`) === 'overworld', 'standing on the entrance does not enter');
    await key('e');
    check(await js(`Game.level.name`) === 'dungeon', 'E on the entrance enters the dungeon');
    check(await js(`Object.keys(Game.dungeon.memory).length < Object.keys(Game.dungeon.cells).length`), 'fog of war hides unseen cells');
    await shot(`dungeon-${round + 1}.png`);

    // Open a chest with loot and move things into the bag.
    const before = await js(`Game.player.inventory.slots.filter(Boolean).length`);
    await js(`(() => { const k = Object.keys(Game.dungeon.chests).find(k => Game.dungeon.chests[k].count('ananas') === 0); const p = k.split(',').map(Number); Game.player.stopTravel(); Game.player._x = p[0]; Game.player._y = p[1]; Game.render(); })()`);
    await key('e');
    check(await js(`InventoryUI.chest !== null && !document.getElementById('chest').hidden`), 'E on a chest opens the chest window');
    await shot(`chest-${round + 1}.png`);
    await js(`InventoryUI.move('chest', InventoryUI.chest.slots.findIndex(Boolean), 'inv', Game.player.inventory.slots.findIndex(s => !s))`);
    check(await js(`Game.player.inventory.slots.filter(Boolean).length`) >= before, 'moving an item from chest to bag');
    await js(`InventoryUI.takeAll()`);
    await key('Escape');
    check(await js(`InventoryUI.chest === null`), 'Esc closes the chest');

    // Stacking: adding bread twice keeps one stack.
    check(await js(`(() => { const c = new Container('t', 4, 4); c.add('bread', 5); c.add('bread', 7); return c.slots.filter(Boolean).length === 1 && c.count('bread') === 12; })()`), 'items stack');

    if (round < 2) await press(120); // the last round skips wandering so Pedro can't end it before the win check
    console.log(`round ${round + 1}: ${await js(`[Game.level.name, Game.running, document.getElementById('message').textContent].join(' | ')`)}`);

    // Take the stairs down to the bottom, then grab the ananas to win (if nothing killed you first).
    await js(`InventoryUI.closeShop(); InventoryUI.closeChest(); InventoryUI.toggle(false); Menu.close(); true`);
    for (let d = 0; d < 3 && await js(`Game.running && Game.level.name === 'dungeon' && !!Game.level.down`); d++) {
      await js(`Game.player.stopTravel(); Game.player._x = Game.level.down[0]; Game.player._y = Game.level.down[1]; Game.render()`);
      await key('e');
    }
    if (await js(`Game.running`)) {
      check(await js(`Game.level.name === 'dungeon' && Game.level.depth === 3 && Game.pedro && Game.pedro.level === Game.level`), 'stairs lead down to level 3, where Pedro is');
    }
    if (await js(`Game.running && Game.level.name === 'dungeon'`)) {
      await js(`(() => { const k = Object.keys(Game.dungeon.chests).find(k => Game.dungeon.chests[k].count('ananas') > 0); const p = k.split(',').map(Number); Game.player.stopTravel(); Game.player._x = p[0]; Game.player._y = p[1]; InventoryUI.openChest(Game.dungeon.chests[k]); InventoryUI.quickMove('chest', Game.dungeon.chests[k].slots.findIndex(s => s && s.id === 'ananas')); })()`);
      check(await js(`!Game.running`), 'taking the ananas wins');
    }
    await key('Escape'); // back to the menu
  }
  await worldChecks(js, key, click, check, shot);
  await economyChecks(js, key, click, check, shot);
  await combatChecks(js, key, click, check, shot);

  // The map view refits when the window changes size: the canvas changes size with the window and
  // still fits inside it. (The number of cells can stay the same if the window keeps its shape.)
  await js(`Game.setZoom(3); true`);
  const w0 = await js(`window.innerWidth + 'x' + window.innerHeight`);
  const c0 = await js(`Game.display.getContainer().width + 'x' + Game.display.getContainer().height`);
  win.setSize(900, 600);
  let w1 = w0;
  for (let i = 0; i < 30 && w1 === w0; i++) { await wait(100); w1 = await js(`window.innerWidth + 'x' + window.innerHeight`); }
  await wait(400);
  if (w1 === w0) {
    console.log('skip resizing check: the window did not change size on this system');
  } else {
    const c1 = await js(`Game.display.getContainer().width + 'x' + Game.display.getContainer().height`);
    const fits = await js(`(() => { const c = Game.display.getContainer(), b = document.getElementById('game'); const v = Game.view.join(); Game.fit();
      return Game.view.join() === v && c.width <= b.clientWidth + 1 && c.height <= b.clientHeight + 1 && (c.width > b.clientWidth * 0.9 || c.height > b.clientHeight * 0.9); })()`);
    check(c1 !== c0 && fits, `resizing the window refits the map view (window ${w0} -> ${w1}, canvas ${c0} -> ${c1})`);
  }
  win.setSize(1200, 760);

  await wait(200);
  if (errors.length) console.log('Errors:\n' + errors.join('\n'));
  console.log(errors.length ? 'SELFTEST FAILED' : 'SELFTEST PASSED');
  app.exit(errors.length ? 1 : 0);
}

// Factions, towns, goods, prices, caravans, taxes and soldiers.
async function economyChecks(js, key, click, check, shot) {
  await js(`InventoryUI.closeShop(); InventoryUI.closeChest(); InventoryUI.toggle(false); Menu.close(); Game.newWorld(); Game.setZoom(3); true`);
  check(await js(`Economy.factions.length === 3 && Game.overworld.towns.length === 12 && Economy.factions.every(f => f.towns.length === 4 && f.towns.filter(t => t.capital).length === 1 && f.capital.capital)`),
    '3 factions, each with a capital and 3 regional towns');
  check(await js(`Game.overworld.towns.every(t => Game.overworld.cells[t.pos.join()].type === (t.capital ? 'capital' : 'town'))`), 'capitals (Ω) and towns (⌂) are on the world map');
  check(await js(`(() => { const w = Game.overworld; return w.towns.filter(t => !t.capital).every(t => { const r = Economy.route(Economy.faction(t.faction).capital, t);
    const inner = r.slice(1, -1); return inner.length > 0 && inner.filter(c => w.cells[c.join()].road).length >= inner.length * 0.9; }); })()`), 'roads join every regional town to its capital');
  check(await js(`(() => { const a = Economy.factions; return Economy.route(a[0].capital, a[1].capital) && Economy.route(a[1].capital, a[2].capital); })()`), 'roads join the capitals');
  check(await js(`(() => { const w = Game.overworld; return Object.keys(w.cells).every(k => w.owner[k] !== undefined) && w.towns.every(t => w.owner[t.pos.join()] === t.faction)
    && new Set(Object.values(w.owner)).size === 3; })()`), 'every square belongs to a faction, towns to their own');

  // Border toggle.
  await key('b');
  check(await js(`Game.showBorders && !document.getElementById('factions').hidden && document.querySelectorAll('#factions .faction').length === 3
    && document.querySelectorAll('#factions .faction-town').length === 12`), 'B shows the borders and the faction panel');
  check(await js(`(() => { const w = Game.overworld; const t = w.towns[0]; const look = Game._look(t.pos.join()); return Game._borderLook(w, t.pos[0], t.pos[1], look).bg !== look.bg; })()`), 'borders tint the map in faction colours');
  await js(`document.querySelector('#hud .chip.button').click()`);
  check(await js(`!Game.showBorders && document.getElementById('factions').hidden`), 'the borders button in the status bar hides them again');

  // Roads are quicker.
  await js(`(() => { const w = Game.overworld; const k = Object.keys(w.cells).find(k => { if (!w.cells[k].road || w.pois[k]) return false; const p = k.split(',').map(Number);
    return ROT.DIRS[8].some(d => { const n = (p[0] + d[0]) + ',' + (p[1] + d[1]); return w.cells[n] && w.cells[n].road && !w.pois[n] && !Game.beingAt(p[0] + d[0], p[1] + d[1]); }); });
    const p = k.split(',').map(Number); Game.player._x = p[0]; Game.player._y = p[1];
    window._roadDir = ROT.DIRS[8].find(d => { const n = (p[0] + d[0]) + ',' + (p[1] + d[1]); return w.cells[n] && w.cells[n].road && !w.pois[n] && !Game.beingAt(p[0] + d[0], p[1] + d[1]); });
    window._t0 = Clock.minutes; Game.render(); })()`);
  await js(`Game.player.tryStep(_roadDir[0], _roadDir[1])`);
  check(await js(`Clock.minutes - _t0 === 15`), 'a step along a road takes 15 minutes (30 off-road)');

  // Towns: people, goods, prices.
  check(await js(`Game.overworld.towns.every(t => t.pop >= 300 && t.goods.length >= 1 && Economy.GOODS.every(g => t.stock[g] >= 0)) && Economy.factions.every(f => f.capital.pop > Math.max(...f.towns.filter(t => !t.capital).map(t => t.pop)))`),
    'every town has people, goods it makes and stores; capitals are the biggest');
  check(await js(`(() => { const t = Game.overworld.towns[1]; const s = t.stock.metal; t.stock.metal = 0; const hi = Economy.buyPrice(t, 'metal'); t.stock.metal = 400; const lo = Economy.buyPrice(t, 'metal');
    t.stock.metal = Economy.target(t, 'metal'); const mid = Economy.buyPrice(t, 'metal'); t.stock.metal = s; return hi === 80 && lo === 5 && mid === 20; })()`), 'prices follow supply and demand (base 20: 4x when scarce, 0.25x when plentiful)');
  check(await js(`(() => { const t = Game.overworld.towns.find(t => t.goods.includes('grain')); t.stock.grain = 100; t.housing = t.pop * 2; const p = t.pop; Economy._townHour(t); return t.pop > p && !t.hungry; })()`), 'a fed town grows');
  check(await js(`(() => { const t = Game.overworld.towns.find(t => !t.goods.includes('grain')); t.stock.grain = 0; const p = t.pop; Economy._townHour(t); return t.pop < p && t.hungry; })()`), 'a town without grain shrinks');
  check(await js(`(() => { const t = Game.overworld.towns.find(t => !t.goods.includes('stone') && !t.goods.includes('grain')); t.stock.grain = 100; t.stock.stone = 0; t.housing = t.pop; const p = t.pop; Economy._townHour(t);
    const stuck = t.pop === p; t.stock.stone = 10; Economy._townHour(t); return stuck && t.pop > p && t.stock.stone < 10; })()`), 'growing needs stone for new houses');
  check(await js(`(() => { const t = Game.overworld.towns.find(t => !t.goods.includes('metal')); t.stock.metal = 0; Economy._townHour(t); const idle = t.forgeIdle; t.stock.metal = 5; Economy._townHour(t); return idle && !t.forgeIdle; })()`), 'the blacksmith needs metal');

  // The clock drives the economy, wherever you are.
  await js(`window._ticks = 0; const _t = Economy.tick; Economy.tick = function () { _ticks++; return _t.apply(this, arguments); }; Game.passTime(30); Game.passTime(30); Game.passTime(120); true`);
  check(await js(`_ticks === 3`), 'the economy ticks once per game hour');

  // Caravans and tax collectors on the roads.
  check(await js(`Game.overworld.beings.filter(b => b instanceof Caravan).length === 3 && Game.overworld.beings.filter(b => b instanceof TaxCollector).length === 3`), 'one caravan and one tax collector per faction, on the world map');
  await js(`window._cpos = Economy.caravans.map(c => [c._x, c._y]); window._steps = []; for (let h = 0; h < 30; h++) { const before = Economy.caravans.map(c => [c._x, c._y, !!c.path]); Economy.tick();
    Economy.caravans.forEach((c, i) => { if (before[i][2]) _steps.push(Math.max(Math.abs(c._x - before[i][0]), Math.abs(c._y - before[i][1]))); }); } true`);
  check(await js(`Economy.caravans.some((c, i) => c._x !== _cpos[i][0] || c._y !== _cpos[i][1]) && _steps.length > 0 && _steps.every(d => d <= 1)`), 'caravans travel one square per game hour');
  check(await js(`(() => { const t = Game.overworld.towns.find(t => t.goods.includes('luxury') && !t.capital); const c = Economy.caravans[t.faction]; const cap = c.faction.capital;
    Economy.towns.forEach(o => Economy.GOODS.forEach(g => o.stock[g] = Economy.target(o, g))); t.stock.luxury = 300; cap.stock.luxury = 0; c.cargo = { grain: 0, stone: 0, metal: 0, luxury: 0 };
    c.at = t; c.path = null; c.purse = 2000; c.depart(); return c.plan && c.plan.good === 'luxury' && c.cargo.luxury > 0 && c.at === cap; })()`), 'a caravan buys cheap luxury goods and takes them to its capital');
  check(await js(`(() => { const c = Economy.caravans[0]; const t = c.at; const q = c.cargo[c.plan.good]; const s = t.stock[c.plan.good]; c.purse = 100; const p0 = c.purse; const tr = c.faction.treasury; c.arrive();
    return c.load() === 0 && t.stock[c.plan.good] >= Math.min(400, s + q - 0.01) && c.purse > p0 && c.faction.treasury > tr; })()`), 'at the far end the caravan sells its load and pays a tenth of the profit to its treasury');

  // Trading with a caravan.
  await js(`(() => { const c = Economy.caravans[0]; const p = Game.player; const w = Game.overworld; c.wait = 99; c.path = null;
    const d = ROT.DIRS[8].find(d => { const k = (p._x + d[0]) + ',' + (p._y + d[1]); return w.cells[k] && w.cells[k].passable && !w.pois[k] && !Game.beingAt(p._x + d[0], p._y + d[1]); });
    c._x = p._x + d[0]; c._y = p._y + d[1]; c.cargo.grain = 10; window._cd = d; p.inventory.add('gold', 200); Game.render(); })()`);
  await js(`Game.player.tryStep(_cd[0], _cd[1])`);
  check(await js(`InventoryUI.shop && InventoryUI.shop.kind === 'caravan' && InventoryUI.shop.stock.slots.filter(s => s && s.market).length === 4`), 'walking into a caravan opens its trading window');
  check(await js(`(() => { const shop = InventoryUI.shop; const i = shop.stock.slots.findIndex(s => s && s.id === 'grain'); const price = shop.stock.slots[i].price; const g = Game.player.inventory.count('gold');
    InventoryUI.quickMove('shop', i); return Game.player.inventory.count('grain') === 1 && Economy.caravans[0].cargo.grain === 9 && Game.player.inventory.count('gold') === g - price; })()`), 'buying grain from the caravan');
  check(await js(`(() => { const inv = Game.player.inventory; const i = inv.slots.findIndex(s => s && s.id === 'grain'); const g = inv.count('gold'); InventoryUI.quickMove('inv', i);
    return inv.count('grain') === 0 && Economy.caravans[0].cargo.grain === 10 && inv.count('gold') > g; })()`), 'selling grain to the caravan');
  check(await js(`(() => { const inv = Game.player.inventory; inv.add('ruby', 1); const i = inv.slots.findIndex(s => s && s.id === 'ruby'); InventoryUI.quickMove('inv', i); const kept = inv.count('ruby') === 1; inv.remove('ruby', 1); return kept; })()`), 'the caravan only deals in trade goods');
  await key('Escape');

  // Taxes and the treasury.
  check(await js(`(() => { const f = Economy.factions[1]; const tc = Economy.collectors[1]; const t = f.towns.find(t => !t.capital); t.taxOwed = 37.5; tc.at = t; tc.purse = 0; tc.arrive();
    const got = tc.purse === 37 && t.taxOwed === 0.5; const tr = f.treasury; tc.at = f.capital; tc.arrive(); return got && f.treasury === tr + 37 && tc.purse === 0; })()`), 'the tax collector collects from the towns and pays the treasury at the capital');
  check(await js(`(() => { const f = Economy.factions[1]; f.treasury = 10; f.capital.taxOwed = 0; f.soldiers = 20; Economy._payday(f); return f.soldiers === 5 && f.unpaid === 15 && /sent home/.test(Economy.news.map(n => n.text).join()); })()`), 'soldiers the treasury cannot pay are fired');
  check(await js(`(() => { const f = Economy.factions[2]; f.treasury = 5000; f.soldiers = 10; f.capital.stock.metal = 100; f.capital.stock.stone = 50; const m = f.capital.stock.metal; Economy._payday(f);
    return f.soldiers === 12 && f.capital.stock.metal < m && f.treasury < 5000; })()`), 'a rich treasury hires soldiers and buys their metal');

  // Towns: businesses and the market at the general store.
  await js(`Game.player._x = Game.overworld.town[0]; Game.player._y = Game.overworld.town[1]; Game.render(); true`);
  await key('e');
  check(await js(`Game.level.name === 'town' && Game.level.poi.goods.every(g => Game.level.businesses.some(b => b.good === g && b.doors.length > 0))`), 'the town has a business for each good it makes');
  check(await js(`(() => { const shop = Game.level.shops.general; InventoryUI.openShop(shop); const t = Game.level.poi; t.stock.stone = 20; Shops.refreshMarket(shop);
    const i = shop.stock.slots.findIndex(s => s && s.id === 'stone'); InventoryUI.quickMove('shop', i); return Game.player.inventory.count('stone') === 1 && t.stock.stone === 19; })()`), 'the general store sells trade goods from the town stores');
  check(await js(`Game.level.shops.tavern.stock.slots.find(s => s && s.id === 'hot_meal').price === Shops.STOCK.tavern.find(l => l[0] === 'hot_meal')[2]`), 'ordinary shop prices stay fixed');
  await key('Escape');
  await js(`Game.leaveTown(); true`);

  // A capital: twice the size, castle, leader, guards.
  await js(`(() => { const f = Economy.factions[1]; Game.player._x = f.capital.pos[0]; Game.player._y = f.capital.pos[1]; Game.render(); })()`);
  await key('e');
  check(await js(`Game.level.name === 'town' && Game.level.poi.capital && Math.abs(Game.level.width * Game.level.height / (160 * 50) - 2) < 0.05`), 'a capital is twice the area of a town');
  check(await js(`(() => { const c = Game.level.castle; return c && c.leader && c.leader.role === 'leader' && Game.level.cells[(c.throneSpot[0]) + ',' + (c.throneSpot[1] - 1)].type === 'throne'; })()`), 'the capital has a castle with the faction leader by the throne');
  check(await js(`Game.level.castle.guards.length === 2`), 'one guard in the courtyard for every 4 soldiers (5 left after the firing)');
  await js(`Game.level.castle.leader.interact(Game.player)`);
  check(await js(`/treasury holds/.test(document.getElementById('message').textContent)`), 'the leader tells you the state of the realm');
  check(await js(`(() => { const L = Game.level, s = L.start; let seen = { [s.join()]: 1 }, q = [s]; while (q.length) { const p = q.pop(); for (const d of ROT.DIRS[8]) { const k = (p[0] + d[0]) + ',' + (p[1] + d[1]);
    if (!seen[k] && L.cells[k] && L.cells[k].passable) { seen[k] = 1; q.push(k.split(',').map(Number)); } } } return !!seen[L.castle.throneSpot.join()] && L.buildings.every(b => b.doors.some(d => seen[d.join()])); })()`),
    'every building and the throne room can be reached from the road in');
  await js(`InventoryUI.toggle(false); Game.player._x = Game.level.castle.gate[0]; Game.player._y = Game.level.castle.gate[1] + 1; Game.setZoom(2); true`);
  await shot('capital.png');
  await js(`Game.leaveTown(); Game.setZoom(0); Game.toggleBorders(true); true`);
  await shot('borders.png');
  await js(`Game.toggleBorders(false); Game.setZoom(3); true`);
}

// The world: map size and zoom, the clock and its light, towns, shops, villagers, food, sleep,
// and dungeon levels.
async function worldChecks(js, key, click, check, shot) {
  const stepAnywhere = `(() => { const p = Game.player; for (const d of ROT.DIRS[8]) { const x = p._x + d[0], y = p._y + d[1]; const c = Game.cellAt(x, y);
    if (c && c.passable && !Game.beingAt(x, y) && !Game.poiAt(x, y)) { p.tryStep(d[0], d[1]); return; } } })()`;
  await js(`InventoryUI.closeShop(); InventoryUI.closeChest(); InventoryUI.toggle(false); Menu.close(); Game.newWorld(); Game.setZoom(3); true`);
  check(await js(`Clock.text() === 'Day 1 08:00'`), 'the clock starts at day 1, 08:00');
  await js(stepAnywhere);
  check(await js(`Clock.minutes === 8 * 60 + 30`), 'a step on the world map takes 30 minutes');

  // Zoom and camera.
  await js(`Game.setZoom(0); true`);
  check(await js(`Game.display.getOptions().width === 160 && Game.display.getOptions().height === 50 && Game.camera().join() === '0,0'`), 'zoomed all the way out shows the whole 160 x 50 map');
  await js(`Game.player._x = 80; Game.player._y = 25; Game.setZoom(6); true`);
  check(await js(`(() => { const v = Game.view; return v[0] >= 32 && v[1] >= 10 && v[0] < 160 && Game.camera().join() === (80 - Math.floor(v[0] / 2)) + ',' + (25 - Math.floor(v[1] / 2)); })()`), 'zoomed in, the camera centres on the player');
  check(await js(`(() => { const c = Game.display.getContainer(), b = document.getElementById('game'); return c.width <= b.clientWidth + 1 && c.height <= b.clientHeight + 1 && (c.width > b.clientWidth * 0.9 || c.height > b.clientHeight * 0.9); })()`), 'the map view fills the window without overflowing');
  await js(`Game.player._x = 2; Game.player._y = 1; true`);
  check(await js(`Game.camera().join() === '0,0'`), 'the camera stops at the map edge');
  await key('-');
  check(await js(`Game.zoom === 5`), 'the - key zooms out');
  await js(`Game.setZoom(3); Game.player._x = Game.overworld.town[0]; Game.player._y = Game.overworld.town[1]; Game.render(); true`);

  // Daylight.
  check(await js(`Clock.minutes = 12 * 60; Clock.light().join() === '255,255,255'`), 'full daylight at noon');
  check(await js(`Clock.minutes = 23 * 60; Clock.light()[0] < 100 && Clock.isNight()`), 'dark at night');
  await js(`Clock.minutes = 9 * 60; true`);

  // Town.
  await key('e');
  check(await js(`Game.level.name === 'town' && Game.level.width === 160 && Game.level.height === 50`), 'E on the town marker enters a 160 x 50 town');
  check(await js(`['tavern', 'blacksmith', 'general'].every(k => Game.level.shops[k] && Game.level.shops[k].keeper)`), 'the town has a tavern, a blacksmith and a general store, each with a shopkeeper');
  check(await js(`Game.level.buildings.every(b => b.doors.length > 0) && Game.level.buildings.find(b => b.kind === 'tavern').beds.length > 0`), 'every building has a door, the tavern has beds');
  check(await js(`Game.level.beings.filter(b => b.role !== 'shopkeeper').length >= 3 && Game.level.fields.length >= 1`), 'villagers and fields');
  check(await js(`(() => { const L = Game.level, s = L.start; return L.beings.every(b => { let n = 0;
      new ROT.Path.AStar(b._x, b._y, (x, y) => (x === b._x && y === b._y) || !!(L.cells[x + ',' + y] && L.cells[x + ',' + y].passable), { topology: 8 }).compute(s[0], s[1], () => n++); return n > 0; }); })()`), 'everyone in town can be reached from the town gate');
  const m0 = await js(`Clock.minutes`);
  await js(stepAnywhere);
  check(await js(`Clock.minutes`) === m0 + 1, 'a step in town takes 1 minute');
  await shot('town.png');

  // Shops.
  await js(`Game.player.inventory.add('gold', 200); Game.level.shops.tavern.keeper.interact(Game.player); true`);
  check(await js(`InventoryUI.shop === Game.level.shops.tavern && !document.getElementById('shop').hidden`), 'walking into the innkeeper opens the tavern shop');
  const g0 = await js(`Game.player.inventory.count('gold')`);
  await js(`InventoryUI.quickMove('shop', InventoryUI.shop.stock.slots.findIndex(s => s && s.id === 'hot_meal'), true)`);
  check(await js(`Game.player.inventory.count('hot_meal') === 1 && Game.player.inventory.count('gold') === ${g0} - InventoryUI.shop.stock.slots.find(s => s && s.id === 'hot_meal').price`), 'buying a meal costs gold coins');
  const g1 = await js(`Game.player.inventory.count('gold')`);
  await js(`Game.player.inventory.add('ruby', 1); InventoryUI.quickMove('inv', Game.player.inventory.slots.findIndex(s => s && s.id === 'ruby'))`);
  check(await js(`Game.player.inventory.count('ruby') === 0 && Game.player.inventory.count('gold') === ${g1} + 50`), 'selling a ruby gets half its 100 gold price');
  await shot('shop.png');
  await key('Escape');
  check(await js(`InventoryUI.shop === null`), 'Esc closes the shop');
  check(await js(`(() => { const ids = Game.level.shops.blacksmith.stock.slots.filter(Boolean).map(s => s.id); return ids.length >= 30 && ['greatsword', 'rapier', 'half_plate', 'longbow'].every(i => ids.includes(i)) && ids.every(i => Combat.slotFor(i)); })()`), 'the blacksmith sells the 5e weapons and armour, all equippable');
  check(await js(`Game.level.shops.general.stock.slots.some(s => s && s.id === 'camp_kit')`), 'the general store sells camping kits');

  // Food.
  await js(`Game.player.satiation = 40; InventoryUI.useItem(Game.player.inventory.slots.findIndex(s => s && s.id === 'hot_meal'))`);
  check(await js(`Game.player.satiation >= 89 && Game.player.satiation <= 90 && Game.player.inventory.count('hot_meal') === 0`), 'eating stew fills the satiation bar');
  const sat = await js(`Game.player.satiation`);
  await js(`Game.passTime(150); true`);
  check(await js(`Math.abs(Game.player.satiation - (${sat} - 10)) < 0.001`), 'satiation drops 1 point per 15 minutes');

  // Sleeping at the inn.
  await js(`(() => { const b = Game.level.buildings.find(b => b.kind === 'tavern').beds[0]; Game.player.stopTravel(); Game.player._x = b[0]; Game.player._y = b[1];
    Game.player.fatigue = 80; Game.player.stats.hp = 1; window._t0 = Clock.minutes; window._g0 = Game.player.inventory.count('gold'); Game.render(); })()`);
  await key('e');
  check(await js(`Game.player.fatigue === 0 && Clock.minutes === _t0 + 480 && Game.player.inventory.count('gold') === _g0 - 1 && Game.player.stats.hp === Game.player.stats.maxHp`), 'a tavern bed costs 1 gold: 8 hours of sleep, fatigue 0, full HP');

  // Villagers go to work.
  await js(`Clock.minutes = Math.floor(Clock.minutes / 1440) * 1440 + 6 * 60 + 30; Game.level.beings.forEach(b => b.placeForTime()); true`);
  check(await js(`Game.level.beings.filter(b => b.role !== 'shopkeeper').every(b => b._inArea(b.home))`), 'at 6:30 villagers are at home');
  await js(`Clock.minutes += 40; for (let i = 0; i < 250; i++) Game.level.beings.forEach(b => b.act()); true`);
  check(await js(`(() => { const v = Game.level.beings.filter(b => b.role !== 'shopkeeper'); return v.filter(b => b._inArea(b.work)).length >= Math.ceil(v.length / 2); })()`), 'after 7:00 villagers walk from home to their jobs');

  // Leaving town: the X key, and the map edge.
  await key('x');
  check(await js(`Game.level === Game.overworld && Game.player._x === Game.overworld.town[0] && Game.player._y === Game.overworld.town[1]`), 'X leaves town for the world map');
  await key('e');
  await js(`Game.player.stopTravel(); Game.player._x = Game.level.start[0]; Game.player._y = Game.level.start[1]; Game.render(); Game.player.tryStep(-1, 0); true`);
  check(await js(`Game.level === Game.overworld`), 'walking off the edge of town leaves it');

  // Camping, starving.
  await js(`Game.player.fatigue = 90; window._t0 = Clock.minutes; InventoryUI.useItem(Game.player.inventory.slots.findIndex(s => s && s.id === 'camp_kit'))`);
  check(await js(`Game.player.fatigue === 0 && Clock.minutes === _t0 + 480`), 'the camping kit sleeps 8 hours anywhere outside town');
  await js(`Game.player.satiation = 0; Game.player.stats.hp = 10; Game.passTime(125); true`);
  check(await js(`Game.player.stats.hp === 8`), 'starving costs 1 HP an hour');
  await js(`Game.player.satiation = 100; Game.player.stats.hp = Game.player.stats.maxHp; true`);

  // Dungeon levels.
  await js(`Game.enterDungeon(); true`);
  check(await js(`Game.level.depth === 1 && Game.level.beings.length === 3 && !!Game.level.down && Object.values(Game.level.chests).every(c => c.count('ananas') === 0)`), 'dungeon level 1: 3 monsters, stairs down, no ananas');
  const m1 = await js(`Clock.minutes`);
  await js(stepAnywhere);
  check(await js(`Clock.minutes`) === m1 + 1, 'a step in a dungeon takes 1 minute');
  await js(`Game.takeStairs(1); true`);
  check(await js(`Game.level.depth === 2 && Game.level.beings.length === 5 && Game.player._x === Game.level.start[0]`), 'level 2: more monsters, you arrive on the stairs up');
  await js(`Game.takeStairs(1); true`);
  check(await js(`Game.level.depth === 3 && !Game.level.down && Game.level.beings.length === 8 && Game.pedro && Game.pedro.level === Game.level && Object.values(Game.level.chests).some(c => c.count('ananas') === 1)`), 'level 3 (the bottom): 7 monsters plus Pedro, and the ananas');
  await js(`Game.takeStairs(-1); true`);
  check(await js(`Game.level.depth === 2 && Game.player._x === Game.level.down[0] && Game.player._y === Game.level.down[1]`), 'going up arrives on the stairs down');
  await js(`Game.takeStairs(-1); Game.takeStairs(-1); true`);
  check(await js(`Game.level === Game.overworld && Game.player._x === Game.overworld.entrance[0]`), 'the stairs up from level 1 lead back to the world map');
  check(await js(`(() => { const rare = d => { let n = 0; for (let i = 0; i < 4000; i++) { const r = Items.randomItem(d).rarity; if (r === 'rare' || r === 'epic') n++; } return n; }; return rare(3) > rare(1) * 1.5; })()`), 'deeper levels roll better loot');
}

// Rules checks: stat block, dice, equipment, Pedro's vision and diagonal moves, attacks, Dodge,
// the heavy swing and its tell, dying, killing Pedro, and click-to-move with its interrupt.
async function combatChecks(js, key, click, check, shot) {
  // A fresh world, in the dungeon. Hide Pedro's turns from random chance by stubbing dice where needed.
  await js(`InventoryUI.toggle(false); Menu.close(); Game.newWorld(); Game.player._x = Game.overworld.entrance[0]; Game.player._y = Game.overworld.entrance[1]; Game.render()`);

  // Click-to-move on the overworld: click a cell a few steps away and wait to arrive.
  // Pick a cell 3-6 steps away by an actual short path (mountains can force long detours).
  const target = await js(`(() => { const p = Game.player; const cells = Game.overworld.cells;
    for (const k in cells) { const q = k.split(',').map(Number); const d = Math.max(Math.abs(q[0] - p._x), Math.abs(q[1] - p._y));
      if (!cells[k].passable || d < 3 || d > 6) continue;
      let n = 0; new ROT.Path.AStar(q[0], q[1], (x, y) => !!(cells[x + ',' + y] && cells[x + ',' + y].passable), { topology: 8 }).compute(p._x, p._y, () => n++);
      if (n > 0 && n - 1 <= 6) return q; }
    return null; })()`);
  if (target) {
    await click(target[0], target[1]);
    for (let i = 0; i < 200 && await js(`!!Game.player.path`); i++) await wait(50);
    await wait(100);
    check(await js(`Game.player._x === ${target[0]} && Game.player._y === ${target[1]}`), 'clicking a cell walks there (diagonals allowed)');
  }
  await js(`Game.player.stopTravel(); Game.player._x = Game.overworld.entrance[0]; Game.player._y = Game.overworld.entrance[1]; Game.render()`);
  await key('e');
  check(await js(`Game.level === Game.dungeon`), 'combat world: entered the dungeon');
  // Down to Pedro's level, and clear out the other monsters so only Pedro takes turns.
  for (let d = 0; d < 2; d++) {
    await js(`Game.player._x = Game.level.down[0]; Game.player._y = Game.level.down[1]; Game.render()`);
    await key('e');
  }
  await js(`Game.level.beings.filter(b => b !== Game.pedro).forEach(b => Game.level.scheduler.remove(b)); Game.level.beings = [Game.pedro]; Game.render(); true`);

  // Stat block.
  check(await js(`(() => { const s = Game.player.stats; return Combat.ABILITIES.every(k => s.abilities[k] >= 3 && s.abilities[k] <= 18)
      && s.maxHp === Math.max(1, 10 + Combat.mod(s.abilities.con)) && s.hp === s.maxHp && s.prof === 2; })()`), 'player stats: 4d6-drop-lowest abilities, fighter HP');
  check(await js(`Game.player.getAC() === 11 + Combat.mod(Game.player.stats.abilities.dex)`), 'leather armour AC = 11 + Dex');
  check(await js(`(() => { for (let i = 0; i < 2000; i++) { const r = Dice.roll('2d6+1').total; const a = Dice.abilityScore(); if (r < 3 || r > 13 || a < 3 || a > 18) return false; } return true; })()`), 'dice stay in range');
  check(await js(`Game.pedro.stats.ac === 13 && Game.pedro.stats.maxHp === 15 && Game.pedro.stats.attack.bonus === 5`), 'Pedro uses the orc stat block');
  check(await js(`!Game.pedro.alerted && !Game.pedro.canSee(Game.player)`), 'Pedro starts out of sight and unaware');

  // Equipment.
  await js(`InventoryUI.toggle(true); ['longsword', 'iron_shield', 'chainmail', 'greataxe'].forEach(id => Game.player.inventory.add(id, 1)); InventoryUI.refresh()`);
  const idx = (id) => `Game.player.inventory.slots.findIndex(s => s && s.id === '${id}')`;
  await js(`InventoryUI.useItem(${idx('chainmail')}); InventoryUI.useItem(${idx('iron_shield')}); InventoryUI.useItem(${idx('longsword')})`);
  check(await js(`Game.player.equipment.armor === 'chainmail' && Game.player.equipment.shield === 'iron_shield' && Game.player.equipment.weapon === 'longsword' && Game.player.getAC() === 18`), 'equipping chain mail + shield gives AC 18');
  check(await js(`Game.player.inventory.count('leather_armor') === 1 && Game.player.inventory.count('dagger') === 1`), 'swapped-out gear goes back to the bag');
  check(await js(`Combat.playerAttack(Game.player).dice.indexOf('1d8') === 0`), 'longsword with a shield: 1d8');
  await js(`InventoryUI.useItem(${idx('greataxe')})`);
  check(await js(`Game.player.equipment.weapon === 'greataxe' && !Game.player.equipment.shield && Game.player.inventory.count('iron_shield') === 1`), 'a two-handed weapon takes the shield off');
  await js(`InventoryUI.useItem(${idx('longsword')})`);
  check(await js(`Combat.playerAttack(Game.player).dice.indexOf('1d10') === 0`), 'versatile longsword with no shield: 1d10');
  check(await js(`document.querySelectorAll('#equip-grid .slot').length === 4 && !document.getElementById('gear').hidden && document.querySelectorAll('#sheet .ability').length === 6`), 'character sheet and equipment slots show with the bag');
  await js(`Game.player.unequip('armor')`);
  check(await js(`Game.player.equipment.armor === null && Game.player.getAC() === 10 + Combat.mod(Game.player.stats.abilities.dex)`), 'unequipping armour');
  await js(`InventoryUI.toggle(false)`);

  // Find an open diagonal in a room: cells a, a+(1,1), a+(2,2) all floor.
  const diag = await js(`(() => { const c = Game.dungeon.cells; for (const k in c) { const [x, y] = k.split(',').map(Number);
      const ok = (dx) => c[(x + dx) + ',' + (y + dx)] && c[(x + dx) + ',' + (y + dx)].passable && !Game.dungeon.chests[(x + dx) + ',' + (y + dx)];
      if ((c[k].type === 'wood' || c[k].type === 'stone') && ok(0) && ok(1) && ok(2)) return [x, y]; } return null; })()`);
  // Vision: a hidden Pedro doesn't come for you.
  const hiddenOk = await js(`(() => { const pe = Game.pedro, pl = Game.player; let ok = true;
      for (let i = 0; i < 30; i++) { if (pe.canSee(pl)) break; pe.act(); if (pe.alerted || pe.lastSeen) { ok = pe.canSee(pl); break; } }
      return ok; })()`);
  check(hiddenOk, 'Pedro ignores a player he cannot see');

  // Diagonal chase.
  await js(`Monster.HEAVY_CHANCE = 0`);
  await js(`Game.player._x = ${diag[0] + 2}; Game.player._y = ${diag[1] + 2}; Game.pedro._x = ${diag[0]}; Game.pedro._y = ${diag[1]}; Game.pedro.act()`);
  check(await js(`Game.pedro.alerted && Game.pedro._x === ${diag[0] + 1} && Game.pedro._y === ${diag[1] + 1}`), 'Pedro sees you and steps diagonally toward you');

  // Attacks and Dodge, with a stubbed d20.
  await js(`window._d20 = Dice.d20; window.d20q = []; Dice.d20 = () => window.d20q.length ? window.d20q.shift() : 10; true`);
  await js(`d20q = [18, 3]`);
  check(await js(`Combat.attack(Game.pedro, Game.player, Game.pedro.stats.attack, { disadvantage: true }).hit === false`), 'Dodge: disadvantage keeps the lower d20 (18, 3 -> miss)');
  await js(`d20q = [18, 3]; Game.player.stats.hp = 100`);
  check(await js(`(() => { const r = Combat.attack(Game.pedro, Game.player, Game.pedro.stats.attack, {}); return r.hit && r.damage >= 4 && r.damage <= 15 && Game.player.stats.hp === 100 - r.damage; })()`), 'a hit rolls 1d12+3 damage and lowers HP');
  await js(`d20q = [20]`);
  check(await js(`(() => { const r = Combat.attack(Game.pedro, Game.player, Game.pedro.stats.attack, {}); return r.crit && r.damage >= 5 && r.damage <= 27; })()`), 'natural 20: critical hit doubles dice');
  await js(`d20q = [1]`);
  check(await js(`Combat.attack(Game.player, Game.pedro, { name: 'test', bonus: 50, dice: '1d4', type: 'piercing' }, {}).hit === false`), 'natural 1 always misses');

  // Q and F on your turn (Pedro next to you).
  await js(`Game.player.stats.hp = 100; Game.pedro.stats.hp = 15; Game.pedro._x = ${diag[0] + 1}; Game.pedro._y = ${diag[1] + 1}; Game.render()`);
  await js(`d20q = [15, 2]`); // Pedro's attack during his turn, with disadvantage: 2 -> miss
  await key('q');
  check(await js(`Game.player.stats.hp === 100 && /dodge/i.test(document.getElementById('message').textContent)`), 'Q dodges and Pedro attacks with disadvantage');
  await js(`d20q = [17, 3]`); // you hit (17 + bonus vs 13), Pedro misses (3)
  await key('f');
  check(await js(`/You attack Pedro/.test(document.getElementById('message').textContent) && Game.pedro.stats.hp < 15`), 'F attacks the adjacent enemy');

  // Heavy swing: tell, then step away.
  await js(`Game.pedro._startWindup(Game.player); Game.render()`);
  check(await js(`!!Game.pedro.windup && /WINDING UP/.test(document.getElementById('hud').textContent) && /greataxe high/.test(document.getElementById('message').textContent)`), 'heavy swing wind-up shows a tell');
  await js(`InventoryUI.toggle(true)`);
  await shot('combat.png');
  await js(`InventoryUI.toggle(false)`);
  const away = await js(`(() => { const p = Game.player; for (const d of ROT.DIRS[8]) { const x = p._x + d[0], y = p._y + d[1];
      const c = Game.cellAt(x, y); if (c && c.passable && !Game.beingAt(x, y)) return [x, y]; } return null; })()`);
  const hpBefore = await js(`Game.player.stats.hp`);
  await js(`d20q = [20, 20]; Game.player._x = ${away[0]}; Game.player._y = ${away[1]}; Game.pedro.act()`);
  check(await js(`Game.player.stats.hp === ${hpBefore} && Game.pedro.offBalance && !Game.pedro.windup`), 'stepping off the red square dodges the heavy swing; Pedro is off balance');
  // Heavy swing that lands.
  await js(`Game.pedro._x = ${diag[0] + 1}; Game.pedro._y = ${diag[1] + 1}; Game.player._x = ${diag[0] + 2}; Game.player._y = ${diag[1] + 2}; Game.pedro._startWindup(Game.player); d20q = [15]; Game.pedro.act()`);
  check(await js(`Game.player.stats.hp <= ${hpBefore} - 5 && Game.player.stats.hp >= ${hpBefore} - 27`), 'the heavy swing hits for 2d12+3 if you stay');

  // Click-to-move interrupt: walk across known cells, Pedro appears, you stop.
  await js(`Game.pedro.stats.hp = 15; Game.pedro._x = -50; Game.pedro._y = -50; Game.pedro.alerted = false; Game.pedro.lastSeen = null; Game.pedro.windup = null; Game.pedro.act = function () {}; Game.render()`);
  // Healing potion (Pedro is out of the way, so the turn it takes is safe).
  await js(`Game.player.stats.hp = 1; Game.player.inventory.add('potion_heal', 1); InventoryUI.useItem(${idx('potion_heal')})`);
  check(await js(`Game.player.stats.hp >= 5 && Game.player.stats.hp <= 11`), 'healing potion heals 2d4+2');

  await js(`(() => { const s = Game.dungeon.start; Game.player._x = s[0]; Game.player._y = s[1]; for (const k in Game.dungeon.cells) Game.dungeon.memory[k] = Game._look(k); Game.render(); })()`);
  const far = await js(`(() => { const p = Game.player; let best = null, bd = 0; for (const k in Game.dungeon.cells) { const c = Game.dungeon.cells[k]; if (!c.passable) continue;
      const q = k.split(',').map(Number); const d = Math.max(Math.abs(q[0] - p._x), Math.abs(q[1] - p._y)); if (d > bd) { bd = d; best = q; } } return best; })()`);
  await js(`Game.player.travelTo(${far[0]}, ${far[1]})`);
  await wait(250);
  check(await js(`!!Game.player.path`), 'click-to-move walks a long path step by step');
  // Put Pedro two cells ahead on the path, in plain view.
  await js(`(() => { const p = Game.player.path; const c = p[Math.min(2, p.length - 1)]; Game.pedro._x = c[0]; Game.pedro._y = c[1]; })()`);
  await wait(300);
  check(await js(`Game.player.path === null && !(Game.player._x === ${far[0]} && Game.player._y === ${far[1]}) && /You see Pedro and stop/.test(document.getElementById('message').textContent)`), 'walking stops when an enemy comes into view');

  // Killing Pedro leaves his remains.
  await js(`delete Game.pedro.act; Game.pedro.stats.hp = 1; d20q = [20]; Game.pedro._x = Game.player._x + 1; Game.pedro._y = Game.player._y;
    if (!Game.cellAt(Game.pedro._x, Game.pedro._y).passable) { Game.pedro._x = Game.player._x - 1; } Game.render()`);
  const pk = await js(`Game.pedro._x + ',' + Game.pedro._y`);
  await js(`Game.player.attackTarget(Game.pedro)`);
  check(await js(`!Game.pedro.isAlive() && Game.dungeon.chests['${pk}'] && Game.dungeon.chests['${pk}'].count('greataxe') >= 1 && Game.running`), 'killing Pedro drops his greataxe; the game goes on');

  // Exhaustion: a full fatigue bar gives your attacks disadvantage.
  await js(`Game.player.fatigue = 100; d20q = [20, 1]; true`);
  check(await js(`Combat.attack(Game.player, Game.pedro, { name: 'test', bonus: 5, dice: '1d4', type: 'piercing' }, {}).hit === false`), 'exhausted: attacks roll with disadvantage');
  await js(`Game.player.fatigue = 0; true`);

  // Dying ends the game (to a monster on the first level).
  await js(`Game.newWorld(); Game.enterDungeon(); Game.player.stats.hp = 1; const m = Game.level.beings[0]; m.stats.heavy = null;
    const p = Game.player; const spot = ROT.DIRS[8].map(d => [p._x + d[0], p._y + d[1]]).find(c => Game.cellAt(c[0], c[1]) && Game.cellAt(c[0], c[1]).passable && !Game.beingAt(c[0], c[1]));
    m._x = spot[0]; m._y = spot[1]; d20q = [20]; m.act()`);
  check(await js(`!Game.running && Game.player.stats.hp === 0 && /You died/.test(document.getElementById('banner').textContent)`), 'dropping to 0 HP ends the game');

  await js(`Dice.d20 = window._d20; Monster.HEAVY_CHANCE = 0.3; true`);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

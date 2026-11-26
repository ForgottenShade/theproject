// Entry point: set up the display and windows, then show the main menu.
// Global keys: I = bag, + / - = zoom, Esc = close the open window (or open the menu).
window.addEventListener("load", function () {
  Game.init();
  InventoryUI.init();
  Menu.init();

  window.addEventListener("keydown", function (e) {
    if (Menu.isOpen()) {
      if (e.key === "Escape" && Game.running) { Menu.close(); }
      return;
    }
    if ((e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_") && Game.running) {
      e.preventDefault();
      Game.zoomBy(e.key === "-" || e.key === "_" ? -1 : 1);
      return;
    }
    if ((e.key === "b" || e.key === "B") && Game.running) {
      e.preventDefault();
      Game.toggleBorders();
      return;
    }
    if (e.key === "Escape") {
      if (InventoryUI.shop) { InventoryUI.closeShop(); }
      else if (InventoryUI.chest) { InventoryUI.closeChest(); }
      else if (InventoryUI.open) { InventoryUI.toggle(false); }
      else { Menu.open(); }
    } else if ((e.key === "i" || e.key === "I" || e.key === "Tab") && Game.player) {
      e.preventDefault();
      InventoryUI.toggle();
    }
  });
});

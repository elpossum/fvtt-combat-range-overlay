import { mouse } from "./mouse.js";
import { MODULE_ID } from "./constants.js";
import { CombatRangeOverlay } from "./croClass.js";
import { setup as terrainSetup} from "./terrainHelper.js";

// Run self-executing hooks

import './mouse.js'
import './debug.js';
import './settings.js';
import './colorPicker.js';
import './controls.js';
import './tokenInfo.js';


/* Tasks
 * Basic functionality:
 * - Register Hooks for joining combat and ending combat turn to update current measureFrom
 * - Add Hook to draw overlay
 *
 * Enhanced functionality:
 * - Add visibility selection to dialog
 * - Honor visibility selection
 */
Hooks.on("init", () => {
  globalThis.combatRangeOverlay = new CombatRangeOverlay()
  globalThis.combatRangeOverlay.registerHooks();
  globalThis.combatRangeOverlay.setActionsToShow();
  globalThis.combatRangeOverlay.setColorByActions();
  globalThis.combatRangeOverlay.setColors();
  globalThis.combatRangeOverlay.setTerrainProvider();
})

Hooks.on("ready", async function () {
  globalThis.combatRangeOverlay.canvasReadyHook();
  if (globalThis.combatRangeOverlay.terrainProvider?.id === "terrainmapper" && !globalThis.combatRangeOverlay.terrainProvider?.usesRegions) await terrainSetup();
  mouse.addHook(globalThis.combatRangeOverlay.dragHandler.bind(globalThis.combatRangeOverlay));
  globalThis.combatRangeOverlay._initialized();
  Hooks.callAll(`${ MODULE_ID }.ready`);
  if (!game.settings.get(MODULE_ID, "shown-notification") && !game.modules.get('colorsettings')?.active && !game.modules.get('color-picker')?.active) {
    ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.no-color-settings`));
    game.settings.set(MODULE_ID, "shown-notification", true)
  };
});
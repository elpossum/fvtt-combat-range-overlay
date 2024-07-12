/* globals
Hooks,
game,
PIXI
*/

import { mouse } from "./mouse.js";
import { MODULE_ID } from "./constants.js";
import { CombatRangeOverlay } from "./croClass.js";
import { setup as terrainSetup } from "./terrainHelper.js";
import { signedArea } from "./utility.js";

// Run self-executing hooks

import "./mouse.js";
import "./debug.js";
import "./settings.js";
import "./colorPicker.js";
import "./controls.js";
import "./tokenInfo.js";
import "./terrainHelperV2.js";

export let cro;

/* On init, create a new instance of the module class and add PIXI.Polygon area methods if not present*/
Hooks.on("init", () => {
  if (!PIXI.Polygon.prototype.signedArea)
    PIXI.Polygon.prototype.signedArea = signedArea;
  if (!PIXI.Polygon.prototype.area) {
    Object.defineProperty(PIXI.Polygon.prototype, "area", {
      get: function () {
        return Math.abs(this.signedArea());
      },
      configurable: true,
    });
  }
  cro = game.modules.get(MODULE_ID).cro = new CombatRangeOverlay();
});

/* On ready, finalize initialization of the module: run canvasReady hook, setup terrain, add drag handler, fire initialized hook */
Hooks.on("ready", async function () {
  cro.canvasReadyHook();
  if (
    cro.terrainProvider?.id === "terrainmapper" &&
    !cro.terrainProvider?.usesRegions
  )
    await terrainSetup();
  mouse.addHook(cro.dragHandler.bind(cro));
  cro._initialized();
  Hooks.callAll(`${MODULE_ID}.ready`);
});

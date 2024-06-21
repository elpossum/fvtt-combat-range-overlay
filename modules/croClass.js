import { colorSettingNames } from "./colorPicker.js";
import { MODULE_ID } from "./constants.js";
import { Overlay } from "./overlay.js";

export class CombatRangeOverlay {

  #initialized;

  constructor() {
    this.instance = new Overlay();
    this.showNumericMovementCost = false;
    this.showPathLines = false,
      this.roundNumericMovementCost = true,
      this.actionsToShow = 2,
      this.colorByActions = [],
      this.colors = [],
      this.#initialized = false;
  }

  get initialized() {
    return this.#initialized;
  }

  _initialized() {
    this.#initialized = true;
  }

  registerHooks() {
    this.instance.registerHooks();
  }

  canvasReadyHook() {
    this.instance.canvasReadyHook();
  }

  setActionsToShow() {
    this.actionsToShow = game.settings.get(MODULE_ID, 'actions-shown');
  }

  setColorByActions() {
    for (let i = 0; i < 5; i++) {
      this.colorByActions.push(parseInt(game.settings.get(MODULE_ID, colorSettingNames[i]).slice(0, -2).replace("#", "0x"), 16));
    };
  }

  setColors() {
    for (let i = 5; i < 8; i++) {
      this.colors.push(parseInt(game.settings.get(MODULE_ID, colorSettingNames[i]).slice(0, -2).replace("#", "0x"), 16));
    };
  }

  dragHandler() {
    this.instance.dragHandler();
  }
} // Still need to convert fullRefresh() and settings

/* globals
game,
Hooks,
foundry,
ui
*/

import { colorSettingNames } from "./colorPicker.js";
import { MODULE_ID, SOCKET_TYPES } from "./constants.js";
import { Overlay } from "./overlay.js";
import { getCurrentToken } from "./utility.js";

/**
 * The class that handles the module
 */
export class CombatRangeOverlay {
  /**
   * Whether the module is initialized
   * @type {boolean}
   */
  #initialized;

  constructor() {
    this.instance = new Overlay();
    this.showNumericMovementCost = false;
    this.showPathLines = false;
    this.roundNumericMovementCost = true;
    this.actionsToShow = 2;
    this.colorByActions = [];
    this.colors = [];
    this.#initialized = false;
    this.terrainProvider = null;
    this.regionMap = new Map();
    this.targetVisionMap = new Map();
    this.waitingForDialog = false;
    this.registerHooks();
    this.setActionsToShow();
    this.setColorByActions();
    this.setColors();
    this.setTerrainProvider();
    this.registerSocketListeners();
  }

  /**
   * Whether the module is initialized
   * @type {boolean}
   */
  get initialized() {
    return this.#initialized;
  }

  /**
   * Set the module to initialized
   */
  _initialized() {
    this.#initialized = true;
  }

  /**
   * Register all hooks needed by the module
   */
  registerHooks() {
    this.instance.registerHooks();
  }

  /**
   * The hook to fire on canvas ready
   */
  canvasReadyHook() {
    this.instance.canvasReadyHook();
  }

  /**
   * Set the number of actions to show
   */
  setActionsToShow() {
    this.actionsToShow = game.settings.get(MODULE_ID, "actions-shown");
  }

  /**
   * Set the color for each action
   */
  setColorByActions() {
    for (let i = 0; i < 5; i++) {
      this.colorByActions.push(
        parseInt(
          game.settings
            .get(MODULE_ID, colorSettingNames[i])
            .slice(0, -2)
            .replace("#", "0x"),
          16,
        ),
      );
    }
  }

  /**
   * Set the color for each weapon
   */
  setColors() {
    for (let i = 5; i < 8; i++) {
      this.colors.push(
        parseInt(
          game.settings
            .get(MODULE_ID, colorSettingNames[i])
            .slice(0, -2)
            .replace("#", "0x"),
          16,
        ),
      );
    }
  }

  /**
   * Handle dragging
   */
  dragHandler() {
    this.instance.dragHandler();
  }

  /**
   * Determine which, if any, active modules provide terrain data, their version and their compatibility
   */
  setTerrainProvider() {
    const terrainModules = [
      { id: "enhanced-terrain-layer" },
      { id: "terrainmapper", latestNonRegionVersion: "0.2.0" },
    ];
    const activeModules = [];
    terrainModules.forEach((module) => {
      const moduleData = game.modules.get(module.id);
      if (moduleData?.active) {
        module.version = moduleData.version;
        if (module.latestNonRegionVersion) {
          module.usesRegions = foundry.utils.isNewerVersion(
            module.version,
            module.latestNonRegionVersion,
          );
        }
        activeModules.push(module);
      }
    });
    switch (activeModules.length) {
      case 0: {
        break;
      }
      case 1: {
        if (game.system.id !== "pf2e") this.terrainProvider = activeModules[0];
        break;
      }
      default: {
        Hooks.on("ready", () => {
          ui.notifications.warn(
            game.i18n.localize(`${MODULE_ID}.multiple-terrain-providers`),
          );
        });
        break;
      }
    }
  }

  /**
   * Update the map of regions and their default display properties
   * @param {string} id - The region id
   * @param {{visibility: number, alpha: number, hatchThickness: number}} object - The region's default display properties
   */
  updateRegionMap(id, object) {
    this.regionMap.set(id, object);
  }

  /**
   * Get the default display properties for a region
   * @param {string} id - The region id
   * @returns {{visibility: number, alpha: number, hatchThickness: number}} - The region's default display properties
   */
  getRegionMapData(id) {
    return this.regionMap.get(id);
  }

  /**
   * Set the visibility of all targets
   */
  setTargetVisibility() {
    if (getCurrentToken() && game.user.targets.size)
      game.user.targets.forEach((target) =>
        this.targetVisionMap.set(target.id, {
          new: target.visible,
          old: target.visible,
        }),
      );
    else this.targetVisionMap.clear();
  }

  /**
   * Refresh the visibility of all targets
   */
  refreshTargetVisibility() {
    if (getCurrentToken() && game.user.targets.size)
      game.user.targets.forEach((target) =>
        this.targetVisionMap.set(target.id, {
          new: target.visible,
          old: this.targetVisionMap.get(target.id)?.new,
        }),
      );
    else this.targetVisionMap.clear();
  }

  /**
   * Register socket listeners
   * Currently only used for updating visiibility for user who aren't the one moving the token
   */
  registerSocketListeners() {
    game.socket.on(`module.${MODULE_ID}`, ({ type, payload }) => {
      switch (type) {
        case SOCKET_TYPES.REFRESH_VISIBILITY:
          this.handleVisionRefresh(payload);
          break;
        default:
          break;
      }
    });
  }

  /**
   * Emit a socket event
   * @param {SOCKET_TYPES} type - The socket event to emit
   * @param {*} payload - The payload to be emitted
   * @returns {*} - The response
   */
  emit(type, payload) {
    return game.socket.emit(`module.${MODULE_ID}`, { type, payload });
  }

  /**
   * The socket handler for vision refresh
   * @param {{userId: string, tokenId: string}} payload - The update in visibility
   */
  handleVisionRefresh(payload) {
    if (!this.#initialized) return;
    const refresh =
      game.userId !== payload.userId &&
      game.user.targets.ids.includes(payload.tokenId);
    if (refresh) this.instance.visibilityRefreshHook();
  }

  /**
   * Redraw the overlay
   */
  fullRefresh() {
    this.instance.fullRefresh()
  }
}

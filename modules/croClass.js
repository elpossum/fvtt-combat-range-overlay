import { colorSettingNames } from "./colorPicker.js";
import { MODULE_ID, SOCKET_TYPES } from "./constants.js";
import { Overlay } from "./overlay.js";
import { getCurrentToken } from "./utility.js";

export class CombatRangeOverlay {

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
    this.registerHooks();
    this.setActionsToShow();
    this.setColorByActions();
    this.setColors();
    this.setTerrainProvider();
    this.registerSocketListeners();
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

  setTerrainProvider() {
    const terrainModules = [{id: "enhanced-terrain-layer"}, {id: "terrainmapper", latestNonRegionVersion: "0.2.0"}];
    const activeModules = [];
    terrainModules.forEach((module) => {
      const moduleData = game.modules.get(module.id);
      if (moduleData?.active) {
        module.version = moduleData.version;
        if (module.latestNonRegionVersion) {
          module.usesRegions = foundry.utils.isNewerVersion(module.version, module.latestNonRegionVersion);
        };
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
          ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.multiple-terrain-providers`))
        })
        break;
      }
    } 
  }

  updateRegionMap(id, object) {
    this.regionMap.set(id, object)
  }

  getRegionMapData(id) {
    return this.regionMap.get(id)
  }

  setTargetVisibility() {
    if (getCurrentToken() && game.user.targets.size) game.user.targets.forEach((target) => this.targetVisionMap.set(target.id, {new: target.visible, old: target.visible}));
    else this.targetVisionMap.clear();
  }

  refreshTargetVisibility() {
    if (getCurrentToken() && game.user.targets.size) game.user.targets.forEach((target) => this.targetVisionMap.set(target.id, {new: target.visible, old: this.targetVisionMap.get(target.id)?.new}));
    else this.targetVisionMap.clear();
  }

  registerSocketListeners() {
    game.socket.on(`module.${MODULE_ID}`, ({type, payload}) => {
      switch (type) {
        case SOCKET_TYPES.REFRESH_VISIBILITY:
          this.handleVisionRefresh(payload)
          break;
        default:
          break;
      }
    })
  }

  emit(type, payload) {
    return game.socket.emit(`module.${MODULE_ID}`, {type, payload})
  }

  handleVisionRefresh(payload) {
    const refresh = game.userId !== payload.userId && game.user.targets.ids.includes(payload.tokenId);
    if (refresh) this.instance.visibilityRefreshHook();
  }
} // Still need to convert fullRefresh() and settings

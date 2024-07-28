/* globals
Hooks,
canvas,
CONFIG,
PIXI,
Ray,
CONST,
game,
Token,
MeasuredTemplateDocument,
DrawingDocument,
HexagonalGrid
*/

import {
  calculateGridDistance,
  calculateTokenShape,
  canvasGridSize,
  canvasTokensGet,
  cubeToPoint,
  getCombatantToken,
  getCombatantTokenDisposition,
  getCurrentToken,
  safeDestroy,
  uiNotificationsInfo,
  uiNotificationsWarn,
} from "./utility.js";

import { GridTile } from "./gridTile.js";
import {
  BASE_GRID_SIZE,
  FUDGE,
  highlightLineWidth,
  MAX_DIST,
  MODULE_ID,
  movementCostStyle,
  pathLineColor,
  pathLineWidth,
  potentialTargetLineWidth,
  PRESSED_KEYS,
  SOCKET_TYPES,
  TEXT_MARGIN,
  turnOrderStyle,
  wallLineColor,
  wallLineWidth,
  weaponRangeStyle,
} from "./constants.js";
import { TokenInfo } from "./tokenInfo.js";
import * as Settings from "./settings.js";
import { mouse } from "./mouse.js";
import { debugLog } from "./debug.js";
import { TerrainHelper } from "./terrainHelper.js";
import { cro } from "./main.js";

/**
 * Determine how diagonal distances should be treated
 * @returns {0|0.5|1} - @see {Settings.diagonals}
 */
function getDiagonalDelta() {
  if (
    Settings.getDiagonals() === Settings.diagonals.FIVE_TEN_FIVE ||
    Settings.getDiagonals() === Settings.diagonals.TEN_FIVE_TEN
  ) {
    return 0.5;
  } else if (Settings.getDiagonals() === Settings.diagonals.FIVE) {
    return 0;
  } else if (Settings.getDiagonals() === Settings.diagonals.TEN) {
    return 1;
  } else {
    console.log("Invalid diagonal method", Settings.getDiagonals());
    return 0;
  }
}

/**
 * Determine the distance between two points taking into diagonals
 * @param {number} rawDist - The raw distance between two points
 * @returns {number} - The distance taking into account diagonals
 */
function diagonalDistance(rawDist) {
  if (Settings.getDiagonals() === Settings.diagonals.FIVE_TEN_FIVE) {
    return Math.floor(rawDist + FUDGE);
  } else if (Settings.getDiagonals() === Settings.diagonals.TEN_FIVE_TEN) {
    return Math.ceil(rawDist - FUDGE);
  } else if (
    Settings.getDiagonals() === Settings.diagonals.FIVE ||
    Settings.getDiagonals() === Settings.diagonals.TEN
  ) {
    return Math.round(rawDist);
  } else {
    console.log("Invalid diagonal method", Settings.getDiagonals());
    return Math.round(rawDist);
  }
}

/**
 * The Overlay class
 */
export class Overlay {
  constructor() {
    this.overlays = {};
    this.hookIDs = {};
    this.newTarget = false;
    this.justActivated = false;
    this.DISTANCE_PER_TILE = 0;
    this.drawing = false;
    this.tokenRefreshTracker = 0;
    this.tokenPositionChanged = false;
  }

  /**
   * Use Dijkstra's shortest path algorithm
   * @returns {Promise<Map<string, GridTile>>} - Map of GridTiles, now with costs, and their location keys
   */
  async calculateMovementCosts() {
    // TODO Fix caching
    const tilesPerAction = TokenInfo.current.speed / this.DISTANCE_PER_TILE;
    const maxTiles = tilesPerAction * cro.actionsToShow;

    const currentToken = getCurrentToken();
    const currentTokenInfo = TokenInfo.getById(currentToken.id);
    const tokenTile = GridTile.fromPixels(
      currentTokenInfo.measureFrom.x,
      currentTokenInfo.measureFrom.y,
    );
    tokenTile.distance = 0;

    // Keep a map of grid coordinate -> GridTile
    const tileMap = new Map();
    tileMap.set(tokenTile.key, tokenTile);

    const toVisit = new Set();
    toVisit.add(tokenTile);

    while (toVisit.size > 0) {
      let current = new GridTile(undefined, undefined);

      for (const tile of toVisit) {
        if (tile.distance < current.distance) {
          current = tile;
        }
      }
      if (current.distance === MAX_DIST) {
        // Stop if cheapest tile is unreachable
        break;
      }
      toVisit.delete(current);
      if (current.visited) {
        console.log("BUG: Trying to visit a tile twice");
        continue;
      }
      current.visited = true;

      let neighborGridXYs;
      if (parseInt(game.version) > 11) {
        neighborGridXYs = canvas.grid
          .getAdjacentOffsets({ i: current.gx, j: current.gy })
          .map(({ i, j }) => [i, j]);
      } else {
        neighborGridXYs = canvas.grid.grid.getNeighbors(current.gx, current.gy);
      }
      for (const neighborGridXY of neighborGridXYs) {
        let neighbor = new GridTile(neighborGridXY[0], neighborGridXY[1]);
        if (tileMap.has(neighbor.key)) {
          neighbor = tileMap.get(neighbor.key);
        } else {
          tileMap.set(neighbor.key, neighbor);
        }

        if (neighbor.visited) {
          continue;
        }

        const ray = new Ray(neighbor.centerPt, current.centerPt);
        if (
          checkCollision(ray, {
            type: "move",
            blockMovement: true,
            blockSenses: false,
            mode: "any",
          })
        ) {
          // Blocked, do nothing
        } else {
          let newDistance;
          if (
            cro.terrainProvider?.id === "terrainmapper" &&
            !cro.terrainProvider?.usesRegions
          ) {
            newDistance =
              current.distance +
              GridTile.costTerrainMapper(currentToken, neighbor);
          } else if (
            cro.terrainProvider?.id === "terrainmapper" &&
            cro.terrainProvider?.usesRegions
          ) {
            newDistance =
              current.distance +
              GridTile.costTerrainMapperV2(currentToken, neighbor);
          } else {
            newDistance = current.distance + neighbor.cost;
          }

          let diagonalDelta = getDiagonalDelta();

          if (current.isDiagonal(neighbor)) {
            // diagonals
            newDistance += diagonalDelta;
          }

          if (diagonalDistance(newDistance) > maxTiles) {
            // Do nothing
          } else if (Math.abs(neighbor.distance - newDistance) < FUDGE) {
            neighbor.upstreams.add(current);
          } else if (newDistance < neighbor.distance) {
            neighbor.upstreams = new Set();
            neighbor.upstreams.add(current);
            neighbor.distance = newDistance;
            toVisit.add(neighbor);
          }
        }
      }
    }

    return new Map([...tileMap].filter((kv) => kv[1].distance !== MAX_DIST));
  }

  /**
   * Calculate what tiles are within range of targets
   * @returns {Promise<Map<string, Set<GridTile>>>} - Map of target ids and sets of GridTiles that can reach them
   */
  async calculateTargetRangeMap() {
    const targetMap = new Map();
    const currentWeaponRange = await TokenInfo.current.weaponRangeColor;
    const weaponRangeInTiles = currentWeaponRange.map((i) => ({
      ...i,
      range: i.range / this.DISTANCE_PER_TILE,
    }));

    for (const targetToken of game.user.targets) {
      if (targetToken.visible)
        targetMap.set(
          targetToken.id,
          calculateTilesInRange(weaponRangeInTiles, targetToken),
        );
    }
    return targetMap;
  }

  /**
   * Highlight targets within movement range
   * @param {Map<string, GridTile>} movementCosts - A movement cost map
   */
  async drawPotentialTargets(movementCosts) {
    const currentToken = getCurrentToken();
    const colorByActions = cro.colorByActions;

    if (!currentToken.inCombat) {
      return;
    }

    const tilesMovedPerActionPromise =
      TokenInfo.current.speed / this.DISTANCE_PER_TILE;
    const currentWeaponRangePromise = TokenInfo.current.weaponRangeColor;
    const [tilesMovedPerAction, currentWeaponRange] = await Promise.all([
      tilesMovedPerActionPromise,
      currentWeaponRangePromise,
    ]);

    const weaponRangeInTiles = currentWeaponRange.map((i) => ({
      ...i,
      range: i.range / this.DISTANCE_PER_TILE,
    }));
    const myDisposition = getCombatantTokenDisposition(currentToken);
    debugLog("drawPotentialTargets", "|", "Current disposition", myDisposition);

    for (const combatant of game.combat.combatants) {
      const combatantToken = getCombatantToken(combatant);
      debugLog(
        "drawPotentialTargets",
        "|",
        "Potential target disposition",
        getCombatantTokenDisposition(combatantToken),
        combatantToken.id,
        combatantToken,
      );

      if (getCombatantTokenDisposition(combatantToken) !== myDisposition) {
        if (combatantToken.visible && !combatant.defeated) {
          let tilesInRange = calculateTilesInRange(
            weaponRangeInTiles,
            combatantToken,
          );
          let bestCost = MAX_DIST;

          for (const tileInRange of tilesInRange) {
            const costTile = movementCosts.get(tileInRange.key);
            if (costTile === undefined) {
              continue;
            }
            if (costTile.distance < bestCost) {
              bestCost = costTile.distance;
            }
          }

          const colorIndex = Math.min(
            Math.ceil(diagonalDistance(bestCost) / tilesMovedPerAction),
            colorByActions.length - 1,
          );
          const color = colorByActions[colorIndex];

          const tokenOverlay = new PIXI.Graphics();
          tokenOverlay.lineStyle(potentialTargetLineWidth, color);
          tokenOverlay.drawCircle(
            combatantToken.hitArea.getBounds().width / 2,
            combatantToken.hitArea.getBounds().height / 2,
            Math.pow(
              Math.pow(combatantToken.hitArea.getBounds().width / 2, 2) +
                Math.pow(combatantToken.hitArea.getBounds().height / 2, 2),
              0.5,
            ),
          );
          combatantToken.addChild(tokenOverlay);
          this.overlays.tokenOverlays.push(tokenOverlay);
        }
      }
    }
  }

  /**
   * Draw all overlays
   */
  async drawAll() {
    const movementCostsPromise = this.calculateMovementCosts();
    const targetRangeMapPromise = this.calculateTargetRangeMap();
    const [movementCosts, targetRangeMap] = await Promise.all([
      movementCostsPromise,
      targetRangeMapPromise,
    ]);

    this.initializePersistentVariables();

    this.drawCosts(movementCosts, targetRangeMap);
    const promises = [];

    if (game.user.targets.size === 0) {
      if (Settings.isShowTurnOrder()) {
        this.drawTurnOrder();
      }

      if (Settings.isShowPotentialTargets()) {
        promises.push(this.drawPotentialTargets(movementCosts));
      }
    }

    if (Settings.isShowWeaponRange()) {
      promises.push(this.drawWeaponRange());
    }

    if (Settings.isShowWalls()) {
      this.drawWalls();
    }

    // noinspection JSUnresolvedVariable
    if (Settings.isShowDifficultTerrain()) {
      this.drawDifficultTerrain();
    }
    await Promise.all(promises);
  }

  /**
   * Draw difficult terrain
   */
  drawDifficultTerrain() {
    if (canvas.terrain) {
      switch (cro.terrainProvider?.id) {
        case "enhanced-terrain-layer": {
          canvas.terrain._tokenDrag = true;
          canvas.terrain.refreshVisibility();
          break;
        }
        case "terrainmapper": {
          canvas.drawings.addChild(cro.terrainGraphics);
          break;
        }
        default: {
          break;
        }
      }
    } else if (cro.terrainProvider?.id === "terrainmapper") {
      canvas.regions.placeables.forEach((region) => {
        const behaviors = region.document.behaviors.contents;
        const isTerrain = behaviors.some(
          (behavior) => behavior.type === "terrainmapper.setTerrain",
        );
        const terrainBehaviors = behaviors.filter(
          (behavior) => behavior.type === "terrainmapper.setTerrain",
        );
        const shouldBeVisible =
          region.visible ||
          (terrainBehaviors.some((behavior) => !behavior.disabled) &&
            (game.user.isGM ||
              terrainBehaviors.some((behavior) => !behavior.system.secret)));
        cro.updateRegionMap(region.id, {
          visibility: region.document.visibility,
          alpha: region.alpha,
          hatchThickness: region.children[0].shader.uniforms.hatchThickness,
        });
        if (cro.initialized && isTerrain && shouldBeVisible) {
          region.document.visibility = CONST.REGION_VISIBILITY.ALWAYS;
          region.alpha = 0.5;
          region.children[0].shader.uniforms.hatchThickness = 30;
          region._refreshState();
        }
      });
    }
  }

  /**
   * Drag handler
   */
  async dragHandler() {
    const currentToken = getCurrentToken();
    const visibilitySetting = currentToken?.inCombat
      ? Settings.getICVisibility()
      : Settings.getOOCVisibility();
    if (visibilitySetting !== Settings.overlayVisibility.ALWAYS) {
      cro.fullRefresh();
    }
  }

  /**
   * Fully refresh all overlays
   */
  async fullRefresh() {
    if (!getCurrentToken()?.hitArea) return;
    if (this.drawing) {
      Hooks.once(`${MODULE_ID}.done`, async () => cro.fullRefresh());
      return;
    }
    this.drawing = true;
    this.clearAll();

    if (!Settings.isActive()) {
      return;
    }

    let showOverlay = false;
    const currentToken = getCurrentToken();
    if (currentToken) {
      let hotkeys = false;
      if (PRESSED_KEYS.showOverlay) {
        hotkeys = true;
      }

      let drag = false;
      if (mouse.isLeftDrag()) {
        drag = true;
      }

      const visibilitySetting = currentToken.inCombat
        ? Settings.getICVisibility()
        : Settings.getOOCVisibility();
      switch (visibilitySetting) {
        case Settings.overlayVisibility.ALWAYS:
          showOverlay = true;
          break;
        case Settings.overlayVisibility.ACTIVE_COMBATANT:
          if (currentToken.id === game.combat.current.tokenId) {
            showOverlay = true;
          }
          break;
        case Settings.overlayVisibility.BOTH:
          if (hotkeys || drag) {
            showOverlay = true;
          }
          break;
        case Settings.overlayVisibility.HOTKEYS:
          if (hotkeys) {
            showOverlay = true;
          }
          break;
        case Settings.overlayVisibility.DRAG:
          if (drag) {
            showOverlay = true;
          }
          break;
        default:
          showOverlay = false;
          break;
      }
    }

    if (showOverlay) {
      await this.drawAll();
    } else if (this.justActivated) {
      uiNotificationsInfo(
        game.i18n.localize(`${MODULE_ID}.activated-not-visible`),
      );
    }
    this.justActivated = false;
    this.drawing = false;
    Hooks.callAll(`${MODULE_ID}.done`);
  }

  // partialRefresh() {
  //   cro.fullRefresh();  // TODO Make this more efficient
  // }

  /* Can't remember if this is important but it seems to cause issues so I have disabled it.
  async renderApplicationHook() {
    if (cro?.initialized)  cro.fullRefresh();
  } */

  /**
   * Update overlays on target change
   */
  async targetTokenHook() {
    this.newTarget = true;
    cro.setTargetVisibility();
    cro.fullRefresh();
  }

  /**
   * Initialize overlay when the canvas is ready
   */
  canvasReadyHook() {
    this.terrainRegionsInit();
    TerrainHelper?.sceneUpdate();
    this.clearAll();
    TokenInfo.resetMap();
    this.DISTANCE_PER_TILE = game.scenes.viewed.grid.distance;
  }

  /**
   * Update overlay when the scene is updated
   */
  sceneUpdateHook() {
    this.canvasReadyHook();
    const token = getCurrentToken();
    if (token) {
      token.release();
      Hooks.once("refreshToken", () => {
        canvas.tokens.get(token.id).control();
      });
    }
  }

  /**
   * Update overlay when regions are updated
   */
  async regionUpdateHook() {
    canvas.regions.placeables.forEach((region) => {
      if (
        region.document.behaviors.contents.some(
          (behavior) => behavior.type === "terrainmapper.setTerrain",
        )
      ) {
        cro.updateRegionMap(region.id, {
          visibility: region.document.visibility,
          alpha: region.alpha,
          hatchThickness: region.children[0].shader.uniforms.hatchThickness,
        });
      } else cro.regionMap.delete(region.id);
    });
    cro.fullRefresh();
  }

  /**
   * Update overlays when walls are updated
   */
  async updateWallHook() {
    cro.fullRefresh();
  }

  /**
   * Initialize terrain data
   */
  terrainRegionsInit() {
    if (canvas.regions) {
      cro.regionMap.clear();
      canvas.regions.placeables.forEach((region) => {
        if (
          region.document.behaviors.contents.some(
            (behavior) => behavior.type === "terrainmapper.setTerrain",
          )
        ) {
          cro.updateRegionMap(region.id, {
            visibility: region.document.visibility,
            alpha: region.alpha,
            hatchThickness: region.children[0].shader.uniforms.hatchThickness,
          });
        }
      });
    }
  }

  /**
   * Update overlays if Enhanced Terrain Layer templates or drawings are updated
   * @param {MeasuredTemplateDocument|DrawingDocument} placeableDocument - The document being updated
   */
  async updateETLHook(placeableDocument) {
    if (
      placeableDocument.flags &&
      placeableDocument.flags["enhanced-terrain-layer"]
    )
      cro.fullRefresh();
  }

  /**
   * Update overlay when visibility changes
   */
  async visibilityRefreshHook() {
    cro.emit(SOCKET_TYPES.REFRESH_VISIBILITY, {
      userId: game.userId,
      tokenId: getCurrentToken()?.id,
    });
    cro.refreshTargetVisibility();
    const targets = game.user.targets;
    const refresh = targets.some(
      (target) =>
        cro.targetVisionMap.get(target.id)?.new !==
        cro.targetVisionMap.get(target.id)?.old,
    );
    if (refresh) {
      cro.setTargetVisibility();
      cro.fullRefresh();
    } else if (
      Settings.getVisionMaskType() !== Settings.visionMaskingTypes.NONE &&
      this.tokenRefreshTracker === 0 &&
      this.tokenPositionChanged &&
      parseInt(game.version) !== 11
    ) {
      parseInt(game.version) > 11
        ? this.refreshTokenHookv12()
        : this.refreshTokenHookv11();
    }
  }

  /**
   * Handle Foundry v11 vision updates
   */
  refreshTokenHookv11() {
    if (
      Settings.getVisionMaskType() !== Settings.visionMaskingTypes.NONE &&
      this.tokenPositionChanged
    ) {
      this.tokenPositionChanged = false;
      const hookId = Hooks.on("refreshToken", (token) => {
        this.clearAll();
        if (!token._animation) {
          Hooks.off("refreshToken", hookId);
          Hooks.once("sightRefresh", async () => cro.fullRefresh());
        }
      });
    }
  }

  /**
   * Handle Foundry v12 vision updates
   */
  refreshTokenHookv12() {
    this.tokenPositionChanged = false;
    const hookId = Hooks.on("refreshToken", async (_token, opts) => {
      this.clearAll();
      !opts.refreshPosition
        ? this.tokenRefreshTracker++
        : (this.tokenRefreshTracker = 0);
      if (this.tokenRefreshTracker === canvas.tokens.placeables.length) {
        this.tokenRefreshTracker = 0;
        Hooks.off("refreshToken", hookId);
        cro.fullRefresh();
      }
    });
  }

  terrainUpdateHook() {
    if (
      cro.initialized &&
      cro.terrainProvider?.id === "terrainmapper" &&
      !cro.terrainProvider.usesRegions
    )
      TerrainHelper.sceneUpdate();
  }

  /**
   * Register hooks
   */
  registerHooks() {
    /* this.hookIDs.renderApplication = Hooks.on("renderApplication", async (application) => {
      if (!['croQuickSettingsDialog', 'token-hud', 'navigation', 'controls'].includes(application.id)) await this.renderApplicationHook()
    }); */
    this.hookIDs.targetToken = Hooks.on(
      "targetToken",
      async () => await this.targetTokenHook(),
    );
    this.hookIDs.canvasReady = Hooks.on("canvasReady", () =>
      this.canvasReadyHook(),
    );
    this.hookIDs.sceneUpdate = Hooks.on("updateScene", () =>
      this.sceneUpdateHook(),
    );
    this.hookIDs.activateTokenLayer = Hooks.on(
      "activateTokenLayer",
      () => (this.tokenLayerJustActivated = true),
    );
    this.hookIDs.updateWall = Hooks.on(
      "updateWall",
      async () => await this.updateWallHook(),
    );
    this.hookIDs.terrainUpdate = Hooks.on("deactivateTerrainLayer", () =>
      this.terrainUpdateHook(),
    );
    this.hookIDs.createRegion = Hooks.on(
      "createRegion",
      async () => await this.regionUpdateHook(),
    );
    this.hookIDs.refreshRegion = Hooks.on(
      "refreshRegion",
      async () => await this.regionUpdateHook(),
    );
    this.hookIDs.deleteRegion = Hooks.on(
      "deleteRegion",
      async () => await this.regionUpdateHook(),
    );
    this.hookIDs.updateRegionBehaviour = Hooks.on(
      "updateRegionBehavior",
      async () => await this.regionUpdateHook(),
    );
    this.hookIDs.createDrawing = Hooks.on(
      "createDrawing",
      async (drawing) => await this.updateETLHook(drawing),
    );
    this.hookIDs.refreshDrawing = Hooks.on(
      "refreshDrawing",
      async (drawing) => await this.updateETLHook(drawing),
    );
    this.hookIDs.deleteDrawing = Hooks.on(
      "deleteDrawing",
      async (drawing) => await this.updateETLHook(drawing),
    );
    this.hookIDs.createMeasuredTemplate = Hooks.on(
      "createMeasuredTemplate",
      async (template) => await this.updateETLHook(template),
    );
    this.hookIDs.refreshMeasuredTemplate = Hooks.on(
      "refreshMeasuredTemplate",
      async (template) => await this.updateETLHook(template),
    );
    this.hookIDs.deleteMeasuredTemplate = Hooks.on(
      "deleteMeasuredTemplate",
      async (template) => await this.updateETLHook(template),
    );
    this.hookIDs.sightRefresh = Hooks.on(
      "sightRefresh",
      async () => await this.visibilityRefreshHook(),
    );
    if (parseInt(game.version) < 12)
      this.hookIDs.initializeVisionSources = Hooks.on(
        "initializeVisionSources",
        () => this.refreshTokenHookv11(),
      );
    this.hookIDs.deleteCombat = Hooks.on("deleteCombat", async () =>
      cro.fullRefresh(),
    );
  }

  /**
   * Unregister a hook
   * @param {string} type - The type of hooks to unregister
   */
  unregisterHook(type) {
    Hooks.off(type, this.hookIDs[type]);
    this.hookIDs[type] = undefined;
  }

  /**
   * Unregister all hooks
   */
  unregisterAllHooks() {
    Object.keys(this.hookIDs).forEach((type) => this.unregisterHook(type));
  }

  /**
   * Clear all overlays and reset persistent variables
   */
  clearAll() {
    this.overlays.distanceTexts?.forEach((t) => {
      safeDestroy(t);
    });
    this.overlays.turnOrderTexts?.forEach((t) => {
      safeDestroy(t);
    });
    this.overlays.tokenOverlays?.forEach((o) => {
      safeDestroy(o);
    });
    safeDestroy(this.overlays.distanceOverlay);
    safeDestroy(this.overlays.pathOverlay);
    safeDestroy(this.overlays.potentialTargetOverlay);
    safeDestroy(this.overlays.wallsOverlay);

    this.overlays.distanceTexts = [];
    this.overlays.tokenOverlays = [];
    this.overlays.distanceOverlay = undefined;
    this.overlays.pathOverlay = undefined;
    this.overlays.turnOrderTexts = [];
    this.overlays.potentialTargetOverlay = undefined;
    this.overlays.wallsOverlay = undefined;

    if (Settings.isShowDifficultTerrain()) {
      this.clearDifficultTerrain();
    }
  }

  /**
   * Clear difficult terrain overlay
   */
  clearDifficultTerrain() {
    if (canvas.terrain) {
      switch (cro.terrainProvider?.id) {
        case "enhanced-terrain-layer": {
          canvas.terrain._tokenDrag = false;
          canvas.terrain.refreshVisibility();
          break;
        }
        case "terrainmapper": {
          canvas.drawings.removeChild(cro.terrainGraphics);
          break;
        }
        default: {
          break;
        }
      }
    } else if (cro.terrainProvider?.id === "terrainmapper" && cro.initialized) {
      canvas.regions.placeables.forEach((region) => {
        const isTerrain = region.document.behaviors.contents.some(
          (behavior) => behavior.type === "terrainmapper.setTerrain",
        );
        const regionDefault = cro.getRegionMapData(region.id);
        if (isTerrain) {
          region.document.visibility = regionDefault.visibility;
          region.alpha = regionDefault.alpha;
          region.children[0].shader.uniforms.hatchThickness =
            regionDefault.hatchThickness;
          region._refreshState();
        }
      });
    }
  }

  /**
   * Initialize persistent variables
   */
  initializePersistentVariables() {
    this.overlays.distanceTexts = [];
    this.overlays.turnOrderTexts = [];
    this.overlays.tokenOverlays = [];

    this.overlays.distanceOverlay = new PIXI.Graphics();
    this.overlays.pathOverlay = new PIXI.Graphics();
    this.overlays.potentialTargetOverlay = new PIXI.Graphics();
    this.overlays.wallsOverlay = new PIXI.Graphics();
  }

  /**
   * Draw weapon ranges on token
   */
  async drawWeaponRange() {
    debugLog("drawWeaponRange");
    const currentToken = getCurrentToken();
    if (!currentToken.inCombat) {
      return;
    }

    const range = [];
    const currentWeaponRange = await TokenInfo.current.weaponRangeColor;
    currentWeaponRange.forEach((i) => {
      if (!range.includes(i.range)) {
        range.push(i.range);
      }
    });

    const style = Object.assign({}, weaponRangeStyle);
    style.fontSize = style.fontSize * (canvasGridSize() / BASE_GRID_SIZE);

    const text = new PIXI.Text(`» ${range}`, style);
    text.position.x =
      currentToken.hitArea.getBounds().width - text.width - TEXT_MARGIN;
    text.position.y =
      currentToken.hitArea.getBounds().height - text.height - TEXT_MARGIN;
    currentToken.addChild(text);
    this.overlays.turnOrderTexts.push(text);
  }

  /**
   * Draw turn order
   */
  drawTurnOrder() {
    const style = Object.assign({}, turnOrderStyle);
    style.fontSize = style.fontSize * (canvasGridSize() / BASE_GRID_SIZE);

    const currentTokenId = getCurrentToken().id;
    for (const combat of game.combats) {
      const currentCombatant = combat.combatants.find(
        (c) => c.token.id === currentTokenId,
      );
      if (!currentCombatant) {
        continue;
      }

      const sortedCombatants = combat.setupTurns();
      let seenCurrent = false;

      const head = [];
      const tail = [];

      for (const combatant of sortedCombatants) {
        const combatantTokenId = combatant.token.id;
        if (!seenCurrent && combatantTokenId === currentTokenId) {
          seenCurrent = true;
        }

        if (!seenCurrent) {
          tail.push(combatant);
        } else {
          head.push(combatant);
        }
      }

      let turnOrder = 0;
      for (const combatant of head.concat(tail)) {
        if (!combatant.defeated) {
          const combatantTokenId = combatant.token.id;
          const combatantToken = canvasTokensGet(combatantTokenId);

          if (turnOrder > 0 && combatantToken.visible) {
            const text = new PIXI.Text(turnOrder, style);
            text.position.x =
              combatantToken.hitArea.getBounds().width -
              text.width -
              TEXT_MARGIN;
            text.position.y =
              combatantToken.hitArea.getBounds().height -
              text.height -
              TEXT_MARGIN;
            combatantToken.addChild(text);
            this.overlays.turnOrderTexts.push(text);
          }
          turnOrder++;
        }
      }
    }
  }

  /**
   * Draw the main overlay showing movement range
   * @param {Map<string, GridTile>} movementCostMap - A map of reachable tiles
   * @param {Map<string, Set<GridTile>>} targetRangeMap - A map of tiles that can reach the targets
   */
  drawCosts(movementCostMap, targetRangeMap) {
    const los = getCurrentToken().vision?.los?.clone();
    if (
      Settings.getVisionMaskType() === Settings.visionMaskingTypes.MASK &&
      los
    ) {
      const losGraphics = new PIXI.Graphics();
      losGraphics.beginFill();
      losGraphics.drawPolygon(los);
      losGraphics.endFill();
      this.overlays.distanceOverlay.addChild(losGraphics);
      this.overlays.distanceOverlay.mask = losGraphics;
    }
    const rangeMap = buildRangeMap(targetRangeMap);
    const idealTileMap = calculateIdealTileMap(
      movementCostMap,
      targetRangeMap,
      rangeMap,
    );
    const colorByActions = cro.colorByActions;
    let showOnlyTargetPath = targetRangeMap.size > 0;
    if (showOnlyTargetPath && idealTileMap.size === 0) {
      if (this.newTarget) {
        this.newTarget = false;
        uiNotificationsWarn(game.i18n.localize(`${MODULE_ID}.no-good-tiles`));
        showOnlyTargetPath = false;
      }
    }

    const tilesMovedPerAction =
      TokenInfo.current.speed / this.DISTANCE_PER_TILE;
    this.overlays.distanceTexts = [];
    this.overlays.pathOverlay.lineStyle(pathLineWidth, pathLineColor);

    for (const tile of movementCostMap.values()) {
      let drawTile = false;
      if (!showOnlyTargetPath || idealTileMap.has(tile.key)) {
        drawTile = true;
      } else {
        for (const idealTile of idealTileMap.values()) {
          if (tile.upstreamOf(idealTile.tile)) {
            drawTile = true;
            break;
          }
        }
      }
      if (drawTile) {
        /* Currently unimplemented */
        if (cro.showNumericMovementCost) {
          const style = Object.assign({}, movementCostStyle);
          style.fontSize = style.fontSize * (canvasGridSize() / BASE_GRID_SIZE);

          const label = cro.roundNumericMovementCost
            ? diagonalDistance(tile.distance)
            : tile.distance;
          const text = new PIXI.Text(label, style);
          const pt = tile.pt;
          text.position.x = pt.x;
          text.position.y = pt.y;
          this.overlays.distanceTexts.push(text);
        }

        if (cro.showPathLines) {
          let tileCenter = tile.centerPt;
          if (tile.upstreams !== undefined) {
            for (const upstream of tile.upstreams) {
              let upstreamCenter = upstream.centerPt;
              this.overlays.pathOverlay.moveTo(tileCenter.x, tileCenter.y);
              this.overlays.pathOverlay.lineTo(
                upstreamCenter.x,
                upstreamCenter.y,
              );
            }
          }
        }

        // Color tile based on number of actions to reach it
        const colorIndex =
          tile.distance && tile.distance < 1
            ? 1
            : Math.min(
                Math.ceil(
                  diagonalDistance(tile.distance) / tilesMovedPerAction,
                ),
                colorByActions.length - 1,
              );
        const color = colorByActions[colorIndex];
        if (idealTileMap.has(tile.key)) {
          this.overlays.distanceOverlay.lineStyle(
            highlightLineWidth,
            idealTileMap.get(tile.key).color,
          );
        } else {
          this.overlays.distanceOverlay.lineStyle(0, 0);
        }
        const poly = new PIXI.Polygon(tile.vertices);
        const intersect = los?.intersectPolygon(poly);
        if (
          intersect?.area / poly.area >= Settings.getVisionMaskPercent() ||
          Settings.getVisionMaskType() !==
            Settings.visionMaskingTypes.INDIVIDUAL ||
          !los
        ) {
          this.overlays.distanceOverlay.beginFill(
            color,
            Settings.getMovementAlpha(),
          );
          this.overlays.distanceOverlay.drawPolygon(poly);
          this.overlays.distanceOverlay.endFill();
        }
      }
    }

    canvas.drawings.addChild(this.overlays.distanceOverlay);
    canvas.drawings.addChild(this.overlays.pathOverlay);

    for (const text of this.overlays.distanceTexts) {
      canvas.drawings.addChild(text);
    }
  }

  /**
   * Draw wall overlay
   */
  drawWalls() {
    this.overlays.wallsOverlay.lineStyle(wallLineWidth, wallLineColor);
    for (const obj of canvas.walls.quadtree.objects) {
      const wall = obj.t;
      if (wall.document.door || !wall.document.move) {
        continue;
      }
      const c = wall.document.c;
      this.overlays.wallsOverlay.moveTo(c[0], c[1]);
      this.overlays.wallsOverlay.lineTo(c[2], c[3]);
    }
    canvas.drawings.addChild(this.overlays.wallsOverlay);
  }
}

/**
 * Calculate how many targets can be reached from each tile in a map
 * @param {Map<string, Set<GridTile>>} targetMap - A map of tiles that can reach targets
 * @returns {Map<string, {count: number, color: number}>} - A map of tiles, their color, and how many targets can be reached from them
 */
function buildRangeMap(targetMap) {
  const rangeMap = new Map();
  for (const tileSet of targetMap.values()) {
    for (const tile of tileSet) {
      const tileKey = tile.key;
      let count = rangeMap.get(tileKey)?.count ?? 0;
      count++;
      rangeMap.set(tileKey, { count: count, color: tile.color });
    }
  }
  return rangeMap;
}

/**
 * Calculate all tiles within movement range and can reach all targets
 * @param {Map<string, GridTile>} movementTileMap - All tiles in movement range
 * @param {Map<string, Set<GridTile>>} targetMap - All tiles in range of a target
 * @param {Map<string, {count: number, color: number}>} rangeMap - How many targets a tile can reach and their color
 * @returns {Map<string, {tile: GridTile, color: number}>} - All tiles that are in range of all targets and within movement range and their colors
 */
function calculateIdealTileMap(movementTileMap, targetMap, rangeMap) {
  const idealTileMap = new Map();
  for (const tile of movementTileMap.values()) {
    if (rangeMap.get(tile.key)) {
      if (rangeMap.get(tile.key).count === targetMap.size) {
        // Every target is reachable from here
        idealTileMap.set(tile.key, {
          tile: tile,
          color: rangeMap.get(tile.key).color,
        });
      }
    }
  }
  return idealTileMap;
}

/**
 * @typedef {object} Weapon
 * @property {number} range - Weapon's range
 * @property {number} color - The color for the weapon
 * @property {string} [weapon] - The weapon's id
 */
/**
 * Calculate tiles in range of a specific target
 * @param {Array<Weapon>} rangeInTiles - An array of weapons, their ranges and their colors
 * @param {Token} targetToken - The target token
 * @returns {Set<GridTile>} - A set of tiles that can a specific target is in range from
 */
function calculateTilesInRange(rangeInTiles, targetToken) {
  const square =
    parseInt(game.version) > 11 ? !canvas.grid.isHexagonal : !canvas.grid.isHex;
  const tileSet = square
    ? calculateTilesInRangeSquare(rangeInTiles, targetToken)
    : calculateTilesInRangeHex(rangeInTiles, targetToken);
  return tileSet;
}

/**
 * Calculate tiles in range of a specific target for square tiles
 * @param {Array<Weapon>} rangeInTiles - An array of weapons, their ranges and their colors
 * @param {Token} targetToken - The target token
 * @returns {Set<GridTile>} - A set of tiles that can a specific target is in range from
 */
function calculateTilesInRangeSquare(rangeInTiles, targetToken) {
  const tokenInfo = TokenInfo.getById(targetToken.id);
  const targetTile = GridTile.fromPixels(
    tokenInfo.location.x,
    tokenInfo.location.y,
  );
  const tileSet = new Set();
  const targetGridX = targetTile.gx;
  const targetGridY = targetTile.gy;
  const targetGridHeight = Math.floor(
    targetToken.hitArea.height / canvasGridSize(),
  );
  const targetGridWidth = Math.floor(
    targetToken.hitArea.width / canvasGridSize(),
  );

  for (const rangeInTilesElement of rangeInTiles) {
    const weaponColor = rangeInTilesElement.color;
    // Loop over X and Y deltas, computing distance for only a single quadrant
    for (
      let gridXDelta = 0;
      gridXDelta <= rangeInTilesElement.range;
      gridXDelta++
    ) {
      for (
        let gridYDelta = 0;
        gridYDelta <= rangeInTilesElement.range;
        gridYDelta++
      ) {
        if (gridXDelta === 0 && gridYDelta === 0) {
          continue;
        }

        const shotDistance = calculateGridDistance(
          { x: 0, y: 0 },
          { x: gridXDelta, y: gridYDelta },
        );
        if (shotDistance < rangeInTilesElement.range + FUDGE) {
          // We're within range
          // We need to test visibility for all 4 quadrants
          // Use sets so we don't have to explicitly test for "on the same row/column as"
          const gridXSet = new Set();
          const gridYSet = new Set();
          gridXSet.add(targetGridX + gridXDelta + targetGridWidth - 1);
          gridXSet.add(targetGridX - gridXDelta);
          gridYSet.add(targetGridY + gridYDelta + targetGridHeight - 1);
          gridYSet.add(targetGridY - gridYDelta);
          for (const testGridX of gridXSet) {
            for (const testGridY of gridYSet) {
              const testTile = new GridTile(testGridX, testGridY, weaponColor);
              let isDupe = false;
              for (const entry of tileSet) {
                if (entry.key === testTile.key) {
                  isDupe = true;
                  break;
                }
              }

              let clearShot = checkTileToTokenVisibility(testTile, targetToken);
              if (clearShot && !isDupe) {
                tileSet.add(testTile);
              }
            }
          }
        }
      }
    }
  }
  return tileSet;
}

/**
 * Calculate tiles in range of a specific target for hex tiles
 * @param {Array<Weapon>} rangeInTiles - An array of weapons, their ranges and their colors
 * @param {Token} targetToken - The target token
 * @returns {Set<GridTile>} - A set of tiles that can a specific target is in range from
 */
function calculateTilesInRangeHex(rangeInTiles, targetToken) {
  const tokenInfo = TokenInfo.getById(targetToken.id);
  const targetTile = GridTile.fromPixels(
    tokenInfo.location.x,
    tokenInfo.location.y,
  );
  const grid = parseInt(game.version) > 11 ? canvas.grid : canvas.grid.grid;
  const tileSet = new Set();
  let targetTileCube;
  switch (parseInt(game.version)) {
    case 12:
      targetTileCube = grid.offsetToCube({
        i: targetTile.gx,
        j: targetTile.gy,
      });
      break;
    case 11:
      targetTileCube = HexagonalGrid.offsetToCube(
        { row: targetTile.gx, col: targetTile.gy },
        { columns: grid.columnar, even: grid.even },
      );
      break;
    case 10:
      targetTileCube = grid.offsetToCube({
        row: targetTile.gx,
        col: targetTile.gy,
      });
      break;
  }
  const targetGridHeight = Math.floor(
    targetToken.hitArea.getBounds().height / canvasGridSize(),
  );
  const targetGridWidth = Math.floor(
    targetToken.hitArea.getBounds().width / canvasGridSize(),
  );
  const targetTiles = new Set();

  // Find tiles that the target occupies
  for (
    let gridQDelta = -targetGridWidth;
    gridQDelta <= targetGridWidth;
    gridQDelta++
  ) {
    for (
      let gridRDelta = Math.max(
        -targetGridHeight,
        -gridQDelta - targetGridHeight,
      );
      gridRDelta <= Math.min(targetGridHeight, -gridQDelta + targetGridHeight);
      gridRDelta++
    ) {
      const testTile = {
        q: targetTileCube.q + gridQDelta,
        r: targetTileCube.r + gridRDelta,
      };
      const testTilePoint = grid.cubeToPoint
        ? grid.cubeToPoint(testTile)
        : cubeToPoint(testTile);
      const hitArea =
        parseInt(game.version) > 11
          ? targetToken.hitArea
          : calculateTokenShape(targetToken);
      const points = [];
      // Translate to target's postion
      if (hitArea.points) {
        // Hit area is a polygon
        hitArea.points.forEach((point, index) => {
          if (index % 2 === 0) points.push(point + targetToken.x);
          else points.push(point + targetToken.y);
        });
      } else {
        // Hit area is a rectangle
        const rectPoints = [
          hitArea.x,
          hitArea.y,
          hitArea.x + hitArea.width + FUDGE,
          hitArea.y,
          hitArea.x + hitArea.width + FUDGE,
          hitArea.y + hitArea.height + FUDGE,
          hitArea.x,
          hitArea.y + hitArea.height + FUDGE,
        ];
        rectPoints.forEach((point, index) => {
          if (index % 2 === 0) points.push(point + targetToken.x);
          else points.push(point + targetToken.y);
        });
      }
      const testArea = new PIXI.Polygon(points);
      if (testArea.contains(testTilePoint.x, testTilePoint.y))
        targetTiles.add(testTile);
    }
  }

  for (const rangeInTilesElement of rangeInTiles) {
    const weaponColor = rangeInTilesElement.color;
    // Loop over Q and R deltas, computing distance for only a single quadrant
    for (const targetTile of targetTiles) {
      const targetGridQ = targetTile.q;
      const targetGridR = targetTile.r;
      for (
        let gridQDelta = -rangeInTilesElement.range;
        gridQDelta <= rangeInTilesElement.range;
        gridQDelta++
      ) {
        for (
          let gridRDelta = Math.max(
            -rangeInTilesElement.range,
            -gridQDelta - rangeInTilesElement.range,
          );
          gridRDelta <=
          Math.min(
            rangeInTilesElement.range,
            -gridQDelta + rangeInTilesElement.range,
          );
          gridRDelta++
        ) {
          if (gridQDelta === 0 && gridRDelta === 0) {
            continue;
          }

          const testGridQ = targetGridQ + gridQDelta;
          const testGridR = targetGridR + gridRDelta;
          let offset;
          switch (parseInt(game.version)) {
            case 12:
              offset = grid.cubeToOffset({ q: testGridQ, r: testGridR });
              break;
            case 11:
              offset = HexagonalGrid.cubeToOffset(
                { q: testGridQ, r: testGridR },
                { columns: grid.columnar, even: grid.even },
              );
              break;
            case 10:
              offset = grid.cubeToOffset({ q: testGridQ, r: testGridR });
          }
          const testTile =
            parseInt(game.version) > 11
              ? new GridTile(offset.i, offset.j, weaponColor)
              : new GridTile(offset.row, offset.col, weaponColor);
          let testTileCube;
          switch (parseInt(game.version)) {
            case 12:
              testTileCube = grid.offsetToCube({
                i: testTile.gx,
                j: testTile.gy,
              });
              break;
            case 11:
              testTileCube = HexagonalGrid.offsetToCube(
                { row: testTile.gx, col: testTile.gy },
                { columns: grid.columnar, even: grid.even },
              );
              break;
            case 10:
              testTileCube = grid.offsetToCube({
                row: testTile.gx,
                col: testTile.gy,
              });
              break;
          }

          // Don't include tiles the target occupies
          let isTargetTile = false;
          targetTiles.forEach((tile) => {
            if (tile.q === testTileCube.q && tile.r === testTileCube.r)
              isTargetTile = true;
          });
          if (isTargetTile) {
            continue;
          }

          // Don't include tiles that are already added by another weapon
          let isDupe = false;
          for (const entry of tileSet) {
            if (entry.key === testTile.key) {
              isDupe = true;
              break;
            }
          }

          let clearShot = checkTileToTokenVisibility(testTile, targetToken);
          if (clearShot && !isDupe) {
            tileSet.add(testTile);
          }
        }
      }
    }
  }
  return tileSet;
}

/**
 * Checks if a line collides with any obstacles
 * @param {Ray} ray - The ray to be checked
 * @param {object} opts - Options for the test
 * @returns {boolean} - Returns true if there is a collision
 */
function checkCollision(ray, opts) {
  if (parseInt(game.version) < 11) {
    return canvas.walls.checkCollision(ray, opts);
  } else {
    return CONFIG.Canvas.polygonBackends[opts.type].testCollision(
      ray.A,
      ray.B,
      opts,
    );
  }
}

// Copied straight from foundry.js (_sortCombatants)
/*
function combatantComparator(a, b) {
    const ia = Number.isNumeric(a.initiative) ? a.initiative : -9999;
    const ib = Number.isNumeric(b.initiative) ? b.initiative : -9999;
    let ci = ib - ia;
    if ( ci !== 0 ) return ci;
    let [an, bn] = [a.token?.name || "", b.token?.name || ""];
    let cn = an.localeCompare(bn);
    if ( cn !== 0 ) return cn;
    return a.tokenId - b.tokenId;
}*/

/**
 * Check if a token is visible from a tile
 * @param {GridTile|{centerPt: {x: number, y: number}}} tile - The source tile
 * @param {Token} token - The token to be checked
 * @returns {boolean} - Returns true if the token is visible
 */
export function checkTileToTokenVisibility(tile, token) {
  const t = Math.min(token.h, token.w) / 4;
  const offsets =
    t > 0
      ? [
          [0, 0],
          [-t, 0],
          [t, 0],
          [0, -t],
          [0, t],
          [-t, -t],
          [-t, t],
          [t, t],
          [t, -t],
        ]
      : [[0, 0]];
  const points = offsets.map(
    (o) => new PIXI.Point(token.center.x + o[0], token.center.y + o[1]),
  );
  const tileCenterPt = tile.centerPt;

  for (const point of points) {
    const ray = new Ray(tileCenterPt, point);
    if (!checkCollision(ray, { type: "sight", mode: "any" })) {
      return true;
    }
  }

  return false;
}

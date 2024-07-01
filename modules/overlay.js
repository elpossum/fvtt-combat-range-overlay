import {
  calculateGridDistance,
  canvasGridSize, canvasTokensGet,
  getCombatantToken,
  getCombatantTokenDisposition,
  getCurrentToken,
  safeDestroy, uiNotificationsInfo, uiNotificationsWarn
} from "./utility.js"

import { GridTile } from "./gridTile.js";
import { FUDGE, MAX_DIST, MODULE_ID, PRESSED_KEYS, SOCKET_TYPES } from "./constants.js"
import { TokenInfo } from "./tokenInfo.js";
import * as Settings from "./settings.js";
import { mouse } from "./mouse.js";
import { debugLog } from "./debug.js";
import { TerrainHelper } from "./terrainHelper.js";

// Colors
const pathLineColor = 0x0000ff; // blue
const wallLineColor = 0x40e0d0; // turquoise

// Line widths
const wallLineWidth = 3;
const pathLineWidth = 1;
const highlightLineWidth = 3;
const potentialTargetLineWidth = 3;

const TEXT_MARGIN = 2;

const BASE_GRID_SIZE = 70; // For scaling fonts

// Fonts
const movementCostStyle = {
  fontFamily: 'Arial',
  fontSize: 30,
  fill: 0x0000ff, // blue
  stroke: 0xffffff, // white
  strokeThickness: 1
};

const turnOrderStyle = {
  fontFamily: 'Arial',
  fontSize: 25,
  fill: 0xffffff, // white
  stroke: 0x000000, // black
  strokeThickness: 5
};

const weaponRangeStyle = {
  fontFamily: 'Arial',
  fontSize: 20,
  fill: 0xffffff, // white
  stroke: 0x000000, // black
  strokeThickness: 4
};

function getDiagonalDelta() {
  if (Settings.getDiagonals() === Settings.diagonals.FIVE_TEN_FIVE || Settings.getDiagonals() === Settings.diagonals.TEN_FIVE_TEN) {
    return .5;
  } else if (Settings.getDiagonals() === Settings.diagonals.FIVE) {
    return 0;
  } else if (Settings.getDiagonals() === Settings.diagonals.TEN) {
    return 1;
  } else {
    console.log("Invalid diagonal method", Settings.getDiagonals())
    return 0;
  }
}

function diagonalDistance(rawDist) {
  if (Settings.getDiagonals() === Settings.diagonals.FIVE_TEN_FIVE) {
    return Math.floor(rawDist + FUDGE);
  } else if (Settings.getDiagonals() === Settings.diagonals.TEN_FIVE_TEN) {
    return Math.ceil(rawDist - FUDGE);
  } else if (Settings.getDiagonals() === Settings.diagonals.FIVE || Settings.getDiagonals() === Settings.diagonals.TEN) {
    return Math.round(rawDist);
  } else {
    console.log("Invalid diagonal method", Settings.getDiagonals())
    return Math.round(rawDist);
  }
}

export class Overlay {
  constructor() {
    this.overlays = {};
    this.hookIDs = {};
    this.newTarget = false;
    this.justActivated = false;
    this.DISTANCE_PER_TILE = 0;
    this.drawing = false;
  }

  // Use Dijkstra's shortest path algorithm
  async calculateMovementCosts() {
    // TODO Fix caching
    const tilesPerAction = await TokenInfo.current.speed / this.DISTANCE_PER_TILE;
    const maxTiles = tilesPerAction * globalThis.combatRangeOverlay.actionsToShow;

    const currentToken = getCurrentToken();
    const currentTokenInfo = TokenInfo.getById(currentToken.id);
    const tokenTile = GridTile.fromPixels(currentTokenInfo.measureFrom.x, currentTokenInfo.measureFrom.y);
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
      if (current.distance === MAX_DIST) { // Stop if cheapest tile is unreachable
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
        neighborGridXYs = canvas.grid.getAdjacentOffsets({ i: current.gx, j: current.gy }).map(({ i, j }) => [i, j])
      } else {
        neighborGridXYs = canvas.grid.grid.getNeighbors(current.gx, current.gy)
      };
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
        if (checkCollision(ray, { type: "move", blockMovement: true, blockSenses: false, mode: 'any' })) {
          // Blocked, do nothing
        } else {
          let newDistance;
          if (globalThis.combatRangeOverlay.terrainProvider?.id === "terrainmapper" && !globalThis.combatRangeOverlay.terrainProvider?.usesRegions) {
            newDistance = current.distance + GridTile.costTerrainMapper(currentToken, neighbor);
          } else if (globalThis.combatRangeOverlay.terrainProvider?.id === "terrainmapper" && globalThis.combatRangeOverlay.terrainProvider?.usesRegions) {
            newDistance = current.distance + GridTile.costTerrainMapperV2(currentToken, neighbor);
          } else {
            newDistance = current.distance + neighbor.cost;
          };

          let diagonalDelta = getDiagonalDelta();

          if (current.isDiagonal(neighbor)) { // diagonals
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

    return new Map([...tileMap].filter(kv => kv[1].distance !== MAX_DIST));
  }

  async calculateTargetRangeMap() {
    const targetMap = new Map();
    const currentWeaponRange = await TokenInfo.current.weaponRangeColor
    const weaponRangeInTiles = currentWeaponRange.map(i => ({ ...i, range: i.range / this.DISTANCE_PER_TILE }));

    for (const targetToken of game.user.targets) {
      if (targetToken.visible) targetMap.set(targetToken.id, calculateTilesInRange(weaponRangeInTiles, targetToken));
    }
    return targetMap;
  }

  async drawPotentialTargets(movementCosts) {
    const currentToken = getCurrentToken();
    const colorByActions = globalThis.combatRangeOverlay.colorByActions;

    if (!currentToken.inCombat) {
      return;
    }

    const tilesMovedPerActionPromise = TokenInfo.current.speed / this.DISTANCE_PER_TILE;
    const currentWeaponRangePromise = TokenInfo.current.weaponRangeColor
    const [tilesMovedPerAction, currentWeaponRange] = await Promise.all([tilesMovedPerActionPromise, currentWeaponRangePromise])
    
    const weaponRangeInTiles = currentWeaponRange.map(i => ({ ...i, range: i.range / this.DISTANCE_PER_TILE }));
    const myDisposition = getCombatantTokenDisposition(currentToken);
    debugLog("drawPotentialTargets", "|", "Current disposition", myDisposition);

    for (const combatant of game.combat.combatants) {
      const combatantToken = getCombatantToken(combatant);
      debugLog("drawPotentialTargets", "|", "Potential target disposition", getCombatantTokenDisposition(combatantToken), combatantToken.id, combatantToken);

      if (getCombatantTokenDisposition(combatantToken) !== myDisposition) {
        if (combatantToken.visible && !combatant.defeated) {
          let tilesInRange = calculateTilesInRange(weaponRangeInTiles, combatantToken);
          let bestCost = MAX_DIST;

          for (const tileInRange of tilesInRange) {
            const costTile = movementCosts.get(tileInRange.key)
            if (costTile === undefined) {
              continue;
            }
            if (costTile.distance < bestCost) {
              bestCost = costTile.distance;
            }
          }

          const colorIndex = Math.min(Math.ceil(diagonalDistance(bestCost) / tilesMovedPerAction), colorByActions.length - 1);
          let color = colorByActions[colorIndex];

          const tokenOverlay = new PIXI.Graphics();
          tokenOverlay.lineStyle(potentialTargetLineWidth, color)
          tokenOverlay.drawCircle(
            combatantToken.hitArea.width / 2,
            combatantToken.hitArea.height / 2,
            Math.pow(Math.pow(combatantToken.hitArea.width / 2, 2) + Math.pow(combatantToken.hitArea.height / 2, 2), .5)
          );
          combatantToken.addChild(tokenOverlay);
          this.overlays.tokenOverlays.push(tokenOverlay);
        }
      }
    }
  }

  async drawAll() {
    const movementCostsPromise = this.calculateMovementCosts();
    const targetRangeMapPromise = this.calculateTargetRangeMap();
    const [movementCosts, targetRangeMap] = await Promise.all([movementCostsPromise, targetRangeMapPromise]);

    this.initializePersistentVariables();

    const promises = [];
    promises.push(this.drawCosts(movementCosts, targetRangeMap));
    
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
      if (canvas.terrain) {
        switch (globalThis.combatRangeOverlay.terrainProvider?.id) {
          case "enhanced-terrain-layer": {
            canvas.terrain._tokenDrag = true;
            canvas.terrain.refreshVisibility();
            break;
          }
          case "terrainmapper": {
            canvas.drawings.addChild(globalThis.combatRangeOverlay.terrainGraphics);
            break;
          }
          default: {
            break;
          }
        }
      } else if (globalThis.combatRangeOverlay.terrainProvider?.id === "terrainmapper") {
        canvas.regions.placeables.forEach((region) => {
          const behaviors = region.document.behaviors.contents;
          const isTerrain = behaviors.some((behavior) => behavior.type === "terrainmapper.setTerrain")
          const terrainBehaviors = behaviors.filter((behavior) => behavior.type === "terrainmapper.setTerrain")
          const shouldBeVisible = region.visible || (terrainBehaviors.some((behavior) => !behavior.disabled) && (game.user.isGM || terrainBehaviors.some((behavior) => !behavior.system.secret)));
          globalThis.combatRangeOverlay.updateRegionMap(region.id, {
            visibility: region.document.visibility,
            alpha: region.alpha,
            hatchThickness: region.children[0].shader.uniforms.hatchThickness
          });
          if (globalThis.combatRangeOverlay.initialized && isTerrain && shouldBeVisible) {
            region.document.visibility = CONST.REGION_VISIBILITY.ALWAYS;
            region.alpha = 0.5;
            region.children[0].shader.uniforms.hatchThickness = 30;
            region._refreshState()
          }
        })
      }
    }
    await Promise.all(promises)
  }

  // noinspection JSUnusedLocalSymbols
  async dragHandler(dragging) {
    const currentToken = getCurrentToken();
    const visibilitySetting = currentToken?.inCombat ? Settings.getICVisibility() : Settings.getOOCVisibility();
    if (visibilitySetting !== Settings.overlayVisibility.ALWAYS) {
      await this.fullRefresh();
    }
  }

  async fullRefresh() {
    if (!_token?.hitArea) return
    if (this.drawing) {
      Hooks.once(`${MODULE_ID}.done`, async () => await this.fullRefresh());
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

      const visibilitySetting = currentToken.inCombat ? Settings.getICVisibility() : Settings.getOOCVisibility();
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
      uiNotificationsInfo(game.i18n.localize(`${MODULE_ID}.activated-not-visible`));
    }
    this.justActivated = false;
    this.drawing = false;
    Hooks.callAll(`${MODULE_ID}.done`);
  }

  // partialRefresh() {
  //   this.fullRefresh();  // TODO Make this more efficient
  // }

  //Can't remember if this is important but it seems to cause issues so I have disabled it.
  async renderApplicationHook() {
    //if (globalThis.combatRangeOverlay?.initialized) await this.fullRefresh();
  }

  async targetTokenHook() {
    this.newTarget = true;
    globalThis.combatRangeOverlay.setTargetVisibility();
    await this.fullRefresh();
  }

  canvasReadyHook() {
    this.terrainRegionsInit();
    TerrainHelper?.sceneUpdate();
    this.clearAll();
    TokenInfo.resetMap();
    this.DISTANCE_PER_TILE = game.scenes.viewed.grid.distance;
  }

  sceneUpdateHook() {
    this.canvasReadyHook();
    const token = getCurrentToken();
    token.release();
    Hooks.once("refreshToken", () => {
      canvas.tokens.get(token.id).control()
    })
  }

  async regionUpdateHook() {
    canvas.regions.placeables.forEach((region) => {
      if (region.document.behaviors.contents.some((behavior) => behavior.type === "terrainmapper.setTerrain")) {
        globalThis.combatRangeOverlay.updateRegionMap(region.id, {
          visibility: region.document.visibility,
          alpha: region.alpha,
          hatchThickness: region.children[0].shader.uniforms.hatchThickness
        });
      } else globalThis.combatRangeOverlay.regionMap.delete(region.id)
    });
    await this.fullRefresh();
  }

  async updateWallHook() {
    await this.fullRefresh();
  }

  terrainRegionsInit() {
    if (canvas.regions) {
      globalThis.combatRangeOverlay.regionMap.clear();
      canvas.regions.placeables.forEach((region) => {
        if (region.document.behaviors.contents.some((behavior) => behavior.type === "terrainmapper.setTerrain")) {
          globalThis.combatRangeOverlay.updateRegionMap(region.id, {
            visibility: region.document.visibility,
            alpha: region.alpha,
            hatchThickness: region.children[0].shader.uniforms.hatchThickness
          });
        }
      })
    }
  }

  async updateETLHook(placeableDocument) {
    if (placeableDocument.flags && placeableDocument.flags["enhanced-terrain-layer"]) await this.fullRefresh()
  }

  async visibilityRefreshHook() {
    globalThis.combatRangeOverlay.emit(SOCKET_TYPES.REFRESH_VISIBILITY, {userId: game.userId, tokenId: getCurrentToken()?.id})
    globalThis.combatRangeOverlay.refreshTargetVisibility();
    const targets = game.user.targets;
    const refresh = targets.some((target) => globalThis.combatRangeOverlay.targetVisionMap.get(target.id)?.new !== globalThis.combatRangeOverlay.targetVisionMap.get(target.id)?.old);
    if (refresh) {
      globalThis.combatRangeOverlay.setTargetVisibility();
      await globalThis.combatRangeOverlay.instance.fullRefresh();
    }
  }

  registerHooks() {
    this.hookIDs.renderApplication = Hooks.on("renderApplication", async (application) => {
      if (!['croQuickSettingsDialog', 'token-hud', 'navigation', 'controls'].includes(application.id)) await this.renderApplicationHook()
    });
    this.hookIDs.targetToken = Hooks.on("targetToken", async () => await this.targetTokenHook());
    this.hookIDs.canvasReady = Hooks.on("canvasReady", () => this.canvasReadyHook());
    this.hookIDs.sceneUpdate = Hooks.on("updateScene", () => this.sceneUpdateHook());
    this.hookIDs.updateWall = Hooks.on("updateWall", async () => await this.updateWallHook());
    this.hookIDs.createRegion = Hooks.on("createRegion", async () => await this.regionUpdateHook());
    this.hookIDs.refreshRegion = Hooks.on("refreshRegion", async () => await this.regionUpdateHook());
    this.hookIDs.deleteRegion = Hooks.on("deleteRegion", async () => await this.regionUpdateHook());
    this.hookIDs.updateRegionBehaviour = Hooks.on("updateRegionBehavior", async () => await this.regionUpdateHook());
    this.hookIDs.createDrawing = Hooks.on("createDrawing", async (drawing) => await this.updateETLHook(drawing));
    this.hookIDs.refreshDrawing = Hooks.on("refreshDrawing", async (drawing) => await this.updateETLHook(drawing));
    this.hookIDs.deleteDrawing = Hooks.on("deleteDrawing", async (drawing) => await this.updateETLHook(drawing));
    this.hookIDs.createMeasuredTemplate = Hooks.on("createMeasuredTemplate", async (template) => await this.updateETLHook(template));
    this.hookIDs.refreshMeasuredTemplate = Hooks.on("refreshMeasuredTemplate", async (template) => await this.updateETLHook(template));
    this.hookIDs.deleteMeasuredTemplate = Hooks.on("deleteMeasuredTemplate", async (template) => await this.updateETLHook(template));
    this.hookIDs.visibilityRefresh = Hooks.on("visibilityRefresh", async () => await this.visibilityRefreshHook());
  }

  unregisterHooks() {
    Hooks.off("renderApplication", this.hookIDs.renderApplication);
    Hooks.off("targetToken", this.hookIDs.targetToken);
    Hooks.off("canvasReady", this.hookIDs.canvasReady);
    this.hookIDs.renderApplication = undefined;
    this.hookIDs.targetToken = undefined;
    this.hookIDs.canvasReady = undefined;
  }

  clearAll() {
    this.overlays.distanceTexts?.forEach(t => { safeDestroy(t) });
    this.overlays.turnOrderTexts?.forEach(t => { safeDestroy(t) });
    this.overlays.tokenOverlays?.forEach(o => { safeDestroy(o) });
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
      if (canvas.terrain) {
        switch (globalThis.combatRangeOverlay.terrainProvider?.id) {
          case "enhanced-terrain-layer": {
            canvas.terrain._tokenDrag = false;
            canvas.terrain.refreshVisibility();
            break;
          }
          case "terrainmapper": {
            canvas.drawings.removeChild(globalThis.combatRangeOverlay.terrainGraphics);
            break;
          }
          default: {
            break;
          }
        }
      } else if (globalThis.combatRangeOverlay.terrainProvider?.id === "terrainmapper" && globalThis.combatRangeOverlay.initialized) {
        canvas.regions.placeables.forEach((region) => {
          const isTerrain = region.document.behaviors.contents.some((behavior) => behavior.type === "terrainmapper.setTerrain");
          const regionDefault = globalThis.combatRangeOverlay.getRegionMapData(region.id)
          if (isTerrain) {
            region.document.visibility = regionDefault.visibility
            region.alpha = regionDefault.alpha;
            region.children[0].shader.uniforms.hatchThickness = regionDefault.hatchThickness
            region._refreshState()
          }
        })
      }
    }
  }

  initializePersistentVariables() {
    this.overlays.distanceTexts = [];
    this.overlays.turnOrderTexts = [];
    this.overlays.tokenOverlays = [];

    this.overlays.distanceOverlay = new PIXI.Graphics();
    this.overlays.pathOverlay = new PIXI.Graphics();
    this.overlays.potentialTargetOverlay = new PIXI.Graphics();
    this.overlays.wallsOverlay = new PIXI.Graphics();
  }

  async drawWeaponRange() {
    debugLog("drawWeaponRange");
    const currentToken = getCurrentToken();
    if (!currentToken.inCombat) {
      return;
    }

    const range = []
    const currentWeaponRange = await TokenInfo.current.weaponRangeColor
    currentWeaponRange.forEach((i) => {
      if (!range.includes(i.range)) {
        range.push(i.range)
      }
    });

    const style = Object.assign({}, weaponRangeStyle);
    style.fontSize = style.fontSize * (canvasGridSize() / BASE_GRID_SIZE);

    const text = new PIXI.Text(`» ${range}`, style);
    text.position.x = currentToken.hitArea.width - text.width - TEXT_MARGIN;
    text.position.y = currentToken.hitArea.height - text.height - TEXT_MARGIN;
    currentToken.addChild(text);
    this.overlays.turnOrderTexts.push(text);
  }

  drawTurnOrder() {
    const style = Object.assign({}, turnOrderStyle);
    style.fontSize = style.fontSize * (canvasGridSize() / BASE_GRID_SIZE);

    const currentTokenId = getCurrentToken().id;
    for (const combat of game.combats) {
      const currentCombatant = combat.combatants.find(c => c.token.id === currentTokenId);
      if (!currentCombatant) {
        continue;
      }

      const sortedCombatants = combat.setupTurns()
      let seenCurrent = false;

      const head = [];
      const tail = [];

      for (const combatant of sortedCombatants) {
        const combatantTokenId = combatant.token.id
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
          const combatantTokenId = combatant.token.id
          const combatantToken = canvasTokensGet(combatantTokenId);

          if (turnOrder > 0 && combatantToken.visible) {
            const text = new PIXI.Text(turnOrder, style);
            text.position.x = combatantToken.hitArea.width - text.width - TEXT_MARGIN;
            text.position.y = combatantToken.hitArea.height - text.height - TEXT_MARGIN;
            combatantToken.addChild(text);
            this.overlays.turnOrderTexts.push(text);
          }
          turnOrder++
        }
      }
    }
  }

  async drawCosts(movementCostMap, targetRangeMap) {
    const rangeMap = buildRangeMap(targetRangeMap);
    const idealTileMap = calculateIdealTileMap(movementCostMap, targetRangeMap, rangeMap);
    const colorByActions = globalThis.combatRangeOverlay.colorByActions;
    let showOnlyTargetPath = targetRangeMap.size > 0;
    if (showOnlyTargetPath && idealTileMap.size === 0) {
      if (this.newTarget) {
        this.newTarget = false;
        uiNotificationsWarn(game.i18n.localize(`${MODULE_ID}.no-good-tiles`));
        showOnlyTargetPath = false;
      }
    }

    const tilesMovedPerAction = await TokenInfo.current.speed / this.DISTANCE_PER_TILE;
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
        if (globalThis.combatRangeOverlay.showNumericMovementCost) {
          const style = Object.assign({}, movementCostStyle);
          style.fontSize = style.fontSize * (canvasGridSize() / BASE_GRID_SIZE);

          const label = globalThis.combatRangeOverlay.roundNumericMovementCost ? diagonalDistance(tile.distance) : tile.distance;
          const text = new PIXI.Text(label, style);
          const pt = tile.pt;
          text.position.x = pt.x;
          text.position.y = pt.y;
          this.overlays.distanceTexts.push(text);
        }

        if (globalThis.combatRangeOverlay.showPathLines) {
          let tileCenter = tile.centerPt;
          if (tile.upstreams !== undefined) {
            for (const upstream of tile.upstreams) {
              let upstreamCenter = upstream.centerPt;
              this.overlays.pathOverlay.moveTo(tileCenter.x, tileCenter.y);
              this.overlays.pathOverlay.lineTo(upstreamCenter.x, upstreamCenter.y);
            }
          }
        }

        // Color tile based on number of actions to reach it
        const colorIndex = (tile.distance && tile.distance < 1) ? 1 : Math.min(Math.ceil(diagonalDistance(tile.distance) / tilesMovedPerAction), colorByActions.length - 1);
        let color = colorByActions[colorIndex];
        let cornerPt = tile.pt;
        if (idealTileMap.has(tile.key)) {
          this.overlays.distanceOverlay.lineStyle(highlightLineWidth, idealTileMap.get(tile.key).color);
        } else {
          this.overlays.distanceOverlay.lineStyle(0, 0);
        }
        this.overlays.distanceOverlay.beginFill(color, Settings.getMovementAlpha());
        this.overlays.distanceOverlay.drawRect(cornerPt.x, cornerPt.y, canvasGridSize(), canvasGridSize());
        this.overlays.distanceOverlay.endFill();
      }
    }

    canvas.drawings.addChild(this.overlays.distanceOverlay);
    canvas.drawings.addChild(this.overlays.pathOverlay);

    for (const text of this.overlays.distanceTexts) {
      canvas.drawings.addChild(text);
    }
  }

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

function calculateIdealTileMap(movementTileMap, targetMap, rangeMap) {
  const idealTileMap = new Map();
  for (const tile of movementTileMap.values()) {
    if (rangeMap.get(tile.key)) {
      if (rangeMap.get(tile.key).count === targetMap.size) { // Every target is reachable from here
        idealTileMap.set(tile.key, { tile: tile, color: rangeMap.get(tile.key).color });
      }
    }
  }
  return idealTileMap;
}

function calculateTilesInRange(rangeInTiles, targetToken) {
  const tokenInfo = TokenInfo.getById(targetToken.id);
  const targetTile = GridTile.fromPixels(tokenInfo.location.x, tokenInfo.location.y);
  const tileSet = new Set();
  const targetGridX = targetTile.gx;
  const targetGridY = targetTile.gy;
  const targetGridHeight = Math.floor(targetToken.hitArea.height / canvasGridSize());
  const targetGridWidth = Math.floor(targetToken.hitArea.width / canvasGridSize());

  for (const rangeInTilesElement of rangeInTiles) {
    const weaponColor = rangeInTilesElement.color;
    // Loop over X and Y deltas, computing distance for only a single quadrant
    for (let gridXDelta = 0; gridXDelta <= rangeInTilesElement.range; gridXDelta++) {
      for (let gridYDelta = 0; gridYDelta <= rangeInTilesElement.range; gridYDelta++) {
        if (gridXDelta === 0 && gridYDelta === 0) {
          continue;
        }

        const shotDistance = calculateGridDistance({ x: 0, y: 0 }, { x: gridXDelta, y: gridYDelta });
        if (shotDistance < rangeInTilesElement.range + FUDGE) { // We're within range
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
              //const testTilePoint = testTile.pt;
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

// Abstract this because IntelliJ complains that canvas.walls.checkCollision isn't accessible and we don't want to annotate it everywhere
function checkCollision(ray, opts) {
  // noinspection JSUnresolvedFunction
  if (parseInt(game.version) < 11) {
    return canvas.walls.checkCollision(ray, opts);
  } else {
    return CONFIG.Canvas.polygonBackends[opts.type].testCollision(ray.A, ray.B, opts);
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

export function checkTileToTokenVisibility(tile, token) {
  const t = Math.min(token.h, token.w) / 4;
  const offsets = t > 0 ? [[0, 0], [-t, 0], [t, 0], [0, -t], [0, t], [-t, -t], [-t, t], [t, t], [t, -t]] : [[0, 0]];
  const points = offsets.map(o => new PIXI.Point(token.center.x + o[0], token.center.y + o[1]));
  const tileCenterPt = tile.centerPt

  for (const point of points) {
    const ray = new Ray(tileCenterPt, point);
    if (!checkCollision(ray, { type: "sight", mode: 'any' })) {
      return true;
    }
  }

  return false;
}

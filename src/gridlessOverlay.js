/* globals
PIXI,
game,
FullCanvasObjectMixin,
canvas,
Token
*/

import {
  canvasGridSize,
  getCurrentToken,
  safeDestroy,
  uiNotificationsWarn,
  getCombatantTokenDisposition,
  getCombatantToken,
} from "./utility.js";

import { debugLog } from "./debug.js";
import { TokenInfo } from "./tokenInfo.js";
import {
  highlightLineWidth,
  potentialTargetLineWidth,
  MODULE_ID,
} from "./constants.js";
import * as Settings from "./settings.js";
import { cro } from "./main.js";
import { Overlay } from "./overlay.js";
import {
  combine,
  intersect,
  SpreadingClockwiseSweepPolygon,
} from "./SpreadingClockwiseSweepPolygon.js";

export class GridlessOverlay extends Overlay {
  constructor() {
    super();
    this.PIXEL_SCALE = 0;
  }

  initializePersistentVariables() {
    super.initializePersistentVariables();
    this.overlays.distanceOverlay =
      new (class FullCanvasContainer extends FullCanvasObjectMixin(
        PIXI.Container,
      ) {})();
    this.overlays.targetOverlay =
      new (class FullCanvasContainer extends FullCanvasObjectMixin(
        PIXI.Container,
      ) {})();
    this.overlays.distanceOverlay.alpha = Settings.getMovementAlpha();
  }

  clearAll() {
    this.overlays.distanceOverlay?.children?.forEach((o) => {
      safeDestroy(o);
    });
    this.overlays.targetOverlay?.children?.forEach((o) => {
      safeDestroy(o);
    });
    safeDestroy(this.overlays.targetOverlay);
    this.overlays.targetOverlay = undefined;
    super.clearAll();
  }

  /**
   * Calculate the area within range of targets
   * @returns {Promise<Map<string, Map<Weapon, SpreadingClockwiseSweepPolygon>>>} - Map of target ids and SpreadingClockwiseSweepPolygons they can be reached within
   */
  async calculateTargetShapeMap() {
    const targetMap = new Map();
    const currentWeaponRange = await TokenInfo.current.weaponRangeColor;
    const weaponRangeInTiles = currentWeaponRange.map((i) => ({
      ...i,
      range: i.range / this.PIXEL_SCALE,
    }));

    for (const targetToken of game.user.targets) {
      if (targetToken.visible)
        targetMap.set(
          targetToken.id,
          this.calculateTargetShape(weaponRangeInTiles, targetToken),
        );
    }
    return targetMap;
  }

  /**
   * Draw the main overlay showing movement range
   * @param {Map<number, SpreadingClockwiseSweepPolygon>} actionShapes - A map of areas that can be reached in a given number of actions
   * @param {Map<string, Map<Weapon, SpreadingClockwiseSweepPolygon>>} targetShapeMap  - A map of targets and the areas that can reach them
   */
  drawCosts(actionShapes, targetShapeMap) {
    const currentToken = getCurrentToken();
    const currentTokenInfo = TokenInfo.getById(currentToken.id);
    if (!currentTokenInfo.speed) return;

    // Get line of sight
    const los = currentToken.vision?.los?.clone();
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

    // Get area within reach of all targets
    const idealShapes = calculateIdealShape(targetShapeMap, actionShapes);
    let longest = { range: 0 };
    let largestArea = 0;
    let longestShape;
    if (idealShapes) {
      idealShapes.forEach((_shape, weapon) => {
        if (weapon.range > longest.range) longest = weapon;
      });
      longestShape = idealShapes.get(longest);
      if (longestShape.length)
        largestArea = longestShape.reduce((prev, curr) => {
          return prev.area ? curr.area + prev.area : curr.area + prev;
        });
    }

    // Warn if can't reach all targets
    let showOnlyTargetPath = targetShapeMap.size > 0;
    if (showOnlyTargetPath && largestArea === 0) {
      if (this.newTarget) {
        this.newTarget = false;
        uiNotificationsWarn(game.i18n.localize(`${MODULE_ID}.no-good-area`));
        showOnlyTargetPath = false;
      }
    }

    /* Calculate path to target bounds
    Ellipses are the locus of points that have the same sum distance from two points 
    i.e. the token can move to any point on the circumference and still be able to reach the target area */
    const result = new Map();
    if (showOnlyTargetPath && largestArea) {
      for (let i = 1; i <= cro.actionsToShow; i++) {
        const maxDistance = (currentTokenInfo.speed * i) / this.PIXEL_SCALE;
        const ellipses = [];
        idealShapes.get(longest).forEach((shape) => {
          const points = [...shape.iteratePoints()];
          for (let j = 0; j < points.length; j++) {
            const ellipse = getEllipse(
              currentTokenInfo.measureFrom,
              new PIXI.Point(points[j].x, points[j].y),
              maxDistance,
            );
            // Filter out degenerate ellipses
            if (ellipse.points.length > 2) ellipses.push(ellipse);
          }
        });
        result.set(i, combine(ellipses));
      }

      // Clip these ellipses with the action shapes as the ellipses ignore walls
      result.forEach((shapes, action) => {
        const intersection = intersect(shapes, [actionShapes.get(action)]);
        result.set(action, intersection);
      });

      /* Clip the ellipses with a circle centered on the current token
      with a radius equal to the distance to the farthest point within range of the target
      i.e. not drawing area further away than the target shape */
      const start = new PIXI.Point(
        currentTokenInfo.measureFrom.x,
        currentTokenInfo.measureFrom.y,
      );
      let furthest = 0;
      idealShapes.get(longest).forEach((shape) => {
        const distance = [...shape.iteratePoints()]
          .map((i) => PIXI.Point.distanceBetween(start, i))
          .sort((a, b) => {
            return b - a;
          })[0];
        if (distance > furthest) furthest = distance;
      });
      result.forEach((shape, action) =>
        result.set(
          action,
          intersect(shape, [
            new PIXI.Circle(start.x, start.y, furthest).toPolygon(),
          ]),
        ),
      );

      // Fill in area inside target shape and action shape as this is always accessible
      result.forEach((shapes, action) => {
        const inside = intersect(longestShape, [actionShapes.get(action)]);
        const combined = combine(shapes.concat(inside));
        result.set(action, combined);
      });
    }

    // Draw movement shapes, preventing overlap using holes
    actionShapes.forEach((shape, action) => {
      let polys = [shape];
      if (showOnlyTargetPath && largestArea) {
        polys = result.get(action);
      }
      const actionOverlay = new PIXI.Graphics();
      actionOverlay.lineStyle(0, 0);
      actionOverlay.beginFill(shape.color);
      polys.forEach((poly) => {
        actionOverlay.drawPolygon(poly);
        if (shape.holes?.length) {
          actionOverlay.beginHole();
          shape.holes.forEach((hole) => actionOverlay.drawPolygon(hole));
          actionOverlay.endHole();
        }
      });
      actionOverlay.endFill();
      this.overlays.distanceOverlay.addChild(actionOverlay);
    });
    canvas.drawings.addChild(this.overlays.distanceOverlay);
    // Deal with transparency issues
    this.overlays.distanceOverlay.cacheAsBitmap = true;

    // Outline area within range of all targets
    idealShapes?.forEach((idealShapes, weapon) => {
      idealShapes.forEach((idealShape) => {
        this.overlays.targetOverlay.addChild(
          new PIXI.Graphics()
            .lineStyle(highlightLineWidth, weapon.color)
            .drawPolygon(idealShape),
        );
      });
    });
    canvas.drawings.addChild(this.overlays.targetOverlay);
  }

  /**
   * Calculate the areas that be reached in each action to be shown
   * @returns {Map<number, SpreadingClockwiseSweepPolygon>} - A map of areas that can be reached in a given number of actions
   */
  calculateMovementArea() {
    const currentToken = getCurrentToken();
    const currentTokenInfo = TokenInfo.getById(currentToken.id);
    const speed = currentTokenInfo.speed;
    const distancePerAction = speed / this.PIXEL_SCALE;
    const maxDistance = distancePerAction * cro.actionsToShow;
    const colorByActions = cro.colorByActions;
    const actionsToShow = cro.actionsToShow;

    // Construct movement shape for each action
    const actionShapes = new Map();
    for (let i = 0; i < actionsToShow; i++) {
      actionShapes.set(
        actionsToShow - i,
        this.calculateMovementShape(
          currentTokenInfo.measureFrom,
          maxDistance - i * distancePerAction,
          colorByActions[actionsToShow - i],
        ),
      );
    }

    return actionShapes;
  }

  /**
   * @typedef {object} Point
   * @property {number} x - The x coord
   * @property {number} y - The y coord
   */
  /**
   * Calculate a SpreadingClockwiseSweepPolygon with the given properties
   * @param {Point} origin - The point to calculate the spread from
   * @param {number} distance - The radius of the spread
   * @param {string} color - The color of the spread
   * @returns {SpreadingClockwiseSweepPolygon} - The requested SpreadingClockwiseSweepPolygon
   */
  calculateMovementShape(origin, distance, color) {
    const sweep = new SpreadingClockwiseSweepPolygon({
      origin,
      distance,
      color,
    });
    return sweep.computeSpreadPolygon();
  }

  /**
   * Highlight targets in movement range
   * @param {Map<number, SpreadingClockwiseSweepPolygon>} actionShapes - A map of areas that can be reached in a given number of actions
   */
  async drawPotentialTargets(actionShapes) {
    const currentToken = getCurrentToken();
    const currentTokenInfo = TokenInfo.current;
    const currentWeaponRange = await currentTokenInfo.weaponRangeColor;

    if (!currentToken.inCombat) {
      return;
    }

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
          let minActions = cro.actionsToShow + 1;
          actionShapes.forEach((shape, actions) => {
            const inShape = shape?.contains(
              combatantToken.center.x,
              combatantToken.center.y,
            );
            if (inShape && actions < minActions) minActions = actions;
          });
          if (currentTokenInfo.speed === 0) {
            const rangeShapes = this.calculateTargetShape(
              currentWeaponRange,
              combatantToken,
            );
            rangeShapes.forEach((shape) => {
              const inShape = shape?.contains(
                currentTokenInfo.location.x,
                currentTokenInfo.location.y,
              );
              if (inShape) minActions = 0;
            });
          }
          const color =
            minActions > 0
              ? actionShapes.get(minActions)?.color
              : cro.colorByActions[0];

          const tokenOverlay = new PIXI.Graphics();
          color
            ? tokenOverlay.lineStyle(potentialTargetLineWidth, color)
            : tokenOverlay.lineStyle(0, 0);
          tokenOverlay.drawCircle(
            combatantToken.hitArea.getBounds().width / 2,
            combatantToken.hitArea.getBounds().height / 2,
            Math.hypot(
              combatantToken.hitArea.getBounds().width / 2,
              combatantToken.hitArea.getBounds().height / 2,
            ),
          );
          combatantToken.addChild(tokenOverlay);
          this.overlays.tokenOverlays.push(tokenOverlay);
        }
      }
    }
  }

  /**
   * Calculate the area in range of a specific target
   * @param {Array<Weapon>} weapons - An array of weapons, their ranges and their colors
   * @param {Token} targetToken - The target token
   * @returns {Map<Weapon, SpreadingClockwiseSweepPolygon>} - The area specific target can be reached from
   */
  calculateTargetShape(weapons, targetToken) {
    const tokenInfo = TokenInfo.getById(targetToken.id);
    const location = { x: tokenInfo.location.x, y: tokenInfo.location.y };
    const targetShapes = new Map();

    for (const weapon of weapons) {
      const weaponColor = weapon.color;
      const shape = this.calculateMovementShape(
        location,
        weapon.range +
          Math.hypot(
            targetToken.hitArea.getBounds().width / 2,
            targetToken.hitArea.getBounds().height / 2,
          ),
        weaponColor,
      );
      targetShapes.set(weapon, shape);
    }
    return targetShapes;
  }

  /**
   * Draw all overlays
   */
  async drawAll() {
    const movementArea = this.calculateMovementArea();
    const targetShapeMap = await this.calculateTargetShapeMap();

    this.initializePersistentVariables();

    this.drawCosts(movementArea, targetShapeMap);
    const promises = [];

    if (game.user.targets.size === 0) {
      if (Settings.isShowTurnOrder()) {
        this.drawTurnOrder();
      }

      if (Settings.isShowPotentialTargets()) {
        promises.push(this.drawPotentialTargets(movementArea));
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

  canvasReadyHook() {
    super.canvasReadyHook();
    this.PIXEL_SCALE = this.DISTANCE_PER_TILE / canvasGridSize();
  }
}

/**
 * @typedef {object} Weapon
 * @property {number} range - Weapon's range
 * @property {number} color - The color for the weapon
 * @property {string} [weapon] - The weapon's id
 */

/**
 * Calculate the area within movement range and can reach all targets
 * @param {Map<string, Map<Weapon, SpreadingClockwiseSweepPolygon>>} targetShapes - A map of targets and the areas that can reach them
 * @param {Map<number, SpreadingClockwiseSweepPolygon>} actionShapes - The area within movement range
 * @returns {Map<Weapon, Array<PIXI.Polygon>>|null} - The area that is in range of all targets and within movement range with their colors
 */
function calculateIdealShape(targetShapes, actionShapes) {
  if (!targetShapes.size || !actionShapes) return null;
  const actionClips = new Map();
  actionShapes.forEach((shape, action) => {
    actionClips.set(action, shape.toClipperPoints());
  });
  const weaponMap = new Map();
  targetShapes.forEach((weaponShapeMap) => {
    weaponShapeMap.forEach((shape, weapon) => {
      if (!weaponMap.has(weapon)) weaponMap.set(weapon, []);
      weaponMap.get(weapon).push(shape);
    });
  });
  let idealShapes = new Map();
  weaponMap.forEach((shapes, weapon) => {
    let intersects;
    for (let i = 0; i < shapes.length; i++) {
      if (i === 0) intersects = shapes[i];
      else intersects = shapes[i].intersectPolygon(intersects);
      intersects.color = shapes[i].color;
    }
    idealShapes.set(weapon, intersects);
  });
  idealShapes.forEach((idealShape, weapon) => {
    const clip = idealShape.intersectClipper(
      actionClips.get(cro.actionsToShow),
    );
    const polys = clip.map((clip) => {
      return PIXI.Polygon.fromClipperPoints(clip);
    });
    idealShapes.set(weapon, polys);
  });
  return idealShapes;
}

/**
 * Get an ellipse from the foci and the width
 * @param {PIXI.Point} f1 - One focus
 * @param {PIXI.Point} f2 - The other focus
 * @param {number} d - The distance that this ellipse is the locus for (the width)
 * @returns {PIXI.Polygon} - The ellipse as a polygon
 */
function getEllipse(f1, f2, d) {
  const a = d / 2;
  const c = PIXI.Point.distanceBetween(f1, f2) / 2;
  const b = Math.sqrt(a ** 2 - c ** 2);
  const center = PIXI.Point.midPoint(f1, f2);
  const unRotatedEllipse = new PIXI.Ellipse(center.x, center.y, a, b);
  const rotation = Math.atan((f1.y - f2.y) / (f1.x - f2.x));
  unRotatedEllipse.radians = rotation;
  return unRotatedEllipse.toPolygon();
}

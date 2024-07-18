/* globals
canvas,
ui,
game,
Token
*/

import * as Settings from "./settings.js";
import { DEFAULT_WEAPON_RANGES } from "./constants.js";

/**
 * Get the current token
 * @returns {Token|undefined} - The current token or undefined if no token is controlled
 */
export function getCurrentToken() {
  if (canvasTokensControlled().length === 1) {
    return canvasTokensControlled()[0];
  } else {
    const activeTokens = game.user?.character?.getActiveTokens();
    if (activeTokens) {
      return activeTokens[0];
    } else {
      return undefined;
    }
  }
}

/**
 * Get the weapon ranges to show in the Quick Settings Dialog
 * @returns {Array<number>} - An array of weapon ranges
 */
export function getWeaponRanges() {
  const rangeStrings = Settings.getRanges().split(",");
  const ranges = [];
  for (const rangeString of rangeStrings) {
    const range = parseInt(rangeString);
    if (!isNaN(range)) {
      ranges.push(range);
    }
  }
  if (ranges.length) {
    return ranges;
  } else {
    return DEFAULT_WEAPON_RANGES.split(",").map((r) => parseInt(r));
  }
}

/**
 * Destroy a PIXI thing
 * @param {*} thing - The thing to be destroyed
 */
export function safeDestroy(thing) {
  try {
    thing.destroy();
  } catch {
    // Already destroyed; ignore
  }
}

/**
 * For some reason the combatant just has the Token's data structure, not the Token object
 * Get the combatant's token
 * @param {*} combatant - The combatant
 * @returns {Token} - The corresponding token
 */
export function getCombatantToken(combatant) {
  const tokenId = combatant.token.id;
  // noinspection JSUnresolvedFunction
  return canvas.tokens.get(tokenId);
}

/**
 * Get a combatant's disposition towards the party
 * @param {Token} combatantToken - The token to get the disposition of
 * @returns {number} - The disposition towards the party
 */
export function getCombatantTokenDisposition(combatantToken) {
  return combatantToken.document.disposition;
}

/**
 * Calculate the grid distance between two points
 * @param {{x: number, y: number}} pt1 - Point one
 * @param {{x: number, y: number}} pt2 - Point two
 * @returns {number} - The number of grid spaces between the points
 */
export function calculateGridDistance(pt1, pt2) {
  const dx = Math.abs(pt1.x - pt2.x);
  const dy = Math.abs(pt1.y - pt2.y);
  return Math.abs(dx - dy) + Math.floor((Math.min(dx, dy) * 3) / 2);
}

/**
 * Get the canvas grid size
 * @returns {number} - The size of a tile in pixels
 */
export function canvasGridSize() {
  return canvas.grid.size;
}

/**
 * Get a token from the canvas by its id
 * @param {string} tokenId - The id
 * @returns {Token} - The corresponding token
 */
export function canvasTokensGet(tokenId) {
  return canvas.tokens.get(tokenId);
}

/**
 * Get all tokens controlled by the current user
 * @returns {Array<Token>} - All tokens controlled by the user
 */
export function canvasTokensControlled() {
  return canvas.tokens.controlled;
}

/**
 * Send a warning popup
 * @param {string} msg - The message
 */
export function uiNotificationsWarn(msg) {
  ui.notifications.warn(msg);
}

/**
 * Send an info popup
 * @param {string} msg - The message
 */
export function uiNotificationsInfo(msg) {
  ui.notifications.info(msg);
}

/**
 * From Foundry v12
 * Compute the signed area of polygon using an approach similar to ClipperLib.Clipper.Area.
 * The math behind this is based on the Shoelace formula. https://en.wikipedia.org/wiki/Shoelace_formula.
 * The area is positive if the orientation of the polygon is positive.
 * @returns {number} - The signed area of the polygon
 */
export function signedArea() {
  const points = this.points;
  const ln = points.length;
  if (ln < 6) return 0;

  // Compute area
  let area = 0;
  let x1 = points[ln - 2];
  let y1 = points[ln - 1];
  for (let i = 0; i < ln; i += 2) {
    const x2 = points[i];
    const y2 = points[i + 1];
    area += (x2 - x1) * (y2 + y1);
    x1 = x2;
    y1 = y2;
  }

  // Negate the area because in Foundry canvas, y-axis is reversed
  // See https://sourceforge.net/p/jsclipper/wiki/documentation/#clipperlibclipperorientation
  // The 1/2 comes from the Shoelace formula
  return area * -0.5;
}
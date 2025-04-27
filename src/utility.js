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
  if (canvasTokensControlled()?.length === 1) {
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
  return canvas.tokens?.controlled;
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
 * Convert cube coordinates (q, r, s) into point coordinates (x, y).
 * @param {{q: number, r: number}} cube - The cube coordinates
 * @returns {{x: number, y: number}} - The point coordinates
 */
export function cubeToPoint({ q, r }) {
  const grid = canvas.grid.grid;
  let x;
  let y;

  if (grid.columnar) {
    x = (Math.sqrt(3) / 2) * (q + 2 / 3);
    y = 0.5 * (q + (grid.even ? 1 : 0)) + r;
  } else {
    y = (Math.sqrt(3) / 2) * (r + 2 / 3);
    x = 0.5 * (r + (grid.even ? 1 : 0)) + q;
  }

  const size = canvasGridSize();
  x *= size;
  y *= size;

  return { x, y };
}

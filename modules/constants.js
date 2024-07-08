/* globals
CONST
*/

/**
 * The module id
 * @type {string}
 */
export const MODULE_ID = "combat-range-overlay";

/**
 * The default weapon range if not overridden by settings
 * @type {number}
 */
export const DEFAULT_DEFAULT_WEAPON_RANGE = 5;

/**
 * The default weapon ranges to choose from in the Quick Settings Dialog
 * @type {string}
 */
export const DEFAULT_WEAPON_RANGES = "5,10,30,60,120";

/**
 * Names of flags
 * @enum {string}
 */
export const FLAG_NAMES = {
  WEAPON_RANGE: "weaponRange",
  SPEED_OVERRIDE: "speedOverride",
  IGNORE_DIFFICULT_TERRAIN: "ignoreDifficultTerrain",
  UNMODIFIED_SPEED: "unmodifiedSpeed",
  IGNORE_SET_SPEED: "ignoreSetSpeed",
  SPEED_OBJECT: "speedObject",
};

/**
 * The maximum distance at which to check tiles
 * @type {number}
 */
export const MAX_DIST = 999;

/**
 * Avoids being on the edges of tiles
 * @type {number}
 */
export const FUDGE = 0.1; // floating point fudge

/**
 * Keybinds and their state
 * @enum {boolean}
 */
export const PRESSED_KEYS = {
  showOverlay: false,
  quickSettings: false,
  resetMeasureFrom: false,
};

/**
 * Events which might apply terrains
 * @type {Set<Array<string|undefined>>}
 */
export const ENTRY_EVENTS = new Set([
  CONST.REGION_EVENTS?.TOKEN_ENTER,
  CONST.REGION_EVENTS?.TOKEN_MOVE,
  CONST.REGION_EVENTS?.TOKEN_MOVE_IN,
  CONST.REGION_EVENTS?.TOKEN_PRE_MOVE,
]);

/**
 * Events that might apply terrains during combat
 * @type {Set<Array<string|undefined>>}
 */
export const ENTRY_EVENTS_COMBAT = new Set([
  CONST.REGION_EVENTS?.TOKEN_ROUND_END,
  CONST.REGION_EVENTS?.TOKEN_ROUND_START,
  CONST.REGION_EVENTS?.TOKEN_TURN_END,
  CONST.REGION_EVENTS?.TOKEN_TURN_START,
]);

/**
 * Socket types
 * @enum {string}
 */
export const SOCKET_TYPES = {
  REFRESH_VISIBILITY: "refreshVisibility",
};

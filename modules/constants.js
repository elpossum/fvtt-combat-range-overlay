export const MODULE_ID = "combat-range-overlay";

export const DEFAULT_DEFAULT_WEAPON_RANGE = 5;
export const DEFAULT_WEAPON_RANGES = "5,10,30,60,120";

export const FLAG_NAMES = {
  WEAPON_RANGE: "weaponRange",
  SPEED_OVERRIDE: "speedOverride",
  IGNORE_DIFFICULT_TERRAIN: "ignoreDifficultTerrain",
  UNMODIFIED_SPEED: "unmodifiedSpeed",
  IGNORE_SET_SPEED: "ignoreSetSpeed",
  SPEED_OBJECT: "speedObject"
};

export const MAX_DIST = 999;
export const FUDGE = .1; // floating point fudge

export const PRESSED_KEYS = {
  showOverlay: false,
  quickSettings: false,
  resetMeasureFrom: false
}

export const ENTRY_EVENTS = new Set([
  CONST.REGION_EVENTS?.TOKEN_ENTER,
  CONST.REGION_EVENTS?.TOKEN_MOVE,
  CONST.REGION_EVENTS?.TOKEN_MOVE_IN,
  CONST.REGION_EVENTS?.TOKEN_PRE_MOVE,
]);

export const ENTRY_EVENTS_COMBAT = new Set([
  CONST.REGION_EVENTS?.TOKEN_ROUND_END,
  CONST.REGION_EVENTS?.TOKEN_ROUND_START,
  CONST.REGION_EVENTS?.TOKEN_TURN_END,
  CONST.REGION_EVENTS?.TOKEN_TURN_START
]);
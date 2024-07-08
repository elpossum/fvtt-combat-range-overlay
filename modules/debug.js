/* globals
Hooks,
game
*/

import { MODULE_ID } from "./constants.js";

/* Register module with Dev Mode */
Hooks.once("devModeReady", ({ registerPackageDebugFlag }) => {
  registerPackageDebugFlag(MODULE_ID);
});

/**
 * Check for debug mode
 * @returns {boolean} - True if debug mode
 */
export function isDebugging() {
  // noinspection JSUnresolvedFunction,JSUnresolvedVariable
  return game.modules.get("_dev-mode")?.api?.getPackageDebugValue(MODULE_ID);
}

/**
 * Log to console with module identifier
 * @param {...*} args - What to log
 */
export function consoleLog(...args) {
  console.log(MODULE_ID, "|", ...args);
}

/**
 * Log to console if in debug mode
 * @param {...*} args - What to log
 */
export function debugLog(...args) {
  try {
    if (isDebugging()) {
      consoleLog(...args);
    }
  } catch {
    //Do nothing
  }
}

/* On hover, show position of token */
Hooks.on("hoverToken", (token, hovering) => {
  if (hovering) {
    debugLog("Hovering over", token.id, token.x, token.y);
  }
});

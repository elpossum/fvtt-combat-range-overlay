/* globals
Hooks,
libWrapper
*/

import { MODULE_ID } from "./constants.js";
import { debugLog } from "./debug.js";

/*
const states = {
    DOWN: 'down',
    UP: 'up'
};
*/

/**
 * The mouse handler class
 */
class Mouse {
  /**
   * Creates an instance of Mouse.
   */
  constructor() {
    this._leftDrag = false;
    this._hooks = [];
  }

  /**
   * Add a hook
   * @param {Function} func - The hook to add
   */
  addHook(func) {
    this._hooks.push(func);
  }

  /**
   * Clear all hooks
   */
  clearHooks() {
    this._hooks = [];
  }

  /**
   * Is the mouse left dragging?
   * @returns {boolean} - True if dragging
   */
  isLeftDrag() {
    return this._leftDrag;
  }

  /**
   * Execute all registered hooks
   * @param {boolean} dragging - Is left mouse dragging
   */
  _executeHooks(dragging) {
    for (const func of this._hooks) {
      func(dragging);
    }
  }

  /**
   * Execute hooks on left drag start
   * @param {Function} wrapped - The wrapped function
   * @param  {...*} args - The wrapped functions arguments
   * @returns {Function} - The wrapped function called with its arguments
   */
  _dragStartWrapper(wrapped, ...args) {
    this._leftDrag = true;
    this._executeHooks(true);
    return wrapped(...args);
  }

  /**
   * Execute hooks on left drag drop
   * @param {Function} wrapped - The wrapped function
   * @param  {...*} args - The wrapped functions arguments
   * @returns {Function} - The wrapped function called with its arguments
   */
  _dragDropWrapper(wrapped, ...args) {
    debugLog(false, "Drag Drop");
    this._leftDrag = false;
    this._executeHooks(false);
    return wrapped(...args);
  }

  /**
   * Execute hooks on left drag cancel
   * @param {Function} wrapped - The wrapped function
   * @param  {...*} args - The wrapped functions arguments
   * @returns {Function} - The wrapped function called with its arguments
   */
  _dragCancelWrapper(wrapped, ...args) {
    debugLog(false, "Drag Cancel");
    this._leftDrag = false;
    this._executeHooks(false);
    return wrapped(...args);
  }
}

/* Export a new mouse instance */
export const mouse = new Mouse();

/* Register with libwrapper */
Hooks.once("libWrapper.Ready", () => {
  libWrapper.ignore_conflicts(
    MODULE_ID,
    ["drag-ruler", "enhanced-terrain-layer"],
    [
      "Token.prototype._onDragLeftStart",
      "Token.prototype._onDragLeftDrop",
      "Token.prototype._onDragLeftCancel",
    ],
  );

  libWrapper.register(
    MODULE_ID,
    "Token.prototype._onDragLeftStart",
    mouse._dragStartWrapper.bind(mouse),
    "WRAPPER",
  );

  libWrapper.register(
    MODULE_ID,
    "Token.prototype._onDragLeftDrop",
    mouse._dragDropWrapper.bind(mouse),
    "WRAPPER",
  );

  libWrapper.register(
    MODULE_ID,
    "Token.prototype._onDragLeftCancel",
    mouse._dragCancelWrapper.bind(mouse),
    "WRAPPER",
  );
});

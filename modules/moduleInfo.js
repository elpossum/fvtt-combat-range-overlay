/* globals
game,
FormApplication,
foundry
*/

import { MODULE_ID } from "./constants.js";

export default class ModuleInfoApp extends FormApplication {
  /**
   * Creates an instance of ModuleInfoApp
   * @param {object} [options] - Foundry FormApplication options
   */
  constructor(options = {}) {
    super(options);
  }

  /**
   * Get default render options
   * @type {object}
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "combat-range-overlay-info",
      title: `${MODULE_ID}.info-button`,
      template: `modules/${MODULE_ID}/templates/info.hbs`,
      popOut: true,
      width: 500,
      height: 700,
    });
  }

  /**
   * Get this module's version
   * @returns {{version: string}} - A version number
   */
  getData() {
    return {
      version: game.modules.get(MODULE_ID).version,
    };
  }

  /**
   * On update, do nothing. Required implementation from prototype
   */
  async _updateObject() {}
}

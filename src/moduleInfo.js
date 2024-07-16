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
      id: `${MODULE_ID}-info`,
      title: `${MODULE_ID}.basic-info.button`,
      template: `modules/${MODULE_ID}/templates/info.hbs`,
      popOut: true,
      width: 500,
      height: 700,
      resizable: true,
    });
  }

  /**
   * Get this module's version
   * @returns {{version: string, MODULE_ID: string}} - A version number and the module id
   */
  getData() {
    return {
      version: game.modules.get(MODULE_ID).version,
      MODULE_ID: MODULE_ID,
    };
  }

  /**
   * On update, do nothing. Required implementation from prototype
   */
  async _updateObject() {}
}

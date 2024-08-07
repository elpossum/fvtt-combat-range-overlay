/* globals
game,
Hooks,
FormApplication,
foundry
*/

import { MODULE_ID } from "./constants.js";
import { cro } from "./main.js";

/**
 * The names of color settings
 * @type {Array<string>}
 */
export const colorSettingNames = [
  "no-actions",
  "one-action",
  "two-actions",
  "three-actions",
  "four-actions",
  "weapon-one",
  "weapon-two",
  "weapon-three",
];

/**
 * The defaults colors for tiles and weapons
 * @type {Array<string>}
 */
const defaultColors = [
  "#ffffff",
  "#0000ff",
  "#ffff00",
  "#ff0000",
  "#800080",
  "#ffffff",
  "#0000ff",
  "#ffff00",
];

/**
 * Update the setting on change
 */
function updateSettings() {
  cro.colorByActions = [];
  cro.colors = [];
  for (let i = 0; i < 5; i++) {
    let color = game.settings.get(MODULE_ID, colorSettingNames[i])
    if (parseInt(game.version) < 11)
      color = parseInt(color.replace("#", "0x"), 16);
    cro.colorByActions.push(color);
  }
  for (let i = 5; i < 8; i++) {
    let color = game.settings.get(MODULE_ID, colorSettingNames[i])
    if (parseInt(game.version) < 11)
      color = parseInt(color.replace("#", "0x"), 16);
    cro.colors.push(color);
  }
}

class ColorPickerApp extends FormApplication {
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
      id: `${MODULE_ID}-color-picker`,
      title: `${MODULE_ID}.color-picker.label`,
      template: `modules/${MODULE_ID}/templates/colorPicker.hbs`,
      popOut: true,
      resizable: true,
    });
  }

  /**
   * Get this module's version
   * @returns {{version: string, MODULE_ID: string}} - A version number and the module id
   */
  getData() {
    const o = {
      useHelper: parseInt(game.version) < 12,
      buttons: {
        save: `${MODULE_ID}.color-picker.save`,
        reset: `${MODULE_ID}.color-picker.reset`,
      },
      settings: {},
    };
    colorSettingNames.forEach((name, index) => {
      o.settings[name] = {};
      o.settings[name].name = `${MODULE_ID}.color-picker.${name}.name`;
      o.settings[name].hint = `${MODULE_ID}.color-picker.${name}.hint`;
      o.settings[name].value = game.settings.get(MODULE_ID, name);
      o.settings[name].default = defaultColors[index];
    });
    return o;
  }

  /**
   * On submit, update settings with new values
   * @param {object} _event - The triggering event
   * @param {object} formData - The data entered in the form
   */
  async _updateObject(_event, formData) {
    const promises = [];
    Object.entries(formData).forEach(([key, value]) => {
      promises.push(game.settings.set(MODULE_ID, key, value));
    });
    await Promise.all(promises);
    updateSettings();
    cro.fullRefresh();
  }
}

/* On Foundry init, register settings and potentially migrate from old settings*/
Hooks.once("init", async () => {
  colorSettingNames.forEach((name, index) => {
    game.settings.register(MODULE_ID, name, {
      name: game.i18n.localize(`${MODULE_ID}.color-picker.${name}.name`),
      hint: game.i18n.localize(`${MODULE_ID}.color-picker.${name}.hint`),
      label: game.i18n.localize(`${MODULE_ID}.color-picker.label`),
      restricted: false,
      type: String,
      config: false,
      default: `${defaultColors[index]}`,
      scope: "client",
      onChange: () => {},
    });
  });
  game.settings.registerMenu(MODULE_ID, "color-picker", {
    name: game.i18n.localize(`${MODULE_ID}.color-picker.label`),
    label: game.i18n.localize(`${MODULE_ID}.color-picker.label`),
    icon: "fas fa-paint-brush",
    type: ColorPickerApp,
    restricted: false,
  });

  //This updates from settings with external color pickers active as they stored color as an 8 digit hex code, not a 6 digit one
  let update = false;
  const updateData = {};
  colorSettingNames.forEach((name) => {
    const value = game.settings.get(MODULE_ID, name);
    updateData[name] = value;
    if (value.length === 9) {
      const newValue = value.slice(0, -2);
      updateData[name] = newValue;
      update = true;
    }
  });
  if (update) {
    const promises = [];
    colorSettingNames.forEach((name) => {
      promises.push(game.settings.set(MODULE_ID, name, updateData[name]));
    });
    await Promise.all(promises);
    updateSettings();
  }
});

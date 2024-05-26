import { MODULE_ID } from "./constants.js"

export const colorSettingNames = [
  'no-actions',
  'one-action',
  'two-actions',
  'three-actions',
  'four-actions',
  'weapon-one',
  'weapon-two',
  'weapon-three'
]

const defaultColors = ["#ffffffff", "#0000ffff", "#ffff00ff", "#ff0000ff", "#800080ff", "#ffffffff", "#0000ffff", "#ffff00ff"]

async function updateSettings() {
  globalThis.combatRangeOverlay.colorByActions = [];
  globalThis.combatRangeOverlay.colors = [];
  for (let i = 0; i < 5; i++) {
    globalThis.combatRangeOverlay.colorByActions.push(parseInt(game.settings.get(MODULE_ID, colorSettingNames[i]).slice(0, -2).replace("#", "0x"), 16))
  };
  for (let i = 5; i < 8; i++) {
    globalThis.combatRangeOverlay.colors.push(parseInt(game.settings.get(MODULE_ID, colorSettingNames[i]).slice(0, -2).replace("#", "0x"), 16))
  };
  await globalThis.combatRangeOverlay.instance.fullRefresh()
}

Hooks.once("init", () => {
  if (game.modules.get('colorsettings')?.active) {
    for (const [index, colorSettingName] of colorSettingNames.entries()) {
      new window.Ardittristan.ColorSetting(MODULE_ID, colorSettingName, {
        name: `${MODULE_ID}.color-picker.${colorSettingName}.name`,
        hint: `${MODULE_ID}.color-picker.${colorSettingName}.hint`,
        label: `${MODULE_ID}.color-picker.label`,
        restricted: false,
        defaultColor: `${defaultColors[index]}`,
        scope: "client",
        onChange: updateSettings
      })
    }
  } else if (game.modules.get('color-picker')?.active) {
    for (const [index, colorSettingName] of colorSettingNames.entries()) {
      ColorPicker.register(MODULE_ID, colorSettingName, {
        name: `${MODULE_ID}.color-picker.${colorSettingName}.name`,
        hint: `${MODULE_ID}.color-picker.${colorSettingName}.hint`,
        label: `${MODULE_ID}.color-picker.label`,
        restricted: false,
        default: `${defaultColors[index]}`,
        scope: "client",
        onChange: updateSettings
      }, { format: 'hexa' })
    }
  } else {
    for (const [index, colorSettingName] of colorSettingNames.entries()) {
      game.settings.register(MODULE_ID, colorSettingName, {
        name: `${MODULE_ID}.color-picker.${colorSettingName}.name`,
        hint: `${MODULE_ID}.color-picker.${colorSettingName}.hint`,
        label: `${MODULE_ID}.color-picker.label`,
        restricted: false,
        type: String,
        config: true,
        default: `${defaultColors[index]}`,
        scope: "client",
        onChange: updateSettings
      })
    }
  }
})
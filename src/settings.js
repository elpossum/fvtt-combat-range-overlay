/* globals
Hooks,
game,
canvas
*/

import {
  DEFAULT_WEAPON_RANGES,
  MODULE_ID,
  PRESSED_KEYS,
  DEFAULT_DEFAULT_WEAPON_RANGE,
} from "./constants.js";
import ModuleInfoApp from "./moduleInfo.js";
import { cro } from "./main.js";

/**
 * Overlay visibility settings
 * @enum {string}
 */
export const overlayVisibility = {
  ALWAYS: "always",
  ACTIVE_COMBATANT: "activeCombatant",
  DRAG: "drag",
  HOTKEYS: "hotkeys",
  BOTH: "both",
  NEVER: "never",
};

/**
 * How diagonals can be treated
 * @enum {string}
 */
export const diagonals = {
  FIVE_TEN_FIVE: "fiveTenFive",
  TEN_FIVE_TEN: "tenFiveTen",
  FIVE: "five",
  TEN: "ten",
};

/**
 * How a tile's terrain can be determined
 * @enum {string}
 */
const terrainMeasureTypes = {
  CENTER_POINT: "centerPoint",
  FIVE_POINT: "fivePoint",
  AREA: "area",
};

/**
 * How the overlay can be masked by vision
 * @enum {string}
 */
export const visionMaskingTypes = {
  NONE: "none",
  MASK: "mask",
  INDIVIDUAL: "individual",
};

/**
 * Setting names
 * @enum {string}
 */
const settingNames = {
  IS_ACTIVE: "is-active",
  IC_VISIBILITY: "ic_visibility",
  OOC_VISIBILITY: "ooc_visibility",
  SHOW_TURN_ORDER: "show-turn-order",
  SHOW_POTENTIAL_TARGETS: "show-potential-targets",
  SHOW_DIFFICULT_TERRAIN: "show-difficult-terrain",
  SHOW_WALLS: "show-walls",
  MOVEMENT_ALPHA: "movement-alpha",
  RANGES: "ranges",
  DIAGONALS: "diagonals",
  DEFAULT_WEAPON_RANGE: "default-weapon-range",
  SHOW_WEAPON_RANGE: "show-weapon-range",
  SPEED_ATTR_PATH: "speed-attr-path",
  INFO_BUTTON: "basic-info.button",
  UPDATE_POSITION_IN_COMBAT: "update-position-in-combat",
  ACTIONS_SHOWN: "actions-shown",
  SHOWN_NOTIFICATION: "shown-notification",
  TERRAIN_MEASURE: "terrain-measure",
  VISION_MASKING_TYPE: "vision-masking-type",
  VISION_MASKING_PERCENTAGE: "vision-masking-percentage",
  SUPPORTED_ACTORS: "supported-actors",
  RECURSIONS: "recursions",
  RECURSION_LIMITED: "recursion-limited",
};

/* Set which settings should be not configurable, default to false, and are non-boolean */
const hiddenSettings = [
  settingNames.IS_ACTIVE,
  settingNames.SHOWN_NOTIFICATION,
];
const defaultFalse = [
  settingNames.IS_ACTIVE,
  settingNames.SHOW_DIFFICULT_TERRAIN,
  settingNames.SHOW_WALLS,
  settingNames.SHOWN_NOTIFICATION,
  settingNames.RECURSION_LIMITED,
];
const ignore = [
  settingNames.MOVEMENT_ALPHA,
  settingNames.VISION_MASKING_TYPE,
  settingNames.VISION_MASKING_PERCENTAGE,
  settingNames.IC_VISIBILITY,
  settingNames.OOC_VISIBILITY,
  settingNames.RANGES,
  settingNames.DIAGONALS,
  settingNames.DEFAULT_WEAPON_RANGE,
  settingNames.SPEED_ATTR_PATH,
  settingNames.INFO_BUTTON,
  settingNames.ACTIONS_SHOWN,
  settingNames.TERRAIN_MEASURE,
  settingNames.SUPPORTED_ACTORS,
  settingNames.RECURSIONS,
];

/* Register settings and keybindings */
Hooks.once("init", () => {
  game.settings.registerMenu(MODULE_ID, settingNames.INFO_BUTTON, {
    name: game.i18n.localize(`${MODULE_ID}.${settingNames.INFO_BUTTON}`),
    label: game.i18n.localize(`${MODULE_ID}.${settingNames.INFO_BUTTON}`),
    icon: "fas fa-info-circle",
    type: ModuleInfoApp,
    restricted: false,
  });

  for (const settingName of Object.values(settingNames)) {
    if (!ignore.includes(settingName)) {
      game.settings.register(MODULE_ID, settingName, {
        name: game.i18n.localize(`${MODULE_ID}.${settingName}`),
        hint: game.i18n.localize(`${MODULE_ID}.${settingName}-hint`),
        scope: "client",
        config: !hiddenSettings.includes(settingName),
        type: Boolean,
        default: !defaultFalse.includes(settingName),
        onChange: async () => {
          cro.fullRefresh();
        },
      });
    }
  }

  game.settings.register(MODULE_ID, settingNames.RECURSIONS, {
    name: game.i18n.localize(`${MODULE_ID}.${settingNames.RECURSIONS}`),
    hint: game.i18n.localize(`${MODULE_ID}.${settingNames.RECURSIONS}-hint`),
    scope: "world",
    config: true,
    type: Number,
    default: 4,
    range: {
      min: 0,
      max: 8,
      step: 1,
    },
    onChange: async () => {
      cro.fullRefresh();
    },
  });

  game.settings.register(MODULE_ID, settingNames.ACTIONS_SHOWN, {
    name: game.i18n.localize(`${MODULE_ID}.${settingNames.ACTIONS_SHOWN}`),
    hint: game.i18n.localize(`${MODULE_ID}.${settingNames.ACTIONS_SHOWN}-hint`),
    scope: "client",
    config: true,
    type: Number,
    default: 2,
    range: {
      min: 0,
      max: 4,
      step: 1,
    },
    onChange: async () => {
      cro.actionsToShow = game.settings.get(MODULE_ID, "actions-shown");
      cro.fullRefresh();
    },
  });

  game.settings.register(MODULE_ID, settingNames.MOVEMENT_ALPHA, {
    name: game.i18n.localize(`${MODULE_ID}.${settingNames.MOVEMENT_ALPHA}`),
    hint: game.i18n.localize(
      `${MODULE_ID}.${settingNames.MOVEMENT_ALPHA}-hint`,
    ),
    scope: "client",
    config: true,
    type: Number,
    default: 0.1,
    range: {
      min: 0,
      max: 1,
      step: 0.05,
    },
    onChange: async () => {
      cro.fullRefresh();
    },
  });

  game.settings.register(MODULE_ID, settingNames.IC_VISIBILITY, {
    name: game.i18n.localize(`${MODULE_ID}.${settingNames.IC_VISIBILITY}`),
    hint: game.i18n.localize(`${MODULE_ID}.${settingNames.IC_VISIBILITY}-hint`),
    scope: "client",
    config: true,
    type: String,
    default: overlayVisibility.ALWAYS,
    choices: {
      always: game.i18n.localize(
        `${MODULE_ID}.visibilities.${overlayVisibility.ALWAYS}`,
      ),
      activeCombatant: game.i18n.localize(
        `${MODULE_ID}.visibilities.${overlayVisibility.ACTIVE_COMBATANT}`,
      ),
      drag: game.i18n.localize(
        `${MODULE_ID}.visibilities.${overlayVisibility.DRAG}`,
      ),
      hotkeys: game.i18n.localize(
        `${MODULE_ID}.visibilities.${overlayVisibility.HOTKEYS}`,
      ),
      both: game.i18n.localize(
        `${MODULE_ID}.visibilities.${overlayVisibility.BOTH}`,
      ),
      never: game.i18n.localize(
        `${MODULE_ID}.visibilities.${overlayVisibility.NEVER}`,
      ),
    },
    onChange: async () => {
      cro.fullRefresh();
    },
  });

  game.settings.register(MODULE_ID, settingNames.OOC_VISIBILITY, {
    name: game.i18n.localize(`${MODULE_ID}.${settingNames.OOC_VISIBILITY}`),
    hint: game.i18n.localize(
      `${MODULE_ID}.${settingNames.OOC_VISIBILITY}-hint`,
    ),
    scope: "client",
    config: true,
    type: String,
    default: overlayVisibility.NEVER,
    choices: {
      always: game.i18n.localize(
        `${MODULE_ID}.visibilities.${overlayVisibility.ALWAYS}`,
      ),
      drag: game.i18n.localize(
        `${MODULE_ID}.visibilities.${overlayVisibility.DRAG}`,
      ),
      hotkeys: game.i18n.localize(
        `${MODULE_ID}.visibilities.${overlayVisibility.HOTKEYS}`,
      ),
      both: game.i18n.localize(
        `${MODULE_ID}.visibilities.${overlayVisibility.BOTH}`,
      ),
      never: game.i18n.localize(
        `${MODULE_ID}.visibilities.${overlayVisibility.NEVER}`,
      ),
    },
    onChange: async () => {
      cro.fullRefresh();
    },
  });

  game.settings.register(MODULE_ID, settingNames.VISION_MASKING_TYPE, {
    name: game.i18n.localize(
      `${MODULE_ID}.${settingNames.VISION_MASKING_TYPE}`,
    ),
    hint: game.i18n.localize(
      `${MODULE_ID}.${settingNames.VISION_MASKING_TYPE}-hint`,
    ),
    scope: "client",
    config: true,
    type: String,
    default: visionMaskingTypes.NONE,
    choices: {
      none: game.i18n.localize(
        `${MODULE_ID}.vision-mask-types.${visionMaskingTypes.NONE}`,
      ),
      mask: game.i18n.localize(
        `${MODULE_ID}.vision-mask-types.${visionMaskingTypes.MASK}`,
      ),
      individual: game.i18n.localize(
        `${MODULE_ID}.vision-mask-types.${visionMaskingTypes.INDIVIDUAL}`,
      ),
    },
    onChange: async () => {
      cro.fullRefresh();
    },
  });

  game.settings.register(MODULE_ID, settingNames.VISION_MASKING_PERCENTAGE, {
    name: game.i18n.localize(
      `${MODULE_ID}.${settingNames.VISION_MASKING_PERCENTAGE}`,
    ),
    hint: game.i18n.localize(
      `${MODULE_ID}.${settingNames.VISION_MASKING_PERCENTAGE}-hint`,
    ),
    scope: "client",
    config: true,
    type: Number,
    default: 50,
    range: {
      min: 0,
      max: 100,
      step: 5,
    },
    onChange: async () => {
      if (getVisionMaskType() === visionMaskingTypes.INDIVIDUAL)
        cro.fullRefresh();
    },
  });

  if (game.modules.get("terrainmapper")?.active) {
    game.settings.register(MODULE_ID, settingNames.TERRAIN_MEASURE, {
      name: game.i18n.localize(`${MODULE_ID}.${settingNames.TERRAIN_MEASURE}`),
      hint: game.i18n.localize(
        `${MODULE_ID}.${settingNames.TERRAIN_MEASURE}-hint`,
      ),
      scope: "world",
      config: true,
      type: String,
      default: terrainMeasureTypes.CENTER_POINT,
      choices: {
        centerPoint: game.i18n.localize(
          `${MODULE_ID}.terrain-measure-types.${terrainMeasureTypes.CENTER_POINT}`,
        ),
        fivePoint: game.i18n.localize(
          `${MODULE_ID}.terrain-measure-types.${terrainMeasureTypes.FIVE_POINT}`,
        ),
        area: game.i18n.localize(
          `${MODULE_ID}.terrain-measure-types.${terrainMeasureTypes.AREA}`,
        ),
      },
      onChange: async () => {
        cro.fullRefresh();
      },
    });
  }

  game.settings.register(MODULE_ID, settingNames.RANGES, {
    name: game.i18n.localize(`${MODULE_ID}.${settingNames.RANGES}`),
    hint: game.i18n.localize(`${MODULE_ID}.${settingNames.RANGES}-hint`),
    scope: "client",
    config: true,
    type: String,
    default: DEFAULT_WEAPON_RANGES,
    onChange: async () => {
      cro.fullRefresh();
    },
  });

  game.settings.register(MODULE_ID, settingNames.DEFAULT_WEAPON_RANGE, {
    name: game.i18n.localize(
      `${MODULE_ID}.${settingNames.DEFAULT_WEAPON_RANGE}`,
    ),
    hint: game.i18n.localize(
      `${MODULE_ID}.${settingNames.DEFAULT_WEAPON_RANGE}-hint`,
    ),
    scope: "world",
    config: true,
    type: Number,
    default: DEFAULT_DEFAULT_WEAPON_RANGE,
    onChange: async () => {
      cro.fullRefresh();
    },
  });

  game.settings.register(MODULE_ID, settingNames.DIAGONALS, {
    name: game.i18n.localize(`${MODULE_ID}.${settingNames.DIAGONALS}.name`),
    hint: game.i18n.localize(`${MODULE_ID}.${settingNames.DIAGONALS}.hint`),
    scope: "world",
    config: true,
    type: String,
    default: diagonals.FIVE_TEN_FIVE,
    choices: {
      fiveTenFive: game.i18n.localize(
        `${MODULE_ID}.${settingNames.DIAGONALS}.${diagonals.FIVE_TEN_FIVE}`,
      ),
      tenFiveTen: game.i18n.localize(
        `${MODULE_ID}.${settingNames.DIAGONALS}.${diagonals.TEN_FIVE_TEN}`,
      ),
      five: game.i18n.localize(
        `${MODULE_ID}.${settingNames.DIAGONALS}.${diagonals.FIVE}`,
      ),
      ten: game.i18n.localize(
        `${MODULE_ID}.${settingNames.DIAGONALS}.${diagonals.TEN}`,
      ),
    },
    onChange: async () => {
      cro.fullRefresh();
    },
  });

  game.settings.register(MODULE_ID, settingNames.SPEED_ATTR_PATH, {
    name: game.i18n.localize(`${MODULE_ID}.${settingNames.SPEED_ATTR_PATH}`),
    hint: game.i18n.localize(
      `${MODULE_ID}.${settingNames.SPEED_ATTR_PATH}-hint`,
    ),
    scope: "world",
    config: true,
    type: String,
    default: "",
  });

  game.settings.register(MODULE_ID, settingNames.SUPPORTED_ACTORS, {
    name: game.i18n.localize(`${MODULE_ID}.${settingNames.SUPPORTED_ACTORS}`),
    hint: game.i18n.localize(
      `${MODULE_ID}.${settingNames.SUPPORTED_ACTORS}-hint`,
    ),
    scope: "world",
    config: true,
    type: String,
    default: "character,npc",
  });

  game.keybindings.register(MODULE_ID, "showOverlay", {
    name: game.i18n.localize(`${MODULE_ID}.keybindings.showOverlay.name`),
    hint: game.i18n.localize(`${MODULE_ID}.keybindings.showOverlay.hint`),
    editable: [
      {
        key: "AltLeft",
      },
    ],
    onDown: () => {
      PRESSED_KEYS.showOverlay = true;
      (async () => cro.fullRefresh())();
    },
    onUp: () => {
      PRESSED_KEYS.showOverlay = false;
      (async () => cro.fullRefresh())();
    },
  });

  game.keybindings.register(MODULE_ID, "quickSettings", {
    name: game.i18n.localize(`${MODULE_ID}.keybindings.quickSettings.name`),
    hint: game.i18n.localize(`${MODULE_ID}.keybindings.quickSettings.hint`),
    editable: [
      {
        key: "ShiftLeft",
      },
    ],
    onDown: () => {
      PRESSED_KEYS.quickSettings = true;
    },
    onUp: () => {
      PRESSED_KEYS.quickSettings = false;
    },
  });

  game.keybindings.register(MODULE_ID, "resetMeasureFrom", {
    name: game.i18n.localize(`${MODULE_ID}.keybindings.resetMeasureFrom.name`),
    hint: game.i18n.localize(`${MODULE_ID}.keybindings.resetMeasureFrom.hint`),
    editable: [
      {
        key: "ControlLeft",
      },
    ],
    onDown: () => {
      PRESSED_KEYS.resetMeasureFrom = true;
    },
    onUp: () => {
      PRESSED_KEYS.resetMeasureFrom = false;
    },
  });
});

// Only add recursions and vision mask percent if they would have an effect
Hooks.on("renderSettingsConfig", (_app, html) => {
  const tab = html.querySelector(`.tab[data-tab="${MODULE_ID}"]`);
  const recursionCheck = tab.querySelector(
    `.form-group:has( input[name="${MODULE_ID}.${settingNames.RECURSION_LIMITED}"] )`,
  );
  const visionMaskInput = tab.querySelector(
    `.form-group:has( select[name="${MODULE_ID}.${settingNames.VISION_MASKING_TYPE}"] )`,
  );
  const recursionSlider = tab.querySelector(
    `.form-group:has( range-picker[name="${MODULE_ID}.${settingNames.RECURSIONS}"] )`,
  );
  const visionMaskSlider = tab.querySelector(
    `.form-group:has( range-picker[name="${MODULE_ID}.${settingNames.VISION_MASKING_PERCENTAGE}"] )`,
  );
  recursionCheck.addEventListener("input", (e) => {
    if (e.target.checked) recursionCheck.after(recursionSlider);
    else recursionSlider.remove();
  });
  visionMaskInput.addEventListener("input", (e) => {
    if (e.target.value === visionMaskingTypes.MASK)
      visionMaskInput.after(visionMaskSlider);
    else visionMaskSlider.remove();
  });
  if (!getRecursionLimited()) recursionSlider.remove();
  if (getVisionMaskType() !== visionMaskingTypes.MASK)
    visionMaskSlider.remove();
});

/**
 * Set the overlay's activation status
 * @param {boolean} isActive - Whether the overlay has been activated
 */
export async function setActive(isActive) {
  await game.settings.set(MODULE_ID, settingNames.IS_ACTIVE, isActive);
}

/**
 * Whether the overlay is active
 * @returns {boolean} - True if active
 */
export function isActive() {
  return game.settings.get(MODULE_ID, settingNames.IS_ACTIVE);
}

/**
 * Should turn order be shown
 * @returns {boolean} - True if shown
 */
export function isShowTurnOrder() {
  return game.settings.get(MODULE_ID, settingNames.SHOW_TURN_ORDER);
}

/**
 * Should potential targets be shown
 * @returns {boolean} - True if shown
 */
export function isShowPotentialTargets() {
  return game.settings.get(MODULE_ID, settingNames.SHOW_POTENTIAL_TARGETS);
}

/**
 * Should walls be shown
 * @returns {boolean} - True if shown
 */
export function isShowWalls() {
  return game.settings.get(MODULE_ID, settingNames.SHOW_WALLS);
}

/**
 * Should difficult terrain be shown
 * @returns {boolean} - True if shown
 */
export function isShowDifficultTerrain() {
  return game.settings.get(MODULE_ID, settingNames.SHOW_DIFFICULT_TERRAIN);
}

/**
 * In combat overlay visibility
 * @returns {overlayVisibility} - @see {overlayVisibility}
 */
export function getICVisibility() {
  return game.settings.get(MODULE_ID, settingNames.IC_VISIBILITY);
}

/**
 * Out of combat overlay visibility
 * @returns {overlayVisibility} - @see {overlayVisibility}
 */
export function getOOCVisibility() {
  return game.settings.get(MODULE_ID, settingNames.OOC_VISIBILITY);
}

/**
 * The overlay alpha
 * @returns {number} - 0-1
 */
export function getMovementAlpha() {
  return game.settings.get(MODULE_ID, settingNames.MOVEMENT_ALPHA);
}

/**
 * How diagonals should be treated
 * @returns {diagonals} - @see {diagonals}
 */
export function getDiagonals() {
  const square = !canvas.grid.isHexagonal;
  if (square) return game.settings.get(MODULE_ID, settingNames.DIAGONALS);
  else return diagonals.FIVE;
}

/**
 * Default ranges if set
 * @returns {string} - Comma separated list of numbers
 */
export function getRanges() {
  return game.settings.get(MODULE_ID, settingNames.RANGES);
}

/**
 * Should weapon range be shown
 * @returns {boolean} - True if shown
 */
export function isShowWeaponRange() {
  return game.settings.get(MODULE_ID, settingNames.SHOW_WEAPON_RANGE);
}

/**
 * The speed attribute path if set
 * @returns {string} - A property path in dot notation
 */
export function getSpeedAttrPath() {
  return game.settings.get(MODULE_ID, settingNames.SPEED_ATTR_PATH);
}

/**
 * Should the overlay be updated during a combat turn
 * @returns {boolean} - True is should be updated
 */
export function updatePositionInCombat() {
  return game.settings.get(MODULE_ID, settingNames.UPDATE_POSITION_IN_COMBAT);
}

/**
 * The default weapon range if none is set
 * @returns {number} - The range to treat as base
 */
export function getWeaponRange() {
  return game.settings.get(MODULE_ID, settingNames.DEFAULT_WEAPON_RANGE);
}

/**
 * How should a tile's terrain be determined
 * @returns {terrainMeasureTypes} - @see {terrainMeasureTypes}
 */
export function getTerrainMeasure() {
  return game.settings.get(MODULE_ID, settingNames.TERRAIN_MEASURE);
}

/**
 * How should the overlay be masked by vision
 * @returns {visionMaskingTypes} - @see {visionMaskingTypes}
 */
export function getVisionMaskType() {
  return game.settings.get(MODULE_ID, settingNames.VISION_MASKING_TYPE);
}

/**
 * How much of a tile must be visible to be shown
 * @returns {number} - 0-1
 */
export function getVisionMaskPercent() {
  return (
    game.settings.get(MODULE_ID, settingNames.VISION_MASKING_PERCENTAGE) / 100
  );
}

/**
 * Get which actor types the overlay should show for
 * @returns {Array<string>} - All actor types for which the overlay should show
 */
export function getSupportedActors() {
  return game.settings.get(MODULE_ID, settingNames.SUPPORTED_ACTORS).split(",");
}

/**
 * Get the max number of recursions for gridless spreading
 * @returns {number} - The number of recursions
 */
export function getNumberOfRecursions() {
  return game.settings.get(MODULE_ID, settingNames.RECURSIONS);
}

/**
 * Is the max number of recursions for gridless spreading limited?
 * @returns {boolean} - False if unlimited recursion
 */
export function getRecursionLimited() {
  return game.settings.get(MODULE_ID, settingNames.RECURSION_LIMITED);
}

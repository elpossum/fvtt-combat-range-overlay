/* globals
canvas,
foundry,
game,
Hooks,
Dialog,
Token,
Item,
ActiveEffect,
CONST
*/

import { FLAG_NAMES, MODULE_ID } from "./constants.js";
import {
  canvasTokensGet,
  getCurrentToken,
  uiNotificationsWarn,
  getWeaponRanges,
} from "./utility.js";
import { debugLog } from "./debug.js";
import * as Settings from "./settings.js";
import { GridTile } from "./gridTile.js";
import { checkTileToTokenVisibility } from "./overlay.js";
import { cro } from "./main.js";

/**
 * The TokenInfo class
 */
export class TokenInfo {
  /**
   * @type {Map<string, TokenInfo>}
   */
  static _tokenInfoMap = new Map();

  /**
   * Clear the token info map
   */
  static resetMap() {
    TokenInfo._tokenInfoMap = new Map();
  }

  /**
   * Construct a new TokenInfo
   * @param {string} tokenId - The id of the token to construct it from
   */
  constructor(tokenId) {
    this.tokenId = tokenId;
    this.token = canvasTokensGet(this.tokenId);
    this.measureFrom = undefined;
    this.location = undefined;

    this.updateLocation();
    this.updateMeasureFrom();

    this.colors = [];

    TokenInfo._tokenInfoMap.set(tokenId, this);
  }

  /**
   * @typedef {object} LocationUpdate
   * @property {number} [x] - The x coordinate
   * @property {number} [y] - The y coordinate
   */
  /**
   * Update the TokenInfo's location
   * @param {LocationUpdate} [updateData] - The updated coords
   */
  updateLocation(updateData) {
    if (parseInt(game.version) > 11) {
      this.location = {
        x: updateData?.x
          ? this.token.center.x + updateData.x - this.token.x
          : this.token.center.x,
        y: updateData?.y
          ? this.token.center.y + updateData.y - this.token.y
          : this.token.center.y,
      };
    } else if (canvas.grid.type === CONST.GRID_TYPES.GRIDLESS) {
      this.location = {
        x: this.token.center.x,
        y: this.token.center.y,
      };
    } else {
      this.location = {
        x: updateData?.x ? updateData.x : this.token.x,
        y: updateData?.y ? updateData.y : this.token.y,
      };
    }
  }

  /**
   * Update the TokenInfo with where it should measure from
   * @param {LocationUpdate} [updateData] - The updated coords
   */
  updateMeasureFrom(updateData) {
    if (parseInt(game.version) > 11) {
      this.measureFrom = {
        x: updateData?.x
          ? this.token.center.x + updateData.x - this.token.x
          : this.token.center.x,
        y: updateData?.y
          ? this.token.center.y + updateData.y - this.token.y
          : this.token.center.y,
      };
    } else if (canvas.grid.type === CONST.GRID_TYPES.GRIDLESS) {
      this.measureFrom = {
        x: this.token.center.x,
        y: this.token.center.y,
      };
    } else {
      this.measureFrom = {
        x: updateData?.x ? updateData.x : this.token.x,
        y: updateData?.y ? updateData.y : this.token.y,
      };
    }
  }

  /**
   * The TokenInfo of the current token
   * @type {TokenInfo|undefined}
   */
  static get current() {
    if (getCurrentToken() !== undefined) {
      return TokenInfo.getById(getCurrentToken().id);
    } else {
      return undefined;
    }
  }

  /**
   * Get the TokenInfo of a specific token by id
   * @param {string} tokenId - The id of the token to get the TokenInfo of
   * @returns {TokenInfo} - The TokenInfo for that id, either from storage or by creating a new TokenInfo
   */
  static getById(tokenId) {
    let ti = TokenInfo._tokenInfoMap.get(tokenId);
    if (!ti) {
      ti = new TokenInfo(tokenId);
      TokenInfo._tokenInfoMap.set(tokenId, ti);
    }
    return ti;
  }

  /**
   * Get a flag from this module's namespace
   * @param {FLAG_NAMES} flagName - The flag name
   * @param {*} [dflt] - The default value if the flag doesn't exist on the object
   * @returns {*} - The value of the flag
   */
  getFlag(flagName, dflt = undefined) {
    // Somehow unlinked tokens get their own copies of actors (they even share IDs) but which have their own flags
    const baseActor = game.actors.get(this.token.actor.id);
    return (
      this.token.document.getFlag(MODULE_ID, flagName) ??
      baseActor.getFlag(MODULE_ID, flagName) ??
      dflt
    );
  }

  /**
   * Get all equipped weapons along with their range and color
   * This is defined by system, if unsupported it opens a dialog to set a range
   * @type {Promise<Array<import("./overlay.js").Weapon>>}
   */
  get weaponRangeColor() {
    return (async () => {
      const DEFAULT_WEAPON_RANGE = Settings.getWeaponRange();
      const colors = cro.colors;
      if (this.getFlag(FLAG_NAMES.WEAPON_RANGE)) {
        let range = [
          {
            range: this.getFlag(FLAG_NAMES.WEAPON_RANGE),
            color: cro.colors[0],
          },
        ];
        return range;
      } else
        switch (game.system.id) {
          case "pf2e": {
            const weapons = this.token.actor.items.filter(
              (i) => i.type == "weapon" && i.isEquipped,
            );
            const baseReach = this.token.actor.system.attributes.reach.base;
            let range = [];
            for (const [, weapon] of weapons.entries()) {
              let weaponObject = {
                range: DEFAULT_WEAPON_RANGE,
                color: undefined,
                weapon: weapon.id,
              };
              const hasReach = weapon.system.traits.value.includes("reach");
              if (weapon.system.traits.value.includes("combination")) {
                hasReach
                  ? (weaponObject.range = baseReach + DEFAULT_WEAPON_RANGE)
                  : (weaponObject.range = DEFAULT_WEAPON_RANGE);
                range.push(weaponObject);
                range.push({
                  range: weapon.rangeIncrement || weapon.system.range,
                  color: undefined,
                  weapon: weapon.id,
                });
              } else if (weapon.isRanged || weapon.isThrown) {
                weaponObject.range =
                  weapon.rangeIncrement || weapon.system.range;
                range.push(weaponObject);
              } else {
                hasReach
                  ? (weaponObject.range = baseReach + DEFAULT_WEAPON_RANGE)
                  : (weaponObject.range = baseReach);
                range.push(weaponObject);
              }
            }
            range.sort((a, b) => {
              return a.range - b.range;
            });
            range.forEach((weapon, index) => {
              weapon.color = colors[index % colors.length];
            });
            return range;
          }
          case "dnd5e": {
            const weapons = this.token.actor.items.filter(
              (i) => i.type == "weapon" && i.system.equipped,
            );
            const baseReach = 5;
            let range = [];
            for (const [, weapon] of weapons.entries()) {
              let weaponObject = {
                range: DEFAULT_WEAPON_RANGE,
                color: undefined,
                weapon: weapon.id,
              };
              const hasReach = weapon.system.properties.rch;
              if (weapon.system.range.value) {
                weaponObject.range = weapon.system.range.value;
                range.push(weaponObject);
              } else {
                hasReach
                  ? (weaponObject.range = baseReach + DEFAULT_WEAPON_RANGE)
                  : (weaponObject.range = baseReach);
                range.push(weaponObject);
              }
            }
            range.sort((a, b) => {
              return a.range - b.range;
            });
            range.forEach((weapon, index) => {
              weapon.color = colors[index % colors.length];
            });
            return range;
          }
          case "D35E": {
            const weapons = this.token.actor.items.filter(
              (i) => i.type == "weapon" && i.system.equipped,
            );
            const baseReach = 5;
            let range = [];
            for (const [, weapon] of weapons.entries()) {
              let weaponObject = {
                range: DEFAULT_WEAPON_RANGE,
                color: undefined,
                weapon: weapon.id,
              };
              const hasReach = weapon.system.properties.rch;
              if (weapon.system.weaponData.range) {
                weaponObject.range = weapon.system.weaponData.range;
                range.push(weaponObject);
              } else {
                hasReach
                  ? (weaponObject.range = baseReach + DEFAULT_WEAPON_RANGE)
                  : (weaponObject.range = baseReach);
                range.push(weaponObject);
              }
            }
            range.sort((a, b) => {
              return a.range - b.range;
            });
            range.forEach((weapon, index) => {
              weapon.color = colors[index % colors.length];
            });
            return range;
          }
          case "pf1": {
            const weapons = this.token.actor.items.filter(
              (i) => i.type == "weapon" && i.system.equipped,
            );
            const baseReach = 5;
            let range = [];
            for (const [, weapon] of weapons.entries()) {
              let weaponObject = {
                range: DEFAULT_WEAPON_RANGE,
                color: undefined,
                weapon: weapon.id,
              };
              const hasReach = weapon.system.properties.rch;
              const descRange = parseInt(
                weapon.system.description.value
                  .match(/range<\/b> \d*/i)[0]
                  .replace(/[^0-9]/g, ""),
              );
              if (descRange) {
                weaponObject.range = descRange;
                range.push(weaponObject);
              } else {
                hasReach
                  ? (weaponObject.range = baseReach + DEFAULT_WEAPON_RANGE)
                  : (weaponObject.range = baseReach);
                range.push(weaponObject);
              }
            }
            range.sort((a, b) => {
              return a.range - b.range;
            });
            range.forEach((weapon, index) => {
              weapon.color = colors[index % colors.length];
            });
            return range;
          }
          case "wfrp4e": {
            const weapons = this.token.actor.itemCategories.weapon.filter(
              (i) => i.system.equipped == true,
            );
            let range = [];
            for (const [, weapon] of weapons.entries()) {
              let weaponObject = {
                range: DEFAULT_WEAPON_RANGE,
                color: undefined,
                weapon: weapon.id,
              };
              if (weapon.system.range.value) {
                weaponObject.range = parseInt(weapon.system.range.value);
                range.push(weaponObject);
              } else {
                range.push(weaponObject);
              }
            }
            range.sort((a, b) => {
              return a.range - b.range;
            });
            range.forEach((weapon, index) => {
              weapon.color = colors[index % colors.length];
            });
            return range;
          }
          case "swade": {
            const weapons = this.token.actor.items.filter(
              (i) => i.type == "weapon" && i.system.equipStatus > 1,
            );
            let range = [];
            for (const [, weapon] of weapons.entries()) {
              let weaponObject = {
                range: DEFAULT_WEAPON_RANGE,
                color: undefined,
                weapon: weapon.id,
              };
              let reach;
              if (weapon.system.notes.toLowerCase().includes("reach")) {
                reach = parseInt(
                  weapon.system.notes
                    .match(/reach\W*\d?/i)[0]
                    .replace(/[^0-9]/g, ""),
                );
              }
              if (weapon.system.range) {
                weaponObject.range = parseInt(weapon.system.range.match(/\d*/));
                range.push(weaponObject);
              } else {
                reach
                  ? (weaponObject.range = reach + DEFAULT_WEAPON_RANGE)
                  : (weaponObject.range = DEFAULT_WEAPON_RANGE);
                range.push(weaponObject);
              }
            }
            range.sort((a, b) => {
              return a.range - b.range;
            });
            range.forEach((weapon, index) => {
              weapon.color = colors[index % colors.length];
            });
            return range;
          }
          default: {
            const buttons = Object.fromEntries(
              getWeaponRanges().map((i) => [
                i,
                {
                  label: i,
                  callback: async (html) => {
                    const updateActor = html.find("[name=update-actor]")[0]
                      ?.checked;
                    await this.setWeaponRange(i, updateActor);
                  },
                },
              ]),
            );
            const submitButton = {
              icon: '<i class="fas fa-check"></i>',
              callback: async (html) => {
                const updateActor = html.find("[name=update-actor]")[0]
                  ?.checked;
                const weaponRange = html.find("[name=weapon-range]")[0]?.value;
                await this.setWeaponRange(weaponRange, updateActor);
              },
            };
            buttons.submit = submitButton;
            const content = [];
            if (game.user.isGM) {
              content.push(
                `<p>${game.i18n.localize(
                  `${MODULE_ID}.quick-settings.update-actor-checkbox`,
                )}</p> <input name="update-actor" type="checkbox"/>`,
              );
            }
            let inputWeaponRange;
            if (!this.getFlag(FLAG_NAMES.WEAPON_RANGE)) {
              inputWeaponRange = "";
            } else {
              inputWeaponRange = this.getFlag(FLAG_NAMES.WEAPON_RANGE);
            }
            content.push(
              `<p>${game.i18n.localize(
                `${MODULE_ID}.quick-settings.weapon-range-header`,
              )} <input name="weapon-range" type="text" value="${inputWeaponRange}" size="3" style="width: 40px" maxlength="3"/></p>`,
            );
            await Dialog.wait(
              {
                title: game.i18n.localize(`${MODULE_ID}.quick-settings.title`),
                content: content.join("\n"),
                buttons,
              },
              { id: "croQuickSettingsDialog" },
            );
            let range = [
              {
                range: this.getFlag(FLAG_NAMES.WEAPON_RANGE),
                color: cro.colors[0],
              },
            ];
            return range;
          }
        }
    })();
  }

  /**
   * An override for the speed, stored as a flag
   * @type {number}
   */
  get speedOverride() {
    return this.getFlag(FLAG_NAMES.SPEED_OVERRIDE);
  }

  /**
   * Should difficult terrain be ignored, stored as a flag
   * @type {boolean}
   */
  get isIgnoreDifficultTerrain() {
    return this.getFlag(FLAG_NAMES.IGNORE_DIFFICULT_TERRAIN);
  }

  /**
   * Set a flag in this module's namespace
   * @param {FLAG_NAMES} flagName - The name of the flag
   * @param {*} newValue - The value to set
   * @param {boolean} updateActor - Whether the corresponding actor should have it's flag set instead
   */
  async setFlag(flagName, newValue, updateActor) {
    debugLog("setFlag", flagName, newValue, updateActor);

    // Somehow unlinked tokens get their own copies of actors (they even share IDs) but which have their own flags
    const baseActor = game.actors.get(this.token.actor.id);

    if (updateActor) {
      await this.token.document.unsetFlag(MODULE_ID, flagName);
      await baseActor.setFlag(MODULE_ID, flagName, newValue);
    } else {
      await this.token.document.setFlag(MODULE_ID, flagName, newValue);
    }
  }

  /**
   * Set the weapon range for a token
   * @param {number} range - The range to set
   * @param {boolean} [updateActor] - Whether the corresponding actor should have it's flag set instead
   */
  async setWeaponRange(range, updateActor = false) {
    await this.setFlag(FLAG_NAMES.WEAPON_RANGE, range, updateActor);
  }

  /**
   * Set the speed for a token
   * @param {number} speed - The speed to set
   * @param {boolean} [updateActor] - Whether the corresponding actor should have it's flag set instead
   */
  async setSpeedOverride(speed, updateActor = false) {
    await this.setFlag(FLAG_NAMES.SPEED_OVERRIDE, speed, updateActor);
  }

  /**
   * Set whether a token should ignore difficult terrain
   * @param {boolean} isIgnore - Whether this token should ignore difficult terrain
   * @param {boolean} [updateActor] - Whether the corresponding actor should have it's flag set instead
   */
  async setIgnoreDifficultTerrain(isIgnore, updateActor = false) {
    await this.setFlag(
      FLAG_NAMES.IGNORE_DIFFICULT_TERRAIN,
      isIgnore,
      updateActor,
    );
  }

  /**
   * Set the speed as if there were no terrain at the token's location
   * @param {number} speed - The speed to set
   * @param {boolean} [updateActor] - Whether the corresponding actor should have it's flag set instead
   */
  async setUnmodifiedSpeed(speed, updateActor = false) {
    await this.setFlag(FLAG_NAMES.UNMODIFIED_SPEED, speed, updateActor);
  }

  /**
   * The speed as if no terrain were present
   * Needed as terrains are applied as effects which modify speed
   * @type {number}
   */
  get unmodifiedSpeed() {
    return this.getFlag(FLAG_NAMES.UNMODIFIED_SPEED);
  }

  /**
   * Whether the set speed prompt has been dismissed in the case that speed couldn't be auto-detected
   * @type {boolean}
   */
  get ignoreSetSpeed() {
    return this.getFlag(FLAG_NAMES.IGNORE_SET_SPEED);
  }

  /**
   * Set whether the set speed prompt has been dismissed
   * @param {boolean} ignore - True if the set speed prompt has been dismissed
   * @param {boolean} [updateActor] - Whether the corresponding actor should have it's flag set instead
   */
  async setIgnoreSetSpeed(ignore, updateActor = false) {
    await this.setFlag(FLAG_NAMES.IGNORE_SET_SPEED, ignore, updateActor);
  }

  /**
   * Set the whole speed object, including non-land speeds, as if there were no terrain present. Used only with Terrain Mapper >= 0.3.0
   * @param {object} speedObject - The speed object to set
   * @param {boolean} [updateActor] - Whether the corresponding actor should have it's flag set instead
   */
  async setSpeedObject(speedObject, updateActor = false) {
    await this.setFlag(FLAG_NAMES.SPEED_OBJECT, speedObject, updateActor);
  }

  /**
   * The speed object as if no terrain were present
   * @type {object}
   */
  get speedObject() {
    return this.getFlag(FLAG_NAMES.SPEED_OBJECT);
  }

  /**
   * Get the speed of a token directly from its attributes, not ignoring terrain effects
   * @param {Token} token - The token to get the speed of
   * @returns {number} - The speed
   */
  getSpeed(token) {
    if (this.speedOverride) {
      return this.speedOverride;
    } else if (Settings.getSpeedAttrPath()) {
      // noinspection JSCheckFunctionSignatures,JSUnresolvedVariable
      return foundry.utils.getProperty(
        token.actor,
        Settings.getSpeedAttrPath(),
      );
    } else {
      return this.getSpeedFromAttributes();
    }
  }

  /**
   * Get the real base speed
   * Only different from getSpeed(token) if Terrain Mapper is used
   * @type {number} - The real base speed
   */
  get speed() {
    const actor = this.token.actor;
    if (!actor) {
      throw "Tried to call speed getter with an undefined actor";
    }

    if (cro.terrainProvider?.id === "terrainmapper") {
      if (this.getSpeed(this.token) === 0) {
        return 0;
      } else {
        return this.unmodifiedSpeed;
      }
    } else {
      return this.getSpeed(this.token);
    }
  }

  /**
   * @typedef {object} SpeedConfig
   * @property {object} [object] - An optional object to get the speed from
   * @property {boolean} [includeOtherSpeeds] - Whether we want all speeds (true), or only the highest (false)
   */
  /**
   * Get the speed from the current TokenInfo, if no options are provided, or from a provided object
   * Options are only used if Terrain Mapper >= 0.3.0
   * @param {SpeedConfig} [param0] - Options: object is the object to get speed from, includeOtherSpeeds is whether the whole speed object is wanted (true) or just the max speed (false)
   * @returns {number|object|undefined} - The speed derived from attributes or the entire speed object
   */
  getSpeedFromAttributes({
    object = undefined,
    includeOtherSpeeds = false,
  } = {}) {
    const actor = object ?? this.token.actor;
    const actorAttrs = actor.system.attributes;

    // 0 > null == true, but need to check if speed set
    let speed = null;
    let otherSpeeds = [];
    switch (game.system.id) {
      case "pf1":
      case "D35E": {
        otherSpeeds = Object.values(actorAttrs.speed).map((s) => s.total);
        if (includeOtherSpeeds) {
          otherSpeeds = actorAttrs.speed;
        }
        break;
      }
      case "pf2e": {
        speed = actorAttrs.speed?.total;
        otherSpeeds = actorAttrs.speed?.otherSpeeds?.map((s) => s.total);
        if (includeOtherSpeeds) {
          speed = null;
          otherSpeeds = actorAttrs.speed;
        }
        break;
      }
      case "dnd5e": {
        otherSpeeds = Object.values(actorAttrs.movement).filter(
          (s) => typeof s === "number",
        );
        if (includeOtherSpeeds) {
          otherSpeeds = actorAttrs.movement;
        }
        break;
      }
      case "swade": {
        speed = actor.system.stats.speed.value;
        break;
      }
      case "wfrp4e": {
        speed = actor.system.details.move.value;
        break;
      }
      default: {
        if (this.ignoreSetSpeed) return;
        const inputSpeedOverride = this.speedOverride ?? "";
        const content = [];
        if (game.user.isGM) {
          content.push(
            `<p>${game.i18n.localize(
              `${MODULE_ID}.quick-settings.update-actor-checkbox`,
            )}</p> <input name="update-actor" type="checkbox"/>`,
          );
        }
        content.push(
          `<p>${game.i18n.localize(
            `${MODULE_ID}.quick-settings.speed-override`,
          )} <input name="speed-override" type="text" value="${inputSpeedOverride}" size="3" style="width: 40px" maxlength="3"/>`,
        );
        if (!cro.waitingForDialog) {
          cro.waitingForDialog = true;
          Dialog.wait(
            {
              title: game.i18n.localize(`${MODULE_ID}.quick-settings.title`),
              content: content.join("\n"),
              buttons: {
                one: {
                  icon: '<i class="fas fa-check"></i>',
                  label: game.i18n.localize(`${MODULE_ID}.dialog.submit`),
                  callback: async (html) => {
                    const updateActor = html.find("[name=update-actor]")[0]
                      ?.checked;
                    const speedOverride = html.find("[name=speed-override]")[0]
                      ?.value;
                    await this.setSpeedOverride(speedOverride, updateActor);
                    cro.waitingForDialog = false;
                  },
                },
                two: {
                  icon: '<i class="fas fa-times"></i>',
                  label: game.i18n.localize(`${MODULE_ID}.dialog.not-again`),
                  callback: async (html) => {
                    const updateActor = html.find("[name=update-actor]")[0]
                      ?.checked;
                    await this.setIgnoreSetSpeed(true, updateActor);
                    cro.waitingForDialog = false;
                  },
                },
              },
              close: () => {
                cro.waitingForDialog = false;
                return true;
              },
            },
            { id: "croQuickSettingsDialog" },
          );
        }
        return this.speedOverride;
      }
    }

    if (includeOtherSpeeds) {
      return speed === null ? otherSpeeds : speed;
    }

    otherSpeeds?.forEach((otherSpeed) => {
      if (otherSpeed > speed) {
        speed = otherSpeed;
      }
    });

    if (speed === null) speed = 0;
    debugLog("getSpeedFromAttributes()", game.system.id, otherSpeeds, speed);

    return speed;
  }
}

/**
 * Update the point to measure from for a specific token
 * @param {Token} token - The token to update
 * @param {LocationUpdate} [updateData] - The updated position
 */
function updateMeasureFrom(token, updateData) {
  const tokenId = token.id;
  const tokenInfo = TokenInfo.getById(tokenId);
  tokenInfo.updateMeasureFrom(updateData);
}

/**
 * Update the location of a specific token in its TokenInfo
 * @param {Token} token - The token to update
 * @param {LocationUpdate} [updateData] - The updated position
 */
function updateLocation(token, updateData) {
  const tokenId = token.id;
  const tokenInfo = TokenInfo.getById(tokenId);
  tokenInfo.updateLocation(updateData);
}

/* On creating a combatant, set its measure from point to its location and refresh the overlay */
Hooks.on("createCombatant", async (combatant) => {
  const token = canvasTokensGet(combatant.token.id);
  updateMeasureFrom(token);
  cro.fullRefresh();
});

/* On deleting a combatant, set its measure from point to its location and refresh the overlay */
Hooks.on("deleteCombatant", async (combatant) => {
  const token = canvasTokensGet(combatant.token?.id);
  if (token) updateMeasureFrom(token);
  cro.fullRefresh();
});

/* On updating a combat (changing turns), update measure from locations and refresh the overlay */
Hooks.on("updateCombat", async (combat) => {
  if (combat?.previous?.tokenId && !Settings.updatePositionInCombat()) {
    const tokens = [
      canvasTokensGet(combat.previous.tokenId),
      canvasTokensGet(combat.current.tokenId),
    ];
    tokens.forEach((token) => updateMeasureFrom(token));
    cro.fullRefresh();
  }
});

/* On updating a token, check if it has moved, had its vision changed or changed what terrain it's in. If any change, refresh the overlay */
Hooks.on("updateToken", async (tokenDocument, updateData, opts) => {
  const tokenId = tokenDocument.id;
  const realToken = canvasTokensGet(tokenId); // Get the real token
  if (
    !realToken ||
    !Settings.getSupportedActors().includes(realToken.actor.type)
  )
    return;
  updateLocation(realToken, updateData);
  if (!realToken.inCombat || Settings.updatePositionInCombat()) {
    updateMeasureFrom(realToken, updateData);
  }

  const translation = !!updateData.x || !!updateData.y;
  if (translation) cro.instance.tokenPositionChanged = true;
  let visionRefresh;
  if (translation && game.user.targets.size) {
    const targetBlocked = new Map();
    const newCenter = {
      centerPt:
        parseInt(game.version) > 11
          ? {
              x: updateData.x
                ? realToken.center.x + updateData.x - realToken.x
                : realToken.center.x,
              y: updateData.y
                ? realToken.center.y + updateData.y - realToken.y
                : realToken.center.y,
            }
          : realToken.center,
    };
    game.user.targets.forEach((target) => {
      const blocked = !checkTileToTokenVisibility(newCenter, target);
      targetBlocked.set(target.id, blocked);
    });
    targetBlocked.forEach((blocked, id) => {
      visionRefresh =
        visionRefresh || cro.targetVisionMap.get(id).new === blocked;
    });
  }

  const currentRegions = updateData._regions;
  const previousRegions = opts._priorRegions?.tokenId;
  let terrainChanged;
  if (currentRegions)
    terrainChanged =
      !currentRegions?.every((regionId) =>
        previousRegions?.includes(regionId),
      ) ||
      !previousRegions?.every((regionId) => currentRegions?.includes(regionId));
  if (
    !terrainChanged &&
    translation &&
    (!visionRefresh ||
      Settings.getVisionMaskType() === Settings.visionMaskingTypes.NONE ||
      !realToken.vision?.los)
  )
    cro.fullRefresh();
});

/**
 * Update the unmodified speed of a given token then refresh the overlay
 * Only needed if Terrain Mapper used
 * @param {Token} token - The token to update
 */
async function updateUnmodifiedSpeed(token) {
  let speed;
  let speedObject;
  try {
    // Terrain Mapper =< 0.2.0 not using regions
    speed =
      GridTile.costTerrainMapper(token, token.center) *
      TokenInfo.current.getSpeed(token);
  } catch {
    // Terrain Mapper >= 0.3.0 using regions
    if (
      cro.terrainProvider?.id === "terrainmapper" &&
      cro.terrainProvider?.usesRegions
    ) {
      if (TokenInfo.current.getSpeed(token) === 0) {
        await TokenInfo.current.setUnmodifiedSpeed(0);
        return;
      }
      // Clone the actor
      let clone = token.actor.clone();
      // Remove terrain effects
      clone.effects.forEach((value) => {
        if (value.flags?.terrainmapper?.uniqueEffectType === "Terrain")
          clone.effects.delete(value.id);
      });
      // Recalculate speeds
      clone.reset();
      speed = TokenInfo.current.getSpeedFromAttributes({ object: clone });
      speedObject = TokenInfo.current.getSpeedFromAttributes({
        object: clone,
        includeOtherSpeeds: true,
      });
      clone = null;
    } else return; // Terrain Mapper not used
  }
  // Terrain Mapper >= 0.3.0
  if (speedObject) {
    await TokenInfo.current.setSpeedObject(speedObject);
  }
  if (speed === TokenInfo.current?.unmodifiedSpeed || isNaN(speed)) {
    // Speed has not been changed since last set or the token is in an impassable space
  } else {
    await TokenInfo.current?.setUnmodifiedSpeed(speed);
    cro.fullRefresh();
  }
}

/* On controlling a token, update its TokenInfo with its position, measure from point and speeds; then refresh the overlay */
Hooks.on("controlToken", async (token, boolFlag) => {
  if (!Settings.getSupportedActors().includes(token.actor.type)) return;
  // If the modules is not initialized, release the token and set to retake control after it has been fully initialized
  if (!cro.initialized && boolFlag) {
    token.release();
    const hookId = Hooks.on("refreshToken", (refreshToken) => {
      if (token.id === refreshToken.id) {
        Hooks.off("refreshToken", hookId);
        Hooks.once("sightRefresh", () => token.control());
      }
    });
    return;
  }
  // Releasing a token so clear the overlay
  if (!TokenInfo.current || !boolFlag) {
    cro.targetVisionMap.clear();
    cro.instance.clearAll();
    return;
  }
  cro.instance.tokenPositionChanged = false;
  cro.setTargetVisibility();
  updateMeasureFrom(token);
  const speed = TokenInfo.current?.speed;
  if (
    !speed &&
    TokenInfo.current?.getSpeedFromAttributes() === undefined &&
    TokenInfo.current.ignoreSetSpeed !== true
  ) {
    if (game.user.isGM) {
      uiNotificationsWarn(
        game.i18n.localize(`${MODULE_ID}.token-speed-warning-gm`),
      );
    } else {
      uiNotificationsWarn(
        game.i18n.localize(`${MODULE_ID}.token-speed-warning-player`),
      );
    }
  }
  await updateUnmodifiedSpeed(token);
  if (!token.vision?.los || cro.instance.tokenLayerJustActivated) {
    Hooks.once("sightRefresh", () => {
      Hooks.once("refreshToken", async () => cro.fullRefresh());
      token.refresh();
    });
    return;
  }
  if (cro?.initialized) cro.fullRefresh();
});

/* On updating an actor (changing its speeds), update its TokenInfo */
Hooks.on("updateActor", async (actor) => {
  const token = canvas.tokens.controlled.filter(
    (token) => token.actor === actor,
  )[0];
  if (
    !token ||
    !Settings.getSupportedActors().includes(token.actor.type) ||
    cro.terrainProvider?.id !== "terrainmapper"
  )
    return;
  await updateUnmodifiedSpeed(token);
});

/**
 * Update the current token when it has an effect added, updated or deleted then refresh the overlay
 * @param {Item|ActiveEffect} effect - The effect being added
 */
async function updateUnmodifiedSpeedOnEffect(effect) {
  const token = getCurrentToken();
  if (token && effect.flags?.terrainmapper?.uniqueEffectType !== "Terrain")
    await updateUnmodifiedSpeed(token);
  cro.fullRefresh();
}

/* On adding, updating or deleting an effect or weapon, update the token and refresht the overlay */
Hooks.on(
  "createActiveEffect",
  async (effect) => await updateUnmodifiedSpeedOnEffect(effect),
);
Hooks.on(
  "updateActiveEffect",
  async (effect) => await updateUnmodifiedSpeedOnEffect(effect),
);
Hooks.on(
  "deleteActiveEffect",
  async (effect) => await updateUnmodifiedSpeedOnEffect(effect),
);
Hooks.on(
  "createItem",
  async (effect) => await updateUnmodifiedSpeedOnEffect(effect),
);
Hooks.on("updateItem", async (effect) => {
  cro.instance.newTarget = true;
  await updateUnmodifiedSpeedOnEffect(effect);
});
Hooks.on(
  "deleteItem",
  async (effect) => await updateUnmodifiedSpeedOnEffect(effect),
);

import { FLAG_NAMES, MODULE_ID } from "./constants.js"
import { canvasTokensGet, getCurrentToken, uiNotificationsWarn, getWeaponRanges } from "./utility.js"
import { debugLog } from "./debug.js"
import { getSpeedAttrPath, updatePositionInCombat, getWeaponRange } from "./settings.js"
import { GridTile } from "./gridTile.js"
import { checkTileToTokenVisibility } from "./overlay.js";

export class TokenInfo {
  static _tokenInfoMap = new Map();

  static resetMap() {
    TokenInfo._tokenInfoMap = new Map();
  }

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

  updateLocation(updateData) {
    this.location = {
      x: updateData?.x ?? this.token.x,
      y: updateData?.y ?? this.token.y
    };
  }

  updateMeasureFrom(updateData) {
    this.measureFrom = {
      x: updateData?.x ?? this.token.x,
      y: updateData?.y ?? this.token.y
    };
  }

  static get current() {
    if (getCurrentToken() !== undefined) {
      return TokenInfo.getById(getCurrentToken().id);
    } else {
      return undefined;
    }
  }

  static getById(tokenId) {
    let ti = TokenInfo._tokenInfoMap.get(tokenId);
    if (!ti) {
      ti = new TokenInfo(tokenId);
      TokenInfo._tokenInfoMap.set(tokenId, ti);
    }
    return ti;
  }

  getFlag(flagName, dflt = undefined) {
    // Somehow unlinked tokens get their own copies of actors (they even share IDs) but which have their own flags
    const baseActor = game.actors.get(this.token.actor.id);

    // Idea is being stupid - this isn't actually deprecated
    // noinspection JSDeprecatedSymbols
    return this.token.document.getFlag(MODULE_ID, flagName) ??
      baseActor.getFlag(MODULE_ID, flagName) ??
      dflt;
  }

  get weaponRangeColor() {
    return (async () => {
      const DEFAULT_WEAPON_RANGE = getWeaponRange();
      const colors = globalThis.combatRangeOverlay.colors;
      if (this.getFlag(FLAG_NAMES.WEAPON_RANGE)) {
        let range = [{
          range: this.getFlag(FLAG_NAMES.WEAPON_RANGE),
          color: globalThis.combatRangeOverlay.colors[0]
        }];
        return range
      } else switch (game.system.id) {
        case 'pf2e': {
          const weapons = this.token.actor.items.filter(i => i.type == 'weapon' && i.isEquipped);
          const baseReach = this.token.actor.system.attributes.reach.base
          let range = []
          for (const [index, weapon] of weapons.entries()) {
            let weaponObject = { range: DEFAULT_WEAPON_RANGE, color: colors[index], weapon: weapon.id };
            const hasReach = weapon.system.traits.value.includes('reach');
            if (weapon.system.traits.value.includes('combination')) {
              hasReach ? weaponObject.range = baseReach + DEFAULT_WEAPON_RANGE : weaponObject.range = DEFAULT_WEAPON_RANGE;
              range.push(weaponObject);
              range.push({ range: weapon.rangeIncrement || weapon.system.range, color: colors[index], weapon: weapon.id });
            } else if (weapon.isRanged || weapon.isThrown) {
              weaponObject.range = weapon.rangeIncrement || weapon.system.range;
              range.push(weaponObject);
            } else {
              hasReach ? weaponObject.range = baseReach + DEFAULT_WEAPON_RANGE : weaponObject.range = baseReach;
              range.push(weaponObject);
            }
          }
          return range.sort((a, b) => { a.range - b.range });
        }
        case 'dnd5e': {
          const weapons = this.token.actor.items.filter(i => i.type == 'weapon' && i.system.equipped);
          const baseReach = 5
          let range = []
          for (const [index, weapon] of weapons.entries()) {
            let weaponObject = { range: DEFAULT_WEAPON_RANGE, color: colors[index], weapon: weapon.id };
            const hasReach = weapon.system.properties.rch;
            if (weapon.system.range.value) {
              weaponObject.range = weapon.system.range.value;
              range.push(weaponObject);
            } else {
              hasReach ? weaponObject.range = baseReach + DEFAULT_WEAPON_RANGE : weaponObject.range = baseReach;
              range.push(weaponObject);
            }
          }
          return range.sort((a, b) => { a.range - b.range });
        }
        case 'D35E': {
          const weapons = this.token.actor.items.filter(i => i.type == 'weapon' && i.system.equipped);
          const baseReach = 5
          let range = []
          for (const [index, weapon] of weapons.entries()) {
            let weaponObject = { range: DEFAULT_WEAPON_RANGE, color: colors[index], weapon: weapon.id };
            const hasReach = weapon.system.properties.rch;
            if (weapon.system.weaponData.range) {
              weaponObject.range = weapon.system.weaponData.range;
              range.push(weaponObject);
            } else {
              hasReach ? weaponObject.range = baseReach + DEFAULT_WEAPON_RANGE : weaponObject.range = baseReach;
              range.push(weaponObject);
            }
          }
          return range.sort((a, b) => { a.range - b.range });
        }
        case 'pf1': {
          const weapons = this.token.actor.items.filter(i => i.type == 'weapon' && i.system.equipped);
          const baseReach = 5
          let range = []
          for (const [index, weapon] of weapons.entries()) {
            let weaponObject = { range: DEFAULT_WEAPON_RANGE, color: colors[index], weapon: weapon.id };
            const hasReach = weapon.system.properties.rch;
            const descRange = parseInt(weapon.system.description.value.match(/range<\/b> \d*/i)[0].replace(/[^0-9]/g, ''));
            if (descRange) {
              weaponObject.range = descRange;
              range.push(weaponObject);
            } else {
              hasReach ? weaponObject.range = baseReach + DEFAULT_WEAPON_RANGE : weaponObject.range = baseReach;
              range.push(weaponObject);
            }
          }
          return range.sort((a, b) => { a.range - b.range });
        }
        case 'wfrp4e': {
          const weapons = this.token.actor.itemCategories.weapon.filter(i => i.system.equipped == true);
          let range = []
          for (const [index, weapon] of weapons.entries()) {
            let weaponObject = { range: DEFAULT_WEAPON_RANGE, color: colors[index], weapon: weapon.id };
            if (weapon.system.range.value) {
              weaponObject.range = parseInt(weapon.system.range.value);
              range.push(weaponObject);
            } else {
              range.push(weaponObject);
            }
          }
          return range.sort((a, b) => { a.range - b.range });
        }
        case 'swade': {
          const weapons = this.token.actor.items.filter(i => i.type == 'weapon' && i.system.equipStatus > 1);
          let range = []
          for (const [index, weapon] of weapons.entries()) {
            let weaponObject = { range: DEFAULT_WEAPON_RANGE, color: colors[index], weapon: weapon.id };
            let reach;
            if (weapon.system.notes.toLowerCase().includes("reach")) {
              reach = parseInt(weapon.system.notes.match(/reach\W*\d?/i)[0].replace(/[^0-9]/g, ''))
            };
            if (weapon.system.range) {
              weaponObject.range = parseInt(weapon.system.range.match(/\d*/));
              range.push(weaponObject);
            } else {
              reach ? weaponObject.range = reach + DEFAULT_WEAPON_RANGE : weaponObject.range = DEFAULT_WEAPON_RANGE;
              range.push(weaponObject);
            }
          }
          return range.sort((a, b) => { a.range - b.range });
        }
        default: {
          const buttons = Object.fromEntries(getWeaponRanges().map((i) => [i, {
            label: i, callback: async (html) => {
              const updateActor = html.find("[name=update-actor]")[0]?.checked;
              await this.setWeaponRange(i, updateActor);
            }
          }]));
          const submitButton = {
            icon: '<i class="fas fa-check"></i>',
            callback: async (html) => {
              const updateActor = html.find("[name=update-actor]")[0]?.checked;
              const weaponRange = html.find("[name=weapon-range]")[0]?.value;
              await this.setWeaponRange(weaponRange, updateActor);
            }
          };
          buttons.submit = submitButton;
          const content = []
          if (game.user.isGM) {
            content.push(`<p>${game.i18n.localize(`${MODULE_ID}.quick-settings.update-actor-checkbox`)}</p> <input name="update-actor" type="checkbox"/>`);
          };
          let inputWeaponRange;
          if (!this.getFlag(FLAG_NAMES.WEAPON_RANGE)) {
            inputWeaponRange = ''
          } else {
            inputWeaponRange = this.getFlag(FLAG_NAMES.WEAPON_RANGE)
          };
          content.push(`<p>${game.i18n.localize(`${MODULE_ID}.quick-settings.weapon-range-header`)} <input name="weapon-range" type="text" value="${inputWeaponRange}" size="3" style="width: 40px" maxlength="3"/></p>`);
          await Dialog.wait({
            title: game.i18n.localize(`${MODULE_ID}.quick-settings.title`),
            content: content.join('\n'),
            buttons
          }, { id: "croQuickSettingsDialog" });
          let range = [{
            range: this.getFlag(FLAG_NAMES.WEAPON_RANGE),
            color: globalThis.combatRangeOverlay.colors[0]
          }];
          return range;
        }
      }
    })();
  }

  get speedOverride() {
    return this.getFlag(FLAG_NAMES.SPEED_OVERRIDE);
  }

  get isIgnoreDifficultTerrain() {
    return this.getFlag(FLAG_NAMES.IGNORE_DIFFICULT_TERRAIN);
  }

  async setFlag(flagName, newValue, updateActor) {
    debugLog("setFlag", flagName, newValue, updateActor);

    // Somehow unlinked tokens get their own copies of actors (they even share IDs) but which have their own flags
    const baseActor = game.actors.get(this.token.actor.id);

    // Idea is being stupid - it's looking up the deprecated versions of the methods
    if (updateActor) {
      // noinspection JSDeprecatedSymbols
      await this.token.document.unsetFlag(MODULE_ID, flagName);
      // noinspection JSDeprecatedSymbols
      await baseActor.setFlag(MODULE_ID, flagName, newValue);
    } else {
      // noinspection JSDeprecatedSymbols
      await this.token.document.setFlag(MODULE_ID, flagName, newValue);
    }
  }

  async setWeaponRange(range, updateActor = false) {
    await this.setFlag(FLAG_NAMES.WEAPON_RANGE, range, updateActor);
  }

  async setSpeedOverride(speed, updateActor = false) {
    await this.setFlag(FLAG_NAMES.SPEED_OVERRIDE, speed, updateActor);
  }

  async setIgnoreDifficultTerrain(isIgnore, updateActor = false) {
    await this.setFlag(FLAG_NAMES.IGNORE_DIFFICULT_TERRAIN, isIgnore, updateActor);
  }

  async setUnmodifiedSpeed(speed, updateActor = false) {
    await this.setFlag(FLAG_NAMES.UNMODIFIED_SPEED, speed, updateActor);
  }

  get unmodifiedSpeed() {
    return this.getFlag(FLAG_NAMES.UNMODIFIED_SPEED);
  }

  get ignoreSetSpeed() {
    return this.getFlag(FLAG_NAMES.IGNORE_SET_SPEED);
  }

  async setIgnoreSetSpeed(ignore, updateActor = false) {
    await this.setFlag(FLAG_NAMES.IGNORE_SET_SPEED, ignore, updateActor);
  }

  async setSpeedObject(speedObject, updateActor = false) {
    await this.setFlag(FLAG_NAMES.SPEED_OBJECT, speedObject, updateActor);
  }

  get speedObject() {
    return this.getFlag(FLAG_NAMES.SPEED_OBJECT);
  }

  getSpeed(token) {
    if (this.speedOverride) {
      return this.speedOverride;
    } else if (getSpeedAttrPath()) {
      // noinspection JSCheckFunctionSignatures,JSUnresolvedVariable
      return foundry.utils.getProperty(token.actor, getSpeedAttrPath());
    } else {
      return this.getSpeedFromAttributes()
    }
  }

  get speed() {
    const actor = this.token.actor;
    if (!actor) {
      throw ("Tried to call speed getter with an undefined actor");
    }

    if (globalThis.combatRangeOverlay.terrainProvider?.id === "terrainmapper") {
      if (this.getSpeed(this.token) === 0) {
        return 0
      } else {
        return this.unmodifiedSpeed
      }
    } else {
      return this.getSpeed(this.token)
    }
  }

  getSpeedFromAttributes({object=undefined, includeOtherSpeeds=false}={}) {
    const actor = object ?? this.token.actor;
    const actorAttrs = actor.system.attributes;

    // 0 > null == true, but need to check if speed set
    let speed = null;
    let otherSpeeds = [];
    switch (game.system.id) {
      case 'pf1':
      case 'D35E': {
        otherSpeeds = Object.values(actorAttrs.speed).map(s => s.total);
        if (includeOtherSpeeds) {
          otherSpeeds = actorAttrs.speed;
        }
        break;
      }
      case 'pf2e': {
        speed = actorAttrs.speed?.total;
        // noinspection JSUnresolvedVariable
        otherSpeeds = actorAttrs.speed?.otherSpeeds?.map(s => s.total);
        if (includeOtherSpeeds) {
          speed = null;
          otherSpeeds = actorAttrs.speed;
        }
        break;
      }
      case 'dnd5e': {
        otherSpeeds = Object.values(actorAttrs.movement).filter(s => typeof s === "number");
        if (includeOtherSpeeds) {
          otherSpeeds = actorAttrs.movement;
        }
        break;
      }
      case 'swade': {
        speed = actor.system.stats.speed.value;
        break;
      }
      case 'wfrp4e': {
        speed = actor.system.details.move.value;
        break;
      }
      default: {
        if (this.ignoreSetSpeed) return;
        const inputSpeedOverride = this.speedOverride ?? "";
        const content = [];
        if (game.user.isGM) {
          content.push(`<p>${game.i18n.localize(`${MODULE_ID}.quick-settings.update-actor-checkbox`)}</p> <input name="update-actor" type="checkbox"/>`);
        };
        content.push(`<p>${game.i18n.localize(`${MODULE_ID}.quick-settings.speed-override`)} <input name="speed-override" type="text" value="${inputSpeedOverride}" size="3" style="width: 40px" maxlength="3"/>`);
        let d = Dialog.wait({
          title: game.i18n.localize(`${MODULE_ID}.quick-settings.title`),
          content: content.join('\n'),
          buttons: {
            one: {
              icon: '<i class="fas fa-check"></i>',
              label: game.i18n.localize(`${MODULE_ID}.dialog.submit`),
              callback: async (html) => {
                const updateActor = html.find("[name=update-actor]")[0]?.checked;
                const speedOverride = html.find("[name=speed-override]")[0]?.value;
                await this.setSpeedOverride(speedOverride, updateActor);
              }
            },
            two: {
              icon: '<i class="fas fa-times"></i>',
              label: game.i18n.localize(`${MODULE_ID}.dialog.not-again`),
              callback: async (html) => {
                const updateActor = html.find("[name=update-actor]")[0]?.checked;
                await this.setIgnoreSetSpeed(true, updateActor);
              }
            }
          }
        }, { id: "croQuickSettingsDialog" });
        return this.speedOverride;
      }
    }

    if (includeOtherSpeeds) {
      return speed === null ? otherSpeeds : speed
    }

    otherSpeeds?.forEach(otherSpeed => {
      if (otherSpeed > speed) {
        speed = otherSpeed;
      }
    })

    if (speed === null) speed = 0;
    debugLog("getSpeedFromAttributes()", game.system.id, otherSpeeds, speed);

    return speed;
  }
}

function updateMeasureFrom(token, updateData) {
  const tokenId = token.id;
  const tokenInfo = TokenInfo.getById(tokenId);
  tokenInfo.updateMeasureFrom(updateData);
}

function updateLocation(token, updateData) {
  const tokenId = token.id;
  const tokenInfo = TokenInfo.getById(tokenId);
  tokenInfo.updateLocation(updateData);
}

// noinspection JSUnusedLocalSymbols
Hooks.on("createCombatant", async (combatant) => {
  const token = canvasTokensGet(combatant.token.id);
  updateMeasureFrom(token);
  await globalThis.combatRangeOverlay.instance.fullRefresh();
});

// noinspection JSUnusedLocalSymbols
Hooks.on("deleteCombatant", async (combatant) => {
  const token = canvasTokensGet(combatant.token?.id);
  if (token) updateMeasureFrom(token);
  await globalThis.combatRangeOverlay.instance.fullRefresh();
});


// noinspection JSUnusedLocalSymbols
Hooks.on("updateCombat", async (combat) => {
  if (combat?.previous?.tokenId && !updatePositionInCombat()) {
    const tokens = [canvasTokensGet(combat.previous.tokenId), canvasTokensGet(combat.current.tokenId)];
    tokens.forEach((token) => updateMeasureFrom(token));
    await globalThis.combatRangeOverlay.instance.fullRefresh();
  }
});

// noinspection JSUnusedLocalSymbols
Hooks.on("updateToken", async (tokenDocument, updateData, opts) => {
  const tokenId = tokenDocument.id;
  const realToken = canvasTokensGet(tokenId); // Get the real token
  if (!realToken) return;
  updateLocation(realToken, updateData);
  if (!realToken.inCombat || updatePositionInCombat()) {
    updateMeasureFrom(realToken, updateData);
  }

  const translation = updateData.x || updateData.y;
  let visionRefresh;
  if (translation && game.user.targets.size) {
    const targetBlocked = new Map();
    const newCenter = {
      w: realToken.w,
      h: realToken.h,
      center: {
        x: updateData.x ? realToken.center.x + updateData.x - realToken.x : realToken.center.x,
        y: updateData.y ? realToken.center.y + updateData.y - realToken.y : realToken.center.y
      }
    };
    game.user.targets.forEach((target) => {
      const blocked = !checkTileToTokenVisibility({centerPt: target.center}, newCenter)
      targetBlocked.set(target.id, blocked)
    })
    targetBlocked.forEach((blocked, id) => {
      visionRefresh = visionRefresh || globalThis.combatRangeOverlay.targetVisionMap.get(id).new === blocked
    });
  }

  const currentRegions = updateData._regions;
  const previousRegions = opts._priorRegions?.tokenId;
  let terrainChanged;
  if (currentRegions) terrainChanged = !currentRegions?.every((regionId) => previousRegions?.includes(regionId)) || !previousRegions?.every((regionId) => currentRegions?.includes(regionId));
  if (!terrainChanged && translation && !visionRefresh) await globalThis.combatRangeOverlay.instance.fullRefresh();
});

async function updateUnmodifiedSpeed(token) {
  let speed;
  let speedObject;
  try {
    speed = GridTile.costTerrainMapper(token, token.center) * TokenInfo.current.getSpeed(token);
  } catch {
    if (globalThis.combatRangeOverlay.terrainProvider?.id === "terrainmapper" && globalThis.combatRangeOverlay.terrainProvider?.usesRegions) {
      if (TokenInfo.current.getSpeed(token) === 0) {
        await TokenInfo.current.setUnmodifiedSpeed(0);
        return;
      }
      let clone = token.actor.clone();
      clone.effects.forEach((value) => {
        if (value.flags?.terrainmapper?.uniqueEffectType === "Terrain") clone.effects.delete(value.id)
      });
      clone.reset()
      speed = TokenInfo.current.getSpeedFromAttributes({object: clone});
      speedObject = TokenInfo.current.getSpeedFromAttributes({object: clone, includeOtherSpeeds: true})
      clone = null;
    } else return
  }
  if (speedObject) {
    await TokenInfo.current.setSpeedObject(speedObject);
  }
  if (speed === TokenInfo.current?.unmodifiedSpeed || isNaN(speed)) {
    // Speed has not been changed since last set or the token is in an impassable space
  } else {
    await TokenInfo.current?.setUnmodifiedSpeed(speed);
    await globalThis.combatRangeOverlay.instance.fullRefresh();
  }
}

Hooks.on("controlToken", async (token, boolFlag) => {
  if (!globalThis.combatRangeOverlay.initialized && boolFlag) {
    token.release();
    Hooks.once("refreshToken", () => {
      token.control();
    });
    return
  }
  if (!TokenInfo.current || !boolFlag) {
    globalThis.combatRangeOverlay.targetVisionMap.clear();
    globalThis.combatRangeOverlay.instance.clearAll();
    return;
  }
  globalThis.combatRangeOverlay.setTargetVisibility();
  updateMeasureFrom(token);
  const speed = TokenInfo.current?.speed
  if (!speed && TokenInfo.current?.getSpeedFromAttributes() === undefined && TokenInfo.current.ignoreSetSpeed !== true) {
    if (game.user.isGM) {
      uiNotificationsWarn(game.i18n.localize(`${MODULE_ID}.token-speed-warning-gm`));
    } else {
      uiNotificationsWarn(game.i18n.localize(`${MODULE_ID}.token-speed-warning-player`));
    }
  }
  await updateUnmodifiedSpeed(token);
  if (globalThis.combatRangeOverlay?.initialized) await globalThis.combatRangeOverlay.instance.fullRefresh();
})

Hooks.on("updateActor", async (actor) => {
  const token = canvas.tokens.controlled.filter((token) => token.actor === actor)[0];
  if (!token || globalThis.combatRangeOverlay.terrainProvider?.id !== "terrainmapper") return
  await updateUnmodifiedSpeed(token)
})

async function updateUnmodifiedSpeedOnEffect(effect) {
  const token = getCurrentToken();
  if (token && effect.flags?.terrainmapper?.uniqueEffectType !== "Terrain") await updateUnmodifiedSpeed(token);
  await globalThis.combatRangeOverlay.instance.fullRefresh()
}

Hooks.on("createActiveEffect", async (effect) => await updateUnmodifiedSpeedOnEffect(effect))
Hooks.on("updateActiveEffect", async (effect) => await updateUnmodifiedSpeedOnEffect(effect))
Hooks.on("deleteActiveEffect", async (effect) => await updateUnmodifiedSpeedOnEffect(effect))
Hooks.on("createItem", async (effect) => await updateUnmodifiedSpeedOnEffect(effect))
Hooks.on("updateItem", async (effect) => await updateUnmodifiedSpeedOnEffect(effect))
Hooks.on("deleteItem", async (effect) => await updateUnmodifiedSpeedOnEffect(effect))
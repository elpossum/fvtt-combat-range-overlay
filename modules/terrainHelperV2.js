/* globals
Hooks,
game,
foundry,
CONFIG,
canvas,
Region,
Token,
NestedObject
*/

import { TokenInfo } from "./tokenInfo.js";
import { ENTRY_EVENTS, ENTRY_EVENTS_COMBAT } from "./constants.js";

let Terrain;

/* On ready, get Terrain Mapper's config */
Hooks.on("ready", () => {
  Terrain = CONFIG["terrainmapper"]?.Terrain;
});

/**
 * For a given point, determine what regions it would be in.
 * @param {{x: number, y: number}} point - The point to be tested
 * @param {number} [elevation] - Elevation of the test point
 * @returns {Set<Region>} - All regions at the point
 */
function identifyRegions(point, elevation = 0) {
  const regions = new Set();
  for (const region of canvas.regions.placeables) {
    if (region.testPoint(point, elevation)) regions.add(region);
  }
  return regions;
}

/**
 * For a given region, determine what terrains a token would have if it entered the region.
 * @param {Region} region - The region to test
 * @param {boolean} [isGM] - Whether the user is a GM
 * @returns {Set<Terrain>} - All terrains belonging to that region
 */
function identifyRegionTerrains(region, isGM = game.user.isGM) {
  const events = game.combat?.started
    ? ENTRY_EVENTS.union(ENTRY_EVENTS_COMBAT)
    : ENTRY_EVENTS;
  const terrainIds = new Set();
  for (const behavior of region.document.behaviors.values()) {
    if (behavior.disabled) continue;
    if (
      !(
        behavior.type === "terrainmapper.addTerrain" ||
        behavior.type === "terrainmapper.setTerrain"
      )
    )
      continue;
    if (
      behavior.type === "terrainmapper.addTerrain" &&
      !behavior.system.events.intersects(events)
    )
      continue;
    if (!isGM && behavior.system.secret) continue;
    behavior.system.terrains.forEach((t) => terrainIds.add(t));
  }
  return new Set(
    [...terrainIds]
      .map((id) => Terrain._instances.get(id))
      .filter((t) => Boolean(t)),
  );
}

/**
 * For a given point, determine what terrains are visible to the user there.
 * @param {{x: number, y: number}} point - The point to test
 * @param {number} [elevation] - Elevation of the point
 * @returns {Set<Terrain>} - All terrains at the point
 */
function getTerrainsAt(point, elevation = 0) {
  // Test for regions with terrains.
  const terrains = new Set();
  for (const region of identifyRegions(point, elevation))
    identifyRegionTerrains(region).forEach((t) => terrains.add(t));
  /* let userTerrains = new Set()
  if ( terrains.size ) {
      // Limit to visible terrains for the user. No purpose for now as userVisible not set on terrains.
      userTerrains = game.user.isGM ? terrains : terrains.filter(t => t.userVisible);
  } */
  return terrains;
}

/**
 * Creates a nested object from a given path in dot notation and a value to set for the final property
 * @param {string} string - The path for the object in dot notation
 * @param {*} value - The value to set for the final property in the path
 * @returns {NestedObject} - An object of the type {property1: {property2: {property3: {...propertyFinal: value}...}}}
 * @example
 * //returns {system: {attributes: {movement: {walk: 30}}}}
 * createNestedObject("system.attributes.movement.walk", 30)
 */
function createNestedObject(string, value) {
  const pathArray = string.split(".");
  pathArray.push(value);
  const updateObj = {};
  pathArray.reduce((previous, current, index) => {
    if (previous === current) return;
    else
      return (
        previous[current] ||
        (index === pathArray.length - 2
          ? (previous[current] = pathArray.at(-1))
          : (previous[current] = {}))
      );
  }, updateObj);
  return updateObj;
}

/**
 * Calculates the cost of moving for given token if it were at a given point
 * @param {Token} token - The token to test
 * @param {{x: number, y: number}} point The point to test
 * @param {number} [elevation] - Elevation of the point
 * @returns {number} - The cost of moving at a point
 */
export function calculateCostAtPoint(token, point, elevation = 0) {
  //Get token info and terrains at point
  const tokenInfo = TokenInfo.getById(token.id);
  const tokenSpeed = tokenInfo.unmodifiedSpeed;
  if (tokenSpeed === 0) return Infinity;
  const pointTerrains = getTerrainsAt(point, elevation);
  const speedObject = foundry.utils.deepClone(tokenInfo.speedObject);

  //Create clone of actor as if there were no terrains
  const actor = token.actor;
  const actorType = actor.type;
  let clone = { type: actorType, system: { attributes: {} } };
  switch (game.system.id) {
    case "pf1":
    case "D35E":
      clone.system.attributes.speed = speedObject;
      break;
    case "dnd5e":
      clone.system.attributes.movement = speedObject;
      break;
    case "pf2e":
      clone.system.attributes.speed = speedObject;
      clone.system.attributes.speed.otherSpeeds.forEach((speed) => {
        Object.defineProperty(speed, "total", {
          get() {
            return this.value + this.totalModifier;
          },
        });
      });
      break;
  }

  //Apply terrains to clone
  if (game.system.id === "pf2e") {
    pointTerrains.forEach((terrain) => {
      const rules = terrain.document.system.rules;
      rules.forEach((rule) => {
        switch (rule.key) {
          case "FlatModifier": {
            const path = rule.selector.split("-");
            switch (path[0].toLowerCase()) {
              case "land": {
                clone.system.attributes.speed.total = Math.max(
                  clone.system.attributes.speed.total + rule.value,
                  0,
                );
                break;
              }
              case "all":
              case "speed": {
                clone.system.attributes.speed.total = Math.max(
                  clone.system.attributes.speed.total + rule.value,
                  0,
                );
                clone.system.attributes.speed.otherSpeeds.forEach((speed) => {
                  speed.value = Math.max(speed.value + rule.value, 0);
                });
                break;
              }
              default:
                clone.system.attributes.speed.otherSpeeds.forEach((speed) => {
                  if (speed.type === path[0].toLowerCase())
                    speed.value = Math.max(speed.value + rule.value, 0);
                });
                break;
            }
            break;
          }
          case "ActiveEffectLike": {
            const pathArray = rule.path.split(".");
            let speed = foundry.utils.getProperty(clone, rule.path);
            if (speed === undefined) break;
            switch (rule.mode.toLowerCase()) {
              case "add":
              case "subtract": {
                speed += rule.value;
                break;
              }
              case "multiply": {
                speed *= rule.value;
                break;
              }
              case "divide": {
                speed /= rule.value;
                break;
              }
              case "custom":
              case "override": {
                speed = rule.value;
              }
            }
            if (["speed", "all"].includes(pathArray.at(-2))) {
              clone.system.attributes.speed.total = Math.max(speed, 0);
            } else {
              clone.system.attributes.speed.otherSpeeds[
                pathArray.at(-2)
              ].value = Math.max(speed, 0);
            }
            break;
          }
          case "BaseSpeed": {
            const path = rule.selector.split("-");
            if (path[0].toLowerCase() === "land") {
              clone.system.attributes.speed.total = rule.value;
            } else {
              let present = false;
              clone.system.attributes.speed.otherSpeeds.forEach((speed) => {
                if (speed.type === path[0].toLowerCase()) {
                  speed.value = Math.max(rule.value, 0);
                  present = true;
                }
              });
              if (!present)
                clone.system.attributes.speed.otherSpeeds.push({
                  total: Math.max(rule.value, 0),
                  type: path[0],
                });
            }
            break;
          }
        }
      });
    });
  } else {
    pointTerrains.forEach((terrain) => {
      const ae = terrain.activeEffect;
      ae.changes.forEach((change) => {
        const update = terrain.applyEffectTemporarily(clone, change);
        const path = Object.keys(update)[0];
        const valueToSet = Object.values(update)[0];
        const updateObj = createNestedObject(path, valueToSet);
        foundry.utils.mergeObject(clone, updateObj);
      });
    });
  }

  //Return cost
  let pointSpeed = tokenInfo.getSpeedFromAttributes({ object: clone });

  if (!pointSpeed) pointSpeed = 0;
  return tokenSpeed / pointSpeed;
}

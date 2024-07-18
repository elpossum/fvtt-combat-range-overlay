/* globals
canvas,
PIXI,
FullCanvasObjectMixin,
game,
Token
*/

import {TokenInfo} from "./tokenInfo.js";
import {cro} from "./main.js";
import {TerrainLayerShader} from "./terrainMapper/glsl/TerrainLayerShader.js";
import {TerrainQuadMesh} from "./terrainMapper/glsl/TerrainQuadMesh.js";

export let TerrainHelper;

/**
 * Setup terrain if Terrain Mapper < 0.3.0
 */
export async function setup() {
  /**
   * TerrainHelper class
   */
  TerrainHelper = class TerrainHelper {
    /**
     * Determine the cost of moving at a point
     * @param {Token} token - The token to check cost for
     * @param {PIXI.Point|{x: number, y: number}} origin - THe point to test
     * @returns {number} - The cost of the terrain
     */
    static percentMovementForTokenAlongPath(token, origin) {
      if (!(origin instanceof PIXI.Point))
        origin = new PIXI.Point(origin.x, origin.y);

      const activeTerrains = canvas.terrain.activeTerrainsAt(
        origin,
        token.elevationE,
      );
      const percent = activeTerrains
        .map(
          (t) =>
            (t.movementSpeedForToken(token) ?? 1) /
            TokenInfo.current.getSpeed(token),
        )
        .reduce((acc, curr) => acc * curr, 1);
      return percent;
    }

    /**
     * Update the terrain graphics when terrain updated
     */
    static sceneUpdate() {
      cro.terrainGraphics.removeChildren();
      const nLayers = canvas.terrain.constructor.MAX_LAYERS;
      const blendMode = game.version < 12 ? 2 : 1;
      for (let i = 0; i < nLayers; i += 1) {
        const shader = TerrainLayerShader.create();
        const m = cro.terrainGraphics.addChild(
          new TerrainQuadMesh(canvas.dimensions.sceneRect, shader),
        );
        m.shader.uniforms.uTerrainLayer = i;
        m.blendMode = blendMode;
      }
    }
  };

  /* Make a canvas sized PIXI Container */
  cro.terrainGraphics =
    new (class FullCanvasContainer extends FullCanvasObjectMixin(
      PIXI.Container,
    ) {})();
  const timeout = setTimeout(() => {
    TerrainHelper.sceneUpdate();
    clearTimeout(timeout);
  }, 1000);
}

/*
  Based on terrain mapper code sourced from https://github.com/caewok/fvtt-terrain-mapper 
  License at ./terrainMapper/LICENSE
 */

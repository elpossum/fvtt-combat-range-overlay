/* globals
canvas,
PIXI,
ui,
FullCanvasObjectMixin,
game,
Token
*/

import {MODULE_ID} from "./constants.js";
import {TokenInfo} from "./tokenInfo.js";
import { cro } from "./main.js";

export let TerrainHelper;

/**
 * Setup terrain if Terrain Mapper >= 0.3.0
 */
export async function setup() {
  try {
    const terrainMapper = await import(
      "../../terrainmapper/scripts/Terrain.js"
    );
    const terrainLayerShader = await import(
      "../../terrainmapper/scripts/glsl/TerrainLayerShader.js"
    );
    const terrainQuadMesh = await import(
      "../../terrainmapper/scripts/glsl/TerrainQuadMesh.js"
    );

    /**
     * Extends Terrain Mapper's Terrain class
     */
    TerrainHelper = class TerrainHelper extends terrainMapper.Terrain {
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
          const shader = terrainLayerShader.TerrainLayerShader.create();
          const m = cro.terrainGraphics.addChild(
            new terrainQuadMesh.TerrainQuadMesh(
              canvas.dimensions.sceneRect,
              shader,
            ),
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
  } catch {
    ui.notifications.warn(
      game.i18n.localize(`${MODULE_ID}.terrain-mapper-misplaced`),
    );
  }
}

/* 
  Based on terrain mapper code sourced from https://github.com/caewok/fvtt-terrain-mapper and licensed as follows

  MIT License

  Copyright (c) 2020 caewok

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE. 
*/

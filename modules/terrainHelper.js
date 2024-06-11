import { TokenInfo } from "./tokenInfo.js"

export let TerrainHelper

if (await srcExists("/modules/terrainmapper/module.json")) {
  const terrainMapper = await import("../../terrainmapper/scripts/Terrain.js");
  const terrainLayerShader = await import("../../terrainmapper/scripts/glsl/TerrainLayerShader.js");
  const terrainQuadMesh = await import("../../terrainmapper/scripts/glsl/TerrainQuadMesh.js");

  TerrainHelper = class TerrainHelper extends terrainMapper.Terrain {

    static percentMovementForTokenAlongPath(token, origin) {
      if (!(origin instanceof PIXI.Point)) origin = new PIXI.Point(origin.x, origin.y);

      const activeTerrains = canvas.terrain.activeTerrainsAt(origin, token.elevationE)
      const percent = activeTerrains.map(t =>
        (t.movementSpeedForToken(token) ?? 1) / TokenInfo.current.getSpeed(token)
      ).reduce((acc, curr) => acc * curr, 1);
      return percent;
    }

    static sceneUpdate() {
      globalThis.combatRangeOverlay.terrainGraphics.removeChildren();
      const nLayers = canvas.terrain.constructor.MAX_LAYERS;
      const blendMode = game.version < 12 ? 2 : 1
      for (let i = 0; i < nLayers; i += 1) {
        const shader = terrainLayerShader.TerrainLayerShader.create();
        const m = globalThis.combatRangeOverlay.terrainGraphics.addChild(new terrainQuadMesh.TerrainQuadMesh(canvas.dimensions.sceneRect, shader));
        m.shader.uniforms.uTerrainLayer = i;
        m.blendMode = blendMode;
      }
    }
  }
} else {
  Hooks.on("ready", () => {
    if (game.modules.get('terrainmapper')?.active) {
      ui.notifications.warn('Terrain Mapper in unexpected location')
    }
  })
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
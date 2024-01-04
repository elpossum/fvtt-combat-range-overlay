import { TokenInfo } from "./tokenInfo.js"

export let TerrainHelper

if (await srcExists("/modules/terrainmapper/module.json")) {
  const terrainMapper = await import("../../terrainmapper/scripts/Terrain.js");
  const terrainTravelRay = await import("../../terrainmapper/scripts/TravelTerrainRay.js");
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
      for (let i = 0; i < nLayers; i += 1) {
        const shader = terrainLayerShader.TerrainLayerShader.create();
        const m = globalThis.combatRangeOverlay.terrainGraphics.addChild(new terrainQuadMesh.TerrainQuadMesh(canvas.dimensions.sceneRect, shader));
        m.shader.uniforms.uTerrainLayer = i;
        m.blendMode = 2;
      }
    }
  }
} else {
  Hooks.on("ready", () => {
    if (game.modules.get('terrainmapper').active) {
      ui.notifications.warn('Terrain Mapper in unexpected location')
    }
  })
}
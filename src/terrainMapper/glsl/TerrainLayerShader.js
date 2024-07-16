/* globals
canvas,
game,
PIXI,
Terrain
*/

import { AbstractTerrainShader } from "./AbstractTerrainShader.js";

const MAX_TERRAINS = 16; // Including 0 as no terrain.

/**
 * Shader to represent terrain values on the terrain layer canvas.
 */
export class TerrainLayerShader extends AbstractTerrainShader {
  /**
   * Vertex shader constructs a quad and calculates the canvas coordinate and texture coordinate varyings.
   * @type {string}
   */
  static vertexShader =
`
#version 300 es
precision ${PIXI.settings.PRECISION_VERTEX} float;

in vec2 aVertexPosition;
in vec2 aTextureCoord;

out vec2 vTextureCoord;

uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;

void main() {
  vTextureCoord = aTextureCoord;
  gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
}`;

  static fragmentShader =
`#version 300 es
precision ${PIXI.settings.PRECISION_FRAGMENT} float;
precision ${PIXI.settings.PRECISION_FRAGMENT} usampler2D;

in vec2 vVertexPosition;
in vec2 vTextureCoord;

out vec4 fragColor;

uniform sampler2D uTerrainSampler0; // Terrain Texture
uniform sampler2D uTerrainSampler1; // Terrain Texture
uniform sampler2D uTerrainIcon;
uniform vec4[${MAX_TERRAINS}] uTerrainColors;
uniform int uTerrainLayer;
// uniform uvec4[${MAX_TERRAINS}] uTerrainColors;

#ifndef TM_DECODETERRAINCHANNELS
#define TM_DECODETERRAINCHANNELS true
/**
 * Return the terrain value for a given color representation at a given layer.
 * @param {vec4} pixel    Color representation of terrain value on canvas
 * @returns {float} The terrain value, between 0 and 31.
 */
uint decodeTerrainChannels(in vec4 color, in int layer) {
  color *= 255.0;
  uvec4 channels = uvec4(color);

  uint terrain;
  switch ( layer ) {
    // First 4 bits
    case 0:
      terrain = (channels.r & 31u);
      break;
    case 1:
      terrain = (channels.g & 31u);
      break;
    case 2:
      terrain = (channels.b & 31u);
      break;

    // Second layer
    case 3:
      terrain = (channels.r & 31u);
      break;
    case 4:
      terrain = (channels.g & 31u);
      break;
    case 5:
      terrain = (channels.b & 31u);
      break;
  }

  return terrain;
}
#endif

/**
 * Determine the color for a given terrain value.
 * Currently draws increasing shades of red with a gamma correction to avoid extremely light alpha.
 */
vec4 colorForTerrain(uint terrainId) {
  // uvec4 uColor = uTerrainColors[terrainId];
  // vec4 color = vec4(uColor) / 255.0;
  vec4 color = uTerrainColors[terrainId];

  // Gamma correct alpha and colors?
  color = pow(color, vec4(1. / 2.2));

  return color;
}

void main() {
  fragColor = vec4(0.0);

  // Terrain is sized to the scene.
  vec4 terrainPixel;
  if ( uTerrainLayer < 3 ) terrainPixel = texture(uTerrainSampler0, vTextureCoord);
  else terrainPixel = texture(uTerrainSampler1, vTextureCoord);

  uint terrainId = decodeTerrainChannels(terrainPixel, uTerrainLayer);
  if ( terrainId == 0u ) return;

  // if ( terrainPixel.r == 0.0 ) fragColor = vec4(0.0);
  // else fragColor = vec4(1.0, 0.0, 0.0, 1.0);
  // ivec2 iconSize = textureSize(uTerrainIcon);
  // vec4 iconColor = texture(uTerrainIcon, vTextureCoord);
  vec4 terrainColor = colorForTerrain(terrainId);
  // fragColor = mix(terrainColor, iconColor, 0.5);
  fragColor = terrainColor;
}`;

  /**
   * Uniforms:
   * uTerrainSampler: elevation texture
   * uMinColor: Color to use at the minimum elevation: minElevation + elevationStep
   * uMaxColor: Color to use at the maximum current elevation: uMaxNormalizedElevation
   * uMaxNormalizedElevation: Maximum elevation, normalized units
   */
  static defaultUniforms = {
    uTerrainSampler0: 0,
    uTerrainSampler1: 0,
    // Unused: uTerrainColors: new Uint8Array(MAX_TERRAINS * 4).fill(0)
    uTerrainColors: new Array(MAX_TERRAINS * 4).fill(0),
    uTerrainIcon: 0,
    uTerrainLayer: 0
  };

  static create(defaultUniforms = {}) {
    const tm = canvas.terrain;
    defaultUniforms.uTerrainSampler0 = tm._terrainTextures[0];
    defaultUniforms.uTerrainSampler1 = tm._terrainTextures[1];
    const shader = super.create(defaultUniforms);
    shader.updateAllTerrainColors();
    shader.updateTerrainIcons();
    shader.updateTerrainLayer();
    return shader;
  }

  /**
   * Update the terrain icons represented in the scene.
   */
  updateTerrainIcons() {
    // TODO: Handle multiple icons.
    for ( const terrain of canvas.terrain.sceneMap.values()) {
      if ( !terrain.img ) continue;
      this.uniforms.uTerrainIcon = PIXI.Texture.from(terrain.img);
      break;
    }
  }

  /**
   * Update the terrain colors represented in the scene.
   */
  updateAllTerrainColors() {
    const colors = this.uniforms.uTerrainColors;
    colors.fill(0);
    canvas.terrain.sceneMap.forEach(t => this.updateTerrainColor(t));
  }

  /**
   * Update a single terrain's color.
   * @param {Terrain} t - The terrain to update
   */
  updateTerrainColor(t) {
    const colors = this.uniforms.uTerrainColors;
    const i = t.pixelValue;
    const idx = i * 4;
    const rgba = [...t.color.rgb, 1]
    colors.splice(idx, 4, ...rgba);
  }

  /**
   * Update the terrain layer currently represented in the scene.
   */
  updateTerrainLayer() {
    this.uniforms.uTerrainLayer = canvas.terrain?.toolbar?.currentLayer
      ?? game.modules.get("terrainmapper", "current-layer") ?? 0;
  }
}

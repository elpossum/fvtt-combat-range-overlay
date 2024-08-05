/* globals
canvas,
foundry,
game,
PIXI,
Token
*/

import { MAX_DIST, FUDGE } from "./constants.js";
import { TokenInfo } from "./tokenInfo.js";
import { TerrainHelper } from "./terrainHelper.js";
import { getTerrainMeasure } from "./settings.js";
import { canvasGridSize } from "./utility.js";
import { calculateCostAtPoint } from "./terrainHelperV2.js";
import { cro } from "./main.js";

/**
 * Calculate the vertices of a square tile
 * @param {GridTile} tile - The tile to get the vertices of
 * @returns {Array<{x: number, y: number}>} - The four vertices
 */
function squareVertices(tile) {
  const grid = canvas.grid.grid;
  const [i, j] = grid.getGridPositionFromPixels(
    tile.centerPt.x,
    tile.centerPt.y,
  );
  const x0 = j * canvasGridSize();
  const x1 = (j + 1) * canvasGridSize();
  const y0 = i * canvasGridSize();
  const y1 = (i + 1) * canvasGridSize();
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

/**
 * Calculate the vertices of a hex tile
 * @param {GridTile} tile - The tile to get the vertices of
 * @returns {Array<{x: number, y: number}>} - The six vertices
 */
function hexVertices(tile) {
  const grid = canvas.grid.grid;
  const [i, j] = grid.getGridPositionFromPixels(
    tile.centerPt.x,
    tile.centerPt.y,
  );
  const scaleX = grid.w / 4;
  const scaleY = grid.h / 4;
  if (grid.columnar) {
    const x = 3 * j;
    const x0 = x * scaleX;
    const x1 = (x + 1) * scaleX;
    const x2 = (x + 3) * scaleX;
    const x3 = (x + 4) * scaleX;
    const even = (j + 1) % 2 === 0;
    const y = 4 * i - (grid.even === even ? 2 : 0);
    const y0 = y * scaleY;
    const y1 = (y + 2) * scaleY;
    const y2 = (y + 4) * scaleY;
    return [
      { x: x0, y: y1 },
      { x: x1, y: y0 },
      { x: x2, y: y0 },
      { x: x3, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ];
  } else {
    const y = 3 * i;
    const y0 = y * scaleY;
    const y1 = (y + 1) * scaleY;
    const y2 = (y + 3) * scaleY;
    const y3 = (y + 4) * scaleY;
    const even = (i + 1) % 2 === 0;
    const x = 4 * j - (grid.even === even ? 2 : 0);
    const x0 = x * scaleX;
    const x1 = (x + 2) * scaleX;
    const x2 = (x + 4) * scaleX;
    return [
      { x: x1, y: y0 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y3 },
      { x: x0, y: y2 },
      { x: x0, y: y1 },
    ];
  }
}

/**
 * GridTile class
 */
export class GridTile {
  /**
   * Construct a new GridTile from grid coordinates
   * @param {number|undefined} gx - The grid x position
   * @param {number|undefined} gy - The grid y position
   * @param {number} [color] - The color of the tile
   */
  constructor(gx, gy, color = undefined) {
    this.gx = gx;
    this.gy = gy;
    this.color = color;
    this.distance = MAX_DIST;
    this.visited = false;
    this.upstreams = undefined;
    this._upstreamCache = undefined;
  }

  /**
   * The center point of a tile in pixel coords
   * @type {{x: number, y: number}}
   */
  get centerPt() {
    let pixels;
    if (parseInt(game.version) > 11) {
      pixels = Object.values(
        canvas.grid.getTopLeftPoint({ i: this.gx, j: this.gy }),
      );
    } else {
      pixels = canvas.grid.grid.getPixelsFromGridPosition(this.gx, this.gy);
    }
    // noinspection JSUnresolvedVariable
    return {
      x: pixels[0] + canvas.grid.size / 2,
      y: pixels[1] + canvas.grid.size / 2,
    };
  }

  /**
   * The top left point of a tile in pixel coords
   * @type {{x: number, y: number}}
   */
  get pt() {
    let pixels;
    if (parseInt(game.version) > 11) {
      pixels = Object.values(
        canvas.grid.getTopLeftPoint({ i: this.gx, j: this.gy }),
      );
    } else {
      pixels = canvas.grid.grid.getPixelsFromGridPosition(this.gx, this.gy);
    }
    return { x: pixels[0], y: pixels[1] };
  }

  /**
   * The key for this tile
   * @type {string}
   */
  get key() {
    return `${this.gx}-${this.gy}`;
  }

  /**
   * The movement cost for this tile
   * Only used if Terrain Mapper isn't
   * @type {number}
   */
  get cost() {
    if (TokenInfo.current.isIgnoreDifficultTerrain || !cro.terrainProvider) {
      return 1;
    } else {
      // noinspection JSUnresolvedVariable
      return canvas.terrain?.cost({ x: this.gy, y: this.gx }) ?? 1;
    }
  }

  /**
   * Find the cost of moving a specific token on a specific tile
   * Only used for Terrain Mapper =< 0.2.0
   * @param {Token} token - The token checking cost
   * @param {GridTile|{x: number, y: number}} neighbor - The tile to find the cost of
   * @returns {number} - The cost to move on this tile
   */
  static costTerrainMapper(token, neighbor) {
    if (TokenInfo.current.isIgnoreDifficultTerrain) {
      return 1;
    } else {
      const api = game.modules.get("terrainmapper").api;
      if (neighbor instanceof GridTile) {
        switch (getTerrainMeasure()) {
          case "centerPoint": {
            const percent = TerrainHelper.percentMovementForTokenAlongPath(
              token,
              neighbor.centerPt,
            );
            return 1 / percent;
          }
          case "fivePoint": {
            let percent = new Array(5);
            let n = 0;
            for (let i = 0; i < percent.length; i += 1) {
              percent[i] = TerrainHelper.percentMovementForTokenAlongPath(
                token,
                {
                  x:
                    neighbor.pt.x +
                    ((2 * Math.floor(i / 2) + 1) * canvasGridSize()) / 4,
                  y: neighbor.pt.y + ((2 * (i % 2) + 1) * canvasGridSize()) / 4,
                },
              );
              if (i === 4)
                percent[i] = TerrainHelper.percentMovementForTokenAlongPath(
                  token,
                  neighbor.centerPt,
                );
              if (percent[i] !== 1) n += 1;
            }
            if (n > 2) {
              return (
                1 /
                Math.pow(
                  percent.reduce((acc, curr) => acc * curr, 1),
                  0.2,
                )
              );
            } else return 1;
          }
          case "area": {
            const rect = new PIXI.Rectangle(
              neighbor.pt.x + FUDGE,
              neighbor.pt.y + FUDGE,
              canvasGridSize() - 2 * FUDGE,
              canvasGridSize() - 2 * FUDGE,
            );
            let point;
            let area = 0;
            canvas.terrain._shapeQueueArray.forEach((layer) => {
              layer.elements.forEach((shape) => {
                const intersect = rect.intersectPolygon(shape.shape);
                if (intersect.points.length > 0) {
                  point = new PIXI.Point(
                    intersect.points[0],
                    intersect.points[1],
                  );
                  area += intersect.area / rect.area;
                }
              });
            });
            if (area >= 0.5)
              return (
                1 / TerrainHelper.percentMovementForTokenAlongPath(token, point)
              );
            else return 1;
          }
        }
      } else {
        const noTerrain = api.Terrain.percentMovementForTokenAlongPath(
          token,
          { x: 0, y: 0 },
          { x: 50, y: 50 },
        );
        if (foundry.utils.isNewerVersion(cro.terrainProvider?.version, "0.1.1"))
          return 1 / noTerrain;
        else return noTerrain;
      }
    }
  }

  /**
   * Find the cost of moving a specific token on a specific tile
   * Only used for Terrain Mapper >= 0.3.0
   * @param {Token} token - The token checking cost
   * @param {GridTile} neighbor - The tile cost is being found for
   * @returns {number} - The cost to move on this tile
   */
  static costTerrainMapperV2(token, neighbor) {
    if (TokenInfo.current.isIgnoreDifficultTerrain) return 1;
    switch (getTerrainMeasure()) {
      case "centerPoint": {
        return calculateCostAtPoint(token, neighbor.centerPt);
      }
      case "fivePoint": {
        let percent = new Array(5);
        let n = 0;
        for (let i = 0; i < percent.length; i += 1) {
          percent[i] = calculateCostAtPoint(token, {
            x:
              neighbor.pt.x +
              ((2 * Math.floor(i / 2) + 1) * canvasGridSize()) / 4,
            y: neighbor.pt.y + ((2 * (i % 2) + 1) * canvasGridSize()) / 4,
          });
          if (i === 4)
            percent[i] = calculateCostAtPoint(token, neighbor.centerPt);
          if (percent[i] !== 1) n += 1;
        }
        if (n > 2) {
          return Math.pow(
            percent.reduce((acc, curr) => acc * curr, 1),
            0.2,
          );
        } else return 1;
      }
      case "area": {
        const rect = new PIXI.Rectangle(
          neighbor.pt.x + FUDGE,
          neighbor.pt.y + FUDGE,
          canvasGridSize() - 2 * FUDGE,
          canvasGridSize() - 2 * FUDGE,
        );
        let point;
        let area = 0;
        canvas.regions.placeables.forEach((region) => {
          region.polygons.forEach((shape) => {
            const intersect = rect.intersectPolygon(shape);
            if (intersect.points.length > 0) {
              point = new PIXI.Point(intersect.points[0], intersect.points[1]);
              area += intersect.area / rect.area;
            }
          });
        });
        if (area >= 0.5) return calculateCostAtPoint(token, point);
        else return 1;
      }
    }
  }

  /**
   * All tiles upstream of this one in Dijkstra's algorithm
   * @type {Map<string, GridTile>}
   */
  get allUpstreams() {
    if (this._upstreamCache === undefined) {
      this._upstreamCache = new Map();
      if (this.upstreams !== undefined) {
        for (const upstream of this.upstreams) {
          this._upstreamCache.set(upstream.key, upstream);
          for (const upstream2 of upstream.allUpstreams.values()) {
            this._upstreamCache.set(upstream2.key, upstream2);
          }
        }
      }
    }
    return this._upstreamCache;
  }

  /**
   * Construct a new GridTile at a specified point
   * @param {number} x - The x coord in pixels
   * @param {number} y - The y coord in pixels
   * @returns {GridTile} - A new GridTile at this point
   */
  static fromPixels(x, y) {
    let [gx, gy] = [undefined, undefined];
    if (parseInt(game.version) > 11) {
      [gx, gy] = Object.values(canvas.grid.getOffset({ x: x, y: y }));
    } else {
      [gx, gy] = canvas.grid.grid.getGridPositionFromPixels(x, y);
    }
    return new GridTile(gx, gy);
  }

  /**
   * Check whether a this tile is upstream of a given tile
   * @param {GridTile} tile - The tile to be checked
   * @returns {boolean} - True if this tile is upstream of the given tile
   */
  upstreamOf(tile) {
    return tile.allUpstreams.has(this.key);
  }

  /**
   * Check whether a given tile is diagonally adjacent to this tile
   * @param {GridTile} neighbor - The tile to be checked
   * @returns {boolean} - True if the given tile is diagonally adjacent to this one
   */
  isDiagonal(neighbor) {
    return this.gx !== neighbor.gx && this.gy !== neighbor.gy;
  }

  get vertices() {
    let points;
    const grid = parseInt(game.version) > 11 ? canvas.grid : canvas.grid.grid;
    const square =
      parseInt(game.version) > 11
        ? !canvas.grid.isHexagonal
        : !canvas.grid.isHex;
    if (square)
      points = grid.getVertices
        ? grid.getVertices(this.centerPt)
        : squareVertices(this);
    else
      points = grid.getVertices
        ? grid.getVertices(this.centerPt)
        : hexVertices(this);
    return points;
  }
}

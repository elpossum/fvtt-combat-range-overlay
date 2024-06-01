import { MAX_DIST, FUDGE } from "./constants.js"
import { TokenInfo } from "./tokenInfo.js"
import { TerrainHelper } from "./terrainHelper.js"
import { getTerrainMeasure } from "./settings.js"
import { canvasGridSize } from "./utility.js"

export class GridTile {
  constructor(gx, gy, color) {
    this.gx = gx;
    this.gy = gy;
    this.color = color;
    this.distance = MAX_DIST;
    this.visited = false;
    this.upstreams = undefined;
    this._upstreamCache = undefined;
  }

  get centerPt() {
    let pixels;
    if (parseInt(game.version) > 11) {
      pixels = Object.values(canvas.grid.getTopLeftPoint({ i: this.gx, j: this.gy }));
    } else {
      pixels = canvas.grid.grid.getPixelsFromGridPosition(this.gx, this.gy);
    }
    // noinspection JSUnresolvedVariable
    return { x: pixels[0] + canvas.grid.size / 2, y: pixels[1] + canvas.grid.size / 2 };
  }

  get pt() {
    let pixels;
    if (parseInt(game.version) > 11) {
      pixels = Object.values(canvas.grid.getTopLeftPoint({ i: this.gx, j: this.gy }));
    } else {
      pixels = canvas.grid.grid.getPixelsFromGridPosition(this.gx, this.gy);
    }
    return { x: pixels[0], y: pixels[1] };
  }

  get key() {
    return `${this.gx}-${this.gy}`;
  }

  get cost() {
    if (TokenInfo.current.isIgnoreDifficultTerrain) {
      return 1;
    } else {
      // noinspection JSUnresolvedVariable
      return canvas.terrain?.cost({ x: this.gy, y: this.gx }) ?? 1;
    }
  }

  static costTerrainMapper(token, neighbor) {
    if (TokenInfo.current.isIgnoreDifficultTerrain) {
      return 1;
    } else {
      const api = game.modules.get('terrainmapper').api;
      if (neighbor instanceof GridTile) {
        switch (getTerrainMeasure()) {
          case "centerPoint": {
            const percent = TerrainHelper.percentMovementForTokenAlongPath(token, neighbor.centerPt);
            return 1 / percent
          }
          case "fivePoint": {
            let percent = new Array(5);
            let n = 0
            for (let i = 0; i < percent.length; i += 1) {
              percent[i] = TerrainHelper.percentMovementForTokenAlongPath(token, { x: neighbor.pt.x + (2 * Math.floor(i / 2) + 1) * canvasGridSize() / 4, y: neighbor.pt.y + (2 * (i % 2) + 1) * canvasGridSize() / 4 });
              if (i === 4) percent[i] = TerrainHelper.percentMovementForTokenAlongPath(token, neighbor.centerPt)
              if (percent[i] !== 1) n += 1
            };
            if (n > 2) {
              return 1 / Math.pow(percent.reduce((acc, curr) => acc * curr, 1), 0.2)
            } else return 1
          }
          case "area": {
            const rect = new PIXI.Rectangle(neighbor.pt.x + FUDGE, neighbor.pt.y + FUDGE, canvasGridSize() - 2 * FUDGE, canvasGridSize() - 2 * FUDGE)
            let point;
            let area = 0;
            canvas.terrain._shapeQueueArray.forEach((layer) => {
              layer.elements.forEach((shape) => {
                const intersect = rect.intersectPolygon(shape.shape);
                if (intersect.points.length > 0) {
                  point = new PIXI.Point(intersect.points[0], intersect.points[1])
                  area += intersect.area / rect.area
                }
              })
            })
            if (area >= 0.5) return 1 / TerrainHelper.percentMovementForTokenAlongPath(token, point)
            else return 1
          }
        }
      } else {
        const noTerrain = api.Terrain.percentMovementForTokenAlongPath(token, { x: 0, y: 0 }, { x: 50, y: 50 });
        if (isNewerVersion(game.modules.get('terrainmapper').version, '0.1.1')) return 1 / noTerrain
        else return noTerrain
      }
    }
  }

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

  static fromPixels(x, y) {
    let [gx, gy] = [];
    if (parseInt(game.version) > 11) {
      [gx, gy] = Object.values(canvas.grid.getOffset({ x: x, y: y }));
    } else {
      [gx, gy] = canvas.grid.grid.getGridPositionFromPixels(x, y);
    }
    return new GridTile(gx, gy);
  }

  upstreamOf(tile) {
    return tile.allUpstreams.has(this.key);
  }

  isDiagonal(neighbor) {
    return this.gx !== neighbor.gx && this.gy !== neighbor.gy;
  }
}
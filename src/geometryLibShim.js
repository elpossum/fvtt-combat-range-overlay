/* globals
CONFIG,
Hooks,
PIXI,
game,
ClipperLib,
ClipperPoint
*/

/**
 * @typedef {object} Point - A point-like object
 * @property {number} x - The x coord
 * @property {number} y - The y coord
 */

/* Add GeometryLib functions if not present */
if (!CONFIG.GeometryLib) {
  Hooks.on("init", () => {
    Object.defineProperties(PIXI.Point.prototype, pointShim);
    Object.defineProperties(PIXI.Point, staticPointShim);
    Object.defineProperties(PIXI.Polygon.prototype, polyShim);
    Object.defineProperties(PIXI.Ellipse.prototype, ellipseShim);
  });
}

/* Add signed area for to older versions of Foundry */
Hooks.on("init", () => {
  if (parseInt(game.version) < 11)
    Object.defineProperties(PIXI.Polygon.prototype, v10Shim);
});

const polyShim = {
  iteratePoints: {
    /**
     * Iterate over the polygon's {x, y} points in order.
     * @param {object} [options] - Options
     * @param {boolean} [options.close] - If close, include the first point again.
     * @yields {PIXI.Point} PIXI.Point
     */
    value: function* ({ close = true } = {}) {
      const ln = this.points.length;
      if (ln < 2) return;

      const num = ln - (this.isClosed ? 2 : 0);
      for (let i = 0; i < num; i += 2) {
        yield new PIXI.Point(this.points[i], this.points[i + 1]);
      }

      if (close) yield new PIXI.Point(this.points[0], this.points[1]);
    },
    configurable: true,
  },

  centroid: {
    /**
     * Calculate the centroid of the polygon
     * https://en.wikipedia.org/wiki/Centroid#Of_a_polygon
     * @returns {Point} - The centroid
     */
    get: function () {
      const pts = [...this.iteratePoints({ close: true })];
      const ln = pts.length;
      switch (ln) {
        case 0:
          return undefined;
        case 1:
          return pts[0]; // Should not happen if close is true
        case 2:
          return pts[0];
        case 3:
          return PIXI.Point.midPoint(pts[0], pts[1]);
      }
      const outPoint = new PIXI.Point();
      let area = 0;
      const iter = ln - 1;
      for (let i = 0; i < iter; i += 1) {
        const iPt = pts[i];
        const jPt = pts[i + 1];
        const ijX = iPt.x + jPt.x;
        area += ijX * (iPt.y - jPt.y); // See signedArea function
        const mult = iPt.x * jPt.y - jPt.x * iPt.y;
        outPoint.x += ijX * mult;
        outPoint.y += (iPt.y + jPt.y) * mult;
      }
      area = -area * 0.5;
      const areaMult = 1 / (6 * area);
      outPoint.x *= areaMult;
      outPoint.y *= areaMult;
      return outPoint;
    },
    configurable: true,
  },

  area: {
    get: function () {
      return Math.abs(this.signedArea());
    },
    configurable: true,
  },
};

const staticPointShim = {
  midPoint: {
    /**
     * Point between two points on a line
     * @param {PIXI.Point} a - One endpoint
     * @param {PIXI.Point} b - The other endpoint
     * @returns {PIXI.Point} - The midpoint
     */
    value: function (a, b) {
      a.x ||= 0;
      a.y ||= 0;
      b.x ||= 0;
      b.y ||= 0;
      return new this(a.x + (b.x - a.x) / 2, a.y + (b.y - a.y) / 2);
    },
    configurable: true,
  },

  distanceBetween: {
    /**
     * Distance between two 2d points
     * @param {object} a - Any object with x,y properties
     * @param {object} b - Any object with x,y properties
     * @returns {number} - The linear distance
     */
    value: function (a, b) {
      const dx = b.x - a.x || 0; // In case x is undefined.
      const dy = b.y - a.y || 0;
      return Math.hypot(dx, dy);
    },
    configurable: true,
  },

  fromObject: {
    /**
     * Construct a PIXI point from any object that has x and y properties.
     * @param {object} obj - The source object
     * @returns {PIXI.Point} - A point with the corresponding x and y coords
     */
    value: function (obj) {
      const x = obj.x ?? 0;
      const y = obj.y ?? 0;
      return new this(x, y);
    },
    configurable: true,
  },
};

const pointShim = {
  key: {
    /**
     * Hashing key for a 2d point, rounded to nearest integer.
     * Ordered, so sortable.
     * @returns {number} - The key for a point
     */
    get: function () {
      const x = Math.round(this.x);
      const y = Math.round(this.y);
      return (x << 16) ^ y;
    },
    configurable: true,
  },

  add: {
    /**
     * Add a point to this one.
     * Based on https://api.pixijs.io/@pixi/math-extras/src/pointExtras.ts.html
     * @param {PIXI.Point} other - The point to add to `this`.
     * @param {PIXI.Point} [outPoint] - A point-like object in which to store the value.
     *   (Will create new point if none provided.)
     * @returns {PIXI.Point} - The resulting point
     */
    value: function (other, outPoint) {
      outPoint ??= new this.constructor();
      outPoint.x = this.x + other.x;
      outPoint.y = this.y + other.y;
      return outPoint;
    },
    configurable: true,
  },

  subtract: {
    /**
     * Subtract a point from this one.
     * Based on https://api.pixijs.io/@pixi/math-extras/src/pointExtras.ts.html
     * @param {PIXI.Point} other - The point to subtract from `this`.
     * @param {PIXI.Point} [outPoint] - A point-like object in which to store the value.
     *   (Will create new point if none provided.)
     * @returns {PIXI.Point} - The resulting point
     */
    value: function (other, outPoint) {
      outPoint ??= new this.constructor();
      outPoint.x = this.x - other.x;
      outPoint.y = this.y - other.y;

      return outPoint;
    },
    configurable: true,
  },

  multiplyScalar: {
    /**
     * Multiply `this` point by a scalar
     * Based on https://api.pixijs.io/@pixi/math-extras/src/pointExtras.ts.html
     * @param {PIXI.Point} scalar - The point to multiply `this` by.
     * @param {PIXI.Point} [outPoint] - A point-like object in which to store the value.
     *   (Will create new point if none provided.)
     * @returns {PIXI.Point} - The resulting point
     */
    value: function (scalar, outPoint) {
      outPoint ??= new this.constructor();
      outPoint.x = this.x * scalar;
      outPoint.y = this.y * scalar;
      return outPoint;
    },
    configurable: true,
  },

  magnitude: {
    /**
     * Magnitude (length, or sometimes distance) of this point.
     * Square root of the sum of squares of each component.
     * @returns {number} - The magnitude
     */
    value: function () {
      // Same as Math.sqrt(this.x * this.x + this.y * this.y)
      return Math.hypot(this.x, this.y);
    },
    configurable: true,
  },

  normalize: {
    /**
     * Normalize the point.
     * @param {PIXI.Point} [outPoint] - A point-like object in which to store the value.
     *   (Will create new point if none provided.)
     * @returns {PIXI.Point} - The normalized vector
     */
    value: function (outPoint) {
      return this.multiplyScalar(1 / this.magnitude(), outPoint);
    },
    configurable: true,
  },

  towardsPoint: {
    /**
     * Project a certain distance toward a known point.
     * @param {PIXI.Point} other - The point toward which to project
     * @param {number} distance - The distance to move from this toward other.
     * @param {PIXI.Point} outPoint - A point-like object to store the result
     *   (Will create new point if none provided.)
     * @returns {PIXI.Point} - The resulting point
     */
    value: function (other, distance, outPoint) {
      outPoint ??= new this.constructor();
      const delta = other.subtract(this, outPoint);
      const t = distance / delta.magnitude();
      this.add(delta.multiplyScalar(t, outPoint), outPoint);
      return outPoint;
    },
    configurable: true,
  },

  rotate: {
    /**
     * Rotate a point around a given angle
     * @param {number} angle - In radians
     * @param {PIXI.Point} [outPoint] - A point-like object to store the result.
     * @returns {Point} - A new point
     */
    value: function (angle, outPoint) {
      outPoint ??= new this.constructor();
      const cAngle = Math.cos(angle);
      const sAngle = Math.sin(angle);
      const { x, y } = this; // Avoid accidentally using the outPoint values when calculating new y.
      outPoint.x = x * cAngle - y * sAngle;
      outPoint.y = y * cAngle + x * sAngle;
      return outPoint;
    },
    configurable: true,
  },

  translate: {
    /**
     * Translate a point by a given dx, dy
     * @param {number} dx - The x delta
     * @param {number} dy - The y delta
     * @param {PIXI.Point} [outPoint] - A point-like object to store the result.
     * @returns {Point} - A new point
     */
    value: function (dx, dy, outPoint) {
      outPoint ??= new this.constructor();
      outPoint.x = this.x + dx;
      outPoint.y = this.y + dy;
      return outPoint;
    },
    configurable: true,
  },
};

const ellipseShim = {
  toPolygon: {
    /**
     * Convert to a polygon
     * @param {object} [options] - Options to pass to Foundry functions
     * @param {number} [options.density] - The point density to use to convert to poly
     * @returns {PIXI.Polygon} - The equivalent polygon
     */
    value: function ({ density } = {}) {
      // Default to the larger radius for density
      density ??= PIXI.Circle.approximateVertexDensity(this.major);

      // Translate to a circle to get the circle polygon
      const cirPoly = new PIXI.Circle(0, 0, this.height).toPolygon({
        density,
      });

      // Translate back to ellipse coordinates
      const cirPts = cirPoly.points;
      const ln = cirPts.length;
      const pts = Array(ln);
      for (let i = 0; i < ln; i += 2) {
        const cirPt = new PIXI.Point(cirPts[i], cirPts[i + 1]);
        const ePt = new PIXI.Point();

        this.fromCircleCoords(cirPt, ePt);
        this.toCartesianCoords(ePt, ePt);

        pts[i] = ePt.x;
        pts[i + 1] = ePt.y;
      }

      cirPoly.points = pts;
      return cirPoly;
    },
    configurable: true,
  },

  fromCircleCoords: {
    value: function (a, outPoint) {
      outPoint ??= new PIXI.Point();

      outPoint.x = a.x * this.ratio;
      outPoint.y = a.y;

      return outPoint;
    },
    configurable: true,
  },

  toCartesianCoords: {
    /**
     * Shift to cartesian coordinates from the shape space.
     * @param {Point} a - The shape coord
     * @param {PIXI.Point} [outPoint] - A point-like object to store the result.
     * @returns {Point} - The cartesian equivalent
     */
    value: function (a, outPoint) {
      outPoint ??= new PIXI.Point();
      a = PIXI.Point.fromObject(a);

      a.rotate(this.radians, outPoint).translate(this.x, this.y, outPoint);
      return outPoint;
    },
  },

  major: {
    get: function () {
      return Math.max(this.width, this.height);
    },
    configurable: true,
  },

  ratio: {
    get: function () {
      return this.width / this.height;
    },
    configurable: true,
  },
};

const v10Shim = {
  /**
   * From Foundry v12
   * Compute the signed area of polygon using an approach similar to ClipperLib.Clipper.Area.
   * The math behind this is based on the Shoelace formula. https://en.wikipedia.org/wiki/Shoelace_formula.
   * The area is positive if the orientation of the polygon is positive.
   * @returns {number} - The signed area of the polygon
   */
  signedArea: {
    value: function () {
      const points = this.points;
      const ln = points.length;
      if (ln < 6) return 0;

      // Compute area
      let area = 0;
      let x1 = points[ln - 2];
      let y1 = points[ln - 1];
      for (let i = 0; i < ln; i += 2) {
        const x2 = points[i];
        const y2 = points[i + 1];
        area += (x2 - x1) * (y2 + y1);
        x1 = x2;
        y1 = y2;
      }

      // Negate the area because in Foundry canvas, y-axis is reversed
      // See https://sourceforge.net/p/jsclipper/wiki/documentation/#clipperlibclipperorientation
      // The 1/2 comes from the Shoelace formula
      return area * -0.5;
    },
  },

  /**
   * Test whether the polygon is has a positive signed area.
   * Using a y-down axis orientation, this means that the polygon is "clockwise".
   * @type {boolean}
   */
  isPositive: {
    get: function () {
      if (this._isPositive !== undefined) return this._isPositive;
      if (this.points.length < 6) return undefined;
      return (this._isPositive = this.signedArea() > 0);
    },
  },
  _isPositive: {
    value: undefined,
    writable: true,
    enumerable: false,
  },

  /**
   * Intersect this PIXI.Polygon with an array of ClipperPoints.
   * @param {ClipperPoint[]} clipperPoints - Array of clipper points generated by PIXI.Polygon.toClipperPoints()
   * @param {object} [options] - Options which configure how the intersection is computed
   * @param {number} [options.clipType] - The clipper clip type
   * @param {number} [options.scalingFactor] - A scaling factor passed to Polygon#toClipperPoints to preserve precision
   * @returns {ClipperPoint[]} - The resulting ClipperPaths
   */
  intersectClipper: {
    value: function (clipperPoints, { clipType, scalingFactor } = {}) {
      clipType ??= ClipperLib.ClipType.ctIntersection;
      const c = new ClipperLib.Clipper();
      c.AddPath(
        this.toClipperPoints({ scalingFactor }),
        ClipperLib.PolyType.ptSubject,
        true,
      );
      c.AddPath(clipperPoints, ClipperLib.PolyType.ptClip, true);
      const solution = new ClipperLib.Paths();
      c.Execute(clipType, solution);
      return solution;
    },
  },
};

/**
 * This is from https://github.com/caewok/lib-geometry
 * @license MIT
 * Copyright (c) 2022 Michael Enion
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

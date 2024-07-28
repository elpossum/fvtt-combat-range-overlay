/* globals
CONFIG,
Hooks,
PIXI
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
  if (!PIXI.Polygon.prototype.signedArea)
    PIXI.Polygon.prototype.signedArea = signedArea;
});

const polyShim = {
  iteratePoints: {
    /**
     * Iterate over the polygon's {x, y} points in order.
     * @param {object} [options]
     * @param {boolean} [options.close]   If close, include the first point again.
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
    writable: true,
  },

  centroid: {
    /**
     * Calculate the centroid of the polygon
     * https://en.wikipedia.org/wiki/Centroid#Of_a_polygon
     * @returns {Point}
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
  },
  area: {
    get: function () {
      return Math.abs(this.signedArea());
    },
  },
};

const staticPointShim = {
  midPoint: {
    /**
     * Point between two points on a line
     * @param {PIXI.Point} a
     * @param {PIXI.Point} b
     * @returns {PIXI.Point}
     */
    value: function (a, b) {
      a.x ||= 0;
      a.y ||= 0;
      b.x ||= 0;
      b.y ||= 0;
      return new this(a.x + (b.x - a.x) / 2, a.y + (b.y - a.y) / 2);
    },
    writable: true,
  },

  distanceBetween: {
    /**
     * Distance between two 2d points
     * @param {object} a - Any object with x,y properties
     * @param {object} b - Any object with x,y properties
     * @returns {number}
     */
    value: function (a, b) {
      const dx = b.x - a.x || 0; // In case x is undefined.
      const dy = b.y - a.y || 0;
      return Math.hypot(dx, dy);
    },
    writable: true,
  },

  fromObject: {
    /**
     * Construct a PIXI point from any object that has x and y properties.
     * @param {object} obj
     * @returns {PIXI.Point}
     */
    value: function (obj) {
      const x = obj.x ?? 0;
      const y = obj.y ?? 0;
      return new this(x, y);
    },
    writable: true,
  },
};

const pointShim = {
  key: {
    /**
     * Hashing key for a 2d point, rounded to nearest integer.
     * Ordered, so sortable.
     * @returns {number}
     */
    get: function () {
      const x = Math.round(this.x);
      const y = Math.round(this.y);
      return (x << 16) ^ y;
    },
  },

  add: {
    /**
     * Add a point to this one.
     * Based on https://api.pixijs.io/@pixi/math-extras/src/pointExtras.ts.html
     * @param {PIXI.Point} other - The point to add to `this`.
     * @param {PIXI.Point} [outPoint] - A point-like object in which to store the value.
     *   (Will create new point if none provided.)
     * @returns {PIXI.Point}
     */
    value: function (other, outPoint) {
      outPoint ??= new this.constructor();
      outPoint.x = this.x + other.x;
      outPoint.y = this.y + other.y;
      return outPoint;
    },
    writable: true,
  },

  subtract: {
    /**
     * Subtract a point from this one.
     * Based on https://api.pixijs.io/@pixi/math-extras/src/pointExtras.ts.html
     * @param {PIXI.Point} other - The point to subtract from `this`.
     * @param {PIXI.Point} [outPoint] - A point-like object in which to store the value.
     *   (Will create new point if none provided.)
     * @returns {PIXI.Point}
     */
    value: function (other, outPoint) {
      outPoint ??= new this.constructor();
      outPoint.x = this.x - other.x;
      outPoint.y = this.y - other.y;

      return outPoint;
    },
    writable: true,
  },

  multiplyScalar: {
    /**
     * Multiply `this` point by a scalar
     * Based on https://api.pixijs.io/@pixi/math-extras/src/pointExtras.ts.html
     * @param {PIXI.Point} scalar - The point to multiply `this` by.
     * @param {PIXI.Point} [outPoint] - A point-like object in which to store the value.
     *   (Will create new point if none provided.)
     * @returns {PIXI.Point}
     */
    value: function (scalar, outPoint) {
      outPoint ??= new this.constructor();
      outPoint.x = this.x * scalar;
      outPoint.y = this.y * scalar;
      return outPoint;
    },
    writable: true,
  },

  magnitude: {
    /**
     * Magnitude (length, or sometimes distance) of this point.
     * Square root of the sum of squares of each component.
     * @returns {number}
     */
    value: function () {
      // Same as Math.sqrt(this.x * this.x + this.y * this.y)
      return Math.hypot(this.x, this.y);
    },
    writable: true,
  },

  normalize: {
    /**
     * Normalize the point.
     * @param {PIXI.Point} [outPoint] - A point-like object in which to store the value.
     *   (Will create new point if none provided.)
     * @returns {PIXI.Point}
     */
    value: function (outPoint) {
      return this.multiplyScalar(1 / this.magnitude(), outPoint);
    },
    writable: true,
  },

  towardsPoint: {
    /**
     * Project a certain distance toward a known point.
     * @param {PIXI.Point} other - The point toward which to project
     * @param {number} distance - The distance to move from this toward other.
     * @param {PIXI.Point} outPoint - A point-like object to store the result
     *   (Will create new point if none provided.)
     * @returns {Point3d|PIXI.Point}
     */
    value: function (other, distance, outPoint) {
      outPoint ??= new this.constructor();
      const delta = other.subtract(this, outPoint);
      const t = distance / delta.magnitude();
      this.add(delta.multiplyScalar(t, outPoint), outPoint);
      return outPoint;
    },
    writable: true,
  },

  rotate: {
    /**
     * Rotate a point around a given angle
     * @param {number} angle  In radians
     * @param {Point3d|PIXI.Point} [outPoint] A point-like object to store the result.
     * @returns {Point} A new point
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
    writable: true,
  },

  translate: {
    /**
     * Translate a point by a given dx, dy
     * @param {number} dx
     * @param {number} dy
     * @param {Point3d|PIXI.Point} [outPoint] A point-like object to store the result.
     * @returns {Point} A new point
     */
    value: function (dx, dy, outPoint) {
      outPoint ??= new this.constructor();
      outPoint.x = this.x + dx;
      outPoint.y = this.y + dy;
      return outPoint;
    },
    writable: true,
  },
};

const ellipseShim = {
  toPolygon: {
    /**
     * Convert to a polygon
     * @return {PIXI.Polygon}
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
    writable: true,
  },

  fromCircleCoords: {
    value: function (a, outPoint) {
      outPoint ??= new PIXI.Point();

      outPoint.x = a.x * this.ratio;
      outPoint.y = a.y;

      return outPoint;
    },
    writable: true,
  },

  toCartesianCoords: {
    /**
     * Shift to cartesian coordinates from the shape space.
     * @param {Point} a
     * @param {PIXI.Point} [outPoint] A point-like object to store the result.
     * @returns {Point}
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
  },

  ratio: {
    get: function () {
      return this.width / this.height;
    },
  },
};

/**
 * From Foundry v12
 * Compute the signed area of polygon using an approach similar to ClipperLib.Clipper.Area.
 * The math behind this is based on the Shoelace formula. https://en.wikipedia.org/wiki/Shoelace_formula.
 * The area is positive if the orientation of the polygon is positive.
 * @returns {number} - The signed area of the polygon
 */
function signedArea() {
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
}

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

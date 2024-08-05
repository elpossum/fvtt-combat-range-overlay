/* globals
ClockwiseSweepPolygon,
ClipperLib,
PIXI,
foundry,
Edge,
game
*/

/**
 * Derived from https://github.com/caewok/fvtt-walled-templates
 * @license MIT
 * Copyright (c) 2020 caewok
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

import * as Settings from "./settings.js";

/**
 * @typedef {object} Point
 * @property {number} x - x coord
 * @property {number} y - y coord
 */

export class SpreadingClockwiseSweepPolygon extends ClockwiseSweepPolygon {
  constructor({ origin, distance, level, color, corner }) {
    super();
    this.distance = distance;
    this.level = level ?? 0;
    this.color = color;
    this.corner = corner;
    this.initialize(origin, { type: "move", radius: distance });
    this.compute();
  }
  /**
   * "Corner" points encountered. Corners are when the sweep hits a non-limited wall
   * and must extend the sweep beyond that point.
   * @type {Point[]}
   */
  cornersEncountered = new Set();

  /**
   * "Edges" or walls encountered. Added if the wall forms part of the polygon.
   * @type {Set<Edge>}
   */
  edgesEncountered = new Set();

  /** @inheritdoc */
  _compute() {
    this.cornersEncountered.clear();
    this.edgesEncountered.clear();
    super._compute();
  }

  addPoint(point) {
    super.addPoint(point);

    // Super will skip repeated points, which really should not happen in sweep.
    // const l = this.points.length;
    // if ( (x === this.points[l-2]) && (y === this.points[l-1]) ) return this;
    if (point.isEndpoint)
      this.cornersEncountered.add(keyFromPoint(point.x, point.y));
    point.edges.forEach((edge) => this.edgesEncountered.add(edge));
  }

  /**
   * Compute the shape for this polygon spreading around corners.
   * @returns {SpreadingClockwiseSweepPolygon} - The spread shape
   */
  computeSpreadPolygon() {
    let shape = this;
    let polys;

    polys = this._recurse(new Set());
    polys.push(this);
    const shapes = combine(polys);
    shape = shapes.filter((poly) => {
      return poly.isClockwise || poly.isPositive;
    })[0];
    const holes = shapes.filter((poly) => {
      return !poly.isClockwise && !poly.isPositive;
    });

    if (shape) {
      shape.color = this.color;
      if (holes.length) shape.holes = holes;
    }
    return shape;
  }

  /**
   * For a given sweep result, re-run by drawing a circle at each wall corner,
   * shrinking the circle radius relative to the distance from this template's origin.
   * @param {Set<number>} cornerTracker - A set that can be utilized to avoid repeats in the recursion.
   * @returns {Array<SpreadingClockwiseSweepPolygon>} - Array of polygons generated.
   */
  _recurse(cornerTracker) {
    const polys = [];
    const subPolys = this._generateSubPolys(cornerTracker);

    // Subpolys may be length zero, which will cause this to return empty arrays.
    for (const subPoly of subPolys) {
      polys.push(subPoly);

      if (
        subPoly.level < Settings.getNumberOfRecursions() ||
        !Settings.getRecursionLimited()
      ) {
        const childPolys = subPoly._recurse(cornerTracker);
        polys.push(...childPolys);
      }
    }

    return polys;
  }

  /**
   * Generate a new SpreadingClockwiseSweepPolygon based on spreading from the corners present in the sweep.
   * @param {Set<number>} cornerTracker - A set that can be utilized to avoid repeats in the recursion.
   * @returns {Array<SpreadingClockwiseSweepPolygon>} - Array of polygons.
   */
  _generateSubPolys(cornerTracker) {
    const subPolys = [];
    const corners = this.cornersEncountered;

    for (const cornerKey of corners) {
      const spreadPoly = this._generateSpreadFromCorner(
        cornerKey,
        cornerTracker,
      );
      if (spreadPoly) subPolys.push(spreadPoly);
    }
    return subPolys;
  }

  /**
   * Generate a new SpreadingClockwiseSweepPolygon based on spreading from a designated corner.
   * @param {number} cornerKey - The corner as a PolygonVertex key
   * @param {Set<number>} cornerTracker - Set of corners processed
   * @returns {SpreadingClockwiseSweepPolygon|null} - The subpolygon
   */
  _generateSpreadFromCorner(cornerKey, cornerTracker) {
    const corner = pointFromKey(cornerKey);

    // If the corner is beyond movement range, ignore
    const dist = PIXI.Point.distanceBetween(this.origin, corner);
    if (this.distance < dist) return null;

    // Skip if we already created a spread at this corner.
    if (cornerTracker.has(cornerKey)) return null;
    cornerTracker.add(cornerKey);

    const edgeSet = this.edgesEncountered;
    const extendedCorner = extendCornerFromWalls(
      cornerKey,
      edgeSet,
      this.origin,
    );

    const opts = {};
    opts.color = this.color;
    opts.level = this.level + 1;
    opts.origin = extendedCorner;
    opts.distance = this.distance - dist;
    opts.corner = cornerKey;

    return new SpreadingClockwiseSweepPolygon(opts);
  }
}

const MAX_TEXTURE_SIZE = Math.pow(2, 16);

/**
 * Get a key for a point
 * @param {number} x - The x coord
 * @param {number} y - The y coord
 * @returns {number} - The point's key
 */
function keyFromPoint(x, y) {
  return MAX_TEXTURE_SIZE * x + y;
}

/**
 * Get coordinates for a point from its key
 * @param {number} cornerKey - The key for this corner
 * @returns {PIXI.Point} - The corner's coordinates
 */
function pointFromKey(cornerKey) {
  const y = cornerKey % MAX_TEXTURE_SIZE;
  const x = (cornerKey - y) / MAX_TEXTURE_SIZE;
  return new PIXI.Point(x, y);
}

/**
 * Adjust a corner point to offset from the wall by 2 pixels.
 * Offset should move in the direction of the wall.
 * If more than one wall at this corner, use the average vector between the
 * rightmost and leftmost walls on the side of the template origin.
 * @param {number} cornerKey - Key value for the corner
 * @param {Set<Edge>} edgeSet - Edges to test
 * @param {Point} origin - Origin of the poly
 * @returns {Point} - The extended point
 */
function extendCornerFromWalls(cornerKey, edgeSet, origin) {
  const CORNER_SPACER = 2;
  if (!edgeSet.size) return pointFromKey(cornerKey);

  const edges = [...edgeSet].filter((edge) =>
    parseInt(game.version) > 11
      ? edge.a.key === cornerKey || edge.b.key === cornerKey
      : edge.A.key === cornerKey || edge.B.key === cornerKey,
  );
  if (!edges.length) return pointFromKey(cornerKey); // Should not occur.

  // If only a single edge, no need to move away from it as no "inside". Except in v10
  if (edges.length === 1) {
    const edge = edges[0];
    let [cornerPt, otherPt] =
      parseInt(game.version) > 11
        ? edge.a.key === cornerKey
          ? [edge.a, edge.b]
          : [edge.b, edge.a]
        : edge.A.key === cornerKey
          ? [edge.A, edge.B]
          : [edge.B, edge.A];
    cornerPt = new PIXI.Point(cornerPt.x, cornerPt.y);
    otherPt = new PIXI.Point(otherPt.x, otherPt.y);
    const dist = PIXI.Point.distanceBetween(cornerPt, otherPt);
    return parseInt(game.version) > 10 ? cornerPt : otherPt.towardsPoint(cornerPt, dist + CORNER_SPACER);
  }

  // Segment with the smallest (incl. negative) orientation is ccw to the point
  // Segment with the largest orientation is cw to the point
  const orient = foundry.utils.orient2dFast;
  const segments = [...edges].map((edge) => {
    // Construct new segment objects so walls are not modified.
    const [cornerPt, otherPt] =
      parseInt(game.version) > 11
        ? edge.a.key === cornerKey
          ? [edge.a, edge.b]
          : [edge.b, edge.a]
        : edge.A.key === cornerKey
          ? [edge.A, edge.B]
          : [edge.B, edge.A];
    const segment = {
      A: cornerPt,
      B: otherPt,
    };
    segment.orient = orient(cornerPt, otherPt, origin);
    return segment;
  });
  segments.sort((a, b) => {
    return a.orient - b.orient;
  });

  // Get the directional vector that splits the segments in two from the corner.
  const ccw = segments[0];
  const cw = segments[segments.length - 1];
  const dir = averageSegments(ccw.A, ccw.B, cw.B);

  // The dir is the point between the smaller angle of the two segments.
  // Check if we need that point or its opposite, depending on location of the template origin.
  let pt = ccw.A.add(dir.multiplyScalar(CORNER_SPACER));
  const oPcw = orient(cw.A, cw.B, pt);
  const oTcw = orient(cw.A, cw.B, origin);
  if (Math.sign(oPcw) !== Math.sign(oTcw))
    pt = ccw.A.add(dir.multiplyScalar(-CORNER_SPACER));
  else {
    const oPccw = orient(ccw.A, ccw.B, pt);
    const oTccw = orient(ccw.A, ccw.B, origin);
    if (Math.sign(oPccw) !== Math.sign(oTccw))
      pt = ccw.A.add(dir.multiplyScalar(-CORNER_SPACER));
  }

  return pt;
}

/**
 * Find the normalized directional vector between two segments that share a common point A.
 * The vector returned will indicate a direction midway between the segments A|B and A|C.
 * The vector will indicate a direction clockwise from A|B.
 * In other words, the vector returned is the sum of the normalized vector of each segment.
 * @param {Point} a - Shared endpoint of the two segments A|B and A|C
 * @param {Point} b - Second endpoint of the segment A|B
 * @param {Point} c - Second endpoint of the segment B|C
 * @returns {Point} - A normalized directional vector
 */
function averageSegments(a, b, c) {
  // If c is collinear, return the orthogonal vector in the clockwise direction
  const orient = foundry.utils.orient2dFast(a, b, c);
  if (!orient) return orthogonalVectorsToSegment(a, b).cw;

  const normB = normalizedVectorFromSegment(a, b);
  const normC = normalizedVectorFromSegment(a, c);

  const outPoint = new PIXI.Point();
  normB.add(normC, outPoint).multiplyScalar(0.5, outPoint);

  // If c is ccw to b, then negate the result to get the vector going the opposite direction.
  // if ( orient > 0 ) outPoint.multiplyScalar(-1, outPoint);

  return outPoint;
}

/**
 * Calculate the normalized directional vector from a segment.
 * @param {PIXI.Point} a   First endpoint of the segment
 * @param {PIXI.Point} b   Second endpoint of the segment
 * @returns {PIXI.Point} A normalized directional vector
 */
function normalizedVectorFromSegment(a, b) {
  return b.subtract(a).normalize();
}

/* -------------------------------------------- */

/**
 * Get the normalized vectors pointing clockwise and counterclockwise from a segment.
 * Orientation is measured A --> B --> vector.
 * @param {PIXI.Point} a   First endpoint of the segment
 * @param {PIXI.Point} b   Second endpoint of the segment
 * @returns {{cw: PIXI.Point, ccw: PIXI.Point}} Normalized directional vectors labeled cw and ccw.
 */
function orthogonalVectorsToSegment(a, b) {
  // Calculate the normalized vectors orthogonal to the edge
  const norm = normalizedVectorFromSegment(a, b);
  const cw = new PIXI.Point(-norm.y, norm.x);
  const ccw = new PIXI.Point(norm.y, -norm.x);
  return { cw, ccw };
}

/**
 * Union a set of polygons preserving multiple pieces
 * @param {Array<PIXI.Polygon>} polys - An array of polys to combine
 * @returns {Array<PIXI.Polygon>} - The resulting union
 */
export function combine(polys) {
  const paths = polys.map((p) => p.toClipperPoints());
  const c = new ClipperLib.Clipper();
  let combined = new ClipperLib.Paths();
  c.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
  c.Execute(
    ClipperLib.ClipType.ctUnion,
    combined,
    ClipperLib.PolyFillType.pftPositive,
    ClipperLib.PolyFillType.pftPositive,
  );
  combined = ClipperLib.Clipper.CleanPolygons(combined, 0.1);
  const holes = [];
  polys.forEach((p) => {
    if (p.holes) p.holes.forEach((h) => holes.push(h));
  });
  combined = difference(combined, holes);
  return combined
    .map((pts) => {
      const poly = PIXI.Polygon.fromClipperPoints(pts);
      if (poly.area > 250) {
        return poly;
      }
    })
    .filter((e) => {
      return !!e;
    });
}

/**
 * Intersect a two polygons preserving multiple pieces
 * @param {Array<PIXI.Polygon>} subjects - The polygons to clip
 * @param {Array<PIXI.Polygon>} clips - The polygon to clip with
 * @returns {Array<PIXI.Polygon>} - The resulting intersection
 */
export function intersect(subjects, clips) {
  const subjectPaths = subjects.map((p) => p.toClipperPoints());
  const clipPaths = clips.map((p) => p.toClipperPoints());
  clips.forEach((p) => {
    if (p.holes) p.holes.forEach((h) => clipPaths.push(h.toClipperPoints()));
  });
  const c = new ClipperLib.Clipper();
  let combined = new ClipperLib.Paths();
  c.AddPaths(subjectPaths, ClipperLib.PolyType.ptSubject, true);
  c.AddPaths(clipPaths, ClipperLib.PolyType.ptClip, true);
  c.Execute(
    ClipperLib.ClipType.ctIntersection,
    combined,
    ClipperLib.PolyFillType.pftPositive,
    ClipperLib.PolyFillType.pftPositive,
  );
  combined = ClipperLib.Clipper.CleanPolygons(combined, 0.1);
  return combined.map((pts) => {
    const poly = PIXI.Polygon.fromClipperPoints(pts);
    return poly;
  });
}

/**
 * Difference two polygons preserving multiple pieces
 * @param {Array<PIXI.Polygon>} subjects - The polygons to difference
 * @param {Array<PIXI.Polygon>} clips - The polygon to difference with
 * @returns {Array<PIXI.Polygon>} - The resulting difference
 */
function difference(subjects, clips) {
  const clipPaths = clips.map((p) => p.toClipperPoints());
  const c = new ClipperLib.Clipper();
  let combined = new ClipperLib.Paths();
  c.AddPaths(subjects, ClipperLib.PolyType.ptSubject, true);
  c.AddPaths(clipPaths, ClipperLib.PolyType.ptClip, true);
  c.Execute(
    ClipperLib.ClipType.ctDifference,
    combined,
    ClipperLib.PolyFillType.pftPositive,
    ClipperLib.PolyFillType.pftPositive,
  );
  combined = ClipperLib.Clipper.CleanPolygons(combined, 0.1);
  return combined;
}

(function publishHomebaseRouteCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HOMEBASE_ROUTE_CORE = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createHomebaseRouteCore() {
  'use strict';

  const DEFAULT_CELL_SIZE_M = 0.5;
  const DEFAULT_CLEARANCE_M = 0.65;
  const DEFAULT_INTERACTION_OFFSET_M = 1;
  const DEFAULT_AIRCRAFT_SIZE_M = 10;
  const SQRT2 = Math.sqrt(2);

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizePoint(raw = {}) {
    return { northM: finite(raw.northM ?? raw.n), eastM: finite(raw.eastM ?? raw.e) };
  }

  function normalizeHeading(value) {
    return ((finite(value) % 360) + 360) % 360;
  }

  function localToWorld(center, forwardM, rightM, headingDeg = 0) {
    const radians = normalizeHeading(headingDeg) * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
      northM: center.northM + cos * forwardM - sin * rightM,
      eastM: center.eastM + sin * forwardM + cos * rightM
    };
  }

  function worldToLocal(point, obstacle) {
    const radians = normalizeHeading(obstacle.heading) * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const north = point.northM - obstacle.northM;
    const east = point.eastM - obstacle.eastM;
    return {
      forwardM: north * cos + east * sin,
      rightM: -north * sin + east * cos
    };
  }

  function normalizeObstacle(raw = {}, options = {}) {
    const footprint = raw.footprint || {};
    const scale = clamp(finite(raw.scale, 1), 0.1, 10);
    const clearanceM = Math.max(0, finite(raw.clearanceM, finite(options.clearanceM, DEFAULT_CLEARANCE_M)));
    const widthM = Math.max(0.1, finite(raw.widthM ?? footprint.widthM, 1)) * scale;
    const depthM = Math.max(0.1, finite(raw.depthM ?? footprint.depthM, 1)) * scale;
    return {
      id: String(raw.id || raw.title || `obstacle-${Math.random().toString(36).slice(2)}`),
      label: String(raw.label || raw.title || raw.id || 'Hindernis'),
      northM: finite(raw.northM),
      eastM: finite(raw.eastM),
      heading: normalizeHeading(raw.heading ?? raw.hdg),
      widthM,
      depthM,
      clearanceM,
      halfWidthM: widthM / 2 + clearanceM,
      halfDepthM: depthM / 2 + clearanceM,
      source: raw
    };
  }

  function obstacleCorners(raw, includeClearance = true) {
    const obstacle = raw.halfWidthM != null ? raw : normalizeObstacle(raw);
    const halfWidth = includeClearance ? obstacle.halfWidthM : obstacle.widthM / 2;
    const halfDepth = includeClearance ? obstacle.halfDepthM : obstacle.depthM / 2;
    return [
      localToWorld(obstacle, halfDepth, halfWidth, obstacle.heading),
      localToWorld(obstacle, halfDepth, -halfWidth, obstacle.heading),
      localToWorld(obstacle, -halfDepth, -halfWidth, obstacle.heading),
      localToWorld(obstacle, -halfDepth, halfWidth, obstacle.heading)
    ];
  }

  function pointInsideObstacle(point, raw, extraM = 0) {
    const obstacle = raw.halfWidthM != null ? raw : normalizeObstacle(raw);
    const local = worldToLocal(normalizePoint(point), obstacle);
    return Math.abs(local.forwardM) <= obstacle.halfDepthM + extraM
      && Math.abs(local.rightM) <= obstacle.halfWidthM + extraM;
  }

  function obstacleBounds(obstacle) {
    const corners = obstacleCorners(obstacle, true);
    return {
      minNorthM: Math.min(...corners.map(point => point.northM)),
      maxNorthM: Math.max(...corners.map(point => point.northM)),
      minEastM: Math.min(...corners.map(point => point.eastM)),
      maxEastM: Math.max(...corners.map(point => point.eastM))
    };
  }

  function aircraftObstacle(raw, options = {}) {
    if (!raw || raw.enabled === false) return null;
    const sizeM = Math.max(2, finite(raw.sizeM, DEFAULT_AIRCRAFT_SIZE_M));
    return normalizeObstacle({
      id: '__aircraft__',
      label: 'Flugzeug 10 × 10 m',
      northM: raw.northM,
      eastM: raw.eastM,
      heading: raw.heading,
      widthM: finite(raw.widthM, sizeM),
      depthM: finite(raw.depthM, sizeM),
      clearanceM: finite(raw.clearanceM, finite(options.clearanceM, DEFAULT_CLEARANCE_M))
    }, options);
  }

  function interactionCandidates(raw, options = {}) {
    const obstacle = raw.halfWidthM != null ? raw : normalizeObstacle(raw, options);
    const gap = Math.max(obstacle.clearanceM + 0.15, finite(options.interactionOffsetM, DEFAULT_INTERACTION_OFFSET_M));
    const forward = obstacle.depthM / 2 + gap;
    const right = obstacle.widthM / 2 + gap;
    const diagonalForward = obstacle.depthM / 2 + gap * 0.8;
    const diagonalRight = obstacle.widthM / 2 + gap * 0.8;
    return [
      ['front', forward, 0], ['right', 0, right], ['back', -forward, 0], ['left', 0, -right],
      ['front-right', diagonalForward, diagonalRight], ['back-right', -diagonalForward, diagonalRight],
      ['back-left', -diagonalForward, -diagonalRight], ['front-left', diagonalForward, -diagonalRight]
    ].map(([side, forwardM, rightM]) => ({
      side,
      ...localToWorld(obstacle, forwardM, rightM, obstacle.heading)
    }));
  }

  function pathDistance(points = []) {
    let total = 0;
    for (let index = 1; index < points.length; index += 1) {
      total += Math.hypot(points[index].northM - points[index - 1].northM, points[index].eastM - points[index - 1].eastM);
    }
    return total;
  }

  class MinHeap {
    constructor() { this.values = []; }
    push(value) {
      const values = this.values;
      values.push(value);
      let index = values.length - 1;
      while (index > 0) {
        const parent = (index - 1) >> 1;
        if (values[parent].score <= value.score) break;
        values[index] = values[parent];
        index = parent;
      }
      values[index] = value;
    }
    pop() {
      const values = this.values;
      if (!values.length) return null;
      const first = values[0];
      const last = values.pop();
      if (!values.length) return first;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= values.length) break;
        const child = right < values.length && values[right].score < values[left].score ? right : left;
        if (values[child].score >= last.score) break;
        values[index] = values[child];
        index = child;
      }
      values[index] = last;
      return first;
    }
    get size() { return this.values.length; }
  }

  function createGrid(start, goal, obstacles, options = {}) {
    const paddingM = Math.max(3, finite(options.boundsPaddingM, 8));
    const extents = [start, goal];
    for (const obstacle of obstacles) extents.push(...obstacleCorners(obstacle, true));
    let minNorthM = Math.min(...extents.map(point => point.northM)) - paddingM;
    let maxNorthM = Math.max(...extents.map(point => point.northM)) + paddingM;
    let minEastM = Math.min(...extents.map(point => point.eastM)) - paddingM;
    let maxEastM = Math.max(...extents.map(point => point.eastM)) + paddingM;
    let cellSizeM = clamp(finite(options.cellSizeM, DEFAULT_CELL_SIZE_M), 0.25, 2);
    const maxCells = Math.max(10000, finite(options.maxCells, 250000));
    let width = Math.ceil((maxEastM - minEastM) / cellSizeM) + 1;
    let height = Math.ceil((maxNorthM - minNorthM) / cellSizeM) + 1;
    if (width * height > maxCells) {
      cellSizeM = Math.min(2, cellSizeM * Math.sqrt((width * height) / maxCells));
      width = Math.ceil((maxEastM - minEastM) / cellSizeM) + 1;
      height = Math.ceil((maxNorthM - minNorthM) / cellSizeM) + 1;
    }
    if (width * height > maxCells * 1.1) throw new Error('Der Homebase-Navigationsbereich ist für das Routengitter zu groß.');
    const blocked = new Uint8Array(width * height);
    const pointFor = (x, y) => ({ northM: minNorthM + y * cellSizeM, eastM: minEastM + x * cellSizeM });
    const indexFor = (x, y) => y * width + x;
    const cellFor = (point) => ({
      x: clamp(Math.round((point.eastM - minEastM) / cellSizeM), 0, width - 1),
      y: clamp(Math.round((point.northM - minNorthM) / cellSizeM), 0, height - 1)
    });
    for (const obstacle of obstacles) {
      const bounds = obstacleBounds(obstacle);
      const from = cellFor({ northM: bounds.minNorthM, eastM: bounds.minEastM });
      const to = cellFor({ northM: bounds.maxNorthM, eastM: bounds.maxEastM });
      for (let y = from.y; y <= to.y; y += 1) {
        for (let x = from.x; x <= to.x; x += 1) {
          if (pointInsideObstacle(pointFor(x, y), obstacle)) blocked[indexFor(x, y)] = 1;
        }
      }
    }
    const startCell = cellFor(start);
    const goalCell = cellFor(goal);
    blocked[indexFor(startCell.x, startCell.y)] = 0;
    blocked[indexFor(goalCell.x, goalCell.y)] = 0;
    return { minNorthM, maxNorthM, minEastM, maxEastM, width, height, cellSizeM, blocked, pointFor, indexFor, startCell, goalCell };
  }

  function reconstructGridPath(grid, parents, goalIndex) {
    const points = [];
    let index = goalIndex;
    while (index >= 0) {
      const y = Math.floor(index / grid.width);
      const x = index - y * grid.width;
      points.push(grid.pointFor(x, y));
      index = parents[index];
    }
    return points.reverse();
  }

  function findGridPath(start, goal, grid) {
    const total = grid.width * grid.height;
    const gScore = new Float64Array(total);
    gScore.fill(Infinity);
    const parents = new Int32Array(total);
    parents.fill(-1);
    const closed = new Uint8Array(total);
    const startIndex = grid.indexFor(grid.startCell.x, grid.startCell.y);
    const goalIndex = grid.indexFor(grid.goalCell.x, grid.goalCell.y);
    const heap = new MinHeap();
    gScore[startIndex] = 0;
    heap.push({ index: startIndex, score: Math.hypot(grid.goalCell.x - grid.startCell.x, grid.goalCell.y - grid.startCell.y) });
    const directions = [
      [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
      [-1, -1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [1, 1, SQRT2]
    ];
    while (heap.size) {
      const current = heap.pop();
      if (!current || closed[current.index]) continue;
      if (current.index === goalIndex) return reconstructGridPath(grid, parents, goalIndex);
      closed[current.index] = 1;
      const y = Math.floor(current.index / grid.width);
      const x = current.index - y * grid.width;
      for (const [dx, dy, cost] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
        const nextIndex = grid.indexFor(nx, ny);
        if (closed[nextIndex] || grid.blocked[nextIndex]) continue;
        if (dx && dy && (grid.blocked[grid.indexFor(x + dx, y)] || grid.blocked[grid.indexFor(x, y + dy)])) continue;
        const tentative = gScore[current.index] + cost;
        if (tentative >= gScore[nextIndex]) continue;
        parents[nextIndex] = current.index;
        gScore[nextIndex] = tentative;
        const heuristic = Math.hypot(grid.goalCell.x - nx, grid.goalCell.y - ny);
        heap.push({ index: nextIndex, score: tentative + heuristic });
      }
    }
    return [];
  }

  function segmentClear(from, to, obstacles, sampleM = 0.2) {
    const distance = Math.hypot(to.northM - from.northM, to.eastM - from.eastM);
    const steps = Math.max(1, Math.ceil(distance / Math.max(0.1, sampleM)));
    for (let step = 1; step < steps; step += 1) {
      const ratio = step / steps;
      const point = {
        northM: from.northM + (to.northM - from.northM) * ratio,
        eastM: from.eastM + (to.eastM - from.eastM) * ratio
      };
      if (obstacles.some(obstacle => pointInsideObstacle(point, obstacle))) return false;
    }
    return true;
  }

  function simplifyPath(points, obstacles, sampleM) {
    if (points.length <= 2) return points.slice();
    const result = [points[0]];
    let anchor = 0;
    while (anchor < points.length - 1) {
      let next = points.length - 1;
      while (next > anchor + 1 && !segmentClear(points[anchor], points[next], obstacles, sampleM)) next -= 1;
      result.push(points[next]);
      anchor = next;
    }
    return result;
  }

  function normalizeObstacles(rawObstacles = [], options = {}) {
    const obstacles = rawObstacles.map(raw => normalizeObstacle(raw, options));
    const aircraft = aircraftObstacle(options.aircraft, options);
    if (aircraft) obstacles.push(aircraft);
    return obstacles;
  }

  function planRoute(input = {}) {
    const start = normalizePoint(input.start);
    const goal = normalizePoint(input.goal || input.target);
    const options = input.options || input;
    const obstacles = normalizeObstacles(input.obstacles || [], options);
    const grid = createGrid(start, goal, obstacles, options);
    const gridPath = findGridPath(start, goal, grid);
    if (!gridPath.length) return { ok: false, error: 'no_route', start, goal, obstacles, debug: { grid } };
    gridPath[0] = start;
    gridPath[gridPath.length - 1] = goal;
    const path = simplifyPath(gridPath, obstacles, grid.cellSizeM * 0.4);
    return {
      ok: true,
      start,
      goal,
      path,
      rawPath: gridPath,
      distanceM: pathDistance(path),
      obstacles,
      debug: {
        grid: {
          minNorthM: grid.minNorthM, maxNorthM: grid.maxNorthM,
          minEastM: grid.minEastM, maxEastM: grid.maxEastM,
          width: grid.width, height: grid.height, cellSizeM: grid.cellSizeM
        },
        obstaclePolygons: obstacles.map(obstacle => ({ id: obstacle.id, label: obstacle.label, points: obstacleCorners(obstacle, true) }))
      }
    };
  }

  function planRouteToObject(input = {}) {
    const options = input.options || input;
    const targetId = String(input.targetObjectId || input.targetId || '');
    const rawObstacles = Array.isArray(input.obstacles) ? input.obstacles : [];
    const targetRaw = rawObstacles.find(obstacle => String(obstacle.id) === targetId);
    if (!targetRaw) return { ok: false, error: 'target_not_found', targetId };
    const targetObstacle = normalizeObstacle(targetRaw, options);
    const allObstacles = normalizeObstacles(rawObstacles, options);
    const otherObstacles = allObstacles.filter(obstacle => obstacle.id !== targetObstacle.id);
    const candidates = interactionCandidates(targetObstacle, options)
      .filter(candidate => !otherObstacles.some(obstacle => pointInsideObstacle(candidate, obstacle)));
    let best = null;
    const attempts = [];
    for (const candidate of candidates) {
      const result = planRoute({ ...input, goal: candidate, options });
      attempts.push({ side: candidate.side, ok: result.ok, distanceM: result.distanceM ?? null });
      if (result.ok && (!best || result.distanceM < best.distanceM)) best = { ...result, interactionSide: candidate.side };
    }
    if (!best) return { ok: false, error: 'target_unreachable', targetId, candidates, attempts, obstacles: allObstacles };
    return { ...best, targetId, interactionPoint: best.goal, candidates, attempts };
  }

  return Object.freeze({
    DEFAULT_AIRCRAFT_SIZE_M,
    DEFAULT_CELL_SIZE_M,
    DEFAULT_CLEARANCE_M,
    DEFAULT_INTERACTION_OFFSET_M,
    normalizePoint,
    normalizeObstacle,
    obstacleCorners,
    pointInsideObstacle,
    aircraftObstacle,
    interactionCandidates,
    planRoute,
    planRouteToObject,
    pathDistance
  });
}));

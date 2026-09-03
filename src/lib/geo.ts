export type LngLat = [number, number];

export function geometryBbox(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of iterRings(geometry)) {
    for (const pos of ring) {
      const x = pos[0];
      const y = pos[1];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return [minX, minY, maxX, maxY];
}

export function pointInGeometry(
  point: LngLat,
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
): boolean {
  if (geometry.type === "Polygon") {
    return pointInPolygonRings(point, geometry.coordinates);
  }
  return geometry.coordinates.some((polygon) => pointInPolygonRings(point, polygon));
}

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function randomPointsInGeometry(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  count: number,
  rng: () => number,
): LngLat[] {
  const [minX, minY, maxX, maxY] = geometryBbox(geometry);
  const points: LngLat[] = [];
  const maxTries = count * 80;
  let tries = 0;
  while (points.length < count && tries < maxTries) {
    tries += 1;
    const x = minX + rng() * (maxX - minX);
    const y = minY + rng() * (maxY - minY);
    const candidate: LngLat = [x, y];
    if (pointInGeometry(candidate, geometry)) points.push(candidate);
  }
  return points;
}

function iterRings(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): number[][][] {
  return geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
}

function pointInPolygonRings(point: LngLat, rings: GeoJSON.Position[][]): boolean {
  if (!rings.length) return false;
  if (!pointInRing(point, rings[0])) return false;
  for (let i = 1; i < rings.length; i += 1) {
    if (pointInRing(point, rings[i])) return false;
  }
  return true;
}

function pointInRing(point: LngLat, ring: GeoJSON.Position[]): boolean {
  const x = point[0];
  const y = point[1];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

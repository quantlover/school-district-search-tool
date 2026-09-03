import { hashString, mulberry32, randomPointsInGeometry } from "./geo";
import type { Listing } from "./types";

const STREETS = [
  "Maple",
  "Oak",
  "Cedar",
  "Walnut",
  "Schoolhouse",
  "Prospect",
  "Highland",
  "Cherry",
  "Willow",
  "Ridge",
  "Meadow",
  "Library",
];

const SUFFIXES = ["St", "Ave", "Rd", "Ln", "Way", "Ct"];

export function buildDemoListings(
  geoid: string,
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  city: string,
  state: string,
  count = 16,
): Listing[] {
  const rng = mulberry32(hashString(geoid));
  const points = randomPointsInGeometry(geometry, count, rng);
  return points.map((point, index) => {
    const beds = 2 + Math.floor(rng() * 4);
    const baths = 1 + Math.floor(rng() * 3) + (rng() > 0.6 ? 0.5 : 0);
    const sqft = 1100 + Math.floor(rng() * 2200);
    const price = Math.round((280_000 + sqft * 220 + beds * 35_000 + rng() * 180_000) / 1000) * 1000;
    const number = 20 + Math.floor(rng() * 380);
    const street = STREETS[Math.floor(rng() * STREETS.length)];
    const suffix = SUFFIXES[Math.floor(rng() * SUFFIXES.length)];
    return {
      id: `demo-${geoid}-${index}`,
      source: "demo",
      lat: point[1],
      lon: point[0],
      price,
      beds,
      baths,
      sqft,
      address: `${number} ${street} ${suffix}`,
      city,
      state,
      status: "for_sale",
    };
  });
}

export function listingProviderNote(): string {
  return "Sample homes placed inside this district boundary. Swap this adapter for an MLS/IDX feed when you have display rights.";
}

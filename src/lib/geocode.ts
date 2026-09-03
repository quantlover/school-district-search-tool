import { FIPS_BY_STATE } from "./states";

export type ParsedQuery = {
  kind: "zip" | "name";
  text: string;
  zip?: string;
  name?: string;
  stateFips?: string;
};

export function parseSearchQuery(raw: string): ParsedQuery {
  const text = raw.trim().replace(/\s+/g, " ");
  const zipMatch = text.match(/\b(\d{5})\b/);
  if (zipMatch && (/^\d{5}$/.test(text) || text === zipMatch[1])) {
    return { kind: "zip", text, zip: zipMatch[1] };
  }

  const stateMatch = text.match(/^(.*?)[,\s]+([A-Za-z]{2})$/);
  if (stateMatch) {
    const stateFips = FIPS_BY_STATE[stateMatch[2].toUpperCase()];
    if (stateFips) {
      return {
        kind: "name",
        text,
        name: stateMatch[1].trim(),
        stateFips,
      };
    }
  }

  if (zipMatch) {
    return { kind: "zip", text, zip: zipMatch[1] };
  }

  return { kind: "name", text, name: text };
}

export async function geocodeZip(zip: string): Promise<{ lat: number; lon: number; place: string } | null> {
  const response = await fetch(`https://api.zippopotam.us/us/${zip}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    places?: Array<{ latitude: string; longitude: string; "place name": string; "state abbreviation": string }>;
  };
  const place = data.places?.[0];
  if (!place) return null;
  return {
    lat: Number(place.latitude),
    lon: Number(place.longitude),
    place: `${place["place name"]}, ${place["state abbreviation"]}`,
  };
}

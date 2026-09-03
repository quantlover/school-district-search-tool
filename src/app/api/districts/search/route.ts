import { NextRequest } from "next/server";
import { geocodeZip, parseSearchQuery } from "@/lib/geocode";
import {
  districtsContainingPoint,
  getDistrictsByGeoids,
  schoolLeaidsByZip,
  searchDistrictsByName,
} from "@/lib/nces";
import type { DistrictSummary } from "@/lib/types";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return Response.json({ districts: [], query: q });
  }

  try {
    const parsed = parseSearchQuery(q);
    const byId = new Map<string, DistrictSummary>();

    if (parsed.kind === "zip" && parsed.zip) {
      const [point, leaids] = await Promise.all([
        geocodeZip(parsed.zip),
        schoolLeaidsByZip(parsed.zip),
      ]);
      if (point) {
        const containing = await districtsContainingPoint(point.lon, point.lat);
        for (const district of containing) byId.set(district.geoid, district);
      }
      const extras = await getDistrictsByGeoids(leaids.slice(0, 25));
      for (const district of extras) byId.set(district.geoid, district);
    } else {
      const name = parsed.name || q;
      const named = await searchDistrictsByName(name, parsed.stateFips);
      for (const district of named) byId.set(district.geoid, district);
    }

    const districts = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    return Response.json({ districts, query: q });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    return Response.json({ error: message, districts: [] }, { status: 502 });
  }
}

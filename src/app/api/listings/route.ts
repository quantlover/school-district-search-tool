import { NextRequest } from "next/server";
import { buildDemoListings, listingProviderNote } from "@/lib/listings";
import { getDistrictByGeoid } from "@/lib/nces";

export async function GET(request: NextRequest) {
  const geoid = request.nextUrl.searchParams.get("geoid")?.trim() ?? "";
  if (!/^\d{7}$/.test(geoid)) {
    return Response.json({ error: "A 7-digit district id is required" }, { status: 400 });
  }
  try {
    const district = await getDistrictByGeoid(geoid);
    if (!district) {
      return Response.json({ error: "District not found" }, { status: 404 });
    }
    const cityGuess = district.name.replace(/ (public )?schools?( district)?/i, "").trim();
    const listings = buildDemoListings(district.geoid, district.geometry, cityGuess, district.state);
    return Response.json({
      listings,
      note: listingProviderNote(),
      provider: "demo",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load listings";
    return Response.json({ error: message, listings: [] }, { status: 502 });
  }
}

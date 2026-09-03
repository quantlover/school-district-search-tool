import { NextRequest } from "next/server";
import { districtsContainingPoint } from "@/lib/nces";

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json({ error: "lat and lon are required" }, { status: 400 });
  }
  try {
    const districts = await districtsContainingPoint(lon, lat);
    return Response.json({ districts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lookup failed";
    return Response.json({ error: message, districts: [] }, { status: 502 });
  }
}

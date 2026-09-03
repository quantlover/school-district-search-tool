import { NextRequest } from "next/server";
import { getSchoolAttendanceZone } from "@/lib/nces";

export async function GET(request: NextRequest) {
  const ncesId = request.nextUrl.searchParams.get("ncesId")?.trim() ?? "";
  const leaid = request.nextUrl.searchParams.get("leaid")?.trim() ?? "";
  const name = request.nextUrl.searchParams.get("name")?.trim() ?? "";
  if (!ncesId && !(leaid && name)) {
    return Response.json({ error: "ncesId or leaid+name is required" }, { status: 400 });
  }
  try {
    const zone = await getSchoolAttendanceZone(ncesId, leaid, name);
    return Response.json({ zone });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load school zone";
    return Response.json({ error: message, zone: null }, { status: 502 });
  }
}

import { getDistrictByGeoid } from "@/lib/nces";

export async function GET(_request: Request, context: RouteContext<"/api/districts/[geoid]">) {
  const { geoid } = await context.params;
  try {
    const district = await getDistrictByGeoid(geoid);
    if (!district) {
      return Response.json({ error: "District not found" }, { status: 404 });
    }
    return Response.json({ district });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load district";
    return Response.json({ error: message }, { status: 502 });
  }
}

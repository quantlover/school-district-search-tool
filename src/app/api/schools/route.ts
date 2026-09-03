import { NextRequest } from "next/server";
import { schoolsByLeaid } from "@/lib/ccd";
import { schoolsLocatedByLeaid } from "@/lib/nces";
import type { School } from "@/lib/types";

export async function GET(request: NextRequest) {
  const leaid = request.nextUrl.searchParams.get("leaid")?.trim() ?? "";
  if (!/^\d{7}$/.test(leaid)) {
    return Response.json({ error: "A 7-digit district id is required" }, { status: 400 });
  }
  try {
    const [located, ccd] = await Promise.all([
      schoolsLocatedByLeaid(leaid),
      schoolsByLeaid(leaid).catch(() => [] as School[]),
    ]);
    const byId = new Map(ccd.map((school) => [school.ncesId, school]));
    const schools = located.map((school) => byId.get(school.ncesId) ?? school);
    for (const extra of ccd) {
      if (!schools.some((school) => school.ncesId === extra.ncesId)) schools.push(extra);
    }
    schools.sort((a, b) => a.name.localeCompare(b.name));
    return Response.json({ schools });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load schools";
    return Response.json({ error: message, schools: [] }, { status: 502 });
  }
}

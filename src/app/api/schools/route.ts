import { NextRequest } from "next/server";
import { schoolsByLeaid } from "@/lib/ccd";
import { schoolsLocatedByLeaid } from "@/lib/nces";
import { nicheProfileUrl } from "@/lib/schoolLinks";
import type { School } from "@/lib/types";

function ncesKey(id: string): string {
  return id.replace(/\D/g, "").padStart(12, "0");
}

function withNicheLink(school: School): School {
  return {
    ...school,
    links: {
      ...school.links,
      niche: nicheProfileUrl(school.name, school.city, school.state),
    },
  };
}

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
    const byId = new Map(ccd.map((school) => [ncesKey(school.ncesId), school]));
    const schools = located.map((school) => byId.get(ncesKey(school.ncesId)) ?? school);
    for (const extra of ccd) {
      if (!schools.some((school) => ncesKey(school.ncesId) === ncesKey(extra.ncesId))) {
        schools.push(extra);
      }
    }
    schools.sort((a, b) => a.name.localeCompare(b.name));
    return Response.json(
      { schools: schools.map(withNicheLink) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load schools";
    return Response.json({ error: message, schools: [] }, { status: 502 });
  }
}

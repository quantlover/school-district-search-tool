import type { School, SchoolLevelKey } from "./types";

export const BROWSER_HEADERS = {
  Accept: "application/json",
  "User-Agent": "SchoolDistrictSearchTool/0.1 (district map; local development)",
};

const CCD_DIRECTORY = "https://educationdata.urban.org/api/v1/schools/ccd/directory/2024/";

type CcdSchool = {
  ncessch: string;
  leaid: string;
  lea_name: string | null;
  school_name: string;
  street_location: string | null;
  city_location: string | null;
  state_location: string | null;
  zip_location: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  school_level: number | null;
  lowest_grade_offered: number | null;
  highest_grade_offered: number | null;
  enrollment: number | null;
  teachers_fte: number | null;
  free_or_reduced_price_lunch: number | null;
  charter: number | null;
  magnet: number | null;
  virtual: number | null;
  school_type: number | null;
  school_status: number | null;
  title_i_eligible: number | null;
  title_i_schoolwide: number | null;
  elem_cedp: number | null;
  middle_cedp: number | null;
  high_cedp: number | null;
};

type CcdPage = {
  count: number;
  next: string | null;
  results: CcdSchool[];
};

export async function schoolsByLeaid(leaid: string): Promise<School[]> {
  const padded = leaid.padStart(7, "0");
  const rows: CcdSchool[] = [];
  let url: string | null = `${CCD_DIRECTORY}?leaid=${encodeURIComponent(padded)}`;
  let pages = 0;
  while (url && pages < 8) {
    pages += 1;
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`CCD request failed (${response.status})`);
    const page = (await response.json()) as CcdPage;
    rows.push(...page.results);
    url = page.next;
  }
  return rows
    .filter((row) => row.school_status === 1 && row.latitude != null && row.longitude != null)
    .map(toSchool);
}

function toSchool(row: CcdSchool): School {
  const levels = inferLevels(row);
  const enrollment = positive(row.enrollment);
  const teachers = positive(row.teachers_fte);
  const frpl = positive(row.free_or_reduced_price_lunch);
  const city = row.city_location?.trim() ?? "";
  const state = row.state_location?.trim() ?? "";
  const query = encodeURIComponent(`${row.school_name} ${city} ${state}`.trim());
  return {
    ncesId: String(row.ncessch),
    leaid: String(row.leaid).padStart(7, "0"),
    districtName: row.lea_name?.trim() || "School district",
    name: row.school_name,
    street: titleCase(row.street_location ?? ""),
    city: titleCase(city),
    state,
    zip: row.zip_location ?? "",
    phone: row.phone,
    lat: row.latitude ?? 0,
    lon: row.longitude ?? 0,
    schoolLevel: row.school_level,
    levels,
    lowGrade: row.lowest_grade_offered,
    highGrade: row.highest_grade_offered,
    gradeLabel: gradeSpan(row.lowest_grade_offered, row.highest_grade_offered),
    enrollment,
    teachersFte: teachers,
    studentTeacher: enrollment && teachers ? Math.round((enrollment / teachers) * 10) / 10 : null,
    frpl,
    frplShare: enrollment && frpl != null ? Math.round((frpl / enrollment) * 100) : null,
    charter: row.charter === 1,
    magnet: row.magnet === 1,
    virtual: row.virtual === 1 || row.virtual === 2,
    schoolType: row.school_type,
    titleI: row.title_i_eligible === 1 || row.title_i_schoolwide === 1,
    links: {
      // GreatSchools and Niche block some automated traffic and/or their search endpoints
      // can return 403/404 depending on client context. A "site:" search reliably routes
      // users to the correct public page(s).
      greatSchools: `https://www.google.com/search?q=${query}+site%3Agreatschools.org`,
      niche: `https://www.google.com/search?q=${query}+site%3Aniche.com%2Fk12`,
      nces: `https://nces.ed.gov/ccd/schoolsearch/school_detail.asp?ID=${row.ncessch}`,
      google: `https://www.google.com/search?q=${query}+school`,
    },
  };
}

function inferLevels(row: CcdSchool): SchoolLevelKey[] {
  const levels = new Set<SchoolLevelKey>();
  if (row.elem_cedp === 1 || row.school_level === 1) levels.add("elementary");
  if (row.middle_cedp === 1 || row.school_level === 2) levels.add("middle");
  if (row.high_cedp === 1 || row.school_level === 3) levels.add("high");

  const low = row.lowest_grade_offered;
  const high = row.highest_grade_offered;
  if (low != null && high != null) {
    if (low <= 5) levels.add("elementary");
    if (low <= 8 && high >= 6) levels.add("middle");
    if (high >= 9) levels.add("high");
  }

  if (!levels.size) {
    for (const level of levelsFromName(row.school_name)) levels.add(level);
  }
  return [...levels];
}

export function levelsFromName(name: string): SchoolLevelKey[] {
  const lower = name.toLowerCase();
  if (/high school|senior high|\bhs\b/.test(lower)) return ["high"];
  if (/middle|junior/.test(lower)) return ["middle"];
  if (/elementary|primary|grammar/.test(lower)) return ["elementary"];
  return ["elementary"];
}

function gradeSpan(low: number | null, high: number | null): string {
  if (low == null && high == null) return "Grades n/a";
  return `${formatGrade(low)}–${formatGrade(high)}`;
}

function formatGrade(grade: number | null): string {
  if (grade == null) return "?";
  if (grade < 0) return "PK";
  if (grade === 0) return "K";
  return String(grade);
}

function positive(value: number | null): number | null {
  return value != null && value >= 0 ? value : null;
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

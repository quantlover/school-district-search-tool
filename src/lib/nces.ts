import { levelsFromName, titleCase } from "./ccd";
import { stateFromFips } from "./states";
import type { AttendanceZone, DistrictDetail, DistrictKind, DistrictSummary, School } from "./types";

const DISTRICT_QUERY =
  "https://nces.ed.gov/opengis/rest/services/School_District_Boundaries/EDGE_SCHOOLDISTRICT_TL25_SY2425/MapServer/1/query";
const SCHOOL_QUERY =
  "https://nces.ed.gov/opengis/rest/services/K12_School_Locations/EDGE_GEOCODE_PUBLICSCH_2425/MapServer/0/query";
const SABS_QUERY =
  "https://nces.ed.gov/opengis/rest/services/K12_School_Locations/SABS_1516/MapServer/0/query";

const DISTRICT_FIELDS =
  "GEOID,NAME,STATEFP,LOGRADE,HIGRADE,MTFCC,INTPTLAT,INTPTLON,SCHOOLYEAR,UNSDLEA,ELSDLEA,SCSDLEA";

export function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export async function getDistrictsByGeoids(geoids: string[]): Promise<DistrictSummary[]> {
  const valid = [...new Set(geoids.filter((id) => /^\d{7}$/.test(id)))];
  if (!valid.length) return [];
  const data = await ncesQuery(DISTRICT_QUERY, {
    where: `GEOID IN (${valid.map(sqlLiteral).join(",")})`,
    outFields: DISTRICT_FIELDS,
    returnGeometry: "false",
    f: "json",
    resultRecordCount: String(valid.length),
  });
  return (data.features ?? []).map((feature) => districtFromAttrs(feature.attributes ?? feature.properties ?? {}));
}

export async function searchDistrictsByName(name: string, stateFips?: string): Promise<DistrictSummary[]> {
  const variants = queryVariants(name);
  if (!variants.length) return [];
  const batches = await Promise.all(
    variants.map(async (variant) => {
      const clauses = [`UPPER(NAME) LIKE ${sqlLiteral(`%${variant.toUpperCase()}%`)}`];
      if (stateFips) clauses.push(`STATEFP = ${sqlLiteral(stateFips)}`);
      const data = await ncesQuery(DISTRICT_QUERY, {
        where: clauses.join(" AND "),
        outFields: DISTRICT_FIELDS,
        returnGeometry: "false",
        orderByFields: "NAME",
        resultRecordCount: "25",
        f: "json",
      });
      return (data.features ?? []).map((feature) => districtFromAttrs(feature.attributes ?? {}));
    }),
  );
  const byId = new Map<string, DistrictSummary>();
  for (const district of batches.flat()) byId.set(district.geoid, district);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 25);
}

function queryVariants(name: string): string[] {
  const cleaned = name.replace(/[%_]/g, " ").trim();
  if (!cleaned) return [];
  const variants = new Set([cleaned]);
  const expansions: Array<[RegExp, string]> = [
    [/\bisd\b/i, "Independent School District"],
    [/\busd\b/i, "Unified School District"],
    [/\bpsd\b/i, "Public School District"],
  ];
  for (const [pattern, phrase] of expansions) {
    if (pattern.test(cleaned)) variants.add(cleaned.replace(pattern, phrase));
  }
  return [...variants];
}

export async function districtsContainingPoint(lon: number, lat: number): Promise<DistrictSummary[]> {
  const data = await ncesQuery(DISTRICT_QUERY, {
    geometry: JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: DISTRICT_FIELDS,
    returnGeometry: "false",
    f: "json",
  });
  return (data.features ?? []).map((feature) => districtFromAttrs(feature.attributes ?? {}));
}

export async function getDistrictByGeoid(geoid: string): Promise<DistrictDetail | null> {
  if (!/^\d{7}$/.test(geoid)) return null;
  const data = await ncesQuery(DISTRICT_QUERY, {
    where: `GEOID = ${sqlLiteral(geoid)}`,
    outFields: DISTRICT_FIELDS,
    returnGeometry: "true",
    outSR: "4326",
    maxAllowableOffset: "0.00025",
    f: "geojson",
  });
  const feature = data.features?.[0];
  if (!feature?.geometry) return null;
  const geometry = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") return null;
  return {
    ...districtFromAttrs(feature.properties ?? feature.attributes ?? {}),
    geometry,
  };
}

export async function getSchoolAttendanceZone(
  ncessch: string,
  leaid?: string,
  name?: string,
): Promise<AttendanceZone | null> {
  const id = ncessch.trim();
  const clauses = [`ncessch = ${sqlLiteral(id)}`];
  if (id.length === 12) clauses.push(`ncessch = ${sqlLiteral(id.replace(/^0+/, "") || id)}`);
  const byId = await ncesQuery(SABS_QUERY, {
    where: clauses.join(" OR "),
    outFields: "ncessch,schnam,leaid,level,gslo,gshi",
    returnGeometry: "true",
    outSR: "4326",
    maxAllowableOffset: "0.0002",
    f: "geojson",
    resultRecordCount: "1",
  });
  const found = zoneFromFeature(byId.features?.[0]);
  if (found) return found;

  if (leaid && name) {
    const shortName = name.replace(/ school$/i, "").trim();
    if (shortName.length >= 4) {
      const byName = await ncesQuery(SABS_QUERY, {
        where: `leaid = ${sqlLiteral(leaid.padStart(7, "0"))} AND UPPER(schnam) LIKE ${sqlLiteral(`%${shortName.toUpperCase()}%`)}`,
        outFields: "ncessch,schnam,leaid,level,gslo,gshi",
        returnGeometry: "true",
        outSR: "4326",
        maxAllowableOffset: "0.0002",
        f: "geojson",
        resultRecordCount: "1",
      });
      return zoneFromFeature(byName.features?.[0]);
    }
  }
  return null;
}

function zoneFromFeature(
  feature:
    | {
        attributes?: Record<string, unknown>;
        properties?: Record<string, unknown>;
        geometry?: GeoJSON.Geometry;
      }
    | undefined,
): AttendanceZone | null {
  if (!feature?.geometry) return null;
  const geometry = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") return null;
  const props = feature.properties ?? feature.attributes ?? {};
  return {
    ncesId: String(props.ncessch ?? ""),
    name: String(props.schnam ?? "School attendance zone"),
    level: props.level != null ? String(props.level) : null,
    vintage: "2015-2016",
    geometry,
  };
}

export async function schoolsLocatedByLeaid(leaid: string): Promise<School[]> {
  const padded = leaid.padStart(7, "0");
  if (!/^\d{7}$/.test(padded)) return [];
  const data = await ncesQuery(SCHOOL_QUERY, {
    where: `LEAID = ${sqlLiteral(padded)}`,
    outFields: "NCESSCH,LEAID,NAME,STREET,CITY,STATE,ZIP,LAT,LON",
    returnGeometry: "false",
    f: "json",
    resultRecordCount: "2000",
  });
  return (data.features ?? [])
    .map((feature) => schoolFromLocation(feature.attributes ?? {}))
    .filter((school) => Number.isFinite(school.lat) && Number.isFinite(school.lon));
}

export async function schoolLeaidsByZip(zip: string): Promise<string[]> {
  if (!/^\d{5}$/.test(zip)) return [];
  const data = await ncesQuery(SCHOOL_QUERY, {
    where: `ZIP = ${sqlLiteral(zip)}`,
    outFields: "LEAID",
    returnGeometry: "false",
    returnDistinctValues: "true",
    f: "json",
    resultRecordCount: "200",
  });
  const ids = new Set<string>();
  for (const feature of data.features ?? []) {
    const leaid = String(feature.attributes?.LEAID ?? "").padStart(7, "0");
    if (/^\d{7}$/.test(leaid)) ids.add(leaid);
  }
  return [...ids];
}

function districtFromAttrs(attrs: Record<string, unknown>): DistrictSummary {
  const geoid = String(attrs.GEOID ?? "").padStart(7, "0");
  const stateFips = String(attrs.STATEFP ?? geoid.slice(0, 2)).padStart(2, "0");
  return {
    geoid,
    name: String(attrs.NAME ?? "Unnamed district"),
    stateFips,
    state: stateFromFips(stateFips),
    lowGrade: String(attrs.LOGRADE ?? "").trim() || "PK",
    highGrade: String(attrs.HIGRADE ?? "").trim() || "12",
    kind: kindFromMtfcc(String(attrs.MTFCC ?? "")),
    lat: Number(attrs.INTPTLAT),
    lon: Number(attrs.INTPTLON),
    schoolYear: String(attrs.SCHOOLYEAR ?? "2024-2025"),
  };
}

function schoolFromLocation(attrs: Record<string, unknown>): School {
  const name = String(attrs.NAME ?? "Unnamed school");
  const city = titleCase(String(attrs.CITY ?? ""));
  const state = String(attrs.STATE ?? "");
  const ncesId = String(attrs.NCESSCH ?? "");
  const query = encodeURIComponent(`${name} ${city} ${state}`.trim());
  const levels = levelsFromName(name);
  return {
    ncesId,
    leaid: String(attrs.LEAID ?? "").padStart(7, "0"),
    districtName: "",
    name,
    street: titleCase(String(attrs.STREET ?? "")),
    city,
    state,
    zip: String(attrs.ZIP ?? ""),
    phone: null,
    lat: Number(attrs.LAT),
    lon: Number(attrs.LON),
    schoolLevel: null,
    levels,
    lowGrade: null,
    highGrade: null,
    gradeLabel: levels.includes("high")
      ? "High school"
      : levels.includes("middle")
        ? "Middle school"
        : levels.includes("elementary")
          ? "Elementary"
          : "Grades n/a",
    enrollment: null,
    teachersFte: null,
    studentTeacher: null,
    frpl: null,
    frplShare: null,
    charter: false,
    magnet: false,
    virtual: false,
    schoolType: null,
    titleI: false,
    links: {
      greatSchools: `https://www.greatschools.org/search/search.page?q=${query}`,
      niche: `https://www.niche.com/search/?q=${query}&type=k12`,
      nces: `https://nces.ed.gov/ccd/schoolsearch/school_detail.asp?ID=${ncesId}`,
      google: `https://www.google.com/search?q=${query}+school`,
    },
  };
}

function kindFromMtfcc(mtfcc: string): DistrictKind {
  if (mtfcc === "G5400") return "elementary";
  if (mtfcc === "G5410") return "secondary";
  if (mtfcc === "G5420") return "unified";
  if (mtfcc === "G5430") return "administrative";
  return "other";
}

type NcesResponse = {
  features?: Array<{
    attributes?: Record<string, unknown>;
    properties?: Record<string, unknown>;
    geometry?: GeoJSON.Geometry;
  }>;
};

async function ncesQuery(endpoint: string, params: Record<string, string>): Promise<NcesResponse> {
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "SchoolDistrictSearchTool/0.1 (district map; local development)",
    },
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`NCES request failed (${response.status})`);
  }
  return (await response.json()) as NcesResponse;
}

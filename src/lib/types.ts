export type DistrictSummary = {
  geoid: string;
  name: string;
  stateFips: string;
  state: string;
  lowGrade: string;
  highGrade: string;
  kind: DistrictKind;
  lat: number;
  lon: number;
  schoolYear: string;
};

export type DistrictKind = "unified" | "elementary" | "secondary" | "administrative" | "other";

export type DistrictDetail = DistrictSummary & {
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
};

export type AttendanceZone = {
  ncesId: string;
  name: string;
  level: string | null;
  vintage: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
};

export type SchoolLevelKey = "elementary" | "middle" | "high" | "other";

export type School = {
  ncesId: string;
  leaid: string;
  districtName: string;
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  lat: number;
  lon: number;
  schoolLevel: number | null;
  levels: SchoolLevelKey[];
  lowGrade: number | null;
  highGrade: number | null;
  gradeLabel: string;
  enrollment: number | null;
  teachersFte: number | null;
  studentTeacher: number | null;
  frpl: number | null;
  frplShare: number | null;
  charter: boolean;
  magnet: boolean;
  virtual: boolean;
  schoolType: number | null;
  titleI: boolean;
  links: SchoolLinks;
};

export type SchoolLinks = {
  greatSchools: string;
  niche: string;
  nces: string;
  google: string;
};

export type Listing = {
  id: string;
  source: "demo";
  lat: number;
  lon: number;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  address: string;
  city: string;
  state: string;
  status: "for_sale";
};

export type SchoolFilters = {
  elementary: boolean;
  middle: boolean;
  high: boolean;
  other: boolean;
  charter: "any" | "yes" | "no";
  magnet: "any" | "yes";
  titleI: "any" | "yes";
  minEnrollment: number;
  maxFrplShare: number;
};

import type { SchoolLinks } from "./types";

const STATE_SLUG: Record<string, string> = {
  AL: "alabama",
  AK: "alaska",
  AZ: "arizona",
  AR: "arkansas",
  CA: "california",
  CO: "colorado",
  CT: "connecticut",
  DE: "delaware",
  DC: "district-of-columbia",
  FL: "florida",
  GA: "georgia",
  HI: "hawaii",
  ID: "idaho",
  IL: "illinois",
  IN: "indiana",
  IA: "iowa",
  KS: "kansas",
  KY: "kentucky",
  LA: "louisiana",
  ME: "maine",
  MD: "maryland",
  MA: "massachusetts",
  MI: "michigan",
  MN: "minnesota",
  MS: "mississippi",
  MO: "missouri",
  MT: "montana",
  NE: "nebraska",
  NV: "nevada",
  NH: "new-hampshire",
  NJ: "new-jersey",
  NM: "new-mexico",
  NY: "new-york",
  NC: "north-carolina",
  ND: "north-dakota",
  OH: "ohio",
  OK: "oklahoma",
  OR: "oregon",
  PA: "pennsylvania",
  RI: "rhode-island",
  SC: "south-carolina",
  SD: "south-dakota",
  TN: "tennessee",
  TX: "texas",
  UT: "utah",
  VT: "vermont",
  VA: "virginia",
  WA: "washington",
  WV: "west-virginia",
  WI: "wisconsin",
  WY: "wyoming",
  PR: "puerto-rico",
};

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Niche k12 profile URLs: /k12/{school-name}-{city}-{state}/ */
export function nicheProfileUrl(name: string, city: string, state: string): string {
  const slug = [name, city, state.trim().toLowerCase()].map(slugPart).filter(Boolean).join("-");
  return `https://www.niche.com/k12/${slug}/`;
}

/**
 * GreatSchools profile URLs need their proprietary numeric school id
 * (e.g. /michigan/.../2750-Bennett-Woods-Elementary-School/). That id is not
 * in NCES/CCD, and city slugs often differ from mailing city, so we cannot
 * construct a reliable deep link without their NearbySchools API.
 *
 * Fall back to the GreatSchools city page on their domain — professional, no Google.
 */
export function greatSchoolsCityUrl(city: string, state: string): string {
  const stateSlug = STATE_SLUG[state.trim().toUpperCase()];
  const citySlug = city
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (stateSlug && citySlug) {
    return `https://www.greatschools.org/${stateSlug}/${citySlug}/`;
  }
  if (stateSlug) return `https://www.greatschools.org/${stateSlug}/`;
  return "https://www.greatschools.org/";
}

export function buildSchoolLinks(input: {
  ncesId: string;
  name: string;
  city: string;
  state: string;
}): SchoolLinks {
  const query = encodeURIComponent(`${input.name} ${input.city} ${input.state}`.trim());
  return {
    greatSchools: greatSchoolsCityUrl(input.city, input.state),
    niche: nicheProfileUrl(input.name, input.city, input.state),
    nces: `https://nces.ed.gov/ccd/schoolsearch/school_detail.asp?ID=${input.ncesId}`,
    google: `https://www.google.com/search?q=${query}+school`,
  };
}

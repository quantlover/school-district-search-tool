"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AttendanceZone,
  DistrictDetail,
  DistrictSummary,
  Listing,
  School,
  SchoolFilters,
  SchoolLevelKey,
} from "@/lib/types";

const DistrictMap = dynamic(() => import("./DistrictMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[var(--paper-2)]" />,
});

const DEFAULT_FILTERS: SchoolFilters = {
  elementary: true,
  middle: true,
  high: true,
  other: true,
  charter: "any",
  magnet: "any",
  titleI: "any",
  minEnrollment: 0,
  maxFrplShare: 100,
};

export default function Explorer() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DistrictSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [district, setDistrict] = useState<DistrictDetail | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingNote, setListingNote] = useState("");
  const [loadingDistrict, setLoadingDistrict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [schoolZone, setSchoolZone] = useState<AttendanceZone | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [showListings, setShowListings] = useState(false);
  const [filters, setFilters] = useState<SchoolFilters>(DEFAULT_FILTERS);
  const skipSearchRef = useRef(false);

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/districts/search?q=${encodeURIComponent(trimmed)}`);
        const data = (await response.json()) as { districts?: DistrictSummary[]; error?: string };
        setResults(data.districts ?? []);
        if (data.error) setError(data.error);
      } catch {
        setError("Could not search districts.");
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => window.clearTimeout(handle);
  }, [query]);

  async function selectDistrict(summary: DistrictSummary, keepSchoolId: string | null = null) {
    setError(null);
    setLoadingDistrict(true);
    setSelectedSchoolId(keepSchoolId);
    if (!keepSchoolId) setSchoolZone(null);
    setSelectedListingId(null);
    try {
      const [districtRes, schoolRes, listingRes] = await Promise.all([
        fetch(`/api/districts/${summary.geoid}`),
        fetch(`/api/schools?leaid=${summary.geoid}`),
        fetch(`/api/listings?geoid=${summary.geoid}`),
      ]);
      const districtJson = (await districtRes.json()) as { district?: DistrictDetail; error?: string };
      const schoolJson = (await schoolRes.json()) as { schools?: School[] };
      const listingJson = (await listingRes.json()) as { listings?: Listing[]; note?: string };
      if (!districtJson.district) {
        setError(districtJson.error || "Could not load that district boundary.");
        return;
      }
      setDistrict(districtJson.district);
      setSchools(schoolJson.schools ?? []);
      setListings(listingJson.listings ?? []);
      setListingNote(listingJson.note ?? "");
      skipSearchRef.current = true;
      setQuery(summary.name);
      setResults([]);
    } catch {
      setError("Could not load district details.");
    } finally {
      setLoadingDistrict(false);
    }
  }

  async function handleSchoolClick(id: string) {
    const school = schools.find((item) => item.ncesId === id);
    setSelectedListingId(null);
    setSelectedSchoolId(id);
    if (!school) return;

    const zoneParams = new URLSearchParams({
      ncesId: school.ncesId,
      leaid: school.leaid,
      name: school.name,
    });
    const zoneRes = await fetch(`/api/schools/zone?${zoneParams}`);
    const zoneJson = (await zoneRes.json()) as { zone?: AttendanceZone | null };
    setSchoolZone(zoneJson.zone ?? null);

    if (district && school.leaid.padStart(7, "0") === district.geoid.padStart(7, "0")) return;

    const districtRes = await fetch(`/api/districts/${school.leaid}`);
    if (districtRes.ok) {
      const body = (await districtRes.json()) as { district?: DistrictDetail };
      if (body.district) {
        await selectDistrict(body.district, id);
        return;
      }
    }

    const at = await fetch(`/api/districts/at?lat=${school.lat}&lon=${school.lon}`);
    const data = (await at.json()) as { districts?: DistrictSummary[] };
    const match =
      data.districts?.find((item) => item.kind === "unified") ?? data.districts?.[0];
    if (match) await selectDistrict(match, id);
  }

  const visibleSchools = useMemo(
    () => schools.filter((school) => matchesFilters(school, filters)),
    [schools, filters],
  );
  const selectedSchool = schools.find((school) => school.ncesId === selectedSchoolId) ?? null;
  const selectedListing = listings.find((listing) => listing.id === selectedListingId) ?? null;
  const visibleListings = showListings ? listings : [];

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:flex-row">
      <aside className="flex max-h-dvh w-full shrink-0 flex-col overflow-y-auto border-b border-[var(--line)] bg-[var(--paper)] lg:h-dvh lg:w-[400px] lg:border-r lg:border-b-0">
        <header className="px-5 pt-6 pb-4">
          <p className="font-sans text-[11px] font-semibold tracking-[0.22em] text-[var(--forest)] uppercase">
            School District Rocks
          </p>
          <h1 className="font-display mt-2 text-[1.85rem] leading-tight text-[var(--ink)]">
            Search homes by the schools that serve them.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Type a district name or ZIP. Click a school to draw its district boundary, then filter by
            elementary, middle, and high.
          </p>
        </header>

        <div className="px-5">
          <label className="sr-only" htmlFor="district-search">
            Search school districts
          </label>
          <input
            id="district-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Princeton Public Schools, 08540, Austin TX…"
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-[15px] text-[var(--ink)] outline-none ring-[var(--forest)] placeholder:text-[var(--muted)] focus:ring-2"
          />
          {searching ? <p className="mt-2 text-xs text-[var(--muted)]">Searching districts…</p> : null}
          {results.length > 0 ? (
            <ul className="mt-2 overflow-hidden rounded-md border border-[var(--line)] bg-white">
              {results.map((item) => (
                <li key={item.geoid} className="border-b border-[var(--line)] last:border-b-0">
                  <button
                    type="button"
                    onClick={() => selectDistrict(item)}
                    className="flex w-full flex-col items-start px-3 py-2.5 text-left hover:bg-[var(--paper-2)]"
                  >
                    <span className="text-sm font-medium text-[var(--ink)]">{item.name}</span>
                    <span className="text-xs text-[var(--muted)]">
                      {item.state} · {kindLabel(item.kind)} · {item.lowGrade}–{item.highGrade}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {error ? <p className="mt-2 text-sm text-[var(--clay)]">{error}</p> : null}
        </div>

        <section className="mt-5 px-5">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--muted)] uppercase">
            Show schools
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <LevelToggle
              label="Elementary"
              tone="elementary"
              active={filters.elementary}
              onClick={() => setFilters((prev) => ({ ...prev, elementary: !prev.elementary }))}
            />
            <LevelToggle
              label="Middle"
              tone="middle"
              active={filters.middle}
              onClick={() => setFilters((prev) => ({ ...prev, middle: !prev.middle }))}
            />
            <LevelToggle
              label="High"
              tone="high"
              active={filters.high}
              onClick={() => setFilters((prev) => ({ ...prev, high: !prev.high }))}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <FilterSelect
              label="Charter"
              value={filters.charter}
              onChange={(charter) => setFilters((prev) => ({ ...prev, charter }))}
              options={[
                ["any", "Any"],
                ["yes", "Charter only"],
                ["no", "Non-charter"],
              ]}
            />
            <FilterSelect
              label="Title I"
              value={filters.titleI}
              onChange={(titleI) => setFilters((prev) => ({ ...prev, titleI }))}
              options={[
                ["any", "Any"],
                ["yes", "Title I"],
              ]}
            />
          </div>
          <label className="mt-3 flex items-center justify-between gap-3 text-sm text-[var(--ink)]">
            Min enrollment
            <input
              type="number"
              min={0}
              value={filters.minEnrollment || ""}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  minEnrollment: Number(event.target.value) || 0,
                }))
              }
              className="w-24 rounded border border-[var(--line)] bg-white px-2 py-1 text-right"
            />
          </label>
          <label className="mt-2 flex items-center justify-between gap-3 text-sm text-[var(--ink)]">
            Max FRPL %
            <input
              type="number"
              min={0}
              max={100}
              value={filters.maxFrplShare}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  maxFrplShare: Math.min(100, Number(event.target.value) || 0),
                }))
              }
              className="w-24 rounded border border-[var(--line)] bg-white px-2 py-1 text-right"
            />
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm text-[var(--ink)]">
            <input
              type="checkbox"
              checked={showListings}
              onChange={(event) => setShowListings(event.target.checked)}
            />
            Show sample homes in this district
          </label>
        </section>

        {district ? (
          <section className="mt-5 px-5 pb-2">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--muted)] uppercase">
              Selected district
            </p>
            <h2 className="font-display mt-1 text-xl text-[var(--ink)]">{district.name}</h2>
            <p className="text-sm text-[var(--muted)]">
              {district.state} · {kindLabel(district.kind)} · {district.lowGrade}–{district.highGrade} ·{" "}
              {visibleSchools.length} school{visibleSchools.length === 1 ? "" : "s"} shown
            </p>
            {loadingDistrict ? <p className="mt-2 text-xs text-[var(--muted)]">Loading boundary…</p> : null}
          </section>
        ) : (
          <p className="px-5 pt-6 text-sm text-[var(--muted)]">
            Try <button type="button" className="underline" onClick={() => setQuery("Princeton Public Schools NJ")}>Princeton NJ</button>
            ,{" "}
            <button type="button" className="underline" onClick={() => setQuery("08540")}>08540</button>
            , or{" "}
            <button type="button" className="underline" onClick={() => setQuery("Austin ISD")}>Austin ISD</button>
            .
          </p>
        )}

        {selectedListing ? <ListingDetail listing={selectedListing} note={listingNote} /> : null}

        <ul className="mt-4 flex-1 space-y-1 px-5 pb-8">
          {visibleSchools.map((school) => (
            <li key={school.ncesId}>
              <button
                type="button"
                onClick={() => handleSchoolClick(school.ncesId)}
                className={`w-full rounded-md border px-3 py-2 text-left ${
                  school.ncesId === selectedSchoolId
                    ? "border-[var(--forest)] bg-[var(--paper-2)]"
                    : "border-transparent hover:bg-[var(--paper-2)]"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--ink)]">{school.name}</span>
                  <span className="shrink-0 text-[11px] tracking-wide text-[var(--muted)] uppercase">
                    {school.levels.map(shortLevel).join(" · ")}
                  </span>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {school.gradeLabel}
                  {school.enrollment != null ? ` · ${school.enrollment.toLocaleString()} students` : ""}
                  {school.charter ? " · Charter" : ""}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="relative h-[55vh] min-h-[22rem] min-w-0 flex-1 overflow-hidden lg:h-full">
        <DistrictMap
          district={district}
          schoolZone={schoolZone}
          schools={visibleSchools}
          listings={visibleListings}
          selectedSchoolId={selectedSchoolId}
          selectedListingId={selectedListingId}
          onSelectSchool={handleSchoolClick}
          onSelectListing={setSelectedListingId}
        />
        {selectedSchool ? (
          <div className="pointer-events-auto absolute top-4 right-4 z-10 w-[min(22rem,calc(100%-2rem))]">
            <SchoolDetail school={selectedSchool} zone={schoolZone} />
          </div>
        ) : district ? (
          <div className="pointer-events-none absolute top-4 right-4 z-10 max-w-xs rounded-md border border-[var(--line)] bg-[var(--paper)]/95 px-3 py-2 text-sm text-[var(--ink)]">
            Click a school on the left. Its attendance zone (orange) will draw on the map.
          </div>
        ) : (
          <div className="pointer-events-none absolute top-4 right-4 z-10 max-w-xs rounded-md border border-[var(--line)] bg-[var(--paper)]/95 px-3 py-2 text-sm text-[var(--ink)]">
            Search and choose a district on the left. Drag and zoom the map freely.
          </div>
        )}
        <p className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-sm text-[10px] leading-snug text-[var(--muted)]">
          District outlines: NCES EDGE 2024–25. School zones: NCES SABS 2015–16 where available.
          Map: OpenFreeMap / OpenStreetMap. Homes are sample points until an MLS/IDX feed is connected.
        </p>
      </section>
    </div>
  );
}

function SchoolDetail({ school, zone }: { school: School; zone: AttendanceZone | null }) {
  return (
    <article className="rounded-md border border-[var(--line)] bg-white p-3">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--forest)] uppercase">
        School
      </p>
      <h3 className="mt-1 text-base font-semibold text-[var(--ink)]">{school.name}</h3>
      <p className="text-sm text-[var(--muted)]">
        {school.street}, {school.city}, {school.state} {school.zip}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <Fact label="Grades" value={school.gradeLabel} />
        <Fact label="Enrollment" value={school.enrollment?.toLocaleString() ?? "—"} />
        <Fact label="Student–teacher" value={school.studentTeacher?.toFixed(1) ?? "—"} />
        <Fact label="FRPL" value={school.frplShare != null ? `${school.frplShare}%` : "—"} />
      </dl>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {school.charter ? <Tag>Charter</Tag> : null}
        {school.magnet ? <Tag>Magnet</Tag> : null}
        {school.titleI ? <Tag>Title I</Tag> : null}
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">
        {zone
          ? `Orange outline is this school's attendance zone (NCES SABS ${zone.vintage}; may be dated).`
          : "No published school-level zone for this campus. The green outline is the whole district."}
      </p>
      <p className="mt-2 text-xs text-[var(--muted)]">Official CCD profile, plus ratings sites:</p>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
        <a className="text-[var(--forest)] underline" href={school.links.nces} target="_blank" rel="noreferrer">
          NCES
        </a>
        <a className="text-[var(--forest)] underline" href={school.links.greatSchools} target="_blank" rel="noreferrer">
          GreatSchools
        </a>
        <a className="text-[var(--forest)] underline" href={school.links.niche} target="_blank" rel="noreferrer">
          Niche
        </a>
      </div>
    </article>
  );
}

function ListingDetail({ listing, note }: { listing: Listing; note: string }) {
  return (
    <article className="mx-5 mt-3 rounded-md border border-[var(--line)] bg-white p-3">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-[#8a7014] uppercase">
        Sample home
      </p>
      <h3 className="mt-1 text-base font-semibold text-[var(--ink)]">
        {formatPrice(listing.price)}
      </h3>
      <p className="text-sm text-[var(--muted)]">
        {listing.beds} bd · {listing.baths} ba · {listing.sqft.toLocaleString()} sqft
      </p>
      <p className="text-sm text-[var(--ink)]">
        {listing.address}, {listing.city}, {listing.state}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{note}</p>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] tracking-wide text-[var(--muted)] uppercase">{label}</dt>
      <dd className="text-[var(--ink)]">{value}</dd>
    </div>
  );
}

function Tag({ children }: { children: string }) {
  return (
    <span className="rounded border border-[var(--line)] px-2 py-0.5 text-[11px] text-[var(--ink)]">
      {children}
    </span>
  );
}

function LevelToggle({
  label,
  tone,
  active,
  onClick,
}: {
  label: string;
  tone: SchoolLevelKey;
  active: boolean;
  onClick: () => void;
}) {
  const color =
    tone === "elementary" ? "#c45c26" : tone === "middle" ? "#1d6b6b" : "#243a6b";
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border px-2 py-2 text-xs font-semibold"
      style={{
        borderColor: active ? color : "var(--line)",
        background: active ? `${color}14` : "white",
        color: active ? color : "var(--muted)",
      }}
    >
      {label}
    </button>
  );
}

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<[T, string]>;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="rounded border border-[var(--line)] bg-white px-2 py-1.5 text-sm text-[var(--ink)]"
      >
        {options.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function matchesFilters(school: School, filters: SchoolFilters): boolean {
  const levelOk =
    (filters.elementary && school.levels.includes("elementary")) ||
    (filters.middle && school.levels.includes("middle")) ||
    (filters.high && school.levels.includes("high")) ||
    (filters.other && school.levels.includes("other"));
  if (!levelOk) return false;
  if (filters.charter === "yes" && !school.charter) return false;
  if (filters.charter === "no" && school.charter) return false;
  if (filters.magnet === "yes" && !school.magnet) return false;
  if (filters.titleI === "yes" && !school.titleI) return false;
  if (school.enrollment != null && school.enrollment < filters.minEnrollment) return false;
  if (school.frplShare != null && school.frplShare > filters.maxFrplShare) return false;
  if (school.virtual) return false;
  return true;
}

function kindLabel(kind: DistrictSummary["kind"]): string {
  if (kind === "elementary") return "Elementary district";
  if (kind === "secondary") return "High school district";
  if (kind === "unified") return "Unified district";
  if (kind === "administrative") return "Administrative";
  return "District";
}

function shortLevel(level: SchoolLevelKey): string {
  if (level === "elementary") return "Elem";
  if (level === "middle") return "Middle";
  if (level === "high") return "High";
  return "Other";
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

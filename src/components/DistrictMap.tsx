"use client";

import { useEffect, useRef } from "react";
import { AttributionControl, Map, NavigationControl } from "maplibre-gl";
import type { GeoJSONSource, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { geometryBbox } from "@/lib/geo";
import type { AttendanceZone, DistrictDetail, Listing, School } from "@/lib/types";

type Props = {
  district: DistrictDetail | null;
  schoolZone: AttendanceZone | null;
  schools: School[];
  listings: Listing[];
  selectedSchoolId: string | null;
  selectedListingId: string | null;
  onSelectSchool: (id: string) => void;
  onSelectListing: (id: string) => void;
};

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const OPENFREEMAP = "https://tiles.openfreemap.org/styles/liberty";
const OVERLAY_LAYERS = [
  "district-fill",
  "district-line",
  "school-zone-fill",
  "school-zone-line",
  "listings-circle",
  "schools-circle",
  "schools-label",
];

const ESRI_STREETS: StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Tiles © Esri",
    },
  },
  layers: [{ id: "esri", type: "raster", source: "esri" }],
};

export default function DistrictMap({
  district,
  schoolZone,
  schools,
  listings,
  selectedSchoolId,
  selectedListingId,
  onSelectSchool,
  onSelectListing,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const districtPathRef = useRef<SVGPathElement>(null);
  const zonePathRef = useRef<SVGPathElement>(null);
  const onSelectSchoolRef = useRef(onSelectSchool);
  const onSelectListingRef = useRef(onSelectListing);
  const dataRef = useRef({
    district,
    schoolZone,
    schools,
    listings,
    selectedSchoolId,
    selectedListingId,
  });
  onSelectSchoolRef.current = onSelectSchool;
  onSelectListingRef.current = onSelectListing;
  dataRef.current = {
    district,
    schoolZone,
    schools,
    listings,
    selectedSchoolId,
    selectedListingId,
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let usedFallback = false;
    const map = new Map({
      container,
      style: OPENFREEMAP,
      center: [-96.8, 39.8],
      zoom: 3.6,
      attributionControl: false,
      dragPan: true,
      scrollZoom: true,
      boxZoom: true,
      doubleClickZoom: true,
      keyboard: true,
      touchZoomRotate: true,
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    mapRef.current = map;

    const redrawBoundaries = () => {
      const districtPath = districtPathRef.current;
      const zonePath = zonePathRef.current;
      if (!districtPath || !zonePath) return;
      const { district: currentDistrict, schoolZone: currentZone } = dataRef.current;
      districtPath.setAttribute(
        "d",
        currentDistrict ? geometryToPath(map, currentDistrict.geometry) : "",
      );
      zonePath.setAttribute(
        "d",
        currentZone ? geometryToPath(map, currentZone.geometry) : "",
      );
    };

    const ensureOverlays = () => {
      if (cancelled || !map.getStyle()) return;
      if (!map.getSource("sdr-district")) {
        map.addSource("sdr-district", { type: "geojson", data: EMPTY });
        map.addSource("sdr-school-zone", { type: "geojson", data: EMPTY });
        map.addSource("sdr-listings", { type: "geojson", data: EMPTY });
        map.addSource("sdr-schools", { type: "geojson", data: EMPTY });

        map.addLayer({
          id: "district-fill",
          type: "fill",
          source: "sdr-district",
          paint: { "fill-color": "#1f7a45", "fill-opacity": 0.2 },
        });
        map.addLayer({
          id: "district-line",
          type: "line",
          source: "sdr-district",
          paint: { "line-color": "#14532d", "line-width": 4, "line-opacity": 1 },
        });
        map.addLayer({
          id: "school-zone-fill",
          type: "fill",
          source: "sdr-school-zone",
          paint: { "fill-color": "#ea580c", "fill-opacity": 0.32 },
        });
        map.addLayer({
          id: "school-zone-line",
          type: "line",
          source: "sdr-school-zone",
          paint: { "line-color": "#9a3412", "line-width": 4, "line-opacity": 1 },
        });
        map.addLayer({
          id: "listings-circle",
          type: "circle",
          source: "sdr-listings",
          paint: {
            "circle-radius": ["case", ["==", ["get", "selected"], 1], 7, 4.5],
            "circle-color": "#ca8a04",
            "circle-stroke-width": 1.2,
            "circle-stroke-color": "#fffbeb",
          },
        });
        map.addLayer({
          id: "schools-circle",
          type: "circle",
          source: "sdr-schools",
          paint: {
            "circle-radius": ["case", ["==", ["get", "selected"], 1], 12, 8],
            "circle-color": [
              "match",
              ["get", "tone"],
              "high",
              "#1e3a8a",
              "middle",
              "#0f766e",
              "elementary",
              "#c2410c",
              "#57534e",
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
        try {
          map.addLayer({
            id: "schools-label",
            type: "symbol",
            source: "sdr-schools",
            layout: {
              "text-field": ["get", "name"],
              "text-size": 12,
              "text-offset": [0, 1.15],
              "text-anchor": "top",
              "text-optional": true,
            },
            paint: {
              "text-color": "#1c1917",
              "text-halo-color": "#ffffff",
              "text-halo-width": 1.4,
            },
          });
        } catch {
          // Raster fallback styles may not ship glyphs.
        }

        map.on("click", "schools-circle", (event) => {
          const id = event.features?.[0]?.properties?.id;
          if (typeof id === "string") onSelectSchoolRef.current(id);
        });
        map.on("click", "listings-circle", (event) => {
          const id = event.features?.[0]?.properties?.id;
          if (typeof id === "string") onSelectListingRef.current(id);
        });
        for (const layer of ["schools-circle", "listings-circle"]) {
          map.on("mouseenter", layer, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layer, () => {
            map.getCanvas().style.cursor = "";
          });
        }
      }

      for (const layer of OVERLAY_LAYERS) {
        if (map.getLayer(layer)) map.moveLayer(layer);
      }
      paintOverlays(map, dataRef.current);
      redrawBoundaries();
    };

    map.on("load", ensureOverlays);
    map.once("idle", ensureOverlays);
    map.on("move", redrawBoundaries);
    map.on("zoom", redrawBoundaries);
    map.on("resize", redrawBoundaries);

    const fallbackTimer = window.setTimeout(() => {
      if (cancelled || usedFallback || map.isStyleLoaded()) return;
      usedFallback = true;
      map.setStyle(ESRI_STREETS);
    }, 7000);

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getSource("sdr-district")) {
      for (const layer of OVERLAY_LAYERS) {
        if (map.getLayer(layer)) map.moveLayer(layer);
      }
      paintOverlays(map, dataRef.current);
    }
    const focus = schoolZone?.geometry ?? district?.geometry;
    if (focus) fitGeometry(map, focus);
    districtPathRef.current?.setAttribute(
      "d",
      district ? geometryToPath(map, district.geometry) : "",
    );
    zonePathRef.current?.setAttribute(
      "d",
      schoolZone ? geometryToPath(map, schoolZone.geometry) : "",
    );
  }, [district, schoolZone, schools, listings, selectedSchoolId, selectedListingId]);

  return (
    <div className="absolute inset-0 bg-[#e6e2d8]">
      <div ref={containerRef} className="absolute inset-0 [&_.maplibregl-canvas]:cursor-grab" />
      <svg
        className="pointer-events-none absolute inset-0 z-[1] h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <path
          ref={districtPathRef}
          fill="#1f7a45"
          fillOpacity="0.16"
          fillRule="evenodd"
          stroke="#14532d"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          ref={zonePathRef}
          fill="#ea580c"
          fillOpacity="0.28"
          fillRule="evenodd"
          stroke="#9a3412"
          strokeWidth="4"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function paintOverlays(
  map: Map,
  data: {
    district: DistrictDetail | null;
    schoolZone: AttendanceZone | null;
    schools: School[];
    listings: Listing[];
    selectedSchoolId: string | null;
    selectedListingId: string | null;
  },
) {
  const districtSource = map.getSource("sdr-district") as GeoJSONSource | undefined;
  const zoneSource = map.getSource("sdr-school-zone") as GeoJSONSource | undefined;
  const schoolSource = map.getSource("sdr-schools") as GeoJSONSource | undefined;
  const listingSource = map.getSource("sdr-listings") as GeoJSONSource | undefined;
  if (!districtSource || !zoneSource || !schoolSource || !listingSource) return;

  districtSource.setData(collectionFromGeometry(data.district?.geometry ?? null));
  zoneSource.setData(collectionFromGeometry(data.schoolZone?.geometry ?? null));
  schoolSource.setData({
    type: "FeatureCollection",
    features: data.schools.map((school) => ({
      type: "Feature",
      properties: {
        id: school.ncesId,
        name: school.name,
        selected: school.ncesId === data.selectedSchoolId ? 1 : 0,
        tone: school.levels.includes("high")
          ? "high"
          : school.levels.includes("middle")
            ? "middle"
            : school.levels.includes("elementary")
              ? "elementary"
              : "other",
      },
      geometry: { type: "Point", coordinates: [school.lon, school.lat] },
    })),
  });
  listingSource.setData({
    type: "FeatureCollection",
    features: data.listings.map((listing) => ({
      type: "Feature",
      properties: {
        id: listing.id,
        selected: listing.id === data.selectedListingId ? 1 : 0,
      },
      geometry: { type: "Point", coordinates: [listing.lon, listing.lat] },
    })),
  });
}

function geometryToPath(map: Map, geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): string {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons
    .map((rings) =>
      rings
        .map((ring) => {
          if (ring.length < 2) return "";
          return `${ring
            .map((position, index) => {
              const point = map.project([Number(position[0]), Number(position[1])]);
              return `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
            })
            .join(" ")} Z`;
        })
        .join(" "),
    )
    .join(" ");
}

function collectionFromGeometry(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | null,
): GeoJSON.FeatureCollection {
  if (!geometry) return EMPTY;
  return {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry }],
  };
}

function fitGeometry(map: Map, geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon) {
  const [minX, minY, maxX, maxY] = geometryBbox(geometry);
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return;
  map.fitBounds(
    [
      [minX, minY],
      [maxX, maxY],
    ],
    { padding: 64, duration: 700, maxZoom: 14 },
  );
}

"use client";

import { useEffect } from "react";
import type { LatLngBoundsExpression, PathOptions } from "leaflet";
import { latLng } from "leaflet";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Polygon,
  Rectangle,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
} from "react-leaflet";
import type { FeatureCollection, Geometry } from "geojson";
import { bboxCenter, formatCenter } from "@/lib/area";
import { featureCenter, toLatLng, toLatLngBounds } from "@/lib/geoUtils";
import { PRIORITY_BANDS, priorityBand } from "@/lib/scoring";
import type { Bbox, MapFeature, MapFeatureProperties, RankedCell, ScenarioResult } from "@/types";

const FEATURE_STYLE: Record<"green" | "building", PathOptions> = {
  green: { color: "#2f7d46", weight: 1.5, fillColor: "#4b8f55", fillOpacity: 0.65, interactive: false },
  building: { color: "#5f6862", weight: 0.6, fillColor: "#8a938b", fillOpacity: 0.55, interactive: false },
};

const FACILITY_COLOR = { school: "#2d6cdf", hospital: "#d6336c" } as const;

// Dashed outline marks the cluster as a proposal, not mapped greenery.
const SCENARIO_STYLE: PathOptions = {
  color: "#123e2a",
  weight: 2,
  dashArray: "6 5",
  fillColor: "#3f9a5c",
  fillOpacity: 0.28,
  interactive: false,
};

export interface MapViewProps {
  /** Bounds of the selected study area. */
  bbox: Bbox;
  green: MapFeature[];
  buildings: MapFeature[];
  facilities: MapFeature[];
  cells: RankedCell[];
  selectedCellId: string | null;
  onSelectCell: (id: string) => void;
  scenario: ScenarioResult | null;
}

const asCollection = (features: MapFeature[]): FeatureCollection<Geometry, MapFeatureProperties> => ({
  type: "FeatureCollection",
  features,
});

/** Keeps the selected cell in view when it is chosen from the side panel. */
function PanToSelection({ cell }: { cell: RankedCell | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (!cell) return;
    const target = latLng(toLatLng(cell.center));
    if (!map.getBounds().pad(-0.1).contains(target)) map.panTo(target);
  }, [cell, map]);
  return null;
}

export default function MapView({
  bbox,
  green,
  buildings,
  facilities,
  cells,
  selectedCellId,
  onSelectCell,
  scenario,
}: MapViewProps) {
  const selected = cells.find((c) => c.id === selectedCellId);
  const reachedFacilities = new Set(scenario?.coveredFacilityIds ?? []);
  const studyBounds: LatLngBoundsExpression = toLatLngBounds(bbox);

  return (
    <div className="relative h-[520px] lg:h-[600px]">
      <MapContainer bounds={studyBounds} zoomControl={false} className="z-0">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Rectangle
          bounds={studyBounds}
          pathOptions={{ color: "#1f6b45", fill: false, weight: 2, dashArray: "7 7", interactive: false }}
        />

        {/* Priority heat grid */}
        {cells.map((cell) => (
          <Polygon
            key={cell.id}
            positions={cell.geometry.coordinates[0].map((p) => toLatLng(p as [number, number]))}
            pathOptions={{
              color: "#ffffff",
              weight: 0.8,
              fillColor: priorityBand(cell.priority).color,
              fillOpacity: cell.priority === "unscored" ? 0.3 : 0.55,
            }}
            eventHandlers={{ click: () => onSelectCell(cell.id) }}
          >
            <Tooltip sticky>
              <span className="font-semibold">{cell.id}</span> ·{" "}
              {cell.priority === "unscored" ? "not scored (nothing mapped)" : `score ${cell.score} · rank #${cell.rank}`}
            </Tooltip>
          </Polygon>
        ))}

        {/* Mapped context layers (non-interactive so clicks reach the grid) */}
        {green.length > 0 && <GeoJSON data={asCollection(green)} style={FEATURE_STYLE.green} />}
        {buildings.length > 0 && <GeoJSON data={asCollection(buildings)} style={FEATURE_STYLE.building} />}

        {scenario && (
          <Polygon
            positions={scenario.coverageGeometry.coordinates[0].map((p) => toLatLng(p as [number, number]))}
            pathOptions={SCENARIO_STYLE}
          />
        )}

        {selected && (
          <Polygon
            positions={selected.geometry.coordinates[0].map((p) => toLatLng(p as [number, number]))}
            pathOptions={{ color: "#123e2a", weight: 3.5, fill: false, interactive: false }}
          />
        )}

        {facilities.map((f) => {
          const category = f.properties.category as keyof typeof FACILITY_COLOR;
          const reached = reachedFacilities.has(f.properties.id);
          return (
            <CircleMarker
              key={f.properties.id}
              center={toLatLng(featureCenter(f.geometry))}
              radius={reached ? 9 : 7}
              pathOptions={{
                color: reached ? "#123e2a" : "#ffffff",
                weight: reached ? 3 : 2,
                fillColor: FACILITY_COLOR[category],
                fillOpacity: 1,
              }}
            >
              <Tooltip direction="top">
                {f.properties.name ?? (category === "school" ? "School" : "Hospital")} · {category}
                {reached ? " · within proposed cluster" : ""}
              </Tooltip>
            </CircleMarker>
          );
        })}

        <PanToSelection cell={selected} />
        <ZoomControl position="bottomright" />
      </MapContainer>

      <div className="pointer-events-none absolute left-4 top-4 z-[500] rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-lg backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--green)]">Study boundary</p>
        <p className="mt-1 text-sm font-medium text-[var(--green-dark)]">{formatCenter(bboxCenter(bbox))}</p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">Click any cell to inspect its score</p>
      </div>

      <div className="absolute bottom-4 left-4 z-[500] rounded-2xl border border-white/70 bg-white/90 px-4 py-3 text-xs shadow-lg backdrop-blur">
        <p className="mb-2 font-semibold uppercase tracking-[0.13em] text-[var(--green)]">Greening priority</p>
        <ul className="space-y-1">
          {PRIORITY_BANDS.map((band) => (
            <li key={band.level} className="flex items-center gap-2 text-[var(--green-dark)]">
              <span className="h-3 w-5 rounded-sm" style={{ backgroundColor: band.color }} aria-hidden="true" />
              {band.label} <span className="text-[var(--muted)]">({band.hint})</span>
            </li>
          ))}
          {scenario && (
            <li className="flex items-center gap-2 text-[var(--green-dark)]">
              <span
                className="h-3 w-5 rounded-sm border-2 border-dashed border-[#123e2a] bg-[#3f9a5c]/30"
                aria-hidden="true"
              />
              Proposed cluster <span className="text-[var(--muted)]">(hypothetical)</span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

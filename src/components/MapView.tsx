"use client";

import { LatLngBoundsExpression } from "leaflet";
import { MapContainer, Rectangle, TileLayer, Tooltip, ZoomControl } from "react-leaflet";

const LAHORE_CENTER: [number, number] = [31.5204, 74.3587];
const PILOT_BOUNDS: LatLngBoundsExpression = [
  [31.5114, 74.3481],
  [31.5294, 74.3693],
];

export default function MapView() {
  return (
    <div className="relative h-[520px] lg:h-[600px]">
      <MapContainer center={LAHORE_CENTER} zoom={15} zoomControl={false} className="z-0">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Rectangle
          bounds={PILOT_BOUNDS}
          pathOptions={{ color: "#1f6b45", fillColor: "#bde77e", fillOpacity: 0.08, weight: 2, dashArray: "7 7" }}
        >
          <Tooltip direction="top" sticky>
            Lahore pilot area · approximately 2 × 2 km
          </Tooltip>
        </Rectangle>
        <ZoomControl position="bottomright" />
      </MapContainer>
      <div className="map-grid-overlay pointer-events-none absolute inset-0 z-[400] opacity-40" aria-hidden="true" />
      <div className="pointer-events-none absolute left-4 top-4 z-[500] rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-lg backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--green)]">Study boundary</p>
        <p className="mt-1 text-sm font-medium text-[var(--green-dark)]">Lahore · 31.5204° N, 74.3587° E</p>
      </div>
    </div>
  );
}

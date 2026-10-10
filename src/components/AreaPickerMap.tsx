"use client";

import { useEffect } from "react";
import { latLng } from "leaflet";
import { MapContainer, Rectangle, TileLayer, Tooltip, useMap, useMapEvents, ZoomControl } from "react-leaflet";
import { areaToBbox } from "@/lib/area";
import { toLatLng, toLatLngBounds } from "@/lib/geoUtils";
import type { AreaSelection, LngLat } from "@/types";

export interface AreaPickerMapProps {
  area: AreaSelection;
  onPickCenter: (center: LngLat) => void;
  /** Bumped by the parent when the centre moved from outside the map (search or preset). */
  recenterKey: number;
}

function ClickToPick({ onPickCenter }: { onPickCenter: (center: LngLat) => void }) {
  useMapEvents({
    click: (event) => onPickCenter([event.latlng.lng, event.latlng.lat]),
  });
  return null;
}

function FitSelection({ area, recenterKey }: { area: AreaSelection; recenterKey: number }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(toLatLngBounds(areaToBbox(area)), { padding: [48, 48] });
    // Only refit when the parent signals a jump, not on every click.
  }, [recenterKey, map]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const target = latLng(toLatLng(area.center));
    if (!map.getBounds().pad(-0.05).contains(target)) map.panTo(target);
  }, [area.center, map]);

  return null;
}

export default function AreaPickerMap({ area, onPickCenter, recenterKey }: AreaPickerMapProps) {
  const bounds = toLatLngBounds(areaToBbox(area));

  return (
    <div className="h-[380px] sm:h-[460px] lg:h-[560px]">
      <MapContainer bounds={bounds} zoomControl={false} className="z-0 cursor-crosshair">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Rectangle
          bounds={bounds}
          pathOptions={{ color: "#123e2a", weight: 2.5, fillColor: "#bde77e", fillOpacity: 0.22, interactive: false }}
        >
          <Tooltip direction="top" sticky>
            {area.sizeKm} × {area.sizeKm} km study area
          </Tooltip>
        </Rectangle>
        <ClickToPick onPickCenter={onPickCenter} />
        <FitSelection area={area} recenterKey={recenterKey} />
        <ZoomControl position="bottomright" />
      </MapContainer>
    </div>
  );
}

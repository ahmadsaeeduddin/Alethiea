"use client";

import dynamic from "next/dynamic";
import type { MapViewProps } from "@/components/MapView";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="map-loading-backdrop grid h-[520px] place-items-center text-sm font-medium text-[var(--muted)] lg:h-[600px]">
      Drawing the priority map…
    </div>
  ),
});

export function MapShell(props: MapViewProps) {
  return <MapView {...props} />;
}

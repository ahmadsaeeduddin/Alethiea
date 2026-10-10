"use client";

import dynamic from "next/dynamic";
import type { MapViewProps } from "@/components/MapView";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="map-loading-backdrop grid h-[520px] place-items-center text-sm font-medium text-[var(--muted)] lg:h-[600px]">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="h-4 w-4 rounded-full border-2 border-[var(--line)] border-t-[var(--green)] motion-safe:animate-spin"
        />
        Drawing the priority map…
      </div>
    </div>
  ),
});

export function MapShell(props: MapViewProps) {
  return <MapView {...props} />;
}

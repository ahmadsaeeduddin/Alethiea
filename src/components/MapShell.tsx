"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[520px] place-items-center bg-[#e8eee3] text-sm font-medium text-[var(--muted)] lg:h-[600px]">
      Preparing the Lahore map…
    </div>
  ),
});

export function MapShell() {
  return <MapView />;
}

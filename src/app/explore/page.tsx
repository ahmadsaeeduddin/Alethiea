import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";
import { areaFromParams, formatCenter } from "@/lib/area";

export const metadata: Metadata = {
  title: "GreenGap | Greening priorities",
  description: "Explore where urban greening could have the greatest local value.",
};

interface ExplorePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = await searchParams;
  const area = areaFromParams(params);

  // No usable area in the URL: send the visitor back to pick one.
  if (!area) redirect("/");

  const label = typeof params.label === "string" ? params.label : formatCenter(area.center);
  return <Dashboard area={area} label={label} />;
}

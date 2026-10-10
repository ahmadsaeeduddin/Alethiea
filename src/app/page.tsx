import type { Metadata } from "next";
import { AreaPicker } from "@/components/AreaPicker";

export const metadata: Metadata = {
  title: "GreenGap | Choose a study area",
  description: "Pick a square study area and see which zones are most underserved by mapped greenery.",
};

export default function Home() {
  return <AreaPicker />;
}

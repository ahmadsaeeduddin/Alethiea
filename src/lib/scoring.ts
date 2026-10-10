import type { ScoreComponents } from "@/types";

const WEIGHTS = {
  greenScarcity: 0.5,
  buildingConcentration: 0.3,
  vulnerableFacilities: 0.2,
} as const;

export function calculatePriorityScore(components: ScoreComponents): number {
  const score =
    components.greenScarcity * WEIGHTS.greenScarcity +
    components.buildingConcentration * WEIGHTS.buildingConcentration +
    components.vulnerableFacilities * WEIGHTS.vulnerableFacilities;

  return Math.round(Math.min(100, Math.max(0, score)));
}

import "server-only";
import fsobData from "@/lib/fsob-data.json";

type FsobData = {
  source: string;
  count: number;
  riksToFisv: Record<string, string>;
  fiToFisv: Record<string, string>;
  fisvToFi: Record<string, string>;
};

const data = fsobData as FsobData;

/**
 * If `s` is a known rikssvenska form, return its Finland-Swedish equivalent.
 * Otherwise return `s` unchanged.
 *
 * Used to post-correct LLM output that tends to drift toward Sweden-Swedish.
 *   toFinlandSwedish("köttfärs") -> "malet kött"
 *   toFinlandSwedish("filmjölk") -> "surmjölk"
 *   toFinlandSwedish("mjölk")    -> "mjölk"   (same in both varieties)
 */
export function toFinlandSwedish(s: string): string {
  if (!s) return s;
  const key = s.trim().toLowerCase();
  return data.riksToFisv[key] ?? s;
}

/**
 * If `s` is a Finnish word with a known Finland-Swedish equivalent, return it.
 * Useful when the user typed Finnish and we want the matching FI-SV display name.
 */
export function finnishToFinlandSwedish(s: string): string | null {
  if (!s) return null;
  return data.fiToFisv[s.trim().toLowerCase()] ?? null;
}

/**
 * If `s` is a Finland-Swedish word with a known Finnish equivalent, return it.
 */
export function finlandSwedishToFinnish(s: string): string | null {
  if (!s) return null;
  return data.fisvToFi[s.trim().toLowerCase()] ?? null;
}

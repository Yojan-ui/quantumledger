/**
 * Cities and the twelve routes the live mesh carries traffic on. Shared by the server (which runs
 * real sessions per route) and the globe (which draws one arc per route). No three.js here.
 */
export const CITIES = {
  mumbai: [19.08, 72.88],
  delhi: [28.61, 77.21],
  bengaluru: [12.97, 77.59],
  chennai: [13.08, 80.27],
  hyderabad: [17.39, 78.49],
  kolkata: [22.57, 88.36],
  pune: [18.52, 73.86],
  bhopal: [23.26, 77.41],
  gurugram: [28.46, 77.03],
  london: [51.51, -0.13],
  newyork: [40.71, -74.0],
  frankfurt: [50.11, 8.68],
  singapore: [1.35, 103.82],
  dubai: [25.2, 55.27],
  tokyo: [35.68, 139.69],
} as const;

export type City = keyof typeof CITIES;

export const CITY_LABEL: Record<City, string> = {
  mumbai: "Mumbai",
  delhi: "New Delhi",
  bengaluru: "Bengaluru",
  chennai: "Chennai",
  hyderabad: "Hyderabad",
  kolkata: "Kolkata",
  pune: "Pune",
  bhopal: "Bhopal",
  gurugram: "Gurugram",
  london: "London",
  newyork: "New York",
  frankfurt: "Frankfurt",
  singapore: "Singapore",
  dubai: "Dubai",
  tokyo: "Tokyo",
};

/** The three-node path each simulated sector uses (matches packages/sim sector nodes). */
export const SECTOR_PATHS: Record<string, [City, City, City]> = {
  fintech: ["mumbai", "hyderabad", "pune"],
  healthcare: ["pune", "delhi", "kolkata"],
  education: ["hyderabad", "bhopal", "gurugram"],
};

export interface RouteDef {
  from: City;
  to: City;
  /** "india" routes carry sector traffic; "world" routes carry it abroad. */
  kind: "india" | "world";
  sector: "fintech" | "healthcare" | "education";
  key: string;
}

const ABROAD: [City, City, RouteDef["sector"]][] = [
  ["mumbai", "london", "fintech"],
  ["delhi", "newyork", "education"],
  ["chennai", "singapore", "fintech"],
  ["bengaluru", "dubai", "fintech"],
  ["mumbai", "frankfurt", "fintech"],
  ["delhi", "tokyo", "healthcare"],
];

/** Exactly 12 routes: the six domestic sector links and six links abroad. */
export const ROUTES: RouteDef[] = [
  ...Object.entries(SECTOR_PATHS).flatMap(([sector, [a, b, c]]) =>
    (
      [
        [a, b],
        [b, c],
      ] as [City, City][]
    ).map(([from, to]) => ({
      from,
      to,
      kind: "india" as const,
      sector: sector as RouteDef["sector"],
      key: [from, to].sort().join("-"),
    })),
  ),
  ...ABROAD.map(([from, to, sector]) => ({
    from,
    to,
    kind: "world" as const,
    sector,
    key: [from, to].sort().join("-"),
  })),
];

export function routeIndex(a: City, b: City): number {
  const key = [a, b].sort().join("-");
  return ROUTES.findIndex((r) => r.key === key);
}

/**
 * Approximate server location for a scanned host, so the globe can turn to it. Uses ip-api.com's
 * free endpoint (no key, IP only, nothing about the visitor is sent). Offline, or on any failure,
 * it returns India and says so: the globe never pretends to know more than it does.
 */
export interface GeoPoint {
  lat: number;
  lon: number;
  label: string;
  /** "lookup" = from GeoIP; "fallback" = unknown, shown at India's centre. */
  source: "lookup" | "fallback";
}

export const INDIA: GeoPoint = {
  lat: 22,
  lon: 79,
  label: "India (location unknown)",
  source: "fallback",
};

export async function locate(ip: string, offline = false): Promise<GeoPoint> {
  if (offline) return INDIA;
  try {
    const r = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,lat,lon,city,country`,
      {
        signal: AbortSignal.timeout(1500),
      },
    );
    const d = (await r.json()) as {
      status: string;
      lat: number;
      lon: number;
      city?: string;
      country?: string;
    };
    if (d.status !== "success" || !Number.isFinite(d.lat)) return INDIA;
    return {
      lat: d.lat,
      lon: d.lon,
      label: [d.city, d.country].filter(Boolean).join(", "),
      source: "lookup",
    };
  } catch {
    return INDIA;
  }
}

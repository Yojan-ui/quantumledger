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
    // A third-party answer over plain HTTP: only well-formed coordinates and a short label pass.
    if (
      d.status !== "success" ||
      !Number.isFinite(d.lat) ||
      !Number.isFinite(d.lon) ||
      Math.abs(d.lat) > 90 ||
      Math.abs(d.lon) > 180
    )
      return INDIA;
    if (typeof d.city === "string") d.city = d.city.slice(0, 60);
    if (typeof d.country === "string") d.country = d.country.slice(0, 60);
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

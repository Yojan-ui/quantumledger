import { parseBody } from "@/lib/server/api";
import { requireFull } from "@/lib/server/app-route";
import { createSite } from "@/lib/server/dashboard";
import { live } from "@/lib/server/runtime";
import { SiteCreateBody } from "@/lib/server/schemas";
import { instructions } from "@qsetu/shield-edge/onboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const view = (s: {
  id: string;
  domain: string;
  mode: string;
  verifiedAt: string | null;
  verifyToken: string;
  settings: string;
  createdAt: string;
}) => ({
  id: s.id,
  domain: s.domain,
  mode: s.mode,
  verified: !!s.verifiedAt,
  verifiedAt: s.verifiedAt,
  dns: instructions(s.domain, s.verifyToken),
  settings: JSON.parse(s.settings || "{}"),
  createdAt: s.createdAt,
});

/** GET /api/app/sites: this account's sites. */
export async function GET() {
  const a = await requireFull();
  if (!a.ok) return a.res;
  const { repos } = await live();
  return Response.json({ sites: (await repos.sites.forAccount(a.account.id)).map(view) });
}

/** POST /api/app/sites { domain }: adds a site in monitor mode. The site key is shown this once. */
export async function POST(req: Request) {
  const a = await requireFull();
  if (!a.ok) return a.res;
  const b = await parseBody(req, SiteCreateBody);
  if (!b.ok) return b.res;
  const { site, key } = await createSite(a.account.id, b.data.domain);
  return Response.json({ site: view(site), key }, { headers: { "cache-control": "no-store" } });
}

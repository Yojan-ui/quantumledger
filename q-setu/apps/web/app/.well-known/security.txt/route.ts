import { SITE_URL } from "@/lib/meta";

/** /.well-known/security.txt (RFC 9116). The contact comes from SECURITY_CONTACT; expires yearly. */
export function GET() {
  const contact = process.env.SECURITY_CONTACT ?? "mailto:security@quantumledger.example";
  const expires = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 0, 1)).toISOString();
  const body = [
    `Contact: ${contact}`,
    `Expires: ${expires}`,
    "Preferred-Languages: en, hi",
    `Policy: ${SITE_URL}/security`,
    `Canonical: ${SITE_URL}/.well-known/security.txt`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}

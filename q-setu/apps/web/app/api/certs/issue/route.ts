import { SECTORS } from "@qsetu/sim";
import type { Certificate } from "@/lib/certs";
import { issue } from "@/lib/server/certs";
import { live } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/certs/issue: Deccan University issues and ML-DSA-signs a new degree certificate. */
export function POST() {
  const r = SECTORS.education.generate();
  const cert: Certificate = {
    certificateId: r.recordId!,
    studentName: r.studentName!,
    studentId: r.studentId!,
    degree: r.degree!,
    grade: r.grade!,
    year: r.year!,
    university: "Deccan University",
  };
  const signed = issue(cert);
  live().bus.publish({
    op: "SIGN",
    source: "certs",
    alg: "ml-dsa-65",
    ms: signed.signMs,
    ok: true,
    sector: "education",
    bytes: Buffer.from(signed.signature, "base64").length,
    detail: `certificate ${cert.certificateId}`,
  });
  return Response.json(signed);
}

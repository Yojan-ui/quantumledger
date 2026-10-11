"use client";

import { bytesToBase64, getSig, utf8ToBytes } from "@qsetu/core";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import {
  canonicalCert,
  qrPayload,
  verifyCertificate,
  type Certificate,
  type SignedCertificate,
  type VerifyResult,
} from "@/lib/certs";
import { ms } from "@/lib/format";
import { token } from "@/lib/tokens";
import { Button, Heading, Label, Text } from "@/components/ui";

type Check = VerifyResult & { label: string };

/**
 * Education scenario: the university signs a degree certificate with ML-DSA-65; an employer scans
 * the QR code (decoded from the rendered pixels with jsQR) and verifies it against the registry.
 */
export function CertificateFlow() {
  const [signed, setSigned] = useState<SignedCertificate>();
  const [printed, setPrinted] = useState<Certificate>();
  const [checks, setChecks] = useState<Check[]>([]);
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  async function issue() {
    setBusy(true);
    const s = (await (
      await fetch("/api/certs/issue", { method: "POST" })
    ).json()) as SignedCertificate;
    setSigned(s);
    setPrinted(s.cert);
    setChecks([]);
    setBusy(false);
  }

  useEffect(() => {
    if (signed && canvas.current)
      void QRCode.toCanvas(canvas.current, qrPayload(signed.cert), {
        width: 148,
        margin: 1,
        color: { dark: token("--bg"), light: token("--text") },
      });
  }, [signed]);

  async function scan(label: string, presented: Certificate, registryOverride?: SignedCertificate) {
    const c = canvas.current!;
    const img = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
    const code = jsQR(img.data, img.width, img.height);
    if (!code)
      return setChecks((x) => [...x, { label, ok: false, ms: 0, reason: "QR not readable" }]);
    const qr = JSON.parse(code.data) as { id: string; d: string };
    const [registry, issuer] = await Promise.all([
      registryOverride ??
        fetch(`/api/certs/${qr.id}`).then((r) => r.json() as Promise<SignedCertificate>),
      fetch("/api/certs/issuer").then((r) => r.json() as Promise<{ publicKey: string }>),
    ]);
    setChecks((x) => [
      ...x,
      { label, ...verifyCertificate(presented, qr, registry, issuer.publicKey) },
    ]);
  }

  async function forgeGrade() {
    const forged = { ...printed!, grade: "CGPA 9.9" };
    setPrinted(forged);
    await scan("Forged grade, original QR", forged);
  }

  async function forgeSignature() {
    // The forger signs an altered record with their own ML-DSA key and serves it as the registry copy.
    const fake = { ...signed!.cert };
    const attacker = getSig("ml-dsa-65").keygen();
    const sig = bytesToBase64(
      getSig("ml-dsa-65").sign(utf8ToBytes(canonicalCert(fake)), attacker.secretKey),
    );
    await scan("Registry copy signed by a fake key", fake, { ...signed!, signature: sig });
  }

  return (
    <div className="space-y-6 border-t border-line pt-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Heading as="h2" variant="h3">
          Scenario: a degree that stays verifiable
        </Heading>
        <div className="flex flex-wrap gap-2">
          <Button onClick={issue} disabled={busy}>
            {signed ? "Issue another" : "1 University issues"}
          </Button>
          <Button onClick={() => scan("Genuine certificate", signed!.cert)} disabled={!signed}>
            2 Employer scans QR
          </Button>
          <Button onClick={forgeGrade} disabled={!signed}>
            3 Forge the grade
          </Button>
          <Button onClick={forgeSignature} disabled={!signed}>
            4 Fake the signature
          </Button>
        </div>
      </div>
      {signed && printed && (
        <div className="flex flex-wrap items-start gap-6">
          <div className="min-w-0 flex-1 rounded-lg border border-line p-6">
            <Label as="p">Deccan University · Degree certificate</Label>
            <p className="mt-4 text-h3 font-medium text-fg">{printed.studentName}</p>
            <Text size="small">
              {printed.degree}, {printed.year}
            </Text>
            <Text size="small" className={printed.grade !== signed.cert.grade ? "text-fg" : ""}>
              {printed.grade}
              {printed.grade !== signed.cert.grade && " (altered)"}
            </Text>
            <Label as="p" className="mt-4">
              {printed.certificateId} · signed with ML-DSA-65 in {ms(signed.signMs)}
            </Label>
          </div>
          <canvas ref={canvas} className="rounded-sm" aria-label="Certificate QR code" />
        </div>
      )}
      {checks.length > 0 && (
        <ul className="border-b border-line" aria-live="polite">
          {checks.map((c, i) => (
            <li key={i} className="flex justify-between gap-4 border-t border-line py-3 text-small">
              <span className="text-fg-2">
                <span className={c.ok ? "text-accent" : "text-fg"}>
                  {c.ok ? "✓ Verified" : "✕ Rejected"}
                </span>{" "}
                · {c.label}
                {!c.ok && <span>: {c.reason}</span>}
              </span>
              <span className="tabular font-mono text-fg-3">{ms(c.ms)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

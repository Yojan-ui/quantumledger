"use client";

/**
 * REPORT.PDF: the run (scan, score, fix, proof, sweep) as a one-page PDF, written by hand (PDF 1.4,
 * the built-in Courier font, no library). Simulated values are marked "(sim)", estimates as such.
 */
import { LEVELS, shorExposure, type PipelineState } from "./pipeline";
import { mosca, trustUntil } from "@/lib/mosca";

/** PDF strings: escape \\, ( and ), and keep to printable ASCII (Courier's WinAnsi subset). */
const esc = (s: string) =>
  s
    .replace(/[‐-―]/g, "-")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/[\\()]/g, (c) => `\\${c}`);

export function reportLines(s: PipelineState): string[] {
  const p = s.scan?.probe;
  const m = mosca(s.mosca.x, s.mosca.y);
  const L = s.patch ? LEVELS[s.patch.level] : undefined;
  const exp = shorExposure(s);
  const out = [
    "QUANTUMLEDGER - PQC DIAGNOSTICS REPORT",
    `Generated ${new Date().toISOString()}`,
    "",
    "01 DETECT (public TLS handshake metadata only)",
    `  Target          ${s.domain || "-"}${s.cached ? "  (cached real scan)" : ""}`,
    `  TLS version     ${p?.protocol ?? "-"}`,
    `  Key exchange    ${p?.group ?? "-"}  (hybrid PQ: ${p ? (p.hybridPq ? "yes" : "no") : "-"})`,
    `  Certificate     ${p?.certKey ?? "-"}  ${p?.certSigAlg ?? ""}`,
    `  Readiness       ${s.scan ? `${s.scan.score}/100 (${s.scan.grade})` : "-"}`,
    `  Scanned         ${s.scan?.scannedAt ?? "-"}`,
    "",
    "02 SCORE",
    `  HNDL risk       ${s.risk ?? "-"}/100  (100 - readiness)`,
    `  Shor exposure   ${s.scan ? `${exp.pct}%${exp.sim ? " (sim)" : ""}` : "-"}`,
    `  Mosca           X=${s.mosca.x} + Y=${s.mosca.y} = ${s.mosca.x + s.mosca.y} yr vs Z=${m ? `${m.z.low}-${m.z.high} yr (estimate)` : "n/a"}`,
    m ? `  Z source        ${m.z.source}` : "",
    `  Trust until     ${trustUntil(s.mosca.x)}`,
    `  Plan            ${s.plan ? `${s.plan.steps} steps; first: ${s.plan.first ?? "-"}` : "-"}`,
    "",
    "03 DEFEND (real hybrid handshake, in the browser)",
    ...(s.patch && L
      ? [
          `  Level           ${s.patch.level} ${L.label}: X25519 + ${s.patch.kem}, ${s.patch.sig}`,
          `  Ciphertext      ${s.patch.ciphertextBytes} B   ServerHello ${s.patch.serverHelloBytes} B`,
          `  Signature       ${s.patch.signatureBytes} B   Handshake ${s.patch.ms.toFixed(2)} ms`,
          `  Transcript      sha3-256 ${s.patch.transcriptSha3}`,
          `  Target after    ${L.group}, ${L.sig} certificate  (sim: the target is not patched)`,
        ]
      : ["  not run"]),
    "",
    "04 PROVE (Proof Chain)",
    ...(s.proof
      ? [
          `  Block           #${s.proof.anchorId} (checkpoint #${s.proof.checkpointId})`,
          `  Merkle root     ${s.proof.root}`,
          `  Block hash      ${s.proof.blockHash}`,
          `  Signature       ${s.proof.alg} by key ${s.proof.keyId}`,
          `                  ${s.proof.signature.slice(0, 64)}...`,
        ]
      : ["  not run"]),
    "",
    "05 RESCAN",
    ...(s.sweep
      ? [
          `  Sweep           ${s.sweep.ok ? "VERIFIED" : `FAILED at #${s.sweep.broken?.id}: ${s.sweep.broken?.detail ?? "Merkle root mismatch"}`}`,
          `  Checked         checkpoint + ${s.sweep.checked} entries, Merkle root ${s.sweep.merkleOk ? "matches" : "MISMATCH"}`,
          `  Patched score   ${s.sweep.patchedScore ?? "-"}/100 (sim)`,
        ]
      : ["  not run"]),
    "",
    "Notes: real values come from real operations. (sim) marks what QuantumLedger cannot do",
    "to a third-party server from here. Z is an expert-survey estimate, not a forecast.",
  ];
  return out;
}

export function reportPdf(s: PipelineState): Blob {
  const lines = reportLines(s);
  const size = 9;
  const lead = 12;
  const text = [
    "BT",
    `/F1 ${size} Tf`,
    `${lead} TL`,
    "40 800 Td",
    ...lines.map((l) => `(${esc(l)}) '`),
    "ET",
  ].join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([pdf], { type: "application/pdf" });
}

export function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

"use client";

import { SECTORS, type SectorId } from "@qsetu/sim";
import { HEADER_SIGNATURE, SEALED_CONTENT_TYPE, type ServerPublicKeys } from "@qsetu/web-shield";
import type { AdapterId } from "@/data/sites";
import type { MeterReading } from "@/components/demo/shell/ComputeMeter";
import { bytes, ms, us } from "@/lib/format";
import { runEdge } from "./edge-runner";
import { sdkInWorker, sealInWorker, verifyInWorker } from "@/lib/client/web-crypto";

export const SNIPPETS: Record<AdapterId, { lang: string; code: string }> = {
  web: {
    lang: "html",
    code: `<script src="/qsetu.js" data-key="af29da952c68ee32" data-endpoint="/api/"></script>`,
  },
  shield: {
    lang: "shell",
    code: `npx qsetu-shield --upstream http://localhost:4000 --listen 8443`,
  },
  sdk: {
    lang: "ts",
    code: `npm i @qsetu/sdk
const s = await createSession({ url: "/qsetu", serverKey });
await s.send(payment); // AES-256-GCM after one PQC handshake`,
  },
  edge: {
    lang: "ts",
    code: `new EdgeDevice("meter-17", deviceKey, gatewayKey,
  { ramBytes: 65_536, cpuSlowdown: 20 }); // ML-KEM-512 + ML-DSA-44`,
  },
  vault: {
    lang: "ts",
    code: `const vault = createVault({ keys });
const { id } = await vault.put(labReport); await vault.get(id);`,
  },
};

export const BEFORE_AFTER: Record<AdapterId, { before: string; after: string }> = {
  web: {
    before: "Form posts ride on TLS with RSA/ECDHE. Recorded today, readable at Q-Day.",
    after: "Bodies sealed in the browser with X25519 + ML-KEM-768; replies signed with ML-DSA-65.",
  },
  shield: {
    before: "Legacy API speaks plain HTTP/TLS-RSA between data centres.",
    after: "Shield nodes carry it over a hybrid PQC session. The app's code doesn't change.",
  },
  sdk: {
    before: "App-to-bank API keys negotiated with ECDHE. Shor's algorithm breaks them.",
    after: "One ML-DSA-authenticated hybrid handshake, then 44 bytes per message.",
  },
  edge: {
    before: "Devices use RSA-2048 or ECC, or no encryption at all, because PQC 'is too heavy'.",
    after: "Edge profile in a 64 KB budget: one handshake, AES-GCM readings, batch-signed.",
  },
  vault: {
    before: "Backups are encrypted with RSA-wrapped keys. Stolen copies are readable at Q-Day.",
    after: "Each record gets its own AES key wrapped with ML-KEM and is signed with ML-DSA.",
  },
};

export interface RunResult {
  headline: string;
  /** What an eavesdropper (or DB thief) sees without QuantumLedger. */
  plainView: string;
  /** What they see with QuantumLedger. */
  sealedView: string;
  details: { k: string; v: string }[];
  meter: MeterReading;
  vaultId?: string;
}

const json = (v: unknown) => JSON.stringify(v, null, 1);
const post = (url: string, body: unknown) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

export async function runAdapter(adapter: AdapterId, sector: SectorId): Promise<RunResult> {
  const sample = SECTORS[sector].generate();

  if (adapter === "web") {
    const key = (await (await fetch("/api/qsetu/key")).json()) as ServerPublicKeys;
    const plain = new TextEncoder().encode(JSON.stringify(sample));
    const sealed = await sealInWorker(plain, "application/json", key);
    const res = await fetch("/api/web-shield/submit", {
      method: "POST",
      headers: { "content-type": SEALED_CONTENT_TYPE, accept: "application/json" },
      body: sealed.body,
    });
    const body = new Uint8Array(await res.arrayBuffer());
    const { ok, ms: verifyMs } = await verifyInWorker(
      body,
      res.headers.get(HEADER_SIGNATURE),
      sealed.nonce,
      key,
    );
    const server = JSON.parse(new TextDecoder().decode(body));
    return {
      headline: ok
        ? "Sealed in the browser, opened by the server, reply signature verified ✓"
        : "Response signature failed ✕",
      plainView: json(sample),
      sealedView: sealed.body.slice(0, 420) + "…",
      details: [
        { k: "Pinned server key", v: key.kid },
        { k: "Server saw", v: server.transport?.sealed ? "sealed envelope → opened" : "plain" },
        { k: "Seal (browser)", v: ms(sealed.ms) },
        { k: "Verify reply (ML-DSA-65)", v: ms(verifyMs) },
      ],
      meter: {
        label: "QuantumLedger Web · one form post",
        cpuMs: sealed.ms + verifyMs,
        bytesAdded: sealed.sealedBytes - sealed.plainBytes,
        plainBytes: sealed.plainBytes,
      },
    };
  }

  if (adapter === "shield") {
    const r = await (await post("/api/shield/run", { sector })).json();
    const added = r.after.ms - r.before.ms;
    return {
      headline: `Legacy app answered “${r.after.response.status}”, unaware it was tunnelled over PQC`,
      plainView: r.before.wire,
      sealedView: r.frames
        .map(
          (f: { kind: string; bytes: number; preview: string }) =>
            `${f.kind.padEnd(13)} ${String(f.bytes).padStart(5)} B  ${f.preview}`,
        )
        .join("\n"),
      details: [
        {
          k: "Stack",
          v: r.stack === "external" ? "separate processes (see terminal)" : "started in-process",
        },
        { k: "Session", v: `${r.after.session}… · epoch ${r.after.epoch}` },
        { k: "Handshakes so far", v: String(r.stats.handshakes) },
        { k: "Requests over this session", v: String(r.stats.requests) },
      ],
      meter: {
        label:
          r.stats.requests > 1
            ? "QuantumLedger Shield · request on an existing session"
            : "QuantumLedger Shield · first request (includes handshake)",
        cpuMs: Math.max(0, added),
        cpuLabel: "Added latency",
        perRequestHint: r.stats.requests > 1 ? "this request" : "first request, incl. handshake",
        bytesAdded: 44,
        plainBytes: r.before.wire.length,
        extra: [{ label: "Direct vs shielded", value: `${ms(r.before.ms)} → ${ms(r.after.ms)}` }],
      },
    };
  }

  if (adapter === "sdk") {
    const s = await sdkInWorker(sample);
    const { reply, perMsg, wire } = s;
    return {
      headline: `Session ${s.id.slice(0, 8)}… established; server replied “${reply.status}”`,
      plainView: json(sample),
      sealedView: `epoch=${wire.epoch} seq=${wire.seq}\n${Array.from(wire.head, (b) => b.toString(16).padStart(2, "0")).join("")}…`,
      details: [
        { k: "Handshake (2 round trips)", v: ms(s.handshake.ms) },
        {
          k: "Handshake bytes",
          v: `${bytes(s.handshake.bytesSent)} ↑ · ${bytes(s.handshake.bytesReceived)} ↓`,
        },
        { k: "Per message (seal, this device)", v: us(perMsg) },
        { k: "Server identity", v: "ML-DSA-65, pinned" },
      ],
      meter: {
        label: "QuantumLedger SDK · handshake, then messages",
        cpuMs: s.handshake.ms,
        cpuLabel: "Handshake (incl. network)",
        perRequestMs: perMsg / 1000,
        perRequestHint: "per message, after the handshake",
        bytesAdded: 44,
        plainBytes: s.plainBytes,
        extra: [{ label: "Per message", value: us(perMsg) }],
      },
    };
  }

  if (adapter === "edge") {
    const r = await runEdge(sector);
    const st = r.stats;
    return {
      headline: `${r.readings} readings delivered, ${r.batchesVerified} batch signatures verified (ML-DSA-44)`,
      plainView: json({ device: r.deviceId, reading: r.lastReading }),
      sealedView: `${r.sampleCiphertext.slice(0, 160)}…`,
      details: [
        { k: "RAM peak / budget", v: `${bytes(st.ramPeak)} / ${bytes(st.ramBudget)}` },
        { k: "Device CPU (simulated 20× slower)", v: ms(st.simulatedMs) },
        { k: "Handshake bytes (once)", v: bytes(st.handshakeBytes) },
        { k: "Bytes per reading", v: `${st.bytesPerReading} B (+${st.overheadPerReading})` },
      ],
      meter: {
        label: "QuantumLedger Edge · handshake + 48 readings on a 64 KB device",
        cpuMs: st.cpuMs,
        cpuLabel: "Device crypto CPU (all)",
        perRequestMs: (st.cpuMs - st.handshakeCpuMs) / st.readings,
        perRequestHint: "per reading, after the handshake",
        bytesAdded: st.overheadPerReading,
        plainBytes: st.bytesPerReading - st.overheadPerReading,
        extra: [{ label: "RAM peak", value: `${bytes(st.ramPeak)} of 64 KB` }],
      },
    };
  }

  const put = await (await post("/api/vault", { sector })).json();
  const got = await (await fetch(`/api/vault/${put.put.id}`)).json();
  const { sig, kemCt, wrappedKey, ct, ...rest } = put.stored;
  return {
    headline: `Stored record ${put.put.id}; read back and signature verified ✓`,
    plainView: json(put.record),
    sealedView: json({
      ...rest,
      kemCt: `${kemCt.slice(0, 40)}…`,
      wrappedKey: `${wrappedKey.slice(0, 24)}…`,
      ct: `${ct.slice(0, 48)}…`,
      sig: `${sig.slice(0, 40)}… (${Math.round((sig.length * 3) / 4)} B)`,
    }),
    details: [
      { k: "Write (wrap + encrypt + sign)", v: ms(put.put.ms) },
      { k: "Read (verify + unwrap + decrypt)", v: ms(got.ms) },
      { k: "Stored size", v: `${bytes(put.put.storedBytes)} for ${bytes(put.put.plainBytes)}` },
    ],
    meter: {
      label: "QuantumLedger Vault · put + get",
      cpuMs: put.put.ms + got.ms,
      bytesAdded: put.put.storedBytes - put.put.plainBytes,
      plainBytes: put.put.plainBytes,
    },
    vaultId: put.put.id,
  };
}

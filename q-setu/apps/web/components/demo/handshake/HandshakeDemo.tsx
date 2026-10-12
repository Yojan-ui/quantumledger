"use client";

import {
  clientFinish,
  clientHello,
  createIdentity,
  handshakeBytes,
  serverComplete,
  serverRespond,
  utf8ToBytes,
  type ClientState,
  type Identity,
  type ServerPending,
  type ServerHello,
  type Session,
} from "@qsetu/core";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { LiveConsole } from "@/components/live/LiveConsole";
import { SceneView } from "@/components/world/SceneView";
import { Button, Label, Text } from "@/components/ui";
import { ComputeMeter, type MeterReading } from "@/components/demo/shell/ComputeMeter";
import { DemoShell } from "@/components/demo/shell/DemoShell";
import { StepControls } from "@/components/demo/shell/StepControls";
import { hexPreview, us } from "@/lib/format";
import { errText } from "@/lib/client/api";
import { pushLocal, useMetrics } from "@/lib/client/live";
import { useStepper } from "@/lib/client/useStepper";
import type { OpEvent, PolicyState } from "@/lib/live/types";
import type { ScenePacket } from "./HandshakeScene";

const HandshakeScene = dynamic(() => import("./HandshakeScene"), {
  ssr: false,
  loading: () => null,
});

const STEPS = [
  { title: "Hello", body: "Client sends a random value and an X25519 key share." },
  {
    title: "Signed key",
    body: "Server replies with an ephemeral ML-KEM-768 key, signed with ML-DSA-65.",
  },
  {
    title: "Hybrid secret",
    body: "Client verifies, encapsulates; X25519 and ML-KEM secrets merge through HKDF.",
  },
  {
    title: "Fast messages",
    body: "Everything after that is AES-256-GCM: microseconds and 44 bytes each.",
  },
];

const TRAVEL = 1500;

/** Crypto-agility presets for POST /api/policy (server mesh) and this tab's own handshake. */
const POLICIES = [
  {
    id: "standard",
    label: "ML-KEM-768 · ML-DSA-65",
    body: { profile: "standard", sig: "ml-dsa-65" },
  },
  { id: "edge", label: "ML-KEM-512 · ML-DSA-44", body: { profile: "edge", sig: "ml-dsa-44" } },
  {
    id: "slh",
    label: "ML-KEM-768 · SLH-DSA",
    body: { profile: "standard", sig: "slh-dsa-sha2-128f" },
  },
] as const;

/** This tab's operations, plus the server's agility events: policy changes, key ratchets, re-keys and handshakes. */
const consoleFilter = (e: OpEvent) =>
  e.source === "browser" ||
  e.op === "POLICY" ||
  e.op === "ROTATE" ||
  (e.source === "mesh" && e.op === "HANDSHAKE");

interface Live {
  identity: Identity;
  client?: ClientState;
  hello?: ReturnType<typeof clientHello>["hello"];
  serverHello?: ServerHello;
  pending?: ServerPending;
  clientSession?: Session;
  serverSession?: Session;
}

export function HandshakeDemo() {
  const live = useRef<Live>(undefined);
  const [packets, setPackets] = useState<ScenePacket[]>([]);
  const [log, setLog] = useState<{ text: string; tone?: "ok" | "bad" }[]>([]);
  const [keyAt, setKeyAt] = useState<number>();
  const [reading, setReading] = useState<MeterReading>();
  const [hover, setHover] = useState<ScenePacket>();
  const seq = useRef(0);
  const metrics = useMetrics();
  const [policy, setPolicy] = useState<PolicyState>();
  const [swapping, setSwapping] = useState(false);
  const profile = policy?.profile ?? "standard";
  const kemName = profile === "edge" ? "ML-KEM-512" : "ML-KEM-768";
  const sigName = profile === "edge" ? "ML-DSA-44" : "ML-DSA-65";

  useEffect(() => {
    void fetch("/api/policy")
      .then((r) => r.json())
      .then((p: PolicyState) => setPolicy(p));
  }, []);
  useEffect(() => {
    live.current = { identity: createIdentity(profile) };
  }, [profile]);
  useEffect(() => {
    if (metrics?.policy) setPolicy(metrics.policy);
  }, [metrics?.policy]);

  async function swap(body: (typeof POLICIES)[number]["body"]) {
    setSwapping(true);
    try {
      const r = await fetch("/api/policy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await r.json()) as PolicyState;
      if (!r.ok) throw new Error(errText(data));
      setPolicy(data);
      reset();
      say(
        `Policy g${data.generation}: ${body.profile} · ${body.sig}. Live server sessions re-key at their next rotation; nothing restarts.`,
        "ok",
      );
    } catch (e) {
      say((e as Error).message, "bad");
    } finally {
      setSwapping(false);
    }
  }

  const send = (
    p: Omit<ScenePacket, "id" | "startedAt" | "durationMs">,
    delay = 0,
    durationMs = TRAVEL,
  ) => {
    const pkt = { ...p, id: `p${++seq.current}`, startedAt: performance.now() + delay, durationMs };
    setPackets((ps) => [...ps.slice(-30), pkt]);
    return new Promise<void>((r) => setTimeout(r, delay + durationMs));
  };
  const say = (text: string, tone?: "ok" | "bad") => setLog((l) => [...l, { text, tone }]);

  async function run(i: number) {
    const L = live.current!;
    if (i === 0) {
      const t = performance.now();
      const c = clientHello(profile);
      const cpu = performance.now() - t;
      pushLocal({
        op: "HANDSHAKE",
        alg: "x25519",
        ms: cpu,
        bytes: handshakeBytes.clientHello(c.hello),
        ok: true,
        detail: "ClientHello",
      });
      L.client = c.state;
      L.hello = c.hello;
      setReading({
        label: "Step 1 · ClientHello",
        cpuMs: cpu,
        bytesAdded: handshakeBytes.clientHello(c.hello),
      });
      await send({
        dir: "c2s",
        kind: "hello",
        label: "ClientHello",
        alg: "X25519 key share",
        bytes: handshakeBytes.clientHello(c.hello),
        hex: hexPreview(c.hello.x25519, 32),
      });
      say(
        `ClientHello → X25519 share ${hexPreview(c.hello.x25519, 8)} (${handshakeBytes.clientHello(c.hello)} B)`,
      );
    } else if (i === 1) {
      const t = performance.now();
      const s = serverRespond(L.hello!, L.identity);
      const cpu = performance.now() - t;
      pushLocal({
        op: "SIGN",
        alg: `${kemName} keygen · ${sigName}`.toLowerCase(),
        ms: cpu,
        bytes: handshakeBytes.serverHello(s.serverHello),
        ok: true,
        detail: "ServerHello signed",
      });
      L.serverHello = s.serverHello;
      L.pending = s.pending;
      const b = handshakeBytes.serverHello(s.serverHello);
      setReading({
        label: `Step 2 · ServerHello (${kemName} keygen + ${sigName} sign)`,
        cpuMs: cpu,
        bytesAdded: b,
      });
      await send({
        dir: "s2c",
        kind: "signed",
        label: "ServerHello (signed)",
        alg: `${kemName} pk + ${sigName} signature`,
        bytes: b,
        hex: hexPreview(s.serverHello.kemPublicKey, 32),
      });
      say(
        `ServerHello ← ${kemName} key (${s.serverHello.kemPublicKey.length} B) sealed with ${sigName} (${s.serverHello.signature.length} B)`,
      );
    } else if (i === 2) {
      const t = performance.now();
      const f = clientFinish(L.client!, L.serverHello!, L.identity.publicKey);
      const tc = performance.now() - t;
      pushLocal({
        op: "VERIFY",
        alg: sigName.toLowerCase(),
        ms: tc,
        ok: true,
        detail: "server hello verified",
      });
      say(`Client verified ${sigName} signature ✓ (pinned server key)`, "ok");
      setKeyAt(performance.now());
      await send({
        dir: "c2s",
        kind: "finish",
        label: "ClientFinish",
        alg: `${kemName} ciphertext + key confirmation`,
        bytes: handshakeBytes.clientFinish(f.finish),
        hex: hexPreview(f.finish.kemCiphertext, 32),
      });
      const t2 = performance.now();
      const server = serverComplete(L.pending!, f.finish);
      const ts = performance.now() - t2;
      L.clientSession = f.session;
      L.serverSession = server;
      pushLocal({
        op: "HANDSHAKE",
        alg: `${kemName}+x25519`.toLowerCase(),
        ms: tc + ts,
        bytes: handshakeBytes.clientFinish(f.finish),
        ok: true,
        detail: `session ${server.id.slice(0, 8)} established`,
      });
      setReading({
        label: "Step 3 · verify + encapsulate + decapsulate + HKDF",
        cpuMs: tc + ts,
        bytesAdded: handshakeBytes.clientFinish(f.finish),
      });
      say(
        `ss_X25519 ‖ ss_ML-KEM → HKDF-SHA256 → session ${server.id.slice(0, 12)}… · key confirmation ✓`,
        "ok",
      );
    } else {
      const msgs = Array.from({ length: 14 }, (_, k) =>
        utf8ToBytes(JSON.stringify({ n: k, amountINR: (100 + k * 37).toFixed(2) })),
      );
      const t = performance.now();
      const sealed = msgs.map((m) => L.clientSession!.seal(m));
      const opened = sealed.map((m) => L.serverSession!.open(m));
      const per = ((performance.now() - t) / msgs.length) * 1000;
      const first = sealed[0]!;
      pushLocal({
        op: "SEAL",
        alg: `${kemName}+x25519`.toLowerCase(),
        ms: per / 1000,
        bytes: first.ciphertext.length + 28,
        ok: true,
        detail: `${opened.length} messages, AES-256-GCM`,
      });
      setReading({
        label: "Step 4 · AES-256-GCM messages",
        cpuMs: per / 1000,
        cpuLabel: "Per message (seal + open)",
        bytesAdded: 44,
        plainBytes: msgs[0]!.length,
        extra: [{ label: "Messages", value: `${opened.length} delivered` }],
      });
      await Promise.all(
        sealed.map((m, k) =>
          send(
            {
              dir: "c2s",
              kind: "msg",
              label: `Message #${m.seq}`,
              alg: "AES-256-GCM",
              bytes: m.ciphertext.length + 28,
              hex: hexPreview(m.ciphertext, 24),
            },
            k * 110,
            900,
          ),
        ),
      );
      say(
        `${opened.length} messages over AES-256-GCM · ${us(per)} each · +44 B (header + tag) · first ct ${hexPreview(first.ciphertext, 8)}`,
        "ok",
      );
    }
  }

  const stepper = useStepper(STEPS.length, run, 700);

  async function attack() {
    // A man-in-the-middle swaps the server's ML-KEM key for their own but can't re-sign it.
    const L = live.current!;
    const c = clientHello(profile);
    const { serverHello } = serverRespond(c.hello, L.identity);
    const forged = { ...serverHello, kemPublicKey: serverHello.kemPublicKey.slice() };
    forged.kemPublicKey.set(new Uint8Array(32).fill(0x66), 100);
    say("Attacker intercepts ServerHello and swaps in their own ML-KEM key…", "bad");
    await send(
      {
        dir: "s2c",
        kind: "attack",
        label: "Tampered ServerHello",
        alg: "forged ML-KEM key, original ML-DSA signature",
        bytes: handshakeBytes.serverHello(forged),
        hex: hexPreview(forged.kemPublicKey.subarray(96), 32),
      },
      0,
      1700,
    );
    const t = performance.now();
    try {
      clientFinish(c.state, forged, L.identity.publicKey);
      say("Unexpected: forged packet accepted", "bad");
    } catch (e) {
      pushLocal({
        op: "REJECT",
        alg: sigName.toLowerCase(),
        ms: performance.now() - t,
        ok: false,
        detail: "tampered ServerHello",
      });
      say(`✕ ${(e as Error).message}`, "bad");
      setReading({
        label: "Attack · ML-DSA-65 verification",
        cpuMs: performance.now() - t,
        extra: [{ label: "Result", value: "packet rejected" }],
      });
    }
  }

  function reset() {
    stepper.reset();
    live.current = { identity: live.current?.identity ?? createIdentity(profile) };
    setPackets([]);
    setLog([]);
    setKeyAt(undefined);
    setReading(undefined);
  }

  return (
    <DemoShell
      title="Demo 1 · How it works"
      caption="The real Q-Setu handshake, running in your browser: one signed hybrid key exchange, then fast symmetric messages. Hover a packet for its bytes."
      controls={
        <>
          <Button onClick={attack} disabled={stepper.playing}>
            Attack it
          </Button>
          <StepControls {...stepper} onStep={stepper.step} onPlay={stepper.play} onReset={reset} />
        </>
      }
      meter={<ComputeMeter reading={reading} profile={profile} />}
      console={<LiveConsole title="Live console · this tab + server" filter={consoleFilter} />}
      onAutoplay={() => void stepper.play().then(() => setTimeout(() => void attack(), 800))}
    >
      <div className="space-y-12">
        <div
          className="relative h-stage-sm overflow-hidden rounded-lg border border-line md:h-stage"
          role="img"
          aria-label="Client and server exchanging Q-Setu handshake packets along two curved links"
        >
          <SceneView className="absolute inset-0">
            <HandshakeScene
              packets={packets}
              keyAt={keyAt}
              keyed={stepper.index >= 2}
              onHover={setHover}
            />
          </SceneView>
          <div className="pointer-events-none absolute bottom-4 left-4">
            <p className="text-small text-fg">Client</p>
            <Label as="p">Browser · app · device</Label>
          </div>
          <div className="pointer-events-none absolute bottom-4 right-4 text-right">
            <p className="text-small text-fg">Server</p>
            <Label as="p">ML-DSA identity</Label>
          </div>
          {hover && (
            <div className="pointer-events-none absolute left-4 top-4 max-w-text rounded-sm border border-line bg-inset p-3">
              <p className="text-small text-fg">{hover.label}</p>
              <Label as="p">
                {hover.alg} · {hover.bytes} bytes
              </Label>
              <p className="mt-1 break-all font-mono text-small text-fg-3">{hover.hex}</p>
            </div>
          )}
        </div>
        <section aria-labelledby="agility" className="rounded-lg border border-line p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <Label as="h2" tone="strong">
              <span id="agility">Crypto agility · hot-swap</span>
            </Label>
            <Label as="p">
              {policy
                ? `Policy g${policy.generation} · ${policy.linksOnCurrent ?? 0}/${policy.links ?? 12} live links re-keyed`
                : "…"}
            </Label>
          </div>
          <div
            role="radiogroup"
            aria-label="Active crypto policy"
            className="mt-4 flex flex-wrap gap-2"
          >
            {POLICIES.map((p) => {
              const on = !!policy && policy.profile === p.body.profile && policy.sig === p.body.sig;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={swapping}
                  onClick={() => !on && void swap(p.body)}
                  className={`h-10 rounded-sm border px-4 font-mono text-label uppercase transition-colors duration-150 disabled:opacity-40 ${on ? "border-line-strong bg-raised text-fg" : "border-line text-fg-3 hover:text-fg"}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <Text size="small" className="mt-3 max-w-text">
            Switches the server’s live mesh without a restart: each session keeps working and adopts
            the new algorithms at its next key rotation. Watch the console’s algorithm IDs change.
          </Text>
        </section>
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
          <ol className="border-b border-line">
            {STEPS.map((s, i) => (
              <li key={s.title} className="border-t border-line py-4">
                <p className={`text-small ${i <= stepper.index ? "text-fg" : "text-fg-2"}`}>
                  <span className="mr-3 font-mono text-fg-3">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                  {i <= stepper.index && <span className="ml-2 text-ok">✓</span>}
                </p>
                <Text size="small" className="mt-1">
                  {s.body}
                </Text>
              </li>
            ))}
          </ol>
          <div>
            <Label as="h2">Handshake log</Label>
            <ol
              className="mt-3 max-h-stage-sm space-y-2 overflow-auto font-mono text-small"
              aria-live="polite"
            >
              {log.length === 0 && (
                <li className="text-fg-3">Press Step or Play to start the handshake.</li>
              )}
              {log.map((l, i) => (
                <li
                  key={i}
                  className={
                    l.tone === "bad" ? "text-fg" : l.tone === "ok" ? "text-fg" : "text-fg-2"
                  }
                >
                  {l.tone === "bad" ? "✕ " : l.tone === "ok" ? "✓ " : ""}
                  {l.text.replace(/^✕ /, "")}
                </li>
              ))}
            </ol>
          </div>
          {packets.length > 0 && (
            <details className="border-t border-line pt-4">
              <summary className="cursor-pointer text-small text-fg-2">
                Packet bytes (accessible list)
              </summary>
              <ul className="mt-2 space-y-1 font-mono text-small text-fg-3">
                {packets
                  .filter((p) => p.kind !== "msg")
                  .map((p) => (
                    <li key={p.id}>
                      {p.label} · {p.bytes} B · {p.hex}
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </div>
        <Label as="p">
          Both sides of the handshake run in this tab with @noble/post-quantum. Nothing is
          pre-recorded.
        </Label>
      </div>
    </DemoShell>
  );
}

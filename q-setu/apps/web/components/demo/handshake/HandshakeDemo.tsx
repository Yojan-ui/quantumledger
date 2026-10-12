"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { DirectorHUD } from "@/components/director/HUD";
import type { Shot, Step } from "@/components/director/types";
import { useDirector } from "@/components/director/useDirector";
import { useFilm } from "@/components/director/useFilm";
import { LiveConsole } from "@/components/live/LiveConsole";
import { LazyView } from "@/components/scenes/LazyView";
import { Button, Label, Text } from "@/components/ui";
import { ComputeMeter, type MeterReading } from "@/components/demo/shell/ComputeMeter";
import { DemoShell } from "@/components/demo/shell/DemoShell";
import { hexPreview, us } from "@/lib/format";
import { errText } from "@/lib/client/api";
import { hs } from "@/lib/client/handshake-crypto";
import { pushLocal, useMetrics } from "@/lib/client/live";
import { useStepper } from "@/lib/client/useStepper";
import type { OpEvent, PolicyState } from "@/lib/live/types";
import type { Film } from "./HandshakeFilm";

const HandshakeFilm = dynamic(() => import("./HandshakeFilm"), { ssr: false, loading: () => null });

/** One handshake packet, for the accessible byte list. */
interface ScenePacket {
  id: string;
  dir: "c2s" | "s2c";
  kind: "hello" | "signed" | "finish" | "msg" | "attack";
  label: string;
  bytes: number;
  hex: string;
  alg: string;
  startedAt: number;
  durationMs: number;
}

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

const STEP_BAR: Step[] = [
  { label: "Hello", role: "kem" },
  { label: "Signed key", role: "sig" },
  { label: "Shared secret", role: "ok" },
  { label: "Messages", role: "kem" },
];

/** The film: six shots, then the attack (reached only through "Attack it"). */
const SHOTS: Shot[] = [
  {
    id: "establish",
    camera: { position: [0, 1.6, 9], target: [0, 0, 0], fov: 38 },
    caption: "Client and server share no secret yet; anything sent is public.",
    simple: "Your phone and the server share no secret yet.",
  },
  {
    id: "client",
    camera: { position: [-2.2, 0.8, 4.6], target: [-2.6, 0.35, 0], fov: 38 },
    focus: "client",
    step: 0,
    caption: "The client creates a one-time X25519 key share.",
    simple: "Your side makes a one-time half of a key.",
  },
  {
    id: "packet",
    camera: { position: [0, 1.6, 4.2], target: [0, 0.9, 0], fov: 40 },
    focus: "packet",
    step: 0,
    caption: "The ClientHello carries that share to the server, in the open.",
    simple: "That half travels to the server, in the open.",
  },
  {
    id: "server",
    camera: { position: [2.2, 0.7, 4.8], target: [2.6, 0.3, 0], fov: 38 },
    focus: "server",
    step: 1,
    caption: "The server signs a fresh ML-KEM key; the client checks the signature.",
    simple: "The server sends a quantum-safe lock, signed; you check the signature.",
  },
  {
    id: "merge",
    camera: { position: [3.2, 1.2, 2.6], target: [0, 0.1, 0], fov: 40 },
    focus: "merge",
    step: 2,
    caption: "Classical and post-quantum secrets merge through HKDF into one key.",
    simple: "The old and new secrets combine into one shared key.",
  },
  {
    id: "pullback",
    camera: { position: [0, 2.4, 8.5], target: [0, 0, 0], fov: 38 },
    step: 3,
    caption: "Every message is now sealed with AES-256-GCM, in microseconds.",
    simple: "Every message is now locked, in millionths of a second.",
  },
  {
    id: "attack",
    camera: { position: [0.6, 1.4, 4.4], target: [2.2, 0.4, 0], fov: 40 },
    focus: "server",
    step: 1,
    caption: "A forged ML-KEM key fails the ML-DSA signature check.",
    simple: "A swapped-in fake lock fails the signature check.",
  },
];
const FILM = SHOTS.length - 1;
const ATTACK = SHOTS.length - 1;
/** The crypto step (index into STEPS) that must really have run before each shot is shown. */
const NEED = [-1, 0, 0, 2, 2, 3];
/** Shots whose subject moves hold a little longer than the minimum. */
const HOLD: Record<string, number> = { packet: 1900, merge: 2000, server: 1800 };

const mine = (e: OpEvent) => e.source === "browser";
/** The console lines behind each shot. */
const HIGHLIGHT: Record<string, (e: OpEvent) => boolean> = {
  client: (e) => mine(e) && e.op === "HANDSHAKE" && e.detail === "ClientHello",
  packet: (e) => mine(e) && e.op === "HANDSHAKE" && e.detail === "ClientHello",
  server: (e) => mine(e) && (e.op === "SIGN" || e.op === "VERIFY"),
  merge: (e) => mine(e) && e.op === "HANDSHAKE" && /established/.test(e.detail ?? ""),
  pullback: (e) => mine(e) && e.op === "SEAL",
  attack: (e) => mine(e) && e.op === "REJECT",
};

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

/** Hex of the first `n` bytes, with "…" when the value is longer (it may be a truncated copy). */
const head = (b: Uint8Array, n: number, total: number) =>
  hexPreview(b.subarray(0, n), n) + (total > n ? "…" : "");

export function HandshakeDemo() {
  // The crypto runs in a worker (lib/client/handshake-crypto); this page only stages it.
  const ready = useRef<Promise<unknown>>(Promise.resolve());
  const [packets, setPackets] = useState<ScenePacket[]>([]);
  const [log, setLog] = useState<{ text: string; tone?: "ok" | "bad" }[]>([]);
  const [reading, setReading] = useState<MeterReading>();
  const [film, setFilm] = useState<Film>({});
  const patch = (f: Partial<Film>) => setFilm((x) => ({ ...x, ...f }));
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
    ready.current = hs.identity(profile);
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
      patch({ rekeyAt: performance.now() });
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
    await ready.current;
    if (i === 0) {
      const c = await hs.hello(profile);
      pushLocal({
        op: "HANDSHAKE",
        alg: "x25519",
        ms: c.ms,
        bytes: c.bytes,
        ok: true,
        detail: "ClientHello",
      });
      patch({ shareHex: hexPreview(c.x25519, 8), helloBytes: c.bytes });
      setReading({ label: "Step 1 · ClientHello", cpuMs: c.ms, bytesAdded: c.bytes });
      await send({
        dir: "c2s",
        kind: "hello",
        label: "ClientHello",
        alg: "X25519 key share",
        bytes: c.bytes,
        hex: hexPreview(c.x25519, 32),
      });
      say(`ClientHello → X25519 share ${hexPreview(c.x25519, 8)} (${c.bytes} B)`);
    } else if (i === 1) {
      const s = await hs.respond();
      pushLocal({
        op: "SIGN",
        alg: `${kemName} keygen · ${sigName}`.toLowerCase(),
        ms: s.ms,
        bytes: s.bytes,
        ok: true,
        detail: "ServerHello signed",
      });
      patch({ signedAt: performance.now(), kemPkBytes: s.kemPkBytes, sigBytes: s.sigBytes });
      setReading({
        label: `Step 2 · ServerHello (${kemName} keygen + ${sigName} sign)`,
        cpuMs: s.ms,
        bytesAdded: s.bytes,
      });
      await send({
        dir: "s2c",
        kind: "signed",
        label: "ServerHello (signed)",
        alg: `${kemName} pk + ${sigName} signature`,
        bytes: s.bytes,
        hex: hexPreview(s.kemPublicKey, 32),
      });
      say(
        `ServerHello ← ${kemName} key (${s.kemPkBytes} B) sealed with ${sigName} (${s.sigBytes} B)`,
      );
    } else if (i === 2) {
      const f = await hs.finish();
      pushLocal({
        op: "VERIFY",
        alg: sigName.toLowerCase(),
        ms: f.tc,
        ok: true,
        detail: "server hello verified",
      });
      say(`Client verified ${sigName} signature ✓ (pinned server key)`, "ok");
      patch({ verified: true });
      await send({
        dir: "c2s",
        kind: "finish",
        label: "ClientFinish",
        alg: `${kemName} ciphertext + key confirmation`,
        bytes: f.bytes,
        hex: hexPreview(f.kemCiphertext, 32),
      });
      patch({ sessionId: f.sessionId, finishBytes: f.bytes });
      pushLocal({
        op: "HANDSHAKE",
        alg: `${kemName}+x25519`.toLowerCase(),
        ms: f.tc + f.ts,
        bytes: f.bytes,
        ok: true,
        detail: `session ${f.sessionId.slice(0, 8)} established`,
      });
      setReading({
        label: "Step 3 · verify + encapsulate + decapsulate + HKDF",
        cpuMs: f.tc + f.ts,
        bytesAdded: f.bytes,
      });
      say(
        `ss_X25519 ‖ ss_ML-KEM → HKDF-SHA256 → session ${f.sessionId.slice(0, 12)}… · key confirmation ✓`,
        "ok",
      );
    } else {
      const m = await hs.messages(14);
      const per = m.per;
      const first = m.sealed[0]!;
      patch({ sparks: true, perUs: per, perSecond: 1e6 / per });
      pushLocal({
        op: "SEAL",
        alg: `${kemName}+x25519`.toLowerCase(),
        ms: per / 1000,
        bytes: first.ctBytes + 28,
        ok: true,
        detail: `${m.opened} messages, AES-256-GCM`,
      });
      setReading({
        label: "Step 4 · AES-256-GCM messages",
        cpuMs: per / 1000,
        cpuLabel: "Per message (seal + open)",
        bytesAdded: 44,
        plainBytes: m.plainBytes,
        extra: [{ label: "Messages", value: `${m.opened} delivered` }],
      });
      await Promise.all(
        m.sealed.map((x, k) =>
          send(
            {
              dir: "c2s",
              kind: "msg",
              label: `Message #${x.seq}`,
              alg: "AES-256-GCM",
              bytes: x.ctBytes + 28,
              hex: head(x.head, 24, x.ctBytes),
            },
            k * 110,
            900,
          ),
        ),
      );
      say(
        `${m.opened} messages over AES-256-GCM · ${us(per)} each · +44 B (header + tag) · first ct ${head(first.head, 8, first.ctBytes)}`,
        "ok",
      );
    }
  }

  const stepper = useStepper(STEPS.length, run, 700);

  async function attack() {
    // A man-in-the-middle swaps the server's ML-KEM key for their own but can't re-sign it.
    await ready.current;
    const a = hs.attack(profile);
    const { bytes, tail } = await a;
    say("Attacker intercepts ServerHello and swaps in their own ML-KEM key…", "bad");
    await send(
      {
        dir: "s2c",
        kind: "attack",
        label: "Tampered ServerHello",
        alg: "forged ML-KEM key, original ML-DSA signature",
        bytes,
        hex: hexPreview(tail, 32),
      },
      0,
      1700,
    );
    const r = await a;
    if (!r.rejected) {
      say("Unexpected: forged packet accepted", "bad");
      return;
    }
    pushLocal({
      op: "REJECT",
      alg: sigName.toLowerCase(),
      ms: r.ms,
      ok: false,
      detail: "tampered ServerHello",
    });
    say(`✕ ${r.error}`, "bad");
    patch({ attackRejected: true });
    setReading({
      label: "Attack · ML-DSA-65 verification",
      cpuMs: r.ms,
      extra: [{ label: "Result", value: "packet rejected" }],
    });
  }

  function reset() {
    stepper.reset();
    setPackets([]);
    setLog([]);
    setReading(undefined);
    setFilm({});
    reel.stop();
    director.replay();
  }

  // ── Staging: the director moves the camera; each shot first waits for its real crypto. ──
  const director = useDirector(SHOTS);
  const stepAt = useRef(-1);
  stepAt.current = stepper.index;
  const reel = useFilm(director, {
    last: FILM - 1,
    need: async (i) => {
      let k = stepAt.current;
      while (k < (NEED[i] ?? -1)) {
        await stepper.step();
        k++;
      }
    },
    hold: (id) => HOLD[id],
    // The packet and the merge are re-staged each time their shot is reached, from real values.
    onArrive: (id) => {
      if (id === "packet") patch({ packetAt: performance.now() });
      if (id === "merge") patch({ mergeAt: performance.now() });
    },
    restart: () => reset(),
  });
  const attackShot = () =>
    reel.detour(ATTACK, async () => {
      patch({ attackAt: performance.now(), attackRejected: false });
      await attack();
    });

  // Presenter mode starts the film by itself.
  useEffect(() => {
    if (!document.documentElement.hasAttribute("data-present")) return;
    const t = setTimeout(() => void reel.play(), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DemoShell
      title="Demo 1 · How it works"
      caption="The real QuantumLedger handshake, running in your browser: one signed hybrid key exchange, then fast symmetric messages. Hover a packet for its bytes."
      controls={
        <Button onClick={() => void attackShot()} disabled={reel.busy}>
          Attack it
        </Button>
      }
      meter={<ComputeMeter reading={reading} profile={profile} />}
      console={
        <LiveConsole
          title="Live console · this tab + server"
          filter={consoleFilter}
          highlight={HIGHLIGHT[director.state.shot.id]}
        />
      }
      onAutoplay={() => void reel.play().then(() => setTimeout(() => void attackShot(), 800))}
    >
      <div className="space-y-12">
        <div className="relative overflow-hidden rounded-lg border border-line">
          <LazyView
            className="h-stage-sm md:h-stage"
            label="The QuantumLedger handshake as a short film: client and server exchange a signed hybrid key, then sealed messages"
          >
            {(onScreen) => (
              <HandshakeFilm
                state={director.state}
                onSettled={reel.onSettled}
                film={film}
                kemName={kemName}
                sigName={sigName}
                active={onScreen}
              />
            )}
          </LazyView>
          <DirectorHUD
            director={director}
            steps={STEP_BAR}
            playing={reel.playing}
            busy={reel.busy}
            onToggle={() => void reel.play()}
            onNext={() => void reel.next()}
            onPrev={reel.prev}
            onReplay={reset}
          />
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
                <li className="text-fg-3">Press Next or Play to start the handshake.</li>
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

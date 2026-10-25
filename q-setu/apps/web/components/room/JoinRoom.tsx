"use client";

/**
 * The phone side of "Phone in the room". On load this phone makes its own X25519 + ML-KEM-768 key
 * pair (in a worker; the secret key never leaves it) and joins the room with the public half. The
 * visitor picks an emoji or types a line and taps "Seal & send": the worker seals it to the room's
 * public key, the server opens it and seals a receipt back to this phone's key, and the worker
 * opens that receipt and checks the digest before showing ✓. "Try to tamper" flips one bit in
 * transit, and the server's AES-GCM check rejects it on the big screen.
 */
import { useEffect, useRef, useState } from "react";
import type { EnvelopeJSON } from "@qsetu/core";
import { Button, Label, Text } from "@/components/ui";
import { MAX_MESSAGE_BYTES } from "@/lib/live/room-limits";
import { ROOM_EMOJI, roomCity, visitorCss } from "@/data/room";
import { errText } from "@/lib/client/api";
import { burst } from "@/lib/client/burst";
import { RoomCryptoError, roomKeygen, roomReceipt, roomSeal } from "@/lib/client/room-crypto";
import { missingForRoom } from "@/lib/client/room-support";
import { ms } from "@/lib/format";

interface Me {
  id: string;
  name: string;
  colour: number;
  city: string;
  roomKey: string;
  roomKid: string;
  kid: string;
  keyMs: number;
  publicBytes: number;
}

interface Sent {
  n: number;
  tamper: boolean;
  label: string;
  bytes: number;
  sealMs: number;
  preview: string;
  kemPreview: string;
  state: "sending" | "verified" | "rejected" | "error";
  detail?: string;
  openMs?: number;
}

const fmtBytes = (n: number) => `${n.toLocaleString("en-IN")} B`;
const utf8Len = (s: string) => new TextEncoder().encode(s).length;

/**
 * POST JSON to the room. A dropped connection or a reply that isn't JSON (a proxy's error page)
 * becomes a message a visitor can act on, not "Failed to fetch" or "Unexpected token <".
 */
async function post<T>(url: string, body: unknown): Promise<{ ok: boolean; status: number; j: T }> {
  let r: Response;
  try {
    r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "Can't reach the demo. Check this phone is on the same Wi-Fi as the screen, then try again.",
    );
  }
  try {
    return { ok: r.ok, status: r.status, j: (await r.json()) as T };
  } catch {
    throw new Error(`The demo server didn't answer properly (${r.status}). Try again in a moment.`);
  }
}

export function JoinRoom() {
  const [me, setMe] = useState<Me>();
  const [err, setErr] = useState<string>();
  const [missing, setMissing] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [pick, setPick] = useState<string>(ROOM_EMOJI[0]);
  const [log, setLog] = useState<Sent[]>([]);
  const [busy, setBusy] = useState(false);
  const count = useRef(0);

  useEffect(() => {
    let off = false;
    const lacks = missingForRoom();
    if (lacks.length) {
      setMissing(lacks);
      return;
    }
    (async () => {
      try {
        const k = await roomKeygen();
        const { ok, j } = await post<{
          id: string;
          visitor: { name: string; colour: number; city: string };
          key: { publicKey: string; kid: string };
        }>("/api/room/join", { publicKey: k.publicKey });
        if (!ok) throw new Error(errText(j, "Couldn't join the room"));
        if (off) return;
        setMe({
          id: j.id,
          name: j.visitor.name,
          colour: j.visitor.colour,
          city: j.visitor.city,
          roomKey: j.key.publicKey,
          roomKid: j.key.kid,
          kid: k.kid,
          keyMs: k.ms,
          publicBytes: k.publicBytes,
        });
      } catch (e) {
        if (!off) setErr((e as Error).message);
      }
    })();
    return () => {
      off = true;
    };
  }, []);

  const message = text.trim() || pick;
  const tooLong = utf8Len(message) > MAX_MESSAGE_BYTES;

  async function send(tamper: boolean, from?: HTMLElement) {
    if (!me || busy || tooLong) return;
    setBusy(true);
    const n = ++count.current;
    const label = text.trim() ? `"${text.trim().slice(0, 40)}"` : pick;
    try {
      const s = await roomSeal(message, me.roomKey, me.id, tamper);
      // Optimistic: the sealed packet shows the instant it exists; the verdict follows.
      const entry: Sent = {
        n,
        tamper,
        label,
        bytes: s.bytes,
        sealMs: s.ms,
        preview: s.preview,
        kemPreview: s.kemPreview,
        state: "sending",
      };
      setLog((l) => [entry, ...l].slice(0, 6));
      const { j } = await post<
        | { ok: true; receipt: EnvelopeJSON; openMs: number }
        | { ok: false; reason: string; openMs: number }
        | { error: unknown }
      >("/api/room/send", { id: me.id, envelope: s.envelope, sealMs: s.ms });
      let next: Partial<Sent>;
      if ("ok" in j && j.ok) {
        const rc = await roomReceipt(j.receipt, me.id, message);
        next = rc.matches
          ? {
              state: "verified",
              openMs: j.openMs,
              detail: `Receipt opened with this phone's key · SHA3-256 ${rc.sha3.slice(0, 12)}… matches`,
            }
          : { state: "error", detail: "The receipt didn't match what was sent" };
        if (rc.matches && from) burst(from);
      } else if ("ok" in j) {
        next = { state: "rejected", openMs: j.openMs, detail: j.reason };
      } else {
        next = { state: "error", detail: errText(j) };
      }
      setLog((l) => l.map((x) => (x.n === n ? { ...x, ...next } : x)));
    } catch (e) {
      // The worker held this phone's key pair: if it stopped, start over with a fresh one.
      if (e instanceof RoomCryptoError) setErr(e.message);
      setLog((l) =>
        l.map((x) => (x.n === n ? { ...x, state: "error", detail: (e as Error).message } : x)),
      );
    } finally {
      setBusy(false);
    }
  }

  if (missing.length)
    return (
      <div className="mt-10" role="alert" data-room-unsupported>
        <h1 className="text-h1-sm font-medium text-fg">This browser can&apos;t join the demo</h1>
        <Text className="mt-3">
          It&apos;s missing {missing.join(", ")}, which the encryption needs. Open this page in an
          up-to-date Chrome or Safari, or just watch the big screen: the demo carries on there.
        </Text>
      </div>
    );

  if (err)
    return (
      <div className="mt-10" role="alert" data-room-error>
        <Text>{err}</Text>
        <Text size="small" className="mt-2">
          Nothing was sent. The demo carries on on the big screen.
        </Text>
        <Button className="mt-4 h-12" onClick={() => location.reload()}>
          Start again
        </Button>
      </div>
    );

  return (
    <div className="mt-8">
      <Label>Live · Phone in the room</Label>
      <h1 className="mt-3 text-h1-sm font-medium text-fg">
        {me ? (
          <>
            You are{" "}
            <span style={{ color: visitorCss(me.colour) }} data-testid="visitor-name">
              {me.name}
            </span>
          </>
        ) : (
          "Making your keys…"
        )}
      </h1>
      <Text size="small" className="mt-3">
        {me
          ? `This phone just made its own post-quantum key pair, in ${ms(me.keyMs)}. Your message is locked on this phone before it leaves. No name, no sign-in, nothing about you is stored.`
          : "Your phone is generating an X25519 + ML-KEM-768 key pair. Nothing leaves it except the public half."}
      </Text>
      {me && (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-label text-fg-3">
          <dt>Your key</dt>
          <dd className="text-fg-2">
            {me.kid} · {fmtBytes(me.publicBytes)}
          </dd>
          <dt>Room key</dt>
          <dd className="text-fg-2">{me.roomKid}</dd>
          <dt>Your arc from</dt>
          <dd className="text-fg-2">{roomCity(me.city).label}</dd>
        </dl>
      )}

      <fieldset className="mt-8" disabled={!me}>
        <legend className="font-mono text-label uppercase text-fg-3">Pick one</legend>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {ROOM_EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={!text.trim() && pick === e}
              onClick={() => {
                setPick(e);
                setText("");
              }}
              className={`h-14 rounded-sm border text-h2 transition-colors duration-150 ${!text.trim() && pick === e ? "border-fg bg-raised" : "border-line"}`}
            >
              {e}
            </button>
          ))}
        </div>
        <label className="mt-5 block">
          <span className="font-mono text-label uppercase text-fg-3">Or type a line</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={140}
            placeholder="Hello from the audience"
            className="mt-2 h-12 w-full rounded-sm border border-line bg-inset px-3 text-body text-fg placeholder:text-fg-3 focus:border-line-strong focus:outline-none"
          />
          <span className="mt-1 block text-small text-fg-3">
            Only you and the server read it. The big screen shows its size, never the text.
          </span>
        </label>
        <div className="mt-6 grid grid-cols-1 gap-3">
          <Button
            variant="primary"
            className="h-12 text-body"
            disabled={!me || busy || tooLong}
            onClick={(e) => void send(false, e.currentTarget)}
          >
            Seal &amp; send
          </Button>
          <Button
            data-ripple="danger"
            className="h-12"
            disabled={!me || busy || tooLong}
            onClick={() => void send(true)}
          >
            Try to tamper
          </Button>
        </div>
      </fieldset>

      <ol className="mt-8 space-y-3" aria-live="polite">
        {log.map((s) => (
          <li
            key={s.n}
            className="rounded-lg border border-line bg-raised p-4"
            data-state={s.state}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-small text-fg">
                {s.tamper ? "Tampered packet" : "Sealed"} {s.label}
              </span>
              <span
                className={`font-mono text-label uppercase ${s.state === "verified" ? "text-ok" : s.state === "rejected" || s.state === "error" ? "text-danger" : "text-fg-3"}`}
              >
                {s.state === "sending"
                  ? "Opening…"
                  : s.state === "verified"
                    ? "✓ Verified"
                    : s.state === "rejected"
                      ? "✗ Rejected"
                      : "✗ Error"}
              </span>
            </div>
            <p className="mt-2 break-all font-mono text-label text-kem">
              {s.kemPreview}… {s.preview}…
            </p>
            <p className="mt-2 font-mono text-label text-fg-3">
              {fmtBytes(s.bytes)} on the wire · sealed in {ms(s.sealMs)}
              {s.openMs !== undefined && ` · opened in ${ms(s.openMs)}`}
            </p>
            {s.detail && (
              <p
                className={`mt-2 text-small ${s.state === "verified" ? "text-fg-2" : "text-danger"}`}
              >
                {s.state === "rejected"
                  ? `The server refused it: ${s.detail}. One flipped bit is enough.`
                  : s.detail}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

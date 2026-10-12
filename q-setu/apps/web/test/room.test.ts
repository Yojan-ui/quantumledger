import { sha3_256 } from "@noble/hashes/sha3.js";
import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  bytesToUtf8,
  envelopeFromJSON,
  envelopeToJSON,
  getKem,
  open,
  seal,
  utf8ToBytes,
} from "@qsetu/core";
import { describe, expect, it } from "vitest";
import { ROOM_EMOJI } from "@/data/room";
import { receiptAad, Room, roomAad, type RoomEvent } from "@/lib/live/room";

/** A phone: its own hybrid key pair, sealing to the room the way workers/room.worker.ts does. */
function phone(room: Room) {
  const keys = getKem("hybrid-x25519-mlkem768").keygen();
  const { id, visitor } = room.join(bytesToBase64(keys.publicKey));
  const roomKey = base64ToBytes(room.publicKey().publicKey);
  const sealText = (text: string, as = id) =>
    envelopeToJSON(seal(utf8ToBytes(text), roomKey, { aad: roomAad(as) }));
  return { keys, id, visitor, sealText };
}

function setup() {
  let t = 1_000_000;
  const room = new Room(
    () => (t += 5000),
    () => 0.3,
    ROOM_EMOJI,
  );
  const events: RoomEvent[] = [];
  room.subscribe((e) => events.push(e));
  return { room, events };
}

describe("Room (phone in the room)", () => {
  it("opens a sealed message and answers with a receipt only the phone can open", () => {
    const { room, events } = setup();
    const p = phone(room);
    expect(p.visitor.name).toBe("Visitor 1");
    const r = room.receive(p.id, p.sealText("hello from row 3"), 0.6);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // ~1,120 B of hybrid KEM ciphertext + 12 B nonce + message + 16 B tag.
    expect(r.bytes).toBe(1120 + 12 + 16 + 16);
    const body = JSON.parse(
      bytesToUtf8(open(envelopeFromJSON(r.receipt), p.keys, { aad: receiptAad(p.id) })),
    );
    expect(body.sha3).toBe(bytesToHex(sha3_256(utf8ToBytes("hello from row 3"))));
    // Another key can't open the receipt.
    const other = getKem("hybrid-x25519-mlkem768").keygen();
    expect(() => open(envelopeFromJSON(r.receipt), other, { aad: receiptAad(p.id) })).toThrow();
    const sealed = events.find((e) => e.kind === "sealed");
    expect(sealed).toMatchObject({ kind: "sealed", sealed: 1, sealMs: 0.6, chars: 16 });
    // Free text is never broadcast.
    expect(JSON.stringify(events)).not.toContain("row 3");
    expect(room.stats()).toMatchObject({ sealed: 1, rejected: 0, visitors: 1 });
  });

  it("broadcasts the message only when it is one of the fixed emoji", () => {
    const { room, events } = setup();
    const p = phone(room);
    room.receive(p.id, p.sealText(ROOM_EMOJI[0]), 1);
    expect(events.find((e) => e.kind === "sealed")).toMatchObject({ emoji: ROOM_EMOJI[0] });
  });

  it("rejects a packet with one flipped bit, in public", () => {
    const { room, events } = setup();
    const p = phone(room);
    const env = p.sealText("tamper me");
    const ct = base64ToBytes(env.ct);
    ct[3]! ^= 1;
    env.ct = bytesToBase64(ct);
    const r = room.receive(p.id, env, 1);
    expect(r.ok).toBe(false);
    expect(events.at(-1)).toMatchObject({ kind: "rejected", rejected: 1 });
    expect(room.stats().sealed).toBe(0);
  });

  it("rejects a message sealed for another visitor (bound by associated data)", () => {
    const { room } = setup();
    const a = phone(room);
    const b = phone(room);
    expect(room.receive(b.id, a.sealText("hi"), 1).ok).toBe(false);
  });

  it("refuses unknown visitors, bad keys and floods", () => {
    const { room } = setup();
    expect(() => room.join(bytesToBase64(new Uint8Array(32)))).toThrow(/ML-KEM-768/);
    const p = phone(room);
    expect(() => room.receive("0".repeat(32), p.sealText("x"), 1)).toThrow(/Unknown visitor/);
    let t = 0;
    const fast = new Room(() => t, Math.random, ROOM_EMOJI);
    const q = phone(fast);
    expect(fast.receive(q.id, q.sealText("one"), 1).ok).toBe(true);
    t += 100;
    expect(() => fast.receive(q.id, q.sealText("two"), 1)).toThrow(/One message at a time/);
  });

  it("gives visitors generic names and cycling colours", () => {
    const { room } = setup();
    const names = Array.from({ length: 7 }, () => phone(room).visitor);
    expect(names.map((v) => v.name)).toEqual(
      Array.from({ length: 7 }, (_, i) => `Visitor ${i + 1}`),
    );
    expect(names[6]!.colour).toBe(0);
  });
});

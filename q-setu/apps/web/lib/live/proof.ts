/**
 * Anchoring a diagnostics run to the Proof Chain.
 *
 * Four leaves (the scan result, the CBOM's hash, the policy applied, the handshake transcript
 * hash) are hashed into a SHA3-256 Merkle tree (RFC 6962-style domain separation: 0x00 for leaves,
 * 0x01 for nodes). The ledger first appends a signed checkpoint (the head it is about to extend),
 * then an anchor entry carrying the leaves and the root, signed with ML-DSA by the KMS key.
 *
 * Verification (the "sweep"): a fresh ML-DSA check of the checkpoint, then a walk of only what came
 * after it, then the Merkle root recomputed from the stored leaves. Fast however long the chain is.
 */
import { sha3_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, concatBytes, hexToBytes, utf8ToBytes } from "@qsetu/core";
import type { Ledger, LedgerEntry, VerifyResult } from "./ledger";

export interface MerkleTree {
  /** Leaf hashes, then each level up, ending with [root]. */
  levels: string[][];
  root: string;
}

export const leafHash = (data: string) =>
  bytesToHex(sha3_256(concatBytes(new Uint8Array([0]), utf8ToBytes(data))));
const nodeHash = (l: string, r: string) =>
  bytesToHex(sha3_256(concatBytes(new Uint8Array([1]), hexToBytes(l), hexToBytes(r))));

export function merkle(data: string[]): MerkleTree {
  if (!data.length) throw new Error("A Merkle tree needs at least one leaf");
  const levels = [data.map(leafHash)];
  while (levels.at(-1)!.length > 1) {
    const cur = levels.at(-1)!;
    const next: string[] = [];
    // An odd node is promoted unchanged (no duplication, so no second-preimage ambiguity).
    for (let i = 0; i < cur.length; i += 2)
      next.push(i + 1 < cur.length ? nodeHash(cur[i]!, cur[i + 1]!) : cur[i]!);
    levels.push(next);
  }
  return { levels, root: levels.at(-1)![0]! };
}

export interface AnchorInput {
  domain: string;
  /** Canonical JSON of the scan result the pipeline used. */
  scan: string;
  cbomSha3: string;
  /** Canonical JSON of the policy applied (level, KEM, signature). */
  policy: string;
  transcriptSha3: string;
}

export const LEAF_LABELS = ["scan result", "CBOM hash", "policy", "handshake transcript"] as const;

export interface Anchored {
  checkpoint: LedgerEntry;
  anchor: LedgerEntry;
  tree: MerkleTree;
  /** The few entries before the checkpoint, for the chain the block locks into. */
  previous: Pick<LedgerEntry, "id" | "hash" | "kind">[];
}

export async function anchorProof(ledger: Ledger, input: AnchorInput): Promise<Anchored> {
  const data = [input.scan, input.cbomSha3, input.policy, input.transcriptSha3];
  const tree = merkle(data);
  await ledger.flush();
  const head = (await ledger.recent(4)).reverse();
  const last = head.at(-1);
  const checkpoint = await ledger.append("checkpoint", `#${last?.id ?? 0}`, {
    upTo: last?.id ?? 0,
    head: last?.hash ?? "0".repeat(64),
  });
  const anchor = await ledger.append("anchor", input.domain, {
    domain: input.domain,
    root: tree.root,
    leaves: LEAF_LABELS.map((label, i) => ({ label, hash: tree.levels[0]![i] })),
    data,
    checkpoint: checkpoint.id,
  });
  return {
    checkpoint,
    anchor,
    tree,
    previous: head.map(({ id, hash, kind }) => ({ id, hash, kind })),
  };
}

export interface SweepResult {
  ok: boolean;
  ms: number;
  checkpoint: VerifyResult;
  segment: VerifyResult;
  merkle: { ok: boolean; expected: string; actual: string };
  /** Where the sweep stopped, if it did. */
  broken?: VerifyResult["broken"];
}

/** Re-verifies an anchor for real: checkpoint signature, the segment after it, the Merkle root. */
export async function sweep(ledger: Ledger, anchorId: number): Promise<SweepResult> {
  const t = performance.now();
  const anchor = await ledger.get(anchorId);
  if (!anchor || anchor.kind !== "anchor") throw new Error(`No anchor #${anchorId}`);
  const cp = Number(anchor.payload.checkpoint);
  const checkpoint = await ledger.verifyEntry(cp);
  const segment = checkpoint.ok ? await ledger.verifyFrom(cp + 1) : checkpoint;
  const stored = anchor.payload as { root: string; data: string[] };
  const actual = merkle(stored.data ?? []).root;
  const merkleOk = actual === stored.root;
  const broken = checkpoint.broken ?? segment.broken;
  return {
    ok: checkpoint.ok && segment.ok && merkleOk,
    ms: performance.now() - t,
    checkpoint,
    segment,
    merkle: { ok: merkleOk, expected: stored.root, actual },
    broken,
  };
}

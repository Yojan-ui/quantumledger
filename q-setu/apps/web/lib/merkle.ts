/**
 * SHA3-256 Merkle trees with RFC 6962-style domain separation (0x00 for leaves, 0x01 for nodes).
 * Shared by the Proof Chain anchor (server) and the browser worker (the Proof Chain demo).
 */
import { sha3_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, concatBytes, hexToBytes, utf8ToBytes } from "@qsetu/core";

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

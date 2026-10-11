/** Converts the SDK's friendly inputs (string, object, bytes) to bytes and back. */
import { bytesToUtf8, utf8ToBytes } from "@qsetu/core";

export type Data = string | Uint8Array | object;

export function toBytes(data: Data): Uint8Array {
  if (data instanceof Uint8Array) return data;
  return utf8ToBytes(typeof data === "string" ? data : JSON.stringify(data));
}

export const asText = (bytes: Uint8Array) => bytesToUtf8(bytes);
export const asJSON = <T = unknown>(bytes: Uint8Array): T => JSON.parse(bytesToUtf8(bytes)) as T;

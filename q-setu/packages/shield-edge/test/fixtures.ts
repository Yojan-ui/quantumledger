import { selfSignedCert } from "../src/selfsigned";

/** A throwaway self-signed ECDSA P-256 certificate for the given names (test only). */
export const selfSigned = (names: string[]) => selfSignedCert(names, 2);

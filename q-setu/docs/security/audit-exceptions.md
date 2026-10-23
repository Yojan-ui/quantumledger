# `pnpm audit` exceptions

CI runs `pnpm audit --audit-level high` and fails on any high or critical advisory. This page lists every
advisory let through, and why. Each one has **no fixed version** upstream. Re-check each at every
dependency update, and remove it as soon as a fix exists.

Fixed with overrides instead (`pnpm-workspace.yaml`):

| Advisory                                            | Package          | Path                | Fix                                            |
| --------------------------------------------------- | ---------------- | ------------------- | ---------------------------------------------- |
| GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr (critical) | tinypool ≤ 2.1.1 | vitest (tests only) | override to 2.2.0; the test suite passes on it |
| GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849 (high)     | postcss ≤ 8.5.17 | next (build)        | override `next>postcss` to 8.5.30              |

## Ignored

### GHSA-86w9-cpqp-85rv: node-forge RSA PKCS#1 v1.5 signature verification (high)

- **Path:** `@qsetu/shield-edge > acme-client 5.4.0 > node-forge ≤ 1.4.0`. No patched node-forge exists.
- **Why it doesn't reach us:**
  - acme-client loads node-forge only for its legacy `acme.forge` export.
  - Shield Edge uses `acme.crypto`, which is Node's native crypto: ECDSA P-256 keys, CSRs and certificate
    parsing.
  - Nothing in this repository calls node-forge. Nothing verifies an RSA PKCS#1 v1.5 signature with it.
- **Checked:**
  - `grep -rn forge packages/shield-edge/src` finds nothing.
  - In acme-client, node-forge is referenced only from `src/crypto/forge.js`.
- **Exit:** when acme-client drops node-forge, or node-forge ships a fix.

### GHSA-vfj7-8cjw-p6xm: braces stack exhaustion on deeply nested patterns (high)

- **Path:** `eslint-config-next > @next/eslint-plugin-next > fast-glob > micromatch > braces`. That's lint
  only, run on our own source tree.
- **Why it doesn't reach us:**
  - The patterns braces expands come from our ESLint configuration, never from users.
  - It isn't in the production bundle or the running server.
- **Exit:** when a fixed braces is published, or eslint-config-next moves off it.

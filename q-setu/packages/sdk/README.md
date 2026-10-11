# @qsetu/sdk

Quantum-safe sessions, envelopes and signatures for any JavaScript app. Hybrid X25519 + ML-KEM
(FIPS 203) for key exchange, ML-DSA (FIPS 204) for signatures, AES-256-GCM for data.

```ts
import { createSession, generateKeys, publicKeys, seal, openJSON, sign, verify } from "@qsetu/sdk";

const s = await createSession({ url: "https://bank.example/qsetu", serverKey }); // one PQC handshake
const reply = await s.send({ payerVPA: "ravi@bharatbank", amountINR: "500.00" }); // then AES-256-GCM

const bank = generateKeys(),
  app = generateKeys(); // standard profile (or "edge")
const box = seal({ amountINR: "500.00" }, publicKeys(bank), app); // encrypt + sign, one shot
openJSON(box, bank, publicKeys(app)); // verify, then decrypt

verify("mandate:42", sign("mandate:42", app), publicKeys(app)); // detached ML-DSA signature
```

On the server, `createSessionServer({ identity })` gives you `hello`, `finish` and `message`
handlers to mount on any HTTP framework. Build with `pnpm --filter @qsetu/sdk build` (ESM + types).

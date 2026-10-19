# @qsetu/shield

AI-agent and abuse defence as one line in your app. It scores each client's behaviour and acts on it
step by step:

- **allow**
- **tighter limit**
- **proof-of-work challenge**
- **temporary block**, with longer blocks for repeat offenders

It also answers honeypot routes, a hidden trap link and a canary API key by itself.

```js
// Express
import { shield } from "@qsetu/shield";
app.use(shield({ siteKey: process.env.QSETU_SITE_KEY }));

// Fastify
import { shieldFastify } from "@qsetu/shield";
await app.register(shieldFastify({ siteKey: process.env.QSETU_SITE_KEY }));

// Next.js: middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { shieldNext } from "@qsetu/shield";
const guard = shieldNext({ siteKey: process.env.QSETU_SITE_KEY! });
export async function middleware(req: NextRequest) {
  return (await guard(req)) ?? NextResponse.next();
}
export const config = { runtime: "nodejs" };
```

New sites start in **monitor** mode: every request is scored and reported to your dashboard, but nothing is
blocked. Switch to `protect` (or `strict`) once the reports look right. `mode: "off"` is the emergency
switch.

## What this does not do

**It does not add post-quantum TLS.** A middleware runs inside your app, after TLS has already ended, so it
can't change the key exchange. For quantum-safe encryption between visitors and your site, put **Shield
Edge** in front, by either:

1. one DNS change (a TXT record, then a CNAME); or
2. the container: `docker run quantumledger/shield`.

Shield Edge runs the same defence engine, and also sees TLS fingerprints (JA4), which a middleware can't.

Also:

- **Error-ratio signal:** Next.js middleware can't see your response's status code, so this signal is off
  under Next.js.
- **Network-operator view:** there is no ASN data unless you pass `asnOf`.
- **Agents that look human:** a patient agent driving a real browser at human speed looks like a person.

The engine raises the cost of abuse and makes it visible. It does not make a site impossible to attack.

## Signed asset manifest (optional)

`qsetu-manifest sign` hashes your built scripts and styles (SHA-384, the same form as Subresource Integrity)
and signs the list with ML-DSA-65. It publishes the result at `/.well-known/qsetu-manifest.json`.
`qsetu-manifest check <url> --pub <key>` then reports any file that no longer matches.

Give checkers the public key another way: in configuration, or in a DNS TXT record. A key fetched from the
same server as the manifest proves nothing about that server.

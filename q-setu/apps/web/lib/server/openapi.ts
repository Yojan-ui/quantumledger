import "server-only";
import { z } from "zod";
import { ErrorSchema, SectorBody } from "./api";
import * as S from "./schemas";

interface Op {
  method: "get" | "post";
  path: string;
  summary: string;
  tag: string;
  body?: z.ZodType;
  query?: z.ZodObject;
  params?: z.ZodObject;
  produces?: string;
}

const OPS: Op[] = [
  {
    method: "get",
    path: "/api/stream",
    tag: "Live",
    summary:
      "Server-Sent Events: the live bus (OpEvents + metrics frames), or raw simulator hops with ?sector=",
    query: S.StreamQuery,
    produces: "text/event-stream",
  },
  {
    method: "get",
    path: "/api/metrics",
    tag: "Live",
    summary: "Rolling 60 s counts and p50/p95 latency per operation, city and site",
  },
  {
    method: "get",
    path: "/api/policy",
    tag: "Crypto agility",
    summary: "Active crypto policy and how many live links have re-keyed onto it",
  },
  {
    method: "post",
    path: "/api/policy",
    tag: "Crypto agility",
    summary: "Hot-swap profile and/or signature algorithm without restarting",
    body: S.PolicyBody,
  },
  {
    method: "get",
    path: "/api/keys",
    tag: "KMS",
    summary: "Key metadata (active and retired). Never secret material",
  },
  {
    method: "post",
    path: "/api/keys/rotate",
    tag: "KMS",
    summary: "Rotate a key now (also rotates on a schedule)",
    body: S.KeysRotateBody,
  },
  {
    method: "get",
    path: "/api/ledger",
    tag: "Proof Chain",
    summary: "Recent ledger entries, newest first",
    query: S.LedgerQuery,
  },
  {
    method: "post",
    path: "/api/ledger/verify",
    tag: "Proof Chain",
    summary: "Verify the whole chain; names the first broken entry",
  },
  {
    method: "post",
    path: "/api/ledger/tamper",
    tag: "Proof Chain",
    summary: "DEMO: edit a row directly in SQLite (or restore it)",
    body: S.LedgerTamperBody,
  },
  {
    method: "post",
    path: "/api/scan",
    tag: "Scanner",
    summary: "Scan pasted code/config: findings, score, CycloneDX CBOM",
    body: S.ScanBody,
  },
  {
    method: "post",
    path: "/api/scan/url",
    tag: "Scanner",
    summary: "Probe a public host's TLS (offers X25519MLKEM768), score it, CBOM + plan",
    body: S.ScanUrlBody,
  },
  {
    method: "post",
    path: "/api/plan",
    tag: "Scanner",
    summary: "Turn findings into an ordered migration plan (JSON or Markdown)",
    body: S.PlanBody,
  },
  {
    method: "post",
    path: "/api/traffic",
    tag: "Live",
    summary: "A deployed Demo 2 node does one unit of real work",
    body: S.TrafficBody,
  },
  {
    method: "get",
    path: "/api/bench",
    tag: "Benchmarks",
    summary: "Benchmarks measured on this server",
    query: S.BenchQuery,
  },
  {
    method: "post",
    path: "/api/simulate",
    tag: "Simulator",
    summary: "Send records through a sector network (classical and QuantumLedger)",
    body: S.SimulateBody,
  },
  {
    method: "get",
    path: "/api/harvest",
    tag: "Simulator",
    summary: "Everything the eavesdropper recorded",
    query: S.SectorQuery,
  },
  {
    method: "post",
    path: "/api/qday",
    tag: "Simulator",
    summary: "Q-Day against recorded QuantumLedger traffic",
    body: SectorBody,
  },
  {
    method: "post",
    path: "/api/reset",
    tag: "Simulator",
    summary: "Clear recorded traffic for a sector",
    body: SectorBody,
  },
  {
    method: "post",
    path: "/api/shield/run",
    tag: "Adapters",
    summary: "One request to the legacy app, direct and through Shield",
    body: SectorBody,
  },
  {
    method: "post",
    path: "/api/sdk/{step}",
    tag: "Adapters",
    summary: "SDK session server: hello, finish, message",
    params: S.SdkStepParams,
  },
  {
    method: "post",
    path: "/api/vault",
    tag: "Adapters",
    summary: "Store one record in Vault",
    body: SectorBody,
  },
  {
    method: "get",
    path: "/api/vault/{id}",
    tag: "Adapters",
    summary: "Verify, unwrap and decrypt a Vault record (409 if tampered)",
    params: S.IdParams,
  },
  {
    method: "post",
    path: "/api/vault/{id}/tamper",
    tag: "Adapters",
    summary: "DEMO: flip one bit of a stored record",
    params: S.IdParams,
  },
  {
    method: "post",
    path: "/api/certs/issue",
    tag: "Adapters",
    summary: "Issue an ML-DSA-65-signed degree certificate",
  },
  {
    method: "get",
    path: "/api/certs/{id}",
    tag: "Adapters",
    summary: "Public certificate registry lookup",
    params: S.IdParams,
  },
  {
    method: "get",
    path: "/api/certs/issuer",
    tag: "Adapters",
    summary: "The issuer's ML-DSA-65 public key",
  },
  {
    method: "post",
    path: "/api/web-shield/submit",
    tag: "Adapters",
    summary: "Form endpoint: accepts plain or QuantumLedger-sealed posts",
  },
  { method: "get", path: "/api/qsetu/key", tag: "Adapters", summary: "Web shield public keys" },
];

const schema = (s: z.ZodType) => z.toJSONSchema(s, { io: "input", unrepresentable: "any" });

function parameters(o: Op) {
  const out: object[] = [];
  for (const [where, obj] of [
    ["query", o.query],
    ["path", o.params],
  ] as const) {
    if (!obj) continue;
    for (const [name, s] of Object.entries(obj.shape)) {
      out.push({
        name,
        in: where,
        required: where === "path" || !(s as z.ZodType).safeParse(undefined).success,
        schema: schema(s as z.ZodType),
      });
    }
  }
  return out;
}

export function openApi() {
  const paths: Record<string, Record<string, object>> = {};
  for (const o of OPS) {
    (paths[o.path] ??= {})[o.method] = {
      summary: o.summary,
      tags: [o.tag],
      parameters: parameters(o),
      ...(o.body
        ? {
            requestBody: {
              required: false,
              content: { "application/json": { schema: schema(o.body) } },
            },
          }
        : {}),
      responses: {
        200: { description: "OK", content: { [o.produces ?? "application/json"]: {} } },
        "4XX": {
          description: "Error",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "QuantumLedger API",
      version: "0.2.0",
      description:
        "Post-quantum security layer for India. Every error has the shape { error: { code, message, issues? } }.",
    },
    paths,
    components: { schemas: { Error: schema(ErrorSchema) } },
  };
}

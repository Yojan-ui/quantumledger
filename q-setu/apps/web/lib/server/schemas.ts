import "server-only";
import { z } from "zod";
import { Sector } from "./api";
import { webhookHost } from "./webhook";

/** Request schemas, shared by the routes (validation) and /api/docs (OpenAPI). */

export const SimulateBody = z.object({
  sector: Sector.default("fintech"),
  count: z.number().int().min(1).max(20).default(4),
  paceMs: z.number().int().min(0).max(3000).default(900),
  wait: z.boolean().default(false),
});

export const SectorQuery = z.object({ sector: Sector.default("fintech") });

export const StreamQuery = z.object({
  sector: z.enum(["fintech", "healthcare", "education", "all"]).optional().meta({
    description: "Omit for the live bus (OpEvents); set for raw simulator hops (NetEvents).",
  }),
});

export const ScanBody = z.object({
  text: z.string().max(256 * 1024, "Input too large (max 256 KB)"),
  filename: z.string().max(120).optional(),
});

export const ScanUrlBody = z.object({
  url: z
    .string()
    .min(1)
    .max(2048)
    .meta({ examples: ["https://example.com"] }),
  /** Answer only from the pre-cached real scans (the homepage's labelled example); never probes. */
  cachedOnly: z.boolean().optional(),
});

export const FindingInput = z.object({
  ruleId: z.string().max(64),
  line: z.number().int().min(0).max(1_000_000),
  algorithm: z.string().max(120),
  primitive: z.enum(["pke", "signature", "key-agree", "kem", "hash", "block-cipher", "protocol"]),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  quantumVulnerable: z.boolean(),
  match: z.string().max(500),
});

export const PlanBody = z.object({
  findings: z.array(FindingInput).max(2000),
  dataLifetimeYears: z.number().min(0).max(100).default(10),
  source: z.enum(["url", "code"]).default("code"),
  hybridPq: z.boolean().optional(),
  format: z.enum(["json", "markdown"]).default("json"),
});

export const PolicyBody = z
  .object({
    profile: z.enum(["standard", "edge", "maximum"]).optional(),
    sig: z.enum(["ml-dsa-65", "ml-dsa-44", "ml-dsa-87", "slh-dsa-sha2-128f"]).optional(),
  })
  .refine((b) => b.profile || b.sig, "Set profile, sig, or both");

export const LedgerQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  /** Return the `limit` entries centred on this ID instead of the newest. */
  around: z.coerce.number().int().min(1).optional(),
});

export const LedgerTamperBody = z.object({
  id: z.number().int().min(1).default(42),
  restore: z.boolean().default(false),
});

export const KeysRotateBody = z.object({
  purpose: z.enum(["ledger", "tx-signing", "mesh-identity"]),
});

export const TrafficBody = z.object({
  site: z.string().regex(/^(fintech|healthcare|education)-(web|shield|sdk|edge|vault)$/),
});

export const IdParams = z.object({ id: z.string().min(1).max(120) });

export const SdkStepParams = z.object({ step: z.enum(["hello", "finish", "message", "identity"]) });

export const BenchQuery = z.object({ fresh: z.enum(["0", "1"]).optional() });

export const EarlyAccessBody = z.object({
  kind: z.enum(["early-access", "contact"]).default("early-access"),
  name: z.string().trim().min(1, "Please tell us your name").max(120),
  email: z.string().trim().email("That email doesn't look right").max(200),
  organisation: z.string().trim().min(1, "Which organisation are you with?").max(160),
  sector: z.enum(["fintech", "healthcare", "education", "government", "other"]),
  useCase: z.string().trim().min(1, "Tell us what you'd protect first").max(2000),
  /** Honeypot: must stay empty. */
  website: z.string().max(0).optional().or(z.literal("")),
});

const B64 = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/, "Expected base64");

export const RoomJoinBody = z.object({
  publicKey: B64.max(4096).meta({ description: "The phone's X25519 + ML-KEM-768 public key" }),
});

export const RoomSendBody = z.object({
  id: z.string().regex(/^[0-9a-f]{32}$/, "Unknown visitor"),
  sealMs: z.number().min(0).max(60_000).default(0),
  envelope: z.object({
    v: z.number(),
    profile: z.enum(["standard", "edge", "maximum"]),
    algIds: z.object({
      kem: z.string().max(64),
      sig: z.string().max(64).nullable(),
      kdf: z.string().max(64),
      aead: z.string().max(64),
    }),
    rid: z.string().max(64),
    sid: z.string().max(64).nullable(),
    kemCt: B64.max(4096),
    nonce: B64.max(64),
    ct: B64.max(2048),
    sig: B64.max(8192).nullable(),
  }),
});

export const SealFromBody = z.object({ city: z.string().regex(/^[a-z]{2,20}$/) });

const Hex64 = z.string().regex(/^[0-9a-f]{64}$/, "Expected a SHA3-256 hex digest");

export const AnchorBody = z.object({
  domain: z.string().min(1).max(253),
  scan: z.string().min(2).max(8192),
  cbomSha3: Hex64,
  policy: z.string().min(2).max(1024),
  transcriptSha3: Hex64,
});

export const AnchorParams = z.object({ id: z.coerce.number().int().min(1) });

// ── Shield dashboard ─────────────────────────────────────────────────────────────────────────
const Email = z.string().trim().toLowerCase().email().max(254);
export const AppSignupBody = z.object({ email: Email, password: z.string().min(12).max(256) });
export const AppLoginBody = z.object({ email: Email, password: z.string().min(1).max(256) });
export const AppCodeBody = z.object({ code: z.string().regex(/^\d{6}$/) });
export const SiteCreateBody = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .max(253)
    .regex(
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
      "A domain like www.example.com",
    ),
});
export const SiteSettingsBody = z.object({
  mode: z.enum(["off", "monitor", "protect", "strict"]).optional(),
  alertEmail: z.union([Email, z.literal("")]).optional(),
  // A public https address only (no internal hosts): checked again, with DNS, at send time.
  alertWebhook: z
    .union([
      z
        .string()
        .url()
        .max(500)
        .superRefine((u, ctx) => {
          const h = webhookHost(u);
          if ("error" in h) ctx.addIssue({ code: "custom", message: h.error });
        }),
      z.literal(""),
    ])
    .optional(),
});
export const ReportQuery = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });
export const ShieldEventsBody = z.object({
  events: z
    .array(
      z.object({
        type: z.string().max(32),
        at: z.number().int().nonnegative(),
        ip: z.string().max(64),
        path: z.string().max(2000),
        score: z.number().min(0).max(100),
        reasons: z.array(z.string().max(200)).max(20),
        monitorOnly: z.boolean(),
      }),
    )
    .max(500),
  stats: z
    .object({
      pq: z.number().int().nonnegative().max(1e9).optional(),
      classical: z.number().int().nonnegative().max(1e9).optional(),
      requests: z.number().int().nonnegative().max(1e9).optional(),
    })
    .optional(),
});

/** Real dependencies for lab runs: the live Proof Chain and the existing URL-scan service. */
import { hostFromInput } from "@/lib/live/tls";
import { live } from "@/lib/server/runtime";
import { cachedScan, scanHost } from "@/lib/server/scan-service";
import type { ResolvedInput } from "./inputs";
import type { RunDeps } from "./runs";

export async function realDeps(): Promise<RunDeps> {
  const { ledger } = await live();
  return {
    ledger: {
      append: (k, s, p) => ledger.append(k, s, p),
      verify: () => ledger.verify() as Promise<unknown>,
    },
    urlScan: async (inp: ResolvedInput) => {
      if (inp.probeLive) return (await scanHost(inp.url!)) as unknown as Record<string, unknown>;
      const c = cachedScan(hostFromInput(inp.url!));
      if (!c)
        throw new Error(
          `No cached real scan for ${inp.name}. Tick "probe live" to contact the host.`,
        );
      return c as unknown as Record<string, unknown>;
    },
  };
}

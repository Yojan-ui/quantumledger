"use client";

import type { HarvestRecord, QDayOutcome } from "@qsetu/sim";
import { workerRpc } from "./worker-rpc";

const call = workerRpc(() => new Worker(new URL("../../workers/qday.worker.ts", import.meta.url)));

/** breakClassical in workers/qday.worker.ts: the factoring never blocks the page. */
export const breakInWorker = (records: HarvestRecord[]) =>
  call<{ outcomes: QDayOutcome[]; ms: number }>("break", { records });

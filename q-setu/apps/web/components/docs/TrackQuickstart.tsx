"use client";

import { useEffect } from "react";
import { track } from "@/lib/client/analytics";

/** Counts quickstart views (privacy-friendly analytics, only if enabled). */
export function TrackQuickstart() {
  useEffect(() => track("docs_quickstart_viewed"), []);
  return null;
}

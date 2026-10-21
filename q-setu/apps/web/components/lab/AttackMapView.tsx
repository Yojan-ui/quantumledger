"use client";

import dynamic from "next/dynamic";
import { LazyView } from "@/components/scenes/LazyView";
import { Copy } from "@/components/ui/Copy";
import { chunkFailed } from "@/lib/client/chunk";
import { useReducedMotion } from "@/lib/client/motion";
import { toneOf, type MapIncident, type Tone } from "./map-data";

// The scene (and three.js with it) loads only on the Lab overview, after the page has painted,
// when the map comes near the viewport (LazyView). Until then its poster holds the frame.
const AttackMap = dynamic(
  () => import("./AttackMap").catch(() => import("./AttackMap")).catch(chunkFailed),
  { ssr: false },
);

const DOT: Record<Tone, string> = {
  danger: "bg-danger",
  warn: "bg-warn",
  sig: "bg-sig",
  text3: "bg-fg-3",
};

/** The overview's "Attack map": the real incidents in scope, as streams hitting Shield's ring. */
export function AttackMapView({
  incidents,
  patterns,
}: {
  incidents: MapIncident[];
  patterns: { id: string; name: string }[];
}) {
  const reduce = useReducedMotion();
  const version = incidents.map((i) => i.id).join(",");
  return (
    <figure className="overflow-hidden rounded-lg border border-line">
      <LazyView
        className="h-stage-sm w-full md:h-stage"
        label={`Attack map: ${incidents.length} recorded attacks flying at the protected site; Shield's ring stops the ones it blocks.`}
      >
        {(on) => <AttackMap incidents={incidents} version={version} active={on} reduce={reduce} />}
      </LazyView>
      <figcaption className="flex flex-col gap-3 border-t border-line p-4 md:flex-row md:items-center md:justify-between md:px-6">
        <p className="text-small text-fg-2">
          <Copy
            simple="Each stream is one attack. The centre is your site; the ring is Shield. Blocked steps break on the ring; steps let through pass inside, dimmer."
            technical="Streams: one per incident, one burst per recorded step. Core: the protected site. Ring: Shield. Refused steps scatter on the ring; allowed steps reach the core (dimmed)."
          />
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {patterns.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-small text-fg-2">
              <span aria-hidden className={`block h-dot w-dot rounded-full ${DOT[toneOf(p.id)]}`} />
              {p.name}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

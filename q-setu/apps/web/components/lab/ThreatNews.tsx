import { Panel } from "@/components/ui";
import { Copy } from "@/components/ui/Copy";
import type { Threat } from "@/lib/lab/types";

const month = (d: string) =>
  new Date(`${d}-01T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/** Real AI-agent attacks in the news, and how the threat model would spot each. */
export function ThreatNews({ threats }: { threats: Threat[] }) {
  return (
    <section aria-labelledby="lab-news" className="mt-10">
      <h2 id="lab-news" className="text-h3 font-medium text-fg">
        <Copy simple="AI attacks in the news" technical="Reference incidents: AI-agent attacks" />
      </h2>
      <p className="mt-2 max-w-prose text-body text-fg-2">
        <Copy
          simple="Real attacks by AI agents this year. The practice attacks in this Lab copy their behaviour, safely, so you can see how Shield and the threat model react."
          technical="Public reports of autonomous-agent attacks. Practice-traffic patterns are mapped to the entry whose behaviour they imitate. Figures are as reported; several are estimates."
        />
      </p>
      <ul className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {threats.map((t) => (
          <li key={t.id}>
            <Panel as="article" className="h-full">
              <p className="font-mono text-label uppercase text-fg-3">{month(t.date)}</p>
              <h3 className="mt-2 text-body font-medium text-fg">{t.title}</h3>
              <p className="mt-2 text-small text-fg-2">{t.summary}</p>
              <p className="mt-3 text-small text-ok">
                <Copy
                  simple={`How our model would spot it: ${t.spot}`}
                  technical={`Features: ${t.features.join(", ")} · seen: ${t.seen.join("; ")}`}
                />
              </p>
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-small">
                {t.sources.map((s) => (
                  <a
                    key={s.url}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-u text-fg-2"
                  >
                    {s.label}
                  </a>
                ))}
              </p>
            </Panel>
          </li>
        ))}
      </ul>
    </section>
  );
}

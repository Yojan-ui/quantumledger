"use client";

import { Container } from "@/components/ui";
import { Workflow } from "@/components/ui/Workflow";

const CHAPTERS = ["chapter-problem", "chapter-how", "chapter-proof", "chapter-start"];

/** The homepage's "How it works" strip: one step per chapter, following the reader. */
export function HomeWorkflow() {
  return (
    <Container className="relative pb-6 pt-10 md:pt-15">
      <Workflow
        sections={CHAPTERS}
        steps={[
          { simple: "See your quantum risk", technical: "Scan: TLS, keys and certificates" },
          { simple: "Fix it with Shield", technical: "Hybrid ML-KEM upgrade, no code change" },
          { simple: "Prove it with signed records", technical: "ML-DSA-signed Proof Chain" },
          { simple: "Start with your own site", technical: "Pilot and early access" },
        ]}
      />
    </Container>
  );
}

import { PipelinePreview } from "@/components/atlas/PipelinePreview";
import { ButtonLink, Section, Text } from "@/components/ui";

/** The second part of the home page: after the scan, the pipeline that plans, verifies and proves the fix. */
export function PipelineSection() {
  return (
    <Section id="pipeline" label="Pipeline" role="kem" className="!pt-8 md:!pt-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-text space-y-3">
          <h2 className="text-h2 font-medium text-fg">From one scan to a signed migration plan.</h2>
          <Text>
            Detect, sign the evidence, plan the waves, order the patches, test them on real TLS,
            cross-check with QAOA and seal the proof. This is the bank demo, from recorded Atlas
            results.
          </Text>
        </div>
        <ButtonLink href="/atlas/demo" variant="secondary" className="shrink-0">
          Open the full pipeline
        </ButtonLink>
      </div>
      <div className="mt-8">
        <PipelinePreview ws="demo" />
      </div>
    </Section>
  );
}

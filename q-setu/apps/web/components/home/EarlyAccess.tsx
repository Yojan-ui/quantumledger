import { EarlyAccessForm } from "@/components/forms/EarlyAccessForm";
import { Grid, Section, Text } from "@/components/ui";
import { MaskHeading } from "@/components/ui/MaskHeading";

/** 09: what do I do next? */
export function EarlyAccess() {
  return (
    <Section id="early-access" index="09" label="Early access">
      <Grid className="gap-y-12">
        <div className="col-span-12 lg:col-span-5">
          <MaskHeading text="Be quantum-safe before Q‑Day." />
          <Text className="mt-4 max-w-text">
            We’re looking for design partners: banks, hospitals, universities and departments ready
            to pilot Q-Setu in shadow mode.
          </Text>
        </div>
        <div className="col-span-12 lg:col-span-6 lg:col-start-7">
          <EarlyAccessForm />
        </div>
      </Grid>
    </Section>
  );
}

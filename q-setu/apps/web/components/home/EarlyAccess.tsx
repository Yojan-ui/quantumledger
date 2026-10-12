import { EarlyAccessForm } from "@/components/forms/EarlyAccessForm";
import { Grid, Section, Text } from "@/components/ui";
import { Copy, CopyHeading } from "@/components/ui/Copy";

/** 10: what do I do next? Early access and pilot partners. */
export function EarlyAccess() {
  return (
    <Section id="early-access" index="10" label="Early access · pilot partners" role="ok">
      <Grid className="gap-y-12">
        <div className="col-span-12 lg:col-span-5">
          <CopyHeading
            simple="Change the locks before the master key exists."
            technical="Be quantum-safe before Q‑Day."
          />
          <Text className="mt-4 max-w-text">
            <Copy
              simple="We’re looking for pilot partners: banks, hospitals, universities and government teams ready to try QuantumLedger alongside their systems, without risk."
              technical="We’re looking for design partners: banks, hospitals, universities and departments ready to pilot QuantumLedger in shadow mode."
            />
          </Text>
        </div>
        <div className="col-span-12 lg:col-span-6 lg:col-start-7">
          <EarlyAccessForm />
        </div>
      </Grid>
    </Section>
  );
}

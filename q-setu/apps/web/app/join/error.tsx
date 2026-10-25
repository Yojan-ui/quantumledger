"use client";

import { Button, Text } from "@/components/ui";
import { Logo } from "@/components/ui/Logo";

/** /join's error boundary: a crash on a phone becomes a calm message and a retry, never a blank page. */
export default function JoinError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="mx-auto min-h-svh w-full max-w-text px-5 pb-16 pt-6">
      <Logo />
      <div className="mt-10" role="alert">
        <h1 className="text-h1-sm font-medium text-fg">Something went wrong on this phone</h1>
        <Text className="mt-3">
          Nothing was sent. Try again, or watch the big screen: the demo carries on there.
        </Text>
        <Button className="mt-6 h-12" onClick={() => reset()}>
          Try again
        </Button>
      </div>
    </main>
  );
}

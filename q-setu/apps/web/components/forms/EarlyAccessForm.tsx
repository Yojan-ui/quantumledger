"use client";

import { useState } from "react";
import { Button, Label, Text } from "@/components/ui";
import { track } from "@/lib/client/analytics";
import { errText } from "@/lib/client/api";

const SECTORS = [
  ["fintech", "Fintech / banking"],
  ["healthcare", "Healthcare"],
  ["education", "Education"],
  ["government", "Government"],
  ["other", "Something else"],
] as const;

const field =
  "h-10 w-full rounded-sm border border-line bg-inset px-3 text-small text-fg outline-none transition-colors duration-150 placeholder:text-fg-3 focus:border-line-strong";

/** Early access and contact: validated on the server (zod), honeypot + rate limit, stored in the database. */
export function EarlyAccessForm({ kind = "early-access" }: { kind?: "early-access" | "contact" }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string>();
  const [email, setEmail] = useState("");

  async function submit(form: HTMLFormElement) {
    setState("sending");
    setError(undefined);
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setEmail(data.email ?? "");
    try {
      const r = await fetch("/api/early-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...data, kind }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(errText(d, "Something went wrong"));
      setState("done");
      if (kind === "early-access") track("early_access_submitted", { sector: data.sector ?? "" });
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "Couldn't reach the server. Check your connection."
          : (e as Error).message,
      );
      setState("error");
    }
  }

  if (state === "done")
    return (
      <div className="space-y-2 border-t border-line pt-6" role="status">
        <p className="text-h3 font-medium text-fg">
          <span className="text-accent">✓</span> Thanks. We’ll write to {email}.
        </p>
        <Text size="small">We read every request ourselves, usually within two working days.</Text>
      </div>
    );

  return (
    <form
      className="grid grid-cols-1 gap-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(e.currentTarget);
      }}
    >
      <label className="space-y-2">
        <Label>Name</Label>
        <input name="name" required maxLength={120} autoComplete="name" className={field} />
      </label>
      <label className="space-y-2">
        <Label>Work email</Label>
        <input
          name="email"
          type="email"
          required
          maxLength={200}
          autoComplete="email"
          className={field}
        />
      </label>
      <label className="space-y-2">
        <Label>Organisation</Label>
        <input
          name="organisation"
          required
          maxLength={160}
          autoComplete="organization"
          className={field}
        />
      </label>
      <label className="space-y-2">
        <Label>Sector</Label>
        <select name="sector" required defaultValue="" className={field}>
          <option value="" disabled>
            Choose one
          </option>
          {SECTORS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-2 md:col-span-2">
        <Label>{kind === "contact" ? "Message" : "What would you protect first?"}</Label>
        <textarea
          name="useCase"
          required
          maxLength={2000}
          rows={4}
          className={`${field} h-auto py-2`}
        />
      </label>
      {/* Honeypot: hidden from people, filled in by bots. */}
      <div aria-hidden className="hidden">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-4 md:col-span-2">
        <Button variant="primary" type="submit" disabled={state === "sending"}>
          {state === "sending"
            ? "Sending…"
            : kind === "contact"
              ? "Send message"
              : "Request early access"}
        </Button>
        <Text size="small" className="text-fg-3">
          We use this only to reply. See the{" "}
          <a href="/privacy" className="underline underline-offset-4">
            privacy notice
          </a>
          .
        </Text>
      </div>
      {state === "error" && (
        <p className="text-small text-fg-2 md:col-span-2" role="alert">
          {error}. Your answers are still here; press send to try again.
        </p>
      )}
    </form>
  );
}

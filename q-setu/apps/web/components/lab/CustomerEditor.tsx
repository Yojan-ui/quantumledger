"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import type { Customer } from "@/lib/lab/types";

/** Team only: the note and readiness score a customer sees on their overview. */
export function CustomerEditor({ customer }: { customer: Customer }) {
  const router = useRouter();
  const [note, setNote] = useState(customer.note);
  const [readiness, setReadiness] = useState(
    customer.readiness === null ? "" : String(customer.readiness),
  );
  const [shieldSiteId, setShieldSiteId] = useState(customer.shieldSiteId ?? "");
  const [msg, setMsg] = useState<string>();
  const field = "rounded-sm border border-line-strong bg-raised px-3 text-small text-fg";
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
      <label className="flex flex-col gap-2">
        <span className="font-mono text-label uppercase text-fg-3">Note for {customer.name}</span>
        <textarea
          rows={3}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={`${field} py-2`}
        />
      </label>
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-2">
          <span className="font-mono text-label uppercase text-fg-3">Readiness (0–100)</span>
          <input
            inputMode="numeric"
            value={readiness}
            onChange={(e) => setReadiness(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
            className={`${field} h-10 w-24`}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-mono text-label uppercase text-fg-3">Shield site id</span>
          <input
            value={shieldSiteId}
            onChange={(e) => setShieldSiteId(e.target.value)}
            className={`${field} h-10`}
            placeholder="for the quantum-safe share"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          onClick={async () => {
            setMsg(undefined);
            const r = await fetch(`/api/lab/customers/${customer.id}`, {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                note,
                readiness: readiness === "" ? null : Number(readiness),
                shieldSiteId,
              }),
            });
            const j = (await r.json()) as { error?: { message: string } };
            if (!r.ok) throw new Error(j.error?.message ?? "Couldn't save");
            setMsg("Saved. Only this customer and the team can see it.");
            router.refresh();
          }}
        >
          Save
        </Button>
        {msg && <span className="text-small text-fg-3">{msg}</span>}
      </div>
    </form>
  );
}

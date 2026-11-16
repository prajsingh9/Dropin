"use client";

import { useState, type FormEvent } from "react";
import { useHousehold } from "@/components/providers/dropin-provider";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { errorMessage, useToast } from "@/components/ui/toast";
import { expectedParcelInput } from "@/lib/backend/schemas";
import { KNOWN_COURIERS } from "@/lib/domain/couriers";

function localInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AddParcelSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { run } = useHousehold();
  const toast = useToast();
  const [form, setForm] = useState(() => ({ courier: "DHL", other: "", tracking: "", sender: "", expected: localInputValue(new Date(Date.now() + 3 * 3600_000)), weight: "" }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      courier_name: form.courier === "Other" ? form.other : form.courier,
      tracking_number: form.tracking,
      sender: form.sender,
      expected_at: form.expected ? new Date(form.expected).toISOString() : null,
      weight_kg: form.weight ? Number(form.weight) : null,
    };
    const parsed = expectedParcelInput.safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
      return setErrors(errs);
    }
    setErrors({});
    setBusy(true);
    try {
      await run((c) => c.addExpectedParcel(payload));
      toast.push({ tone: "success", title: "Parcel added", description: "We'll match it when the courier drops it in." });
      setForm((f) => ({ ...f, tracking: "", sender: "", weight: "", other: "" }));
      onClose();
    } catch (err) {
      toast.push({ tone: "error", title: "Couldn't add parcel", description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Expect a parcel" description="Matched automatically by tracking number when it's deposited.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Courier" htmlFor="courier" error={form.courier !== "Other" ? errors.courier_name : undefined}>
            <Select id="courier" value={form.courier} onChange={(e) => setForm({ ...form, courier: e.target.value })}>
              {KNOWN_COURIERS.map((c) => (
                <option key={c}>{c}</option>
              ))}
              <option>Other</option>
            </Select>
          </Field>
          <Field label="Weight (kg)" htmlFor="weight" error={errors.weight_kg}>
            <Input id="weight" inputMode="decimal" type="number" min="0" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="Optional" />
          </Field>
        </div>
        {form.courier === "Other" && (
          <Field label="Courier name" htmlFor="other" error={errors.courier_name}>
            <Input id="other" value={form.other} onChange={(e) => setForm({ ...form, other: e.target.value })} aria-invalid={!!errors.courier_name} />
          </Field>
        )}
        <Field label="Tracking number" htmlFor="tracking" error={errors.tracking_number}>
          <Input id="tracking" value={form.tracking} onChange={(e) => setForm({ ...form, tracking: e.target.value })} className="font-mono" placeholder="Optional, improves matching" />
        </Field>
        <Field label="From" htmlFor="sender">
          <Input id="sender" value={form.sender} onChange={(e) => setForm({ ...form, sender: e.target.value })} placeholder="Shop or sender (optional)" />
        </Field>
        <Field label="Expected" htmlFor="expected" error={errors.expected_at}>
          <Input id="expected" type="datetime-local" value={form.expected} onChange={(e) => setForm({ ...form, expected: e.target.value })} />
        </Field>
        <Button type="submit" block size="lg" loading={busy} className="!mt-6">
          Add parcel
        </Button>
      </form>
    </Sheet>
  );
}

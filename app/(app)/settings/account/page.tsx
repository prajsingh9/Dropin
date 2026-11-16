"use client";

import { Camera, KeyRound } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useHousehold } from "@/components/providers/dropin-provider";
import { Avatar } from "@/components/settings/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { errorMessage, useToast } from "@/components/ui/toast";
import { profileInput } from "@/lib/backend/schemas";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** Resize an image to a small square JPEG data URL (keeps avatars tiny and private). */
async function resizeImage(file: File, size = 160): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const s = Math.min(bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, (bitmap.width - s) / 2, (bitmap.height - s) / 2, s, s, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export default function AccountPage() {
  const { snapshot, run, mode } = useHousehold();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ full_name: snapshot.user.full_name, phone: snapshot.user.phone ?? "", avatar_url: snapshot.user.avatar_url });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ password: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = profileInput.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
      return setErrors(errs);
    }
    setErrors({});
    setBusy(true);
    try {
      await run((c) => c.updateProfile(form));
      toast.push({ tone: "success", title: "Profile updated" });
    } catch (err) {
      toast.push({ tone: "error", title: "Couldn't save profile", description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.password.length < 8) return setPwError("Use at least 8 characters");
    if (pw.password !== pw.confirm) return setPwError("Passwords don't match");
    setPwError("");
    setPwBusy(true);
    const { error } = await getSupabaseBrowserClient().auth.updateUser({ password: pw.password });
    setPwBusy(false);
    if (error) toast.push({ tone: "error", title: "Couldn't change password", description: error.message });
    else {
      setPw({ password: "", confirm: "" });
      toast.push({ tone: "success", title: "Password changed" });
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back="/settings" title="Account" />
      <form onSubmit={save} className="space-y-5 rounded-card bg-surface p-5 shadow-card" noValidate>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar name={form.full_name || "?"} src={form.avatar_url} className="size-20 text-xl" />
            <button type="button" onClick={() => file.current?.click()} aria-label="Change profile photo" className="absolute -bottom-1 -right-1 flex size-9 items-center justify-center rounded-full bg-ink text-on-ink ring-4 ring-surface">
              <Camera className="size-4" />
            </button>
            <input
              ref={file}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  setForm((x) => ({ ...x, avatar_url: null }));
                  const url = await resizeImage(f);
                  setForm((x) => ({ ...x, avatar_url: url }));
                } catch {
                  toast.push({ tone: "error", title: "Couldn't read that image" });
                }
              }}
            />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold">Profile photo</p>
            {form.avatar_url ? (
              <button type="button" className="text-sm font-semibold text-danger" onClick={() => setForm({ ...form, avatar_url: null })}>
                Remove photo
              </button>
            ) : (
              <p className="text-sm text-muted">Shown to your household</p>
            )}
          </div>
        </div>
        <Field label="Full name" htmlFor="name" error={errors.full_name}>
          <Input id="name" autoComplete="name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} aria-invalid={!!errors.full_name} />
        </Field>
        <Field label="Email" htmlFor="email" hint={mode === "demo" ? "Demo profile email" : "Contact support to change your sign-in email."}>
          <Input id="email" value={snapshot.user.email} disabled />
        </Field>
        <Field label="Phone" htmlFor="phone" error={errors.phone}>
          <Input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} aria-invalid={!!errors.phone} />
        </Field>
        <Button type="submit" block size="lg" loading={busy}>
          Save changes
        </Button>
      </form>

      {mode === "supabase" && (
        <form onSubmit={changePassword} className="mt-6 space-y-4 rounded-card bg-surface p-5 shadow-card" noValidate>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-surface-2">
              <KeyRound className="size-5" />
            </span>
            <p className="text-lg font-semibold">Change password</p>
          </div>
          <Field label="New password" htmlFor="pw" error={pwError}>
            <Input id="pw" type="password" autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} />
          </Field>
          <Field label="Confirm password" htmlFor="pw2">
            <Input id="pw2" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          </Field>
          <Button type="submit" variant="outline" block loading={pwBusy}>
            Update password
          </Button>
        </form>
      )}
    </div>
  );
}

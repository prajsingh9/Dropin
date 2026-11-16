"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, FlaskConical, MailCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { DropinLogo } from "@/components/brand/logo";
import { useDropin } from "@/components/providers/dropin-provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { errorMessage, useToast } from "@/components/ui/toast";
import type { DemoClient } from "@/lib/client/demo-client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import warm from "@/public/images/dropin-collector-warm.jpg";

const credentials = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
});

const demoIdentity = z.object({
  full_name: z.string().trim().min(2, "Enter your name"),
  email: z.string().trim().email("Enter a valid email"),
});

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";
}

export function AuthScreen() {
  const { mode, client, status, refresh } = useDropin();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [tab, setTab] = useState<"signin" | "signup">(params.get("intent") === "signup" ? "signup" : "signin");
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [sent, setSent] = useState<"confirm" | "reset" | null>(null);
  const next = safeNext(params.get("next"));

  useEffect(() => {
    if (status === "ready") router.replace(next);
    if (status === "needs_onboarding") router.replace("/onboarding");
  }, [status, router, next]);

  useEffect(() => {
    const err = params.get("error");
    if (err) toast.push({ tone: "error", title: "Sign-in link failed", description: err });
  }, [params, toast]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submitSupabase(e: FormEvent) {
    e.preventDefault();
    const parsed = credentials.safeParse(form);
    const nameOk = tab === "signin" || form.full_name.trim().length >= 2;
    if (!parsed.success || !nameOk) {
      const errs: Record<string, string> = {};
      parsed.error?.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
      if (!nameOk) errs.full_name = "Enter your name";
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy("submit");
    const sb = getSupabaseBrowserClient();
    try {
      if (tab === "signin") {
        const { error } = await sb.auth.signInWithPassword(parsed.data);
        if (error) throw error;
        await refresh();
      } else {
        const { data, error } = await sb.auth.signUp({
          ...parsed.data,
          options: { data: { full_name: form.full_name.trim() }, emailRedirectTo: `${location.origin}/auth/callback?next=/onboarding` },
        });
        if (error) throw error;
        if (!data.session) setSent("confirm");
        else await refresh();
      }
    } catch (err) {
      toast.push({ tone: "error", title: tab === "signin" ? "Couldn't sign in" : "Couldn't create account", description: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  async function resetPassword() {
    const email = z.string().email().safeParse(form.email.trim());
    if (!email.success) return setErrors({ email: "Enter your email first" });
    setBusy("reset");
    const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(email.data, { redirectTo: `${location.origin}/auth/callback?next=/settings/account` });
    setBusy(null);
    if (error) toast.push({ tone: "error", title: "Couldn't send reset link", description: error.message });
    else setSent("reset");
  }

  async function startDemo(withSample: boolean) {
    const parsed = demoIdentity.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
      return setErrors(errs);
    }
    setErrors({});
    setBusy(withSample ? "sample" : "fresh");
    try {
      await (client as DemoClient).signIn(parsed.data, withSample);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[1fr_minmax(0,560px)]">
      <div className="relative hidden overflow-hidden bg-[#111] lg:block">
        <Image src={warm} alt="" fill sizes="50vw" className="object-cover opacity-90" style={{ objectPosition: "60% 30%" }} placeholder="blur" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <p className="absolute bottom-12 left-12 max-w-md text-[44px] font-semibold leading-none tracking-[-0.04em] text-white">Your doorstep, handled.</p>
      </div>

      <div className="pt-safe flex min-h-dvh flex-col px-5 pb-8 sm:px-10">
        <div className="flex items-center justify-between py-4">
          <Link href="/" aria-label="Back to introduction" className="flex size-11 items-center justify-center rounded-full ring-1 ring-inset ring-line">
            <ChevronLeft className="size-5" />
          </Link>
          <DropinLogo />
          <span className="size-11" />
        </div>

        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div key="sent" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="my-auto text-center">
              <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-accent text-on-accent">
                <MailCheck className="size-9" strokeWidth={1.8} />
              </div>
              <h1 className="text-title font-semibold">Check your inbox</h1>
              <p className="mx-auto mt-3 max-w-xs text-muted">{sent === "confirm" ? `We sent a confirmation link to ${form.email}. Open it on this device to finish setting up.` : `If an account exists for ${form.email}, a reset link is on its way.`}</p>
              <Button variant="outline" className="mt-8" onClick={() => setSent(null)}>
                Back to sign in
              </Button>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-6 w-full max-w-md flex-1 lg:mt-16">
              <h1 className="text-title font-semibold">{mode === "demo" ? "Try Dropin" : tab === "signin" ? "Welcome back" : "Create your account"}</h1>
              <p className="mt-2 text-muted">{mode === "demo" ? "Explore the full app with a simulated Dropin." : "One account for your Dropin, doorbell and indoor monitor."}</p>

              {mode === "demo" ? (
                <div className="mt-8 space-y-4">
                  <div className="flex gap-3 rounded-[22px] bg-paper p-4 text-on-paper">
                    <FlaskConical className="mt-0.5 size-5 shrink-0" />
                    <p className="text-sm">
                      <strong className="font-semibold">Local demo mode.</strong> Supabase isn&apos;t configured, so there&apos;s no real sign-in — your data stays in this browser and the hardware is simulated.
                    </p>
                  </div>
                  <Field label="Your name" error={errors.full_name} htmlFor="name">
                    <Input id="name" autoComplete="name" value={form.full_name} onChange={set("full_name")} placeholder="Praj Singh" aria-invalid={!!errors.full_name} />
                  </Field>
                  <Field label="Email" error={errors.email} htmlFor="email" hint="Only used to label your demo profile.">
                    <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} placeholder="you@example.com" aria-invalid={!!errors.email} />
                  </Field>
                  <div className="space-y-3 pt-3">
                    <Button block size="lg" variant="accent" loading={busy === "sample"} onClick={() => startDemo(true)}>
                      Explore a sample home
                    </Button>
                    <Button block size="lg" variant="outline" loading={busy === "fresh"} onClick={() => startDemo(false)}>
                      Set up a new Dropin
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={submitSupabase} className="mt-8 space-y-4" noValidate>
                  <Segmented
                    value={tab}
                    onChange={(v) => {
                      setTab(v);
                      setErrors({});
                    }}
                    options={[
                      { value: "signin", label: "Sign in" },
                      { value: "signup", label: "Create account" },
                    ]}
                  />
                  {tab === "signup" && (
                    <Field label="Full name" error={errors.full_name} htmlFor="name">
                      <Input id="name" autoComplete="name" value={form.full_name} onChange={set("full_name")} aria-invalid={!!errors.full_name} />
                    </Field>
                  )}
                  <Field label="Email" error={errors.email} htmlFor="email">
                    <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} aria-invalid={!!errors.email} />
                  </Field>
                  <Field label="Password" error={errors.password} htmlFor="password">
                    <Input id="password" type="password" autoComplete={tab === "signin" ? "current-password" : "new-password"} value={form.password} onChange={set("password")} aria-invalid={!!errors.password} />
                  </Field>
                  <Button type="submit" block size="lg" loading={busy === "submit"} className="!mt-6">
                    {tab === "signin" ? "Sign in" : "Create account"}
                  </Button>
                  {tab === "signin" && (
                    <button type="button" onClick={resetPassword} disabled={busy === "reset"} className="mx-auto block text-sm font-semibold text-muted underline-offset-4 hover:underline">
                      Forgot password?
                    </button>
                  )}
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

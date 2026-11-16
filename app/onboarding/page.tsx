"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, CircleAlert, FlaskConical, KeyRound, LoaderCircle, Power, QrCode, Router, Users, Wifi } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DropinLogo } from "@/components/brand/logo";
import { DropinDevice } from "@/components/illustrations/dropin-device";
import { QrScanner } from "@/components/onboarding/qr-scanner";
import { useDropin } from "@/components/providers/dropin-provider";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { errorMessage, useToast } from "@/components/ui/toast";
import { householdInput, pairingInput } from "@/lib/backend/schemas";
import { isSimulatorEnabled } from "@/lib/config";
import { browserTimeZone } from "@/lib/demo/seed";
import { cn, sleep } from "@/lib/utils";

const STEPS = ["Connect", "Pair", "Wi-Fi", "Home", "Done"] as const;

function randomId(prefix: "SIM" | "DRP") {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${prefix}-${part()}-${part()}`;
}

function timeZones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [browserTimeZone()];
  } catch {
    return [browserTimeZone()];
  }
}

type WifiState = "idle" | "connecting" | "connected" | "error";

interface Invitation {
  id: string;
  role: string;
  household: { name: string; building: string | null } | null;
}

export default function OnboardingPage() {
  const { status, client, mode, refresh } = useDropin();
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [pairMode, setPairMode] = useState<"scan" | "manual">("manual");
  const [pair, setPair] = useState({ device_identifier: "", pairing_code: "", simulated: false });
  const [pairErrors, setPairErrors] = useState<Record<string, string>>({});
  const [wifi, setWifi] = useState({ ssid: "", state: "idle" as WifiState, message: "" });
  const [home, setHome] = useState({ full_name: "", phone: "", name: "Home", flat_number: "", building: "", address: "", timezone: browserTimeZone(), device_name: "Front door Dropin" });
  const [homeErrors, setHomeErrors] = useState<Record<string, string>>({});
  const [finishing, setFinishing] = useState<"idle" | "working" | "done" | "error">("idle");
  const [finishError, setFinishError] = useState("");
  const [invites, setInvites] = useState<Invitation[]>([]);
  const zones = useMemo(() => timeZones(), []);

  useEffect(() => {
    if (status === "signed_out") router.replace("/login?next=/onboarding");
    if (status === "ready" && finishing === "idle") router.replace("/home");
  }, [status, router, finishing]);

  useEffect(() => {
    if (mode !== "supabase" || status !== "needs_onboarding") return;
    fetch("/api/invitations")
      .then((r) => (r.ok ? r.json() : { invitations: [] }))
      .then((d: { invitations: Invitation[] }) => setInvites(d.invitations))
      .catch(() => {});
  }, [mode, status]);

  const onScan = useCallback((r: { device_identifier: string; pairing_code: string }) => {
    setPair({ ...r, simulated: r.device_identifier.startsWith("SIM-") });
    setPairMode("manual");
  }, []);

  const validatePair = () => {
    const r = pairingInput.safeParse(pair);
    if (!r.success) {
      const e: Record<string, string> = {};
      r.error.issues.forEach((i) => (e[String(i.path[0])] = i.message));
      setPairErrors(e);
      return false;
    }
    if (r.data.device_identifier.startsWith("SIM-") && !isSimulatorEnabled) {
      setPairErrors({ device_identifier: "Simulated devices aren't available in this environment." });
      return false;
    }
    setPairErrors({});
    setPair({ ...r.data, simulated: r.data.device_identifier.startsWith("SIM-") });
    return true;
  };

  const useSimulated = () => {
    setPair({ device_identifier: randomId("SIM"), pairing_code: "SIMULATED-PAIRING", simulated: true });
    setPairErrors({});
  };

  const provisionWifi = async () => {
    if (!wifi.ssid.trim()) return setWifi((w) => ({ ...w, state: "error", message: "Enter the name of your Wi-Fi network." }));
    if (!pair.simulated) {
      // Real hardware joins Wi-Fi through its own setup hotspot; we can't confirm it from here.
      setWifi((w) => ({ ...w, state: "connected", message: "Saved. Your Dropin will appear online once it joins this network." }));
      return;
    }
    setWifi((w) => ({ ...w, state: "connecting", message: "Simulated: sending credentials to the device…" }));
    await sleep(900);
    setWifi((w) => ({ ...w, message: "Simulated: joining network…" }));
    await sleep(900);
    setWifi((w) => ({ ...w, state: "connected", message: `Simulated device connected to ${w.ssid}.` }));
  };

  const validateHome = () => {
    const errs: Record<string, string> = {};
    if (home.full_name.trim().length < 2) errs.full_name = "Enter your name";
    const r = householdInput.safeParse(home);
    if (!r.success) r.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
    if (home.device_name.trim().length < 2) errs.device_name = "Name your Dropin";
    setHomeErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const finish = async () => {
    setStep(4);
    setFinishing("working");
    try {
      await client.completeOnboarding({
        full_name: home.full_name,
        phone: home.phone || undefined,
        household: { name: home.name, flat_number: home.flat_number, building: home.building, address: home.address, timezone: home.timezone },
        device: { ...pair, device_name: home.device_name },
        wifi_ssid: wifi.ssid || null,
      });
      setFinishing("done");
    } catch (e) {
      setFinishError(errorMessage(e));
      setFinishing("error");
    }
  };

  const acceptInvite = async (id: string) => {
    try {
      const res = await fetch(`/api/invitations/${id}/accept`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      await refresh();
      router.replace("/home");
    } catch (e) {
      toast.push({ tone: "error", title: "Couldn't join", description: errorMessage(e) });
    }
  };

  if (status === "loading") return <div className="min-h-dvh" />;

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5">
      <div className="flex items-center justify-between py-4">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || step === 4} aria-label="Back" className="flex size-11 items-center justify-center rounded-full ring-1 ring-inset ring-line disabled:opacity-0">
          <ChevronLeft className="size-5" />
        </button>
        <DropinLogo />
        <span className="w-11 text-right text-sm font-semibold text-muted">
          {Math.min(step + 1, 5)}/5
        </span>
      </div>
      <div className="mb-8 flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
        {STEPS.map((s, i) => (
          <div key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <motion.div className="h-full bg-accent" initial={false} animate={{ width: i <= step ? "100%" : "0%" }} transition={{ duration: 0.35 }} />
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.section key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }} className="flex flex-1 flex-col">
          {step === 0 && (
            <>
              {invites.length > 0 && (
                <div className="mb-6 rounded-card bg-paper p-5 text-on-paper">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Users className="size-4" /> You&apos;ve been invited
                  </div>
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold">{inv.household?.name ?? "A household"}</p>
                        <p className="text-sm opacity-70">Join as {inv.role}</p>
                      </div>
                      <Button size="sm" onClick={() => acceptInvite(inv.id)}>
                        Join
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <h1 className="text-title font-semibold">Connect your Dropin</h1>
              <p className="mt-3 text-muted">Plug in your Dropin Parcel Collector and wait for the green light on the camera module.</p>
              <div className="relative my-8 flex flex-1 items-center justify-center rounded-card bg-surface-2 py-8">
                <DropinDevice state="empty" className="h-[300px]" />
              </div>
              <ul className="mb-6 space-y-3">
                {[
                  { icon: <Power className="size-4" />, text: "Power is connected and the status light is on" },
                  { icon: <QrCode className="size-4" />, text: "The QR code and pairing code are on the back panel" },
                  { icon: <Router className="size-4" />, text: "You know your home Wi-Fi name and password" },
                ].map((r) => (
                  <li key={r.text} className="flex items-center gap-3 text-[15px]">
                    <span className="flex size-9 items-center justify-center rounded-full bg-surface-2">{r.icon}</span>
                    {r.text}
                  </li>
                ))}
              </ul>
              <Button size="lg" block onClick={() => setStep(1)}>
                My Dropin is on
              </Button>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-title font-semibold">Pair your device</h1>
              <p className="mt-3 text-muted">Scan the QR code on the back panel, or type the device ID and pairing code printed below it.</p>
              <Segmented
                className="mt-6"
                value={pairMode}
                onChange={setPairMode}
                options={[
                  { value: "scan", label: "Scan QR", icon: <QrCode className="size-4" /> },
                  { value: "manual", label: "Enter ID", icon: <KeyRound className="size-4" /> },
                ]}
              />
              <div className="mt-6 flex-1 space-y-4">
                {pairMode === "scan" ? (
                  <QrScanner onResult={onScan} />
                ) : (
                  <>
                    <Field label="Device ID" htmlFor="did" error={pairErrors.device_identifier} hint="Looks like DRP-7Q4K-2M8D">
                      <Input id="did" value={pair.device_identifier} onChange={(e) => setPair({ ...pair, device_identifier: e.target.value.toUpperCase(), simulated: e.target.value.toUpperCase().startsWith("SIM-") })} placeholder="DRP-XXXX-XXXX" autoCapitalize="characters" spellCheck={false} aria-invalid={!!pairErrors.device_identifier} className="font-mono tracking-wider" />
                    </Field>
                    <Field label="Pairing code" htmlFor="code" error={pairErrors.pairing_code} hint="Only a fingerprint of this code is stored — it proves the device is yours.">
                      <Input id="code" value={pair.pairing_code} onChange={(e) => setPair({ ...pair, pairing_code: e.target.value })} autoComplete="off" spellCheck={false} aria-invalid={!!pairErrors.pairing_code} className="font-mono" />
                    </Field>
                    {pair.simulated && (
                      <div className="flex items-center gap-2 rounded-2xl bg-yellow/25 px-4 py-3 text-sm font-semibold">
                        <FlaskConical className="size-4" /> Simulated device — no hardware will be contacted.
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="mt-6 space-y-3">
                <Button size="lg" block onClick={() => validatePair() && setStep(2)}>
                  Continue
                </Button>
                {isSimulatorEnabled && (
                  <Button size="lg" block variant="outline" icon={<FlaskConical className="size-4" />} onClick={useSimulated}>
                    Use a simulated Dropin
                  </Button>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-title font-semibold">Connect to Wi-Fi</h1>
              {pair.simulated ? (
                <p className="mt-3 text-muted">Your simulated Dropin will pretend to join this network so you can test the full flow.</p>
              ) : (
                <ol className="mt-4 space-y-3 text-[15px]">
                  {["Hold the button on the lower panel for 5 seconds until the light pulses white.", `On this phone, join the Wi-Fi network “Dropin-${pair.device_identifier.slice(-4)}”.`, "Pick your home network in the page that opens, then come back here."].map((t, i) => (
                    <li key={t} className="flex gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-on-ink dark:bg-on-ink dark:text-[#111]">{i + 1}</span>
                      <span className="pt-0.5">{t}</span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="my-6 flex-1 space-y-4">
                <Field label="Home Wi-Fi network" htmlFor="ssid" error={wifi.state === "error" ? wifi.message : undefined}>
                  <Input id="ssid" value={wifi.ssid} onChange={(e) => setWifi({ ssid: e.target.value, state: "idle", message: "" })} placeholder="e.g. Home-5G" aria-invalid={wifi.state === "error"} />
                </Field>
                {wifi.state !== "idle" && wifi.state !== "error" && (
                  <div className={cn("flex items-center gap-3 rounded-2xl px-4 py-4 text-sm font-semibold", wifi.state === "connected" ? "bg-success-soft text-success" : "bg-surface-2")} role="status">
                    {wifi.state === "connecting" ? <LoaderCircle className="size-5 animate-spin" /> : <Check className="size-5" />}
                    {wifi.message}
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {wifi.state === "connected" ? (
                  <Button size="lg" block onClick={() => setStep(3)}>
                    Continue
                  </Button>
                ) : (
                  <Button size="lg" block icon={<Wifi className="size-4" />} loading={wifi.state === "connecting"} onClick={provisionWifi}>
                    {pair.simulated ? "Connect (simulated)" : "I've connected it"}
                  </Button>
                )}
              </div>
            </>
          )}

          {step === 3 && (
            <form
              className="flex flex-1 flex-col"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (validateHome()) void finish();
              }}
            >
              <h1 className="text-title font-semibold">About your home</h1>
              <p className="mt-3 text-muted">Couriers and household members will see this as your delivery address.</p>
              <div className="my-6 flex-1 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Your name" htmlFor="fn" error={homeErrors.full_name}>
                    <Input id="fn" autoComplete="name" value={home.full_name} onChange={(e) => setHome({ ...home, full_name: e.target.value })} aria-invalid={!!homeErrors.full_name} />
                  </Field>
                  <Field label="Phone (optional)" htmlFor="ph">
                    <Input id="ph" type="tel" autoComplete="tel" value={home.phone} onChange={(e) => setHome({ ...home, phone: e.target.value })} />
                  </Field>
                </div>
                <Field label="Home name" htmlFor="hn" error={homeErrors.name}>
                  <Input id="hn" value={home.name} onChange={(e) => setHome({ ...home, name: e.target.value })} aria-invalid={!!homeErrors.name} />
                </Field>
                <div className="grid grid-cols-[1fr_2fr] gap-4">
                  <Field label="Flat no." htmlFor="flat">
                    <Input id="flat" value={home.flat_number} onChange={(e) => setHome({ ...home, flat_number: e.target.value })} />
                  </Field>
                  <Field label="Building" htmlFor="bld">
                    <Input id="bld" value={home.building} onChange={(e) => setHome({ ...home, building: e.target.value })} />
                  </Field>
                </div>
                <Field label="Address" htmlFor="addr">
                  <Input id="addr" autoComplete="street-address" value={home.address} onChange={(e) => setHome({ ...home, address: e.target.value })} />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Time zone" htmlFor="tz" hint="Used for quiet hours.">
                    <Select id="tz" value={home.timezone} onChange={(e) => setHome({ ...home, timezone: e.target.value })}>
                      {zones.map((z) => (
                        <option key={z}>{z}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Device name" htmlFor="dn" error={homeErrors.device_name}>
                    <Input id="dn" value={home.device_name} onChange={(e) => setHome({ ...home, device_name: e.target.value })} />
                  </Field>
                </div>
              </div>
              <Button type="submit" size="lg" block>
                Finish setup
              </Button>
            </form>
          )}

          {step === 4 && (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              {finishing === "working" && (
                <>
                  <LoaderCircle className="mb-6 size-10 animate-spin text-accent" />
                  <h1 className="text-title font-semibold">Setting up {home.name}…</h1>
                </>
              )}
              {finishing === "error" && (
                <>
                  <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-danger-soft text-danger">
                    <CircleAlert className="size-9" />
                  </div>
                  <h1 className="text-title font-semibold">Setup didn&apos;t finish</h1>
                  <p className="mt-3 max-w-sm text-muted">{finishError}</p>
                  <div className="mt-8 flex gap-3">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      Check device ID
                    </Button>
                    <Button onClick={finish}>Try again</Button>
                  </div>
                </>
              )}
              {finishing === "done" && (
                <>
                  <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="mb-6 flex size-24 items-center justify-center rounded-full bg-accent text-on-accent">
                    <Check className="size-11" strokeWidth={2.5} />
                  </motion.div>
                  <h1 className="text-display font-semibold">You&apos;re all set</h1>
                  <p className="mt-4 max-w-sm text-muted">
                    {pair.simulated
                      ? `${home.device_name} is a simulated device. Use the yellow Simulate button to send it parcels and visitors.`
                      : `${home.device_name} is registered. It will show as online once it connects to your Wi-Fi and checks in.`}
                  </p>
                  <Button
                    size="lg"
                    className="mt-10 w-full max-w-xs"
                    onClick={async () => {
                      await refresh();
                      router.replace("/home");
                    }}
                  >
                    Go to my home
                  </Button>
                </>
              )}
            </div>
          )}
        </motion.section>
      </AnimatePresence>
      <div className="h-6" />
    </main>
  );
}

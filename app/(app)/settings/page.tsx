"use client";

import { Bell, ChevronRight, Cpu, FlaskConical, Home, LifeBuoy, LogOut, Palette, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHousehold } from "@/components/providers/dropin-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { Avatar } from "@/components/settings/avatar";
import { SectionHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { PageHeader } from "@/components/ui/page-header";

export default function SettingsPage() {
  const { snapshot, client, refresh, mode, device } = useHousehold();
  const { preference } = useTheme();
  const router = useRouter();
  const [confirmOut, setConfirmOut] = useState(false);
  const h = snapshot.household;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" />
      <Link href="/settings/account" className="mb-8 flex items-center gap-4 rounded-card bg-ink p-5 text-on-ink shadow-card">
        <Avatar name={snapshot.user.full_name} src={snapshot.user.avatar_url} className="size-16 text-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[22px] font-semibold tracking-[-0.03em]">{snapshot.user.full_name}</p>
          <p className="truncate text-sm text-on-ink-muted">{snapshot.user.email}</p>
        </div>
        <ChevronRight className="size-5 text-on-ink-muted" />
      </Link>

      <div className="space-y-8">
        <section>
          <SectionHeader title="Home" />
          <ListGroup>
            <ListRow icon={Home} title={h.name} detail={[h.flat_number && `Flat ${h.flat_number}`, h.building].filter(Boolean).join(" · ") || "Add your address"} href="/settings/household" />
            <ListRow icon={Users} title="Household members" detail={`${snapshot.members.length} member${snapshot.members.length === 1 ? "" : "s"}${snapshot.invitations.length ? ` · ${snapshot.invitations.length} invited` : ""}`} href="/settings/household#members" />
            <ListRow icon={Cpu} title="Devices" detail={device ? `${device.device_name} · ${device.connection_status}` : "No device paired"} href="/device" />
          </ListGroup>
        </section>

        <section>
          <SectionHeader title="Preferences" />
          <ListGroup>
            <ListRow icon={ShieldCheck} title="Security & privacy" detail="Quiet hours, access, alerts" href="/settings/security" />
            <ListRow icon={Bell} title="Notifications" detail="Parcels, visitors, device" href="/settings/notifications" />
            <ListRow icon={Palette} title="Appearance" detail={preference === "system" ? "Match system" : preference === "dark" ? "Dark" : "Light"} href="/settings/appearance" />
          </ListGroup>
        </section>

        <section>
          <SectionHeader title="Support" />
          <ListGroup>
            <ListRow icon={LifeBuoy} title="Help & support" detail="Help centre, troubleshooting, report a problem" href="/settings/support" />
            <ListRow icon={LogOut} title="Sign out" tone="danger" onClick={() => setConfirmOut(true)} />
          </ListGroup>
        </section>

        <p className="flex items-center justify-center gap-2 pb-4 text-center text-[13px] text-muted">
          {mode === "demo" && <FlaskConical className="size-3.5" />}
          Dropin 0.1.0 · {mode === "demo" ? "Local demo mode" : "Connected to Supabase"}
        </p>
      </div>

      <ConfirmDialog
        open={confirmOut}
        onClose={() => setConfirmOut(false)}
        icon={<LogOut className="size-6" />}
        title="Sign out?"
        description={mode === "demo" ? "Demo data stored in this browser will be cleared." : "You'll stop receiving alerts on this device until you sign in again."}
        confirmLabel="Sign out"
        destructive
        onConfirm={async () => {
          await client.signOut();
          await refresh();
          router.replace("/");
        }}
      />
    </div>
  );
}

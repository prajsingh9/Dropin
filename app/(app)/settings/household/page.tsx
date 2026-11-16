"use client";

import { Crown, Mail, UserMinus, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useHousehold } from "@/components/providers/dropin-provider";
import { Avatar } from "@/components/settings/avatar";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { errorMessage, useToast } from "@/components/ui/toast";
import { householdInput, inviteInput } from "@/lib/backend/schemas";
import { relativeTime } from "@/lib/domain/format";
import { isAdmin, PERMISSION_LABELS, ROLE_DEFAULT_PERMISSIONS } from "@/lib/domain/permissions";
import type { HouseholdMember, MemberPermissions } from "@/types/dropin";

export default function HouseholdPage() {
  const { snapshot, run, mode } = useHousehold();
  const toast = useToast();
  const router = useRouter();
  const admin = isAdmin(snapshot.membership);
  const h = snapshot.household;
  const [home, setHome] = useState({ name: h.name, flat_number: h.flat_number ?? "", building: h.building ?? "", address: h.address ?? "", timezone: h.timezone });
  const [homeErrors, setHomeErrors] = useState<Record<string, string>>({});
  const [savingHome, setSavingHome] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [invite, setInvite] = useState({ email: "", role: "resident" as "resident" | "admin" });
  const [inviteError, setInviteError] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [editing, setEditing] = useState<HouseholdMember | null>(null);
  const [perms, setPerms] = useState<MemberPermissions>(ROLE_DEFAULT_PERMISSIONS.resident);
  const [role, setRole] = useState<"resident" | "admin">("resident");
  const [removing, setRemoving] = useState<HouseholdMember | null>(null);

  const saveHome = async (e: FormEvent) => {
    e.preventDefault();
    const r = householdInput.safeParse(home);
    if (!r.success) {
      const errs: Record<string, string> = {};
      r.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
      return setHomeErrors(errs);
    }
    setHomeErrors({});
    setSavingHome(true);
    try {
      await run((c) => c.updateHousehold(home));
      toast.push({ tone: "success", title: "Home details saved" });
    } catch (err) {
      toast.push({ tone: "error", title: "Couldn't save", description: errorMessage(err) });
    } finally {
      setSavingHome(false);
    }
  };

  const sendInvite = async (e: FormEvent) => {
    e.preventDefault();
    const r = inviteInput.safeParse(invite);
    if (!r.success) return setInviteError(r.error.issues[0]?.message ?? "Invalid");
    setInviteError("");
    setInviteBusy(true);
    try {
      await run((c) => c.inviteMember(r.data));
      toast.push({ tone: "success", title: "Invitation created", description: mode === "demo" ? "In demo mode no email is sent." : `${r.data.email} can join by signing up with this email.` });
      setInvite({ email: "", role: "resident" });
      setInviting(false);
    } catch (err) {
      setInviteError(errorMessage(err));
    } finally {
      setInviteBusy(false);
    }
  };

  const openMember = (m: HouseholdMember) => {
    setEditing(m);
    setPerms(m.permissions);
    setRole(m.role === "admin" ? "admin" : "resident");
  };

  const saveMember = async () => {
    if (!editing) return;
    try {
      await run((c) => c.updateMember(editing.id, { role, permissions: { ...perms } }));
      toast.push({ tone: "success", title: "Access updated" });
      setEditing(null);
    } catch (err) {
      toast.push({ tone: "error", title: "Couldn't update access", description: errorMessage(err) });
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back="/settings" title="Household" eyebrow={h.name} />

      <form onSubmit={saveHome} className="space-y-4 rounded-card bg-surface p-5 shadow-card" noValidate>
        <Field label="Home name" htmlFor="hn" error={homeErrors.name}>
          <Input id="hn" value={home.name} disabled={!admin} onChange={(e) => setHome({ ...home, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <Field label="Flat no." htmlFor="flat">
            <Input id="flat" value={home.flat_number} disabled={!admin} onChange={(e) => setHome({ ...home, flat_number: e.target.value })} />
          </Field>
          <Field label="Building" htmlFor="bld">
            <Input id="bld" value={home.building} disabled={!admin} onChange={(e) => setHome({ ...home, building: e.target.value })} />
          </Field>
        </div>
        <Field label="Address" htmlFor="addr">
          <Input id="addr" value={home.address} disabled={!admin} onChange={(e) => setHome({ ...home, address: e.target.value })} />
        </Field>
        {admin && (
          <Button type="submit" block loading={savingHome}>
            Save home details
          </Button>
        )}
      </form>

      <section id="members" className="mt-8 scroll-mt-6">
        <SectionHeader
          title="Members"
          action={
            admin && (
              <Button size="sm" icon={<UserPlus className="size-4" />} onClick={() => setInviting(true)}>
                Invite
              </Button>
            )
          }
        />
        <div className="divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card">
          {snapshot.members.map((m) => {
            const name = m.profile?.full_name || m.profile?.email || "Resident";
            const self = m.user_id === snapshot.user.id;
            return (
              <div key={m.id} className="flex items-center gap-4 px-5 py-4">
                <Avatar name={name} src={m.profile?.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-[15px] font-semibold">
                    {name}
                    {self && <span className="text-muted">(you)</span>}
                    {m.role === "owner" && <Crown className="size-4 text-yellow" aria-label="Owner" />}
                  </p>
                  <p className="truncate text-[13px] capitalize text-muted">
                    {m.role} · {Object.values(m.permissions).filter(Boolean).length}/4 permissions
                  </p>
                </div>
                {admin && m.role !== "owner" && !self ? (
                  <Button size="sm" variant="outline" onClick={() => openMember(m)}>
                    Manage
                  </Button>
                ) : self && m.role !== "owner" ? (
                  <Button size="sm" variant="outline" onClick={() => setRemoving(m)}>
                    Leave
                  </Button>
                ) : null}
              </div>
            );
          })}
          {snapshot.invitations.map((inv) => (
            <div key={inv.id} className="flex items-center gap-4 px-5 py-4">
              <span className="flex size-11 items-center justify-center rounded-full bg-surface-2">
                <Mail className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{inv.email}</p>
                <p className="text-[13px] text-muted">
                  Invited as {inv.role} · {relativeTime(inv.created_at)}
                </p>
              </div>
              {admin && (
                <button
                  aria-label={`Revoke invitation for ${inv.email}`}
                  className="flex size-9 items-center justify-center rounded-full bg-surface-2"
                  onClick={async () => {
                    try {
                      await run((c) => c.revokeInvitation(inv.id));
                      toast.push({ tone: "success", title: "Invitation revoked" });
                    } catch (err) {
                      toast.push({ tone: "error", title: "Couldn't revoke", description: errorMessage(err) });
                    }
                  }}
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <Sheet open={inviting} onClose={() => setInviting(false)} title="Invite a resident" description="They'll join this household when they sign up with this email.">
        <form onSubmit={sendInvite} className="space-y-4" noValidate>
          <Field label="Email" htmlFor="ie" error={inviteError}>
            <Input id="ie" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} aria-invalid={!!inviteError} />
          </Field>
          <Field label="Role" htmlFor="ir" hint={invite.role === "admin" ? "Admins can change device settings, quiet hours and members." : "Residents can collect parcels and answer visitors."}>
            <Select id="ir" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as "resident" | "admin" })}>
              <option value="resident">Resident</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
          <Button type="submit" block size="lg" loading={inviteBusy}>
            Send invitation
          </Button>
        </form>
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.profile?.full_name ?? "Member"} description="Choose what this person can do.">
        <div className="space-y-4">
          <Field label="Role" htmlFor="mr">
            <Select
              id="mr"
              value={role}
              onChange={(e) => {
                const r = e.target.value as "resident" | "admin";
                setRole(r);
                setPerms(ROLE_DEFAULT_PERMISSIONS[r]);
              }}
            >
              <option value="resident">Resident</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
          <div className="divide-y divide-line rounded-2xl bg-surface-2">
            {(Object.keys(PERMISSION_LABELS) as (keyof MemberPermissions)[]).map((k) => (
              <div key={k} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <span className="text-[15px] font-medium">{PERMISSION_LABELS[k]}</span>
                <Switch checked={perms[k]} onChange={(v) => setPerms({ ...perms, [k]: v })} label={PERMISSION_LABELS[k]} />
              </div>
            ))}
          </div>
          <Button block size="lg" onClick={saveMember}>
            Save access
          </Button>
          <Button
            block
            variant="ghost"
            className="!text-danger"
            icon={<UserMinus className="size-4" />}
            onClick={() => {
              setRemoving(editing);
              setEditing(null);
            }}
          >
            Revoke access
          </Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        destructive
        icon={<UserMinus className="size-6" />}
        title={removing?.user_id === snapshot.user.id ? "Leave this household?" : `Remove ${removing?.profile?.full_name ?? "this member"}?`}
        description="They'll immediately lose access to the camera, parcels and controls."
        confirmLabel={removing?.user_id === snapshot.user.id ? "Leave" : "Remove"}
        onConfirm={async () => {
          if (!removing) return;
          const self = removing.user_id === snapshot.user.id;
          try {
            await run((c) => c.removeMember(removing.id));
            toast.push({ tone: "success", title: self ? "You left the household" : "Access revoked" });
            if (self) router.replace("/onboarding");
          } catch (err) {
            toast.push({ tone: "error", title: "Couldn't remove", description: errorMessage(err) });
            throw err;
          }
        }}
      />
    </div>
  );
}

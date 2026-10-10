"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing, CalendarPlus, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import { Avatar, Button, Card, EmptyState, Field, inputClass, Modal, PageHeader, Spinner, StatusPill } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatSlot, fullName } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Department, Space } from "@/lib/types";

function ScheduleSpaceModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
  const [form, setForm] = useState({ title: "", description: "", departmentId: "", date: tomorrow, time: "18:00", durationMinutes: 60, isStartingNow: false });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    api.get<Department[]>("/departments").then(({ data }) => setDepartments(data)).catch(() => {});
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const scheduledStartAt = form.isStartingNow ? new Date().toISOString() : new Date(`${form.date}T${form.time}:00+01:00`).toISOString();
      const { data } = await api.post<Space>("/spaces", {
        title: form.title,
        description: form.description || undefined,
        departmentId: form.departmentId || undefined,
        scheduledStartAt,
        durationMinutes: form.durationMinutes,
      });
      if (form.isStartingNow) await api.post(`/spaces/${data.id}/start`);
      toast(form.isStartingNow ? "You're live! 🎙️" : "Space scheduled. Your followers have been notified 📣");
      router.push(`/spaces/${data.id}`);
    } catch (caught) {
      toast(errorMessage(caught), "error");
      setIsSaving(false);
    }
  };

  return (
    <Modal title="Host a space" onClose={onClose} wide>
      <form onSubmit={save} className="space-y-4">
        <Field label="Title">
          <input className={inputClass} minLength={5} maxLength={120} placeholder="e.g. Breaking into product management" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
        </Field>
        <Field label="What will you talk about?">
          <textarea className={inputClass} rows={3} maxLength={1000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </Field>
        <Field label="For which course? (optional)">
          <select className={inputClass} value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}>
            <option value="">Everyone</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={form.isStartingNow} onChange={(event) => setForm({ ...form, isStartingNow: event.target.checked })} className="accent-[var(--primary)]" />
          Go live now
        </label>
        {!form.isStartingNow && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Date">
              <input type="date" className={inputClass} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
            </Field>
            <Field label="Time (WAT)">
              <input type="time" className={inputClass} value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} />
            </Field>
            <Field label="Length">
              <select className={inputClass} value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })}>
                <option value={30}>30 min</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
              </select>
            </Field>
          </div>
        )}
        <Button type="submit" variant="accent" className="w-full" isLoading={isSaving}>
          {form.isStartingNow ? "Go live" : "Schedule space"}
        </Button>
      </form>
    </Modal>
  );
}

function SpaceCard({ space, onChange }: { space: Space; onChange: () => void }) {
  const toast = useToast();
  const isLive = space.status === "LIVE";
  const toggleReminder = async (event: React.MouseEvent) => {
    event.preventDefault();
    try {
      if (space.isRegistered) await api.delete(`/spaces/${space.id}/registration`);
      else await api.put(`/spaces/${space.id}/registration`);
      toast(space.isRegistered ? "Email reminders removed" : "We'll email you 1 hour and 15 minutes before it starts 🔔");
      onChange();
    } catch (caught) {
      toast(errorMessage(caught), "error");
    }
  };

  return (
    <Link href={`/spaces/${space.id}`} className={`block rounded-card border p-5 transition hover:-translate-y-0.5 hover:shadow-lg ${isLive ? "border-live/40 bg-gradient-to-br from-surface to-danger-soft" : "border-line bg-surface"}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <StatusPill status={space.status} />
        <span className="flex items-center gap-1 text-xs text-muted">
          <Users className="size-3.5" /> {space.participantCount}
        </span>
      </div>
      <p className="text-lg font-bold leading-snug text-primary">{space.title}</p>
      {space.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{space.description}</p>}
      <div className="mt-4 flex items-center gap-2">
        <Avatar user={space.host} size={32} />
        <div className="min-w-0 text-xs">
          <p className="truncate font-semibold">Hosted by {fullName(space.host)}</p>
          <p className="truncate text-muted">{space.host.jobTitle} at {space.host.company}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs">
        <span className="font-medium text-muted">{isLive ? "Happening now" : formatSlot(space.scheduledStartAt)}</span>
        {isLive ? (
          <span className="rounded-full bg-live px-3 py-1 font-semibold text-on-primary">Join →</span>
        ) : (
          space.status === "SCHEDULED" && (
            <button onClick={toggleReminder} className={`flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold ${space.isRegistered ? "border-primary bg-primary-soft text-primary" : "border-line"}`}>
              {space.isRegistered ? <BellRing className="size-3.5" /> : <Bell className="size-3.5" />}
              {space.isRegistered ? "Reminder set" : "Remind me"}
            </button>
          )
        )}
      </div>
      {space.department && <p className="mt-2 text-[11px] text-muted">For {space.department.name}</p>}
    </Link>
  );
}

export default function SpacesPage() {
  const { user } = useSession();
  const [spaces, setSpaces] = useState<Space[] | null>(null);
  const [pastSpaces, setPastSpaces] = useState<Space[]>([]);
  const [isScheduling, setIsScheduling] = useState(false);

  const load = useCallback(async () => {
    const [current, past] = await Promise.all([api.get<Space[]>("/spaces"), api.get<Space[]>("/spaces", { status: "ENDED" })]);
    setSpaces(current.data);
    setPastSpaces(past.data.slice(0, 6));
  }, []);

  useEffect(() => {
    load().catch(() => setSpaces([]));
  }, [load]);

  const live = spaces?.filter((space) => space.status === "LIVE") ?? [];
  const upcoming = spaces?.filter((space) => space.status === "SCHEDULED") ?? [];

  return (
    <AppShell wide>
      <PageHeader
        eyebrow="Spaces"
        title="Live conversations with alumni"
        description="Join a live room, raise your hand to speak, and upvote the questions you want answered."
        action={
          user?.role === "ALUMNI" && (
            <Button variant="accent" onClick={() => setIsScheduling(true)}>
              <CalendarPlus className="size-4" /> Host a space
            </Button>
          )
        }
      />
      {!spaces ? (
        <Spinner />
      ) : (
        <div className="space-y-8">
          {live.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-bold">
                <span className="animate-pulse-live size-2 rounded-full bg-live" /> Live now
              </h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-4">{live.map((space) => <SpaceCard key={space.id} space={space} onChange={load} />)}</div>
            </section>
          )}
          <section>
            <h2 className="mb-3 font-bold">Upcoming</h2>
            {upcoming.length === 0 ? (
              <EmptyState icon="🎙️" title="No spaces scheduled" description={user?.role === "ALUMNI" ? "Host one: students will be notified." : "Follow alumni to hear when they schedule one."} />
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-4">{upcoming.map((space) => <SpaceCard key={space.id} space={space} onChange={load} />)}</div>
            )}
          </section>
          {pastSpaces.length > 0 && (
            <section>
              <h2 className="mb-3 font-bold">Recently ended</h2>
              <Card className="divide-y divide-line">
                {pastSpaces.map((space) => (
                  <Link key={space.id} href={`/spaces/${space.id}`} className="flex items-center justify-between gap-3 p-3 hover:bg-surface-muted">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{space.title}</p>
                      <p className="text-xs text-muted">
                        {fullName(space.host)} · {space.participantCount} attended
                      </p>
                    </div>
                    <StatusPill status="ENDED" />
                  </Link>
                ))}
              </Card>
            </section>
          )}
        </div>
      )}
      {isScheduling && <ScheduleSpaceModal onClose={() => setIsScheduling(false)} />}
    </AppShell>
  );
}

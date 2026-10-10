"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Repeat, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import { Button, Card, EmptyState, Field, inputClass, PageHeader, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatDay, formatTime } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Slot } from "@/lib/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SLOT_STATUS = {
  OPEN: { label: "Open", className: "bg-primary-soft text-primary" },
  HELD: { label: "Requested", className: "bg-warning-soft text-warning" },
  BOOKED: { label: "Booked", className: "bg-success-soft text-success" },
} as const;

/** "2026-10-14" + "18:00" in WAT (UTC+1) → ISO string. */
const watToIso = (date: string, time: string) => new Date(`${date}T${time}:00+01:00`).toISOString();
const todayInput = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);

export default function AvailabilityPage() {
  const { user } = useSession();
  const toast = useToast();
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [single, setSingle] = useState({ date: todayInput(), time: "18:00", durationMinutes: 30 });
  const [weekly, setWeekly] = useState({ days: [2, 4], time: "18:00", weeks: 2 });
  const [isSaving, setIsSaving] = useState<"single" | "weekly" | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await api.get<Slot[]>(`/users/${user.id}/availability-slots`);
    setSlots(data);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (kind: "single" | "weekly", payload: { startsAt: string; durationMinutes: number }[]) => {
    setIsSaving(kind);
    try {
      await api.post("/availability-slots", { slots: payload });
      toast(`${payload.length} slot${payload.length === 1 ? "" : "s"} published 📅`);
      load();
    } catch (caught) {
      toast(errorMessage(caught), "error");
    } finally {
      setIsSaving(null);
    }
  };

  const weeklyPreview = useMemo(() => {
    const result: string[] = [];
    const start = new Date();
    for (let offset = 1; offset <= weekly.weeks * 7; offset++) {
      const day = new Date(start.getTime() + offset * 86400_000);
      if (weekly.days.includes(day.getDay())) result.push(watToIso(day.toISOString().slice(0, 10), weekly.time));
    }
    return result;
  }, [weekly]);

  const slotsByDay = useMemo(() => {
    const groups = new Map<string, Slot[]>();
    for (const slot of slots ?? []) groups.set(formatDay(slot.startsAt), [...(groups.get(formatDay(slot.startsAt)) ?? []), slot]);
    return [...groups.entries()];
  }, [slots]);

  if (user && user.role !== "ALUMNI") {
    return (
      <AppShell>
        <EmptyState icon="🎓" title="Availability is for alumni" description="Students book the slots alumni publish." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader eyebrow="Mentorship" title="My availability" description="Publish 30-minute slots. Students can only book times you open, so nobody spams your inbox. All times are WAT." />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <p className="mb-4 flex items-center gap-2 font-bold text-primary">
            <Plus className="size-4" /> Add a slot
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
              <Field label="Date">
                <input type="date" className={inputClass} min={todayInput()} value={single.date} onChange={(event) => setSingle({ ...single, date: event.target.value })} />
              </Field>
              <Field label="Start time (WAT)">
                <input type="time" className={inputClass} step={900} value={single.time} onChange={(event) => setSingle({ ...single, time: event.target.value })} />
              </Field>
            </div>
            <Field label="Length">
              <select className={inputClass} value={single.durationMinutes} onChange={(event) => setSingle({ ...single, durationMinutes: Number(event.target.value) })}>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </Field>
            <Button className="w-full" isLoading={isSaving === "single"} onClick={() => create("single", [{ startsAt: watToIso(single.date, single.time), durationMinutes: single.durationMinutes }])}>
              Publish slot
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <p className="mb-4 flex items-center gap-2 font-bold text-primary">
            <Repeat className="size-4" /> Quick add: weekly pattern
          </p>
          <div className="space-y-3">
            <Field label="Days">
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setWeekly({ ...weekly, days: weekly.days.includes(index) ? weekly.days.filter((day) => day !== index) : [...weekly.days, index] })}
                    aria-pressed={weekly.days.includes(index)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold coarse:min-h-11 coarse:min-w-11 ${weekly.days.includes(index) ? "border-primary bg-primary text-on-primary" : "border-line text-muted"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
              <Field label="Time (WAT)">
                <input type="time" className={inputClass} step={900} value={weekly.time} onChange={(event) => setWeekly({ ...weekly, time: event.target.value })} />
              </Field>
              <Field label="For the next">
                <select className={inputClass} value={weekly.weeks} onChange={(event) => setWeekly({ ...weekly, weeks: Number(event.target.value) })}>
                  <option value={1}>1 week</option>
                  <option value={2}>2 weeks</option>
                  <option value={4}>4 weeks</option>
                </select>
              </Field>
            </div>
            <Button className="w-full" variant="accent" disabled={weeklyPreview.length === 0} isLoading={isSaving === "weekly"} onClick={() => create("weekly", weeklyPreview.map((startsAt) => ({ startsAt, durationMinutes: 30 })))}>
              Publish {weeklyPreview.length} slots
            </Button>
          </div>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 font-bold">Upcoming slots</h2>
      {!slots ? (
        <Spinner />
      ) : slots.length === 0 ? (
        <EmptyState icon="📅" title="You have no open slots" description="Add one to start getting requests." />
      ) : (
        <div className="space-y-4">
          {slotsByDay.map(([day, daySlots]) => (
            <Card key={day} className="p-4">
              <p className="mb-2 text-sm font-semibold">{day}</p>
              <div className="flex flex-wrap gap-2">
                {daySlots.map((slot) => (
                  <div key={slot.id} className="flex items-center gap-2 rounded-control border border-line px-3 py-1.5 text-sm">
                    <span className="font-semibold">{formatTime(slot.startsAt)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SLOT_STATUS[slot.status ?? "OPEN"].className}`}>{SLOT_STATUS[slot.status ?? "OPEN"].label}</span>
                    {slot.status === "OPEN" && (
                      <button
                        onClick={async () => {
                          try {
                            await api.delete(`/availability-slots/${slot.id}`);
                            setSlots((current) => current?.filter((item) => item.id !== slot.id) ?? null);
                          } catch (caught) {
                            toast(errorMessage(caught), "error");
                          }
                        }}
                        className="tap-target text-muted hover:text-danger"
                        aria-label="Delete slot"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
          <p className="text-xs text-muted">Requested = a student is waiting for your reply on Sessions.</p>
        </div>
      )}
    </AppShell>
  );
}

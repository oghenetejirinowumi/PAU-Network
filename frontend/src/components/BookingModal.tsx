"use client";

import { useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { formatDay, formatTime, TOPIC_LABEL } from "@/lib/format";
import type { Booking, BookingTopic, Slot, UserSummary } from "@/lib/types";
import { useToast } from "./Toast";
import { Button, Field, inputClass, Modal } from "./ui";

/** Student picks one of the alumnus's open slots, a topic and a short message. */
export function BookingModal({ alumnus, slots, initialSlotId, onClose, onBooked }: { alumnus: UserSummary; slots: Slot[]; initialSlotId?: string; onClose: () => void; onBooked: (booking: Booking) => void }) {
  const toast = useToast();
  const [slotId, setSlotId] = useState(initialSlotId ?? slots[0]?.id ?? "");
  const [topic, setTopic] = useState<BookingTopic>("CAREER_ADVICE");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const slotsByDay = useMemo(() => {
    const groups = new Map<string, Slot[]>();
    for (const slot of slots) {
      const day = formatDay(slot.startsAt);
      groups.set(day, [...(groups.get(day) ?? []), slot]);
    }
    return [...groups.entries()];
  }, [slots]);

  const submit = async () => {
    setIsSubmitting(true);
    try {
      const { data } = await api.post<Booking>("/bookings", { slotId, topic, message });
      toast(`Request sent to ${alumnus.firstName}. You'll see it under Sessions.`);
      onBooked(data);
    } catch (caught) {
      toast(errorMessage(caught), "error");
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={`Book a session with ${alumnus.firstName}`} onClose={onClose} wide>
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-semibold">Pick a time (30 minutes, WAT)</p>
          <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
            {slotsByDay.map(([day, daySlots]) => (
              <div key={day}>
                <p className="mb-1.5 text-xs text-muted">{day}</p>
                <div className="flex flex-wrap gap-2">
                  {daySlots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => setSlotId(slot.id)}
                      className={`rounded-control border px-3 py-1.5 text-sm font-semibold transition ${slotId === slot.id ? "border-primary bg-primary text-on-primary" : "border-line hover:border-primary"}`}
                    >
                      {formatTime(slot.startsAt)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <Field label="What do you want to talk about?">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TOPIC_LABEL) as BookingTopic[]).map((value) => (
              <button key={value} type="button" onClick={() => setTopic(value)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${topic === value ? "border-accent bg-accent-soft text-on-accent" : "border-line text-muted"}`}>
                {TOPIC_LABEL[value]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Message" hint={`${message.trim().length}/300 · at least 20 characters so ${alumnus.firstName} can prepare`}>
          <textarea className={inputClass} rows={4} maxLength={300} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="I'm a 300L student and I'd love your advice on…" />
        </Field>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" className="flex-1" onClick={submit} disabled={!slotId || message.trim().length < 20} isLoading={isSubmitting}>
            Send request
          </Button>
        </div>
      </div>
    </Modal>
  );
}

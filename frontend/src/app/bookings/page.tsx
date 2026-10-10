"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, Star, Video, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import { Button, ButtonLink, Card, EmptyState, Field, inputClass, Modal, PageHeader, Spinner, StatusPill, UserLine } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatSlot, studentLevelLabel, TOPIC_LABEL } from "@/lib/format";
import { useSession, useSocketEvent } from "@/lib/session";
import type { Booking } from "@/lib/types";

function ReviewModal({ booking, onClose, onSaved }: { booking: Booking; onClose: () => void; onSaved: (booking: Booking) => void }) {
  const toast = useToast();
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  return (
    <Modal title={`How was your session with ${booking.alumni.firstName}?`} onClose={onClose}>
      <div className="mb-4 flex justify-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button key={value} onClick={() => setRating(value)} aria-label={`${value} stars`}>
            <Star className={`size-9 ${value <= rating ? "fill-accent text-accent" : "text-line"}`} />
          </button>
        ))}
      </div>
      <Field label="A short thank-you (optional)">
        <textarea className={inputClass} rows={3} maxLength={300} value={feedback} onChange={(event) => setFeedback(event.target.value)} />
      </Field>
      <Button
        className="mt-4 w-full"
        isLoading={isSaving}
        onClick={async () => {
          setIsSaving(true);
          try {
            const { data } = await api.post<Booking>(`/bookings/${booking.id}/review`, { rating, feedback: feedback || undefined });
            toast("Thanks for the feedback! +5 points");
            onSaved(data);
          } catch (caught) {
            toast(errorMessage(caught), "error");
            setIsSaving(false);
          }
        }}
      >
        Submit review
      </Button>
    </Modal>
  );
}

function BookingRow({ booking, onChange }: { booking: Booking; onChange: (booking: Booking) => void }) {
  const { user } = useSession();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [isDeclining, setIsDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const isAlumniView = user?.id === booking.alumniId;
  const other = isAlumniView ? booking.student : booking.alumni;

  const act = async (action: "accept" | "decline" | "cancel" | "complete", body?: unknown) => {
    setBusy(action);
    try {
      const { data } = await api.post<Booking>(`/bookings/${booking.id}/${action}`, body);
      onChange(data);
      toast({ accept: "Accepted. The meeting link is ready 🎉", decline: "Request declined", cancel: "Session cancelled", complete: "Marked as completed. +50 points" }[action]);
    } catch (caught) {
      toast(errorMessage(caught), "error");
    } finally {
      setBusy(null);
      setIsDeclining(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <UserLine user={other} subtitle={isAlumniView ? `${studentLevelLabel(booking.student.studentLevel)} ${booking.student.department.name}` : undefined} />
        <StatusPill status={booking.status} />
      </div>
      <div className="mt-3 rounded-control bg-surface-muted p-3 text-sm">
        <p className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-on-accent">{TOPIC_LABEL[booking.topic]}</span>
          {formatSlot(booking.slot.startsAt)}
        </p>
        <p>{booking.message}</p>
        {booking.declineReason && <p className="mt-2 text-xs text-muted">Note: {booking.declineReason}</p>}
        {booking.rating && (
          <p className="mt-2 text-xs">
            {"⭐".repeat(booking.rating)} {booking.feedback && <span className="text-muted">“{booking.feedback}”</span>}
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {booking.status === "PENDING" && isAlumniView && (
          <>
            <Button size="sm" onClick={() => act("accept")} isLoading={busy === "accept"}>
              <Check className="size-4" /> Accept
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setIsDeclining(true)}>
              <X className="size-4" /> Decline
            </Button>
          </>
        )}
        {booking.status === "ACCEPTED" && booking.meetingUrl && (
          <a href={booking.meetingUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-control bg-success px-3 text-xs font-semibold text-on-primary hover:opacity-90">
            <Video className="size-4" /> Join meeting
          </a>
        )}
        {booking.status === "ACCEPTED" && isAlumniView && new Date(booking.slot.startsAt) < new Date() && (
          <Button size="sm" variant="secondary" onClick={() => act("complete")} isLoading={busy === "complete"}>
            Mark completed
          </Button>
        )}
        {(booking.status === "PENDING" || booking.status === "ACCEPTED") && (
          <Button size="sm" variant="ghost" onClick={() => act("cancel")} isLoading={busy === "cancel"}>
            Cancel
          </Button>
        )}
        {booking.status === "COMPLETED" && !isAlumniView && !booking.rating && (
          <Button size="sm" variant="accent" onClick={() => setIsReviewing(true)}>
            <Star className="size-4" /> Rate session
          </Button>
        )}
      </div>

      {isDeclining && (
        <Modal title="Decline request" onClose={() => setIsDeclining(false)}>
          <Field label="Let the student know why (optional)">
            <textarea className={inputClass} rows={3} maxLength={200} value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} placeholder="I'm travelling that week, please pick another slot." />
          </Field>
          <Button className="mt-4 w-full" variant="danger" onClick={() => act("decline", { declineReason: declineReason || undefined })} isLoading={busy === "decline"}>
            Decline request
          </Button>
        </Modal>
      )}
      {isReviewing && (
        <ReviewModal
          booking={booking}
          onClose={() => setIsReviewing(false)}
          onSaved={(updated) => {
            setIsReviewing(false);
            onChange(updated);
          }}
        />
      )}
    </Card>
  );
}

export default function BookingsPage() {
  const { user } = useSession();
  const [upcoming, setUpcoming] = useState<Booking[] | null>(null);
  const [past, setPast] = useState<Booking[]>([]);

  const load = useCallback(async () => {
    const [upcomingResult, pastResult] = await Promise.all([api.get<Booking[]>("/bookings", { scope: "UPCOMING" }), api.get<Booking[]>("/bookings", { scope: "PAST" })]);
    setUpcoming(upcomingResult.data);
    setPast(pastResult.data.slice(0, 20));
  }, []);

  useEffect(() => {
    load().catch(() => setUpcoming([]));
  }, [load]);
  useSocketEvent("booking:created", load);
  useSocketEvent("booking:updated", load);

  const replace = (booking: Booking) => {
    setUpcoming((current) => current?.map((item) => (item.id === booking.id ? booking : item)) ?? null);
    setPast((current) => current.map((item) => (item.id === booking.id ? booking : item)));
  };

  const isAlumni = user?.role === "ALUMNI";
  const pending = upcoming?.filter((booking) => booking.status === "PENDING") ?? [];
  const confirmed = upcoming?.filter((booking) => booking.status !== "PENDING") ?? [];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Mentorship"
        title={isAlumni ? "Session requests" : "My sessions"}
        description={isAlumni ? "Accept a request and a Jitsi meeting link is created for both of you." : "Track your requests. Join from here once an alumnus accepts."}
        action={isAlumni ? <ButtonLink href="/availability" variant="accent">Add availability</ButtonLink> : <ButtonLink href="/alumni" variant="accent">Find alumni</ButtonLink>}
      />
      {!upcoming ? (
        <Spinner />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              {isAlumni ? "Pending requests" : "Waiting for a reply"}
              {pending.length > 0 && <span className="rounded-full bg-warning-soft px-2 text-xs text-warning">{pending.length}</span>}
            </h2>
            {pending.length === 0 ? (
              <EmptyState icon="📭" title={isAlumni ? "No requests yet" : "No pending requests"} description={isAlumni ? "Add availability so students can book you." : "Find an alumnus from your course and book an open slot."} />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">{pending.map((booking) => <BookingRow key={booking.id} booking={booking} onChange={replace} />)}</div>
            )}
          </section>
          <section>
            <h2 className="mb-3 font-bold">Upcoming</h2>
            {confirmed.length === 0 ? (
              <p className="text-sm text-muted">Nothing scheduled.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">{confirmed.map((booking) => <BookingRow key={booking.id} booking={booking} onChange={replace} />)}</div>
            )}
          </section>
          <section>
            <h2 className="mb-3 font-bold">Past</h2>
            {past.length === 0 ? (
              <p className="text-sm text-muted">
                No past sessions. {!isAlumni && <Link href="/alumni" className="font-semibold text-primary">Book your first one →</Link>}
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">{past.map((booking) => <BookingRow key={booking.id} booking={booking} onChange={replace} />)}</div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}

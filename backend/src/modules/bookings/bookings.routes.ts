import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { badRequest, conflict, forbidden, notFound } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { userSummarySelect } from "../../lib/user-select.js";
import { parse, uuidSchema } from "../../lib/validation.js";
import { authenticate, currentUser, requireRole, type AuthUser } from "../../middleware/authenticate.js";
import { emitToUser } from "../../realtime/socket.js";
import { awardPoints } from "../gamification/gamification.service.js";
import { notify } from "../notifications/notifications.service.js";

export const bookingsRouter = Router();
bookingsRouter.use(authenticate);

const MAX_PENDING_PER_STUDENT = 3;

const bookingInclude = {
  slot: { select: { id: true, startsAt: true, endsAt: true } },
  student: { select: { ...userSummarySelect, studentLevel: true, department: { select: { id: true, name: true } } } },
  alumni: { select: userSummarySelect },
} satisfies Prisma.BookingInclude;

export const meetingUrlFor = (bookingId: string) => `https://meet.jit.si/PAU-Network-${bookingId}`;

async function findBookingFor(user: AuthUser, bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: bookingInclude });
  if (!booking) throw notFound("Booking");
  if (booking.studentId !== user.id && booking.alumniId !== user.id && user.role !== "ADMIN") throw forbidden();
  return booking;
}

/** Pending requests whose slot already started are expired; accepted ones whose slot ended are completed. */
async function settleStaleBookings(userId: string) {
  const now = new Date();
  await prisma.booking.updateMany({
    where: { status: "PENDING", slot: { startsAt: { lt: now } }, OR: [{ studentId: userId }, { alumniId: userId }] },
    data: { status: "DECLINED", declineReason: "No response before the session time", respondedAt: now },
  });
  const finished = await prisma.booking.findMany({
    where: { status: "ACCEPTED", slot: { endsAt: { lt: now } }, OR: [{ studentId: userId }, { alumniId: userId }] },
    select: { id: true, studentId: true, alumniId: true },
  });
  for (const booking of finished) {
    await prisma.booking.update({ where: { id: booking.id }, data: { status: "COMPLETED" } });
    await awardPoints(booking.alumniId, "SESSION_COMPLETED", { referenceId: booking.id });
    await awardPoints(booking.studentId, "SESSION_ATTENDED", { referenceId: booking.id });
  }
}

/** GET /bookings?status=PENDING&scope=UPCOMING — the current user's bookings, as student or alumni. */
bookingsRouter.get("/", async (req, res) => {
  const me = currentUser(req);
  const query = parse(
    z.object({
      status: z.enum(["PENDING", "ACCEPTED", "DECLINED", "CANCELLED", "COMPLETED"]).optional(),
      scope: z.enum(["UPCOMING", "PAST", "ALL"]).default("ALL"),
    }),
    req.query,
  );
  await settleStaleBookings(me.id);

  const now = new Date();
  const bookings = await prisma.booking.findMany({
    where: {
      OR: [{ studentId: me.id }, { alumniId: me.id }],
      status: query.status,
      slot: query.scope === "UPCOMING" ? { endsAt: { gt: now } } : query.scope === "PAST" ? { endsAt: { lte: now } } : undefined,
    },
    orderBy: { slot: { startsAt: query.scope === "PAST" ? "desc" : "asc" } },
    include: bookingInclude,
  });
  res.json({ data: bookings });
});

/** GET /bookings/:bookingId */
bookingsRouter.get("/:bookingId", async (req, res) => {
  const booking = await findBookingFor(currentUser(req), parse(uuidSchema, req.params.bookingId));
  res.json({ data: booking });
});

const createBookingSchema = z.object({
  slotId: uuidSchema,
  topic: z.enum(["CAREER_ADVICE", "CV_REVIEW", "INTERNSHIPS", "COURSE_ADVICE", "INTERVIEW_PREP", "OTHER"]),
  message: z.string().trim().min(20).max(300),
});

/** POST /bookings — a student requests an open slot; the slot is held while pending. */
bookingsRouter.post("/", requireRole("STUDENT"), async (req, res) => {
  const me = currentUser(req);
  const input = parse(createBookingSchema, req.body);

  const slot = await prisma.availabilitySlot.findUnique({
    where: { id: input.slotId },
    include: { bookings: { where: { status: { in: ["PENDING", "ACCEPTED"] } } }, alumni: { select: { firstName: true } } },
  });
  if (!slot) throw notFound("Slot");
  if (slot.startsAt <= new Date()) throw badRequest("This slot has already started");
  if (slot.bookings.length > 0) throw conflict("This slot was just taken. Please pick another one.");

  const [activeWithAlumni, pendingTotal] = await Promise.all([
    prisma.booking.count({ where: { studentId: me.id, alumniId: slot.alumniId, status: { in: ["PENDING", "ACCEPTED"] }, slot: { endsAt: { gt: new Date() } } } }),
    prisma.booking.count({ where: { studentId: me.id, status: "PENDING" } }),
  ]);
  if (activeWithAlumni > 0) throw conflict(`You already have a session with ${slot.alumni.firstName}`);
  if (pendingTotal >= MAX_PENDING_PER_STUDENT) throw conflict(`You have ${MAX_PENDING_PER_STUDENT} pending requests. Wait for a reply or cancel one.`);

  // The partial unique index bookings_slot_id_active_key guards against two students racing for one slot.
  const booking = await prisma.booking.create({
    data: { slotId: slot.id, studentId: me.id, alumniId: slot.alumniId, topic: input.topic, message: input.message },
    include: bookingInclude,
  });

  await notify({
    userId: booking.alumniId,
    type: "BOOKING_REQUESTED",
    title: `${booking.student.firstName} ${booking.student.lastName} requested a session`,
    body: input.message,
    linkUrl: "/bookings",
  });
  emitToUser(booking.alumniId, "booking:created", booking);
  res.status(201).json({ data: booking });
});

/** POST /bookings/:bookingId/accept — alumni only; generates the Jitsi meeting URL. */
bookingsRouter.post("/:bookingId/accept", requireRole("ALUMNI"), async (req, res) => {
  const me = currentUser(req);
  const booking = await findBookingFor(me, parse(uuidSchema, req.params.bookingId));
  if (booking.alumniId !== me.id) throw forbidden();
  if (booking.status !== "PENDING") throw conflict(`Booking is already ${booking.status.toLowerCase()}`);

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "ACCEPTED", meetingUrl: meetingUrlFor(booking.id), respondedAt: new Date() },
    include: bookingInclude,
  });
  await notify({
    userId: booking.studentId,
    type: "BOOKING_ACCEPTED",
    title: `${booking.alumni.firstName} accepted your session request`,
    body: "Your meeting link is ready on your bookings page.",
    linkUrl: "/bookings",
  });
  emitToUser(booking.studentId, "booking:updated", updated);
  res.json({ data: updated });
});

/** POST /bookings/:bookingId/decline — alumni only; frees the slot. */
bookingsRouter.post("/:bookingId/decline", requireRole("ALUMNI"), async (req, res) => {
  const me = currentUser(req);
  const input = parse(z.object({ declineReason: z.string().trim().max(200).optional() }), req.body ?? {});
  const booking = await findBookingFor(me, parse(uuidSchema, req.params.bookingId));
  if (booking.alumniId !== me.id) throw forbidden();
  if (booking.status !== "PENDING") throw conflict(`Booking is already ${booking.status.toLowerCase()}`);

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "DECLINED", declineReason: input.declineReason, respondedAt: new Date() },
    include: bookingInclude,
  });
  await notify({
    userId: booking.studentId,
    type: "BOOKING_DECLINED",
    title: `${booking.alumni.firstName} couldn't take your session`,
    body: input.declineReason ?? "Try another time slot.",
    linkUrl: `/profile/${booking.alumniId}`,
  });
  emitToUser(booking.studentId, "booking:updated", updated);
  res.json({ data: updated });
});

/** POST /bookings/:bookingId/cancel — either side, while pending or accepted. */
bookingsRouter.post("/:bookingId/cancel", async (req, res) => {
  const me = currentUser(req);
  const booking = await findBookingFor(me, parse(uuidSchema, req.params.bookingId));
  if (booking.status !== "PENDING" && booking.status !== "ACCEPTED") throw conflict(`Booking is already ${booking.status.toLowerCase()}`);

  const updated = await prisma.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" }, include: bookingInclude });
  const otherUserId = me.id === booking.studentId ? booking.alumniId : booking.studentId;
  await notify({
    userId: otherUserId,
    type: "BOOKING_CANCELLED",
    title: "A session was cancelled",
    body: `The session on ${booking.slot.startsAt.toISOString()} was cancelled.`,
    linkUrl: "/bookings",
  });
  emitToUser(otherUserId, "booking:updated", updated);
  res.json({ data: updated });
});

/** POST /bookings/:bookingId/complete — alumni marks a session done (also happens automatically after the slot ends). */
bookingsRouter.post("/:bookingId/complete", requireRole("ALUMNI"), async (req, res) => {
  const me = currentUser(req);
  const booking = await findBookingFor(me, parse(uuidSchema, req.params.bookingId));
  if (booking.alumniId !== me.id) throw forbidden();
  if (booking.status !== "ACCEPTED") throw conflict("Only accepted sessions can be completed");
  if (booking.slot.startsAt > new Date()) throw badRequest("This session has not started yet");

  const updated = await prisma.booking.update({ where: { id: booking.id }, data: { status: "COMPLETED" }, include: bookingInclude });
  await awardPoints(booking.alumniId, "SESSION_COMPLETED", { referenceId: booking.id });
  await awardPoints(booking.studentId, "SESSION_ATTENDED", { referenceId: booking.id });
  res.json({ data: updated });
});

/** POST /bookings/:bookingId/review — the student rates a completed session. */
bookingsRouter.post("/:bookingId/review", requireRole("STUDENT"), async (req, res) => {
  const me = currentUser(req);
  const input = parse(z.object({ rating: z.number().int().min(1).max(5), feedback: z.string().trim().max(300).optional() }), req.body);
  const booking = await findBookingFor(me, parse(uuidSchema, req.params.bookingId));
  if (booking.studentId !== me.id) throw forbidden();
  if (booking.status !== "COMPLETED") throw conflict("You can only review completed sessions");
  if (booking.rating !== null) throw conflict("You already reviewed this session");

  const updated = await prisma.booking.update({ where: { id: booking.id }, data: input, include: bookingInclude });
  await awardPoints(me.id, "FEEDBACK_GIVEN", { referenceId: booking.id });
  if (input.rating === 5) await awardPoints(booking.alumniId, "FIVE_STAR_RATING_RECEIVED", { referenceId: booking.id });
  res.json({ data: updated });
});

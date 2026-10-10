import { Router } from "express";
import { z } from "zod";
import { badRequest, conflict, forbidden, notFound } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { parse, queryBooleanSchema, uuidSchema } from "../../lib/validation.js";
import { authenticate, currentUser, requireRole } from "../../middleware/authenticate.js";

export const availabilityRouter = Router();

const MIN_LEAD_TIME_MS = 2 * 60 * 60 * 1000;
const MAX_DAYS_AHEAD = 30;
const ACTIVE_BOOKING_STATUSES = ["PENDING", "ACCEPTED"] as const;

/** GET /users/:userId/availability-slots?isOpen=true */
availabilityRouter.get("/users/:userId/availability-slots", async (req, res) => {
  const alumniId = parse(uuidSchema, req.params.userId);
  const query = parse(z.object({ isOpen: queryBooleanSchema.optional() }), req.query);

  const slots = await prisma.availabilitySlot.findMany({
    where: {
      alumniId,
      startsAt: { gt: new Date() },
      ...(query.isOpen && { bookings: { none: { status: { in: [...ACTIVE_BOOKING_STATUSES] } } } }),
    },
    orderBy: { startsAt: "asc" },
    include: { bookings: { where: { status: { in: [...ACTIVE_BOOKING_STATUSES] } }, select: { id: true, status: true } } },
  });

  res.json({
    data: slots.map(({ bookings, ...slot }) => ({
      ...slot,
      status: bookings[0]?.status === "ACCEPTED" ? "BOOKED" : bookings[0] ? "HELD" : "OPEN",
    })),
  });
});

const createSlotsSchema = z.object({
  slots: z
    .array(
      z.object({
        startsAt: z.coerce.date(),
        durationMinutes: z.union([z.literal(30), z.literal(45), z.literal(60)]).default(30),
      }),
    )
    .min(1)
    .max(50),
});

/** POST /availability-slots — alumni publish one or many slots (the frontend expands weekly patterns). */
availabilityRouter.post("/availability-slots", authenticate, requireRole("ALUMNI"), async (req, res) => {
  const me = currentUser(req);
  const input = parse(createSlotsSchema, req.body);
  const earliest = Date.now() + MIN_LEAD_TIME_MS;
  const latest = Date.now() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000;

  const candidates = input.slots.map((slot) => ({
    startsAt: slot.startsAt,
    endsAt: new Date(slot.startsAt.getTime() + slot.durationMinutes * 60 * 1000),
  }));
  for (const slot of candidates) {
    if (slot.startsAt.getTime() < earliest) throw badRequest("Slots must start at least 2 hours from now");
    if (slot.startsAt.getTime() > latest) throw badRequest(`Slots can be at most ${MAX_DAYS_AHEAD} days ahead`);
  }

  const existing = await prisma.availabilitySlot.findMany({
    where: { alumniId: me.id, endsAt: { gt: new Date() } },
    select: { startsAt: true, endsAt: true },
  });
  const all = [...existing, ...candidates].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  for (let index = 1; index < all.length; index++) {
    if (all[index].startsAt < all[index - 1].endsAt) throw conflict("You already have a slot at that time");
  }

  await prisma.availabilitySlot.createMany({ data: candidates.map((slot) => ({ ...slot, alumniId: me.id })) });
  const slots = await prisma.availabilitySlot.findMany({
    where: { alumniId: me.id, startsAt: { in: candidates.map((slot) => slot.startsAt) } },
    orderBy: { startsAt: "asc" },
  });
  res.status(201).json({ data: slots });
});

/** DELETE /availability-slots/:slotId — only open (unbooked) slots. */
availabilityRouter.delete("/availability-slots/:slotId", authenticate, requireRole("ALUMNI"), async (req, res) => {
  const me = currentUser(req);
  const slotId = parse(uuidSchema, req.params.slotId);
  const slot = await prisma.availabilitySlot.findUnique({
    where: { id: slotId },
    include: { bookings: { where: { status: { in: [...ACTIVE_BOOKING_STATUSES] } } } },
  });
  if (!slot) throw notFound("Slot");
  if (slot.alumniId !== me.id) throw forbidden();
  if (slot.bookings.length > 0) throw conflict("This slot has a booking. Decline or cancel the booking first.");
  await prisma.availabilitySlot.delete({ where: { id: slotId } });
  res.status(204).end();
});

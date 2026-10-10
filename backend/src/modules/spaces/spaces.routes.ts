import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { badRequest, conflict, forbidden, notFound } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { userSummarySelect } from "../../lib/user-select.js";
import { parse, uuidSchema } from "../../lib/validation.js";
import { authenticate, authenticateOptional, currentUser, requireRole } from "../../middleware/authenticate.js";
import { emitToSpace } from "../../realtime/socket.js";
import { awardPoints } from "../gamification/gamification.service.js";
import { notify } from "../notifications/notifications.service.js";

/**
 * Spaces are live rooms hosted by alumni (like LinkedIn Audio Events / X Spaces).
 * Audio and video run in a Jitsi room (meetingUrl). Everything else (who is in the room,
 * raised hands, speakers, questions and upvotes) is stored here and pushed over Socket.IO.
 *
 * Lifecycle: SCHEDULED → LIVE → ENDED, or SCHEDULED → CANCELLED.
 */
export const spacesRouter = Router();

const spaceListInclude = {
  host: { select: userSummarySelect },
  department: { select: { id: true, name: true } },
  _count: { select: { participants: true, questions: true } },
} satisfies Prisma.SpaceInclude;

const participantInclude = { user: { select: userSummarySelect } } satisfies Prisma.SpaceParticipantInclude;

const meetingUrlFor = (roomName: string) => `https://meet.jit.si/${roomName}`;

async function findSpace(spaceId: string) {
  const space = await prisma.space.findUnique({ where: { id: spaceId } });
  if (!space) throw notFound("Space");
  return space;
}

async function findHostedSpace(spaceId: string, userId: string) {
  const space = await findSpace(spaceId);
  if (space.hostId !== userId) throw forbidden("Only the host can do this");
  return space;
}

async function findJoinedParticipant(spaceId: string, userId: string) {
  const participant = await prisma.spaceParticipant.findUnique({ where: { spaceId_userId: { spaceId, userId } } });
  if (!participant?.joinedAt || participant.leftAt) throw forbidden("Join the space first");
  return participant;
}

/** GET /spaces?status=LIVE&departmentId=&hostId= */
spacesRouter.get("/", authenticateOptional, async (req, res) => {
  const query = parse(
    z.object({
      status: z.enum(["SCHEDULED", "LIVE", "ENDED", "CANCELLED"]).optional(),
      departmentId: uuidSchema.optional(),
      hostId: uuidSchema.optional(),
    }),
    req.query,
  );
  const spaces = await prisma.space.findMany({
    where: { status: query.status ?? { in: ["SCHEDULED", "LIVE"] }, departmentId: query.departmentId, hostId: query.hostId },
    orderBy: query.status === "ENDED" ? { endedAt: "desc" } : [{ status: "asc" }, { scheduledStartAt: "asc" }],
    take: 50,
    include: spaceListInclude,
  });
  const registrations = req.user
    ? await prisma.spaceParticipant.findMany({ where: { userId: req.user.id, spaceId: { in: spaces.map((space) => space.id) } }, select: { spaceId: true } })
    : [];
  const registered = new Set(registrations.map((registration) => registration.spaceId));

  // Live spaces first, then upcoming by start time (enum order alone would put SCHEDULED before LIVE).
  spaces.sort((a, b) => Number(b.status === "LIVE") - Number(a.status === "LIVE"));

  res.json({
    data: spaces.map(({ _count, ...space }) => ({
      ...space,
      participantCount: _count.participants,
      questionCount: _count.questions,
      isRegistered: registered.has(space.id),
    })),
  });
});

const createSpaceSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().max(1000).optional(),
  departmentId: uuidSchema.optional(),
  scheduledStartAt: z.coerce.date(),
  durationMinutes: z.number().int().min(15).max(180).default(60),
  capacity: z.number().int().min(2).max(500).default(100),
});

/** POST /spaces — alumni schedule a space. */
spacesRouter.post("/", authenticate, requireRole("ALUMNI"), async (req, res) => {
  const me = currentUser(req);
  const { durationMinutes, ...input } = parse(createSpaceSchema, req.body);
  if (input.scheduledStartAt.getTime() < Date.now() - 5 * 60 * 1000) throw badRequest("Pick a start time in the future");

  const space = await prisma.space.create({
    data: {
      ...input,
      hostId: me.id,
      scheduledEndAt: new Date(input.scheduledStartAt.getTime() + durationMinutes * 60 * 1000),
      roomName: `PAU-Network-Space-${randomBytes(6).toString("hex")}`,
      participants: { create: { userId: me.id, role: "HOST" } },
    },
    include: spaceListInclude,
  });

  const followers = await prisma.follow.findMany({ where: { followingId: me.id }, select: { followerId: true } });
  for (const follower of followers) {
    await notify({
      userId: follower.followerId,
      type: "SPACE_SCHEDULED",
      title: `${space.host.firstName} scheduled a space: ${space.title}`,
      linkUrl: `/spaces/${space.id}`,
    });
  }
  res.status(201).json({ data: space });
});

/** GET /spaces/:spaceId — full room state. */
spacesRouter.get("/:spaceId", authenticateOptional, async (req, res) => {
  const spaceId = parse(uuidSchema, req.params.spaceId);
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    include: {
      ...spaceListInclude,
      participants: { include: participantInclude, orderBy: [{ role: "asc" }, { handRaisedAt: "asc" }, { registeredAt: "asc" }] },
      questions: {
        include: { author: { select: userSummarySelect } },
        orderBy: [{ status: "asc" }, { upvoteCount: "desc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!space) throw notFound("Space");

  const viewerVotes = req.user
    ? await prisma.spaceQuestionVote.findMany({ where: { userId: req.user.id, question: { spaceId } }, select: { questionId: true } })
    : [];
  const voted = new Set(viewerVotes.map((vote) => vote.questionId));
  const viewerParticipant = req.user ? space.participants.find((participant) => participant.userId === req.user!.id) : undefined;
  const { _count, participants, questions, ...rest } = space;

  res.json({
    data: {
      ...rest,
      participantCount: _count.participants,
      // The Jitsi link is only revealed to people who have joined or are hosting.
      meetingUrl: viewerParticipant?.joinedAt || viewerParticipant?.role === "HOST" ? meetingUrlFor(space.roomName) : null,
      participants: participants.filter((participant) => (space.status === "LIVE" ? participant.joinedAt && !participant.leftAt : true)),
      questions: questions.map((question) => ({ ...question, hasViewerUpvoted: voted.has(question.id) })),
      viewer: viewerParticipant
        ? { role: viewerParticipant.role, isRegistered: true, isInRoom: Boolean(viewerParticipant.joinedAt && !viewerParticipant.leftAt), isHandRaised: viewerParticipant.isHandRaised }
        : { role: null, isRegistered: false, isInRoom: false, isHandRaised: false },
    },
  });
});

/** POST /spaces/:spaceId/start — host goes live. */
spacesRouter.post("/:spaceId/start", authenticate, async (req, res) => {
  const me = currentUser(req);
  const space = await findHostedSpace(parse(uuidSchema, req.params.spaceId), me.id);
  if (space.status !== "SCHEDULED") throw conflict(`Space is already ${space.status.toLowerCase()}`);

  const now = new Date();
  const updated = await prisma.space.update({ where: { id: space.id }, data: { status: "LIVE", startedAt: now }, include: spaceListInclude });
  await prisma.spaceParticipant.update({ where: { spaceId_userId: { spaceId: space.id, userId: me.id } }, data: { joinedAt: now, leftAt: null } });

  const registered = await prisma.spaceParticipant.findMany({ where: { spaceId: space.id, role: { not: "HOST" } }, select: { userId: true } });
  for (const participant of registered) {
    await notify({ userId: participant.userId, type: "SPACE_STARTED", title: `🔴 Live now: ${space.title}`, linkUrl: `/spaces/${space.id}` });
  }
  emitToSpace(space.id, "space:started", { spaceId: space.id, startedAt: now, meetingUrl: meetingUrlFor(space.roomName) });
  res.json({ data: updated });
});

/** POST /spaces/:spaceId/end — host ends the space; points are awarded to host and attendees. */
spacesRouter.post("/:spaceId/end", authenticate, async (req, res) => {
  const me = currentUser(req);
  const space = await findHostedSpace(parse(uuidSchema, req.params.spaceId), me.id);
  if (space.status !== "LIVE") throw conflict("Only a live space can be ended");

  const now = new Date();
  const updated = await prisma.space.update({ where: { id: space.id }, data: { status: "ENDED", endedAt: now }, include: spaceListInclude });
  await prisma.spaceParticipant.updateMany({ where: { spaceId: space.id, joinedAt: { not: null }, leftAt: null }, data: { leftAt: now, isHandRaised: false } });

  await awardPoints(me.id, "SPACE_HOSTED", { referenceId: space.id });
  const attendees = await prisma.spaceParticipant.findMany({ where: { spaceId: space.id, joinedAt: { not: null }, role: { not: "HOST" } }, select: { userId: true } });
  for (const attendee of attendees) await awardPoints(attendee.userId, "SPACE_ATTENDED", { referenceId: space.id });

  emitToSpace(space.id, "space:ended", { spaceId: space.id, endedAt: now });
  res.json({ data: updated });
});

/** POST /spaces/:spaceId/cancel — host cancels before it starts. */
spacesRouter.post("/:spaceId/cancel", authenticate, async (req, res) => {
  const me = currentUser(req);
  const space = await findHostedSpace(parse(uuidSchema, req.params.spaceId), me.id);
  if (space.status !== "SCHEDULED") throw conflict("Only a scheduled space can be cancelled");
  const updated = await prisma.space.update({ where: { id: space.id }, data: { status: "CANCELLED" }, include: spaceListInclude });
  emitToSpace(space.id, "space:cancelled", { spaceId: space.id });
  res.json({ data: updated });
});

/** PUT /spaces/:spaceId/registration — RSVP to get a "live now" notification. */
spacesRouter.put("/:spaceId/registration", authenticate, async (req, res) => {
  const me = currentUser(req);
  const space = await findSpace(parse(uuidSchema, req.params.spaceId));
  if (space.status === "ENDED" || space.status === "CANCELLED") throw conflict("This space is over");
  await prisma.spaceParticipant.upsert({
    where: { spaceId_userId: { spaceId: space.id, userId: me.id } },
    create: { spaceId: space.id, userId: me.id },
    update: {},
  });
  res.status(204).end();
});

/** DELETE /spaces/:spaceId/registration */
spacesRouter.delete("/:spaceId/registration", authenticate, async (req, res) => {
  const me = currentUser(req);
  const spaceId = parse(uuidSchema, req.params.spaceId);
  await prisma.spaceParticipant.deleteMany({ where: { spaceId, userId: me.id, role: { not: "HOST" }, joinedAt: null } });
  res.status(204).end();
});

/** POST /spaces/:spaceId/join — enter a live space as a listener. */
spacesRouter.post("/:spaceId/join", authenticate, async (req, res) => {
  const me = currentUser(req);
  const space = await findSpace(parse(uuidSchema, req.params.spaceId));
  if (space.status !== "LIVE") throw conflict("This space is not live");

  const inRoom = await prisma.spaceParticipant.count({ where: { spaceId: space.id, joinedAt: { not: null }, leftAt: null } });
  const existing = await prisma.spaceParticipant.findUnique({ where: { spaceId_userId: { spaceId: space.id, userId: me.id } } });
  const isAlreadyIn = existing?.joinedAt && !existing.leftAt;
  if (!isAlreadyIn && inRoom >= space.capacity) throw conflict("This space is full");

  const participant = await prisma.spaceParticipant.upsert({
    where: { spaceId_userId: { spaceId: space.id, userId: me.id } },
    create: { spaceId: space.id, userId: me.id, joinedAt: new Date() },
    update: { joinedAt: new Date(), leftAt: null },
    include: participantInclude,
  });
  emitToSpace(space.id, "space:participant-joined", participant);
  res.json({ data: { ...participant, meetingUrl: meetingUrlFor(space.roomName) } });
});

/** POST /spaces/:spaceId/leave */
spacesRouter.post("/:spaceId/leave", authenticate, async (req, res) => {
  const me = currentUser(req);
  const spaceId = parse(uuidSchema, req.params.spaceId);
  await findJoinedParticipant(spaceId, me.id);
  const participant = await prisma.spaceParticipant.update({
    where: { spaceId_userId: { spaceId, userId: me.id } },
    data: { leftAt: new Date(), isHandRaised: false, handRaisedAt: null },
    include: participantInclude,
  });
  emitToSpace(spaceId, "space:participant-left", participant);
  res.status(204).end();
});

/** PUT /spaces/:spaceId/hand — raise your hand to ask to speak. */
spacesRouter.put("/:spaceId/hand", authenticate, async (req, res) => {
  const me = currentUser(req);
  const spaceId = parse(uuidSchema, req.params.spaceId);
  const current = await findJoinedParticipant(spaceId, me.id);
  if (current.role !== "LISTENER") throw badRequest("Only listeners raise hands");
  const participant = await prisma.spaceParticipant.update({
    where: { spaceId_userId: { spaceId, userId: me.id } },
    data: { isHandRaised: true, handRaisedAt: new Date() },
    include: participantInclude,
  });
  emitToSpace(spaceId, "space:participant-updated", participant);
  res.json({ data: participant });
});

/** DELETE /spaces/:spaceId/hand — lower your own hand. */
spacesRouter.delete("/:spaceId/hand", authenticate, async (req, res) => {
  const me = currentUser(req);
  const spaceId = parse(uuidSchema, req.params.spaceId);
  await findJoinedParticipant(spaceId, me.id);
  const participant = await prisma.spaceParticipant.update({
    where: { spaceId_userId: { spaceId, userId: me.id } },
    data: { isHandRaised: false, handRaisedAt: null },
    include: participantInclude,
  });
  emitToSpace(spaceId, "space:participant-updated", participant);
  res.json({ data: participant });
});

/** PATCH /spaces/:spaceId/participants/:userId — host changes a role (invite to speak) or lowers a hand. */
spacesRouter.patch("/:spaceId/participants/:userId", authenticate, async (req, res) => {
  const me = currentUser(req);
  const spaceId = parse(uuidSchema, req.params.spaceId);
  const userId = parse(uuidSchema, req.params.userId);
  await findHostedSpace(spaceId, me.id);
  const input = parse(z.object({ role: z.enum(["SPEAKER", "LISTENER"]).optional(), isHandRaised: z.literal(false).optional() }), req.body);
  if (userId === me.id) throw badRequest("The host's role cannot change");
  await findJoinedParticipant(spaceId, userId);

  const participant = await prisma.spaceParticipant.update({
    where: { spaceId_userId: { spaceId, userId } },
    data: {
      role: input.role,
      // Promoting someone to speaker answers their raised hand.
      ...((input.role === "SPEAKER" || input.isHandRaised === false) && { isHandRaised: false, handRaisedAt: null }),
    },
    include: participantInclude,
  });
  emitToSpace(spaceId, "space:participant-updated", participant);
  res.json({ data: participant });
});

// ───── Questions ─────

/** POST /spaces/:spaceId/questions — registered or joined users; allowed before and during the space. */
spacesRouter.post("/:spaceId/questions", authenticate, async (req, res) => {
  const me = currentUser(req);
  const spaceId = parse(uuidSchema, req.params.spaceId);
  const input = parse(z.object({ body: z.string().trim().min(5).max(300) }), req.body);
  const space = await findSpace(spaceId);
  if (space.status !== "SCHEDULED" && space.status !== "LIVE") throw conflict("Questions are closed");
  if (space.hostId === me.id) throw badRequest("Hosts answer questions, they don't ask them");
  const participant = await prisma.spaceParticipant.findUnique({ where: { spaceId_userId: { spaceId, userId: me.id } } });
  if (!participant) throw forbidden("Register for or join the space to ask a question");

  const question = await prisma.spaceQuestion.create({
    data: { spaceId, authorId: me.id, body: input.body },
    include: { author: { select: userSummarySelect } },
  });
  await awardPoints(me.id, "QUESTION_ASKED", { referenceId: question.id });
  emitToSpace(spaceId, "space:question-created", { ...question, hasViewerUpvoted: false });
  res.status(201).json({ data: { ...question, hasViewerUpvoted: false } });
});

async function findQuestion(spaceId: string, questionId: string) {
  const question = await prisma.spaceQuestion.findUnique({ where: { id: questionId } });
  if (!question || question.spaceId !== spaceId) throw notFound("Question");
  return question;
}

/** PUT /spaces/:spaceId/questions/:questionId/upvote */
spacesRouter.put("/:spaceId/questions/:questionId/upvote", authenticate, async (req, res) => {
  const me = currentUser(req);
  const spaceId = parse(uuidSchema, req.params.spaceId);
  const question = await findQuestion(spaceId, parse(uuidSchema, req.params.questionId));
  const existing = await prisma.spaceQuestionVote.findUnique({ where: { questionId_userId: { questionId: question.id, userId: me.id } } });
  if (!existing) {
    await prisma.$transaction([
      prisma.spaceQuestionVote.create({ data: { questionId: question.id, userId: me.id } }),
      prisma.spaceQuestion.update({ where: { id: question.id }, data: { upvoteCount: { increment: 1 } } }),
    ]);
  }
  const updated = await prisma.spaceQuestion.findUniqueOrThrow({ where: { id: question.id }, include: { author: { select: userSummarySelect } } });
  emitToSpace(spaceId, "space:question-updated", updated);
  res.json({ data: { ...updated, hasViewerUpvoted: true } });
});

/** DELETE /spaces/:spaceId/questions/:questionId/upvote */
spacesRouter.delete("/:spaceId/questions/:questionId/upvote", authenticate, async (req, res) => {
  const me = currentUser(req);
  const spaceId = parse(uuidSchema, req.params.spaceId);
  const question = await findQuestion(spaceId, parse(uuidSchema, req.params.questionId));
  const deleted = await prisma.spaceQuestionVote.deleteMany({ where: { questionId: question.id, userId: me.id } });
  if (deleted.count > 0) await prisma.spaceQuestion.update({ where: { id: question.id }, data: { upvoteCount: { decrement: 1 } } });
  const updated = await prisma.spaceQuestion.findUniqueOrThrow({ where: { id: question.id }, include: { author: { select: userSummarySelect } } });
  emitToSpace(spaceId, "space:question-updated", updated);
  res.json({ data: { ...updated, hasViewerUpvoted: false } });
});

/** PATCH /spaces/:spaceId/questions/:questionId — host marks ANSWERED or DISMISSED. */
spacesRouter.patch("/:spaceId/questions/:questionId", authenticate, async (req, res) => {
  const me = currentUser(req);
  const spaceId = parse(uuidSchema, req.params.spaceId);
  await findHostedSpace(spaceId, me.id);
  const question = await findQuestion(spaceId, parse(uuidSchema, req.params.questionId));
  const { status } = parse(z.object({ status: z.enum(["ANSWERED", "DISMISSED", "OPEN"]) }), req.body);

  const updated = await prisma.spaceQuestion.update({
    where: { id: question.id },
    data: { status, answeredAt: status === "ANSWERED" ? new Date() : null },
    include: { author: { select: userSummarySelect } },
  });
  if (status === "ANSWERED") await awardPoints(me.id, "QUESTION_ANSWERED", { referenceId: question.id });
  emitToSpace(spaceId, "space:question-updated", updated);
  res.json({ data: updated });
});

import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { badRequest, conflict, forbidden, notFound } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { userSummarySelect } from "../../lib/user-select.js";
import { parse, uuidSchema } from "../../lib/validation.js";
import { authenticate, currentUser, type AuthUser } from "../../middleware/authenticate.js";
import { emitToUser } from "../../realtime/socket.js";
import { awardPoints, evaluateBadges } from "../gamification/gamification.service.js";
import { notify } from "../notifications/notifications.service.js";

/**
 * Message requests work like LinkedIn / Instagram:
 *   1. The requester sends a first message, creating a PENDING conversation.
 *   2. Until the recipient accepts, the requester cannot send more messages.
 *   3. ACCEPTED opens the chat for both; DECLINED closes it.
 * Students can only send requests to alumni. Alumni can send requests to anyone.
 */
export const conversationsRouter = Router();
conversationsRouter.use(authenticate);

const conversationInclude = {
  requester: { select: userSummarySelect },
  recipient: { select: userSummarySelect },
  messages: { orderBy: { createdAt: "desc" }, take: 1 },
} satisfies Prisma.ConversationInclude;

async function findConversationFor(user: AuthUser, conversationId: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId }, include: conversationInclude });
  if (!conversation) throw notFound("Conversation");
  if (conversation.requesterId !== user.id && conversation.recipientId !== user.id) throw forbidden();
  return conversation;
}

/** GET /conversations?box=INBOX|REQUESTS|SENT */
conversationsRouter.get("/", async (req, res) => {
  const me = currentUser(req);
  const query = parse(z.object({ box: z.enum(["INBOX", "REQUESTS", "SENT"]).default("INBOX") }), req.query);

  const where: Prisma.ConversationWhereInput = {
    INBOX: { status: "ACCEPTED" as const, OR: [{ requesterId: me.id }, { recipientId: me.id }] },
    REQUESTS: { status: "PENDING" as const, recipientId: me.id },
    SENT: { status: { in: ["PENDING" as const, "DECLINED" as const] }, requesterId: me.id },
  }[query.box];

  const [conversations, requestCount] = await Promise.all([
    prisma.conversation.findMany({ where, orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }], include: conversationInclude }),
    prisma.conversation.count({ where: { status: "PENDING", recipientId: me.id } }),
  ]);

  const unreadCounts = await prisma.message.groupBy({
    by: ["conversationId"],
    where: { conversationId: { in: conversations.map((conversation) => conversation.id) }, senderId: { not: me.id }, readAt: null },
    _count: { _all: true },
  });
  const unreadById = new Map(unreadCounts.map((row) => [row.conversationId, row._count._all]));

  res.json({
    data: conversations.map(({ messages, ...conversation }) => ({
      ...conversation,
      otherUser: conversation.requesterId === me.id ? conversation.recipient : conversation.requester,
      lastMessage: messages[0] ?? null,
      unreadCount: unreadById.get(conversation.id) ?? 0,
    })),
    meta: { requestCount },
  });
});

/** POST /conversations — send a message request with the first message. */
conversationsRouter.post("/", async (req, res) => {
  const me = currentUser(req);
  const input = parse(z.object({ recipientId: uuidSchema, body: z.string().trim().min(1).max(1000) }), req.body);
  if (input.recipientId === me.id) throw badRequest("You cannot message yourself");

  const recipient = await prisma.user.findUnique({ where: { id: input.recipientId }, select: { id: true, role: true } });
  if (!recipient) throw notFound("User");
  if (me.role === "STUDENT" && recipient.role !== "ALUMNI") throw forbidden("Students can only send message requests to alumni");

  const existing = await prisma.conversation.findFirst({
    where: {
      OR: [
        { requesterId: me.id, recipientId: input.recipientId },
        { requesterId: input.recipientId, recipientId: me.id },
      ],
    },
  });
  if (existing) throw conflict(existing.status === "DECLINED" ? "This message request was declined" : "You already have a conversation with this person");

  const now = new Date();
  const conversation = await prisma.conversation.create({
    data: {
      requesterId: me.id,
      recipientId: input.recipientId,
      lastMessageAt: now,
      messages: { create: { senderId: me.id, body: input.body, createdAt: now } },
    },
    include: conversationInclude,
  });

  await notify({
    userId: input.recipientId,
    type: "MESSAGE_REQUEST_RECEIVED",
    title: `${conversation.requester.firstName} ${conversation.requester.lastName} sent you a message request`,
    body: input.body.slice(0, 140),
    linkUrl: "/messages?box=REQUESTS",
  });
  emitToUser(input.recipientId, "conversation:created", conversation);
  res.status(201).json({ data: conversation });
});

/** POST /conversations/:conversationId/accept — recipient only. */
conversationsRouter.post("/:conversationId/accept", async (req, res) => {
  const me = currentUser(req);
  const conversation = await findConversationFor(me, parse(uuidSchema, req.params.conversationId));
  if (conversation.recipientId !== me.id) throw forbidden("Only the recipient can accept a message request");
  if (conversation.status !== "PENDING") throw conflict(`Request is already ${conversation.status.toLowerCase()}`);

  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { status: "ACCEPTED", respondedAt: new Date() },
    include: conversationInclude,
  });
  await awardPoints(me.id, "MESSAGE_REQUEST_ACCEPTED", { referenceId: conversation.id });
  await evaluateBadges(conversation.requesterId);
  await notify({
    userId: conversation.requesterId,
    type: "MESSAGE_REQUEST_ACCEPTED",
    title: `${conversation.recipient.firstName} accepted your message request`,
    linkUrl: `/messages/${conversation.id}`,
  });
  emitToUser(conversation.requesterId, "conversation:updated", updated);
  res.json({ data: updated });
});

/** POST /conversations/:conversationId/decline — recipient only. */
conversationsRouter.post("/:conversationId/decline", async (req, res) => {
  const me = currentUser(req);
  const conversation = await findConversationFor(me, parse(uuidSchema, req.params.conversationId));
  if (conversation.recipientId !== me.id) throw forbidden("Only the recipient can decline a message request");
  if (conversation.status !== "PENDING") throw conflict(`Request is already ${conversation.status.toLowerCase()}`);

  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { status: "DECLINED", respondedAt: new Date() },
    include: conversationInclude,
  });
  emitToUser(conversation.requesterId, "conversation:updated", updated);
  res.json({ data: updated });
});

/** GET /conversations/:conversationId/messages?before=<ISO date> — newest 50, marks incoming as read. */
conversationsRouter.get("/:conversationId/messages", async (req, res) => {
  const me = currentUser(req);
  const conversation = await findConversationFor(me, parse(uuidSchema, req.params.conversationId));
  const query = parse(z.object({ before: z.coerce.date().optional() }), req.query);

  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id, createdAt: query.before ? { lt: query.before } : undefined },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  await prisma.message.updateMany({
    where: { conversationId: conversation.id, senderId: { not: me.id }, readAt: null },
    data: { readAt: new Date() },
  });

  const { messages: _latest, ...conversationFields } = conversation;
  res.json({
    data: messages.reverse(),
    meta: {
      conversation: {
        ...conversationFields,
        otherUser: conversation.requesterId === me.id ? conversation.recipient : conversation.requester,
      },
    },
  });
});

/** POST /conversations/:conversationId/messages — only once accepted. */
conversationsRouter.post("/:conversationId/messages", async (req, res) => {
  const me = currentUser(req);
  const conversation = await findConversationFor(me, parse(uuidSchema, req.params.conversationId));
  const input = parse(z.object({ body: z.string().trim().min(1).max(2000) }), req.body);
  if (conversation.status !== "ACCEPTED") throw forbidden("You can send more messages once your request is accepted");

  const [message] = await prisma.$transaction([
    prisma.message.create({ data: { conversationId: conversation.id, senderId: me.id, body: input.body } }),
    prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } }),
  ]);

  const otherUserId = conversation.requesterId === me.id ? conversation.recipientId : conversation.requesterId;
  emitToUser(otherUserId, "message:created", message);
  emitToUser(me.id, "message:created", message);
  res.status(201).json({ data: message });
});

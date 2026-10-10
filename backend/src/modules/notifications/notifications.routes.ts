import { Router } from "express";
import { notFound } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { pageMeta, paginationSchema, parse, queryBooleanSchema } from "../../lib/validation.js";
import { authenticate, currentUser } from "../../middleware/authenticate.js";

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const query = parse(paginationSchema.extend({ isUnread: queryBooleanSchema.optional() }), req.query);
  const where = { userId: user.id, ...(query.isUnread ? { readAt: null } : {}) };
  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  res.json({ data: items, meta: { ...pageMeta(query.page, query.pageSize, total), unreadCount } });
});

notificationsRouter.post("/read-all", async (req, res) => {
  const user = currentUser(req);
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  res.status(204).end();
});

notificationsRouter.post("/:notificationId/read", async (req, res) => {
  const user = currentUser(req);
  const result = await prisma.notification.updateMany({
    where: { id: req.params.notificationId, userId: user.id },
    data: { readAt: new Date() },
  });
  if (result.count === 0) throw notFound("Notification");
  res.status(204).end();
});

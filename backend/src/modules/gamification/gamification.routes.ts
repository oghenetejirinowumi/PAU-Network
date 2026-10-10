import { Router } from "express";
import { z } from "zod";
import { notFound } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { userSummarySelect } from "../../lib/user-select.js";
import { parse, uuidSchema } from "../../lib/validation.js";
import { BADGE_DEFINITIONS, TIER_THRESHOLDS } from "./gamification.config.js";
import { periodRange, pointsByUser } from "./gamification.service.js";

export const gamificationRouter = Router();

/** GET /leaderboard?role=ALUMNI&period=MONTH&departmentId=...&limit=20 */
gamificationRouter.get("/leaderboard", async (req, res) => {
  const query = parse(
    z.object({
      role: z.enum(["STUDENT", "ALUMNI"]).default("ALUMNI"),
      period: z.enum(["MONTH", "YEAR", "ALL_TIME"]).default("MONTH"),
      departmentId: uuidSchema.optional(),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
    req.query,
  );

  const range = periodRange(query.period);
  const ranking = range
    ? (await pointsByUser(range, { role: query.role, departmentId: query.departmentId })).slice(0, query.limit)
    : (
        await prisma.user.findMany({
          where: { role: query.role, departmentId: query.departmentId },
          orderBy: { points: "desc" },
          take: query.limit,
          select: { id: true, points: true },
        })
      ).map((user) => ({ userId: user.id, points: user.points }));

  const users = await prisma.user.findMany({
    where: { id: { in: ranking.map((row) => row.userId) } },
    select: { ...userSummarySelect, department: { select: { id: true, name: true } } },
  });
  const userById = new Map(users.map((user) => [user.id, user]));

  res.json({
    data: ranking.map((row, index) => ({ rank: index + 1, points: row.points, user: userById.get(row.userId) })),
    meta: { role: query.role, period: query.period, periodStart: range?.start, periodEnd: range?.end },
  });
});

/** GET /badges — the full catalogue with how to earn each badge. */
gamificationRouter.get("/badges", async (_req, res) => {
  const badges = await prisma.badge.findMany({
    orderBy: [{ category: "asc" }, { code: "asc" }],
    include: { _count: { select: { userBadges: true } } },
  });
  const thresholdByCode = new Map(BADGE_DEFINITIONS.map((definition) => [definition.code, definition]));
  res.json({
    data: badges.map(({ _count, ...badge }) => ({
      ...badge,
      metric: thresholdByCode.get(badge.code)?.metric,
      threshold: thresholdByCode.get(badge.code)?.threshold,
      earnedCount: _count.userBadges,
    })),
  });
});

/** GET /tiers — thresholds for Bronze, Silver, Gold, Platinum. */
gamificationRouter.get("/tiers", (_req, res) => {
  res.json({ data: [...TIER_THRESHOLDS].reverse() });
});

/** GET /users/:userId/achievements — points, tier, progress to next tier, badges, awards, recent points. */
gamificationRouter.get("/users/:userId/achievements", async (req, res) => {
  const userId = parse(uuidSchema, req.params.userId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      points: true,
      tier: true,
      userBadges: { orderBy: { awardedAt: "desc" }, select: { awardedAt: true, badge: true } },
      awards: { orderBy: { periodStart: "desc" }, include: { department: { select: { id: true, name: true } } } },
      pointTransactions: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!user) throw notFound("User");

  const ascending = [...TIER_THRESHOLDS].reverse();
  const nextTier = ascending.find((threshold) => threshold.minPoints > user.points);

  res.json({
    data: {
      points: user.points,
      tier: user.tier,
      nextTier: nextTier ? { tier: nextTier.tier, minPoints: nextTier.minPoints, pointsNeeded: nextTier.minPoints - user.points } : null,
      badges: user.userBadges.map((userBadge) => ({ ...userBadge.badge, awardedAt: userBadge.awardedAt })),
      awards: user.awards,
      recentPointTransactions: user.pointTransactions,
    },
  });
});

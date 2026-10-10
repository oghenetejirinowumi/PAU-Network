import type { ActivityType } from "../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import { notify } from "../notifications/notifications.service.js";
import { BADGE_DEFINITIONS, POINT_RULES, tierForPoints, type BadgeMetric } from "./gamification.config.js";

function startOfToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Records points in the ledger, updates the user's total and tier, then checks badges.
 * Safe to call repeatedly: daily limits and once-per-reference rules are enforced here.
 */
export async function awardPoints(
  userId: string,
  activityType: ActivityType,
  options: { referenceId?: string; points?: number } = {},
): Promise<number> {
  const rule = POINT_RULES[activityType];
  const points = options.points ?? rule.points;
  if (points <= 0) return 0;

  if (rule.isOncePerReference && options.referenceId) {
    const existing = await prisma.pointTransaction.findFirst({
      where: { userId, activityType, referenceId: options.referenceId },
      select: { id: true },
    });
    if (existing) return 0;
  }
  if (rule.dailyLimit) {
    const countToday = await prisma.pointTransaction.count({
      where: { userId, activityType, createdAt: { gte: startOfToday() } },
    });
    if (countToday >= rule.dailyLimit) return 0;
  }

  const [, user] = await prisma.$transaction([
    prisma.pointTransaction.create({ data: { userId, activityType, points, referenceId: options.referenceId } }),
    prisma.user.update({ where: { id: userId }, data: { points: { increment: points } }, select: { points: true, tier: true } }),
  ]);

  const newTier = tierForPoints(user.points);
  if (newTier !== user.tier) {
    await prisma.user.update({ where: { id: userId }, data: { tier: newTier } });
    await notify({
      userId,
      type: "TIER_REACHED",
      title: `You reached ${newTier.charAt(0)}${newTier.slice(1).toLowerCase()} tier!`,
      body: `You now have ${user.points} points.`,
      linkUrl: "/achievements",
    });
  }

  await evaluateBadges(userId);
  return points;
}

async function measure(userId: string, metric: BadgeMetric): Promise<number> {
  switch (metric) {
    case "sessionsMentored":
      return prisma.booking.count({ where: { alumniId: userId, status: "COMPLETED" } });
    case "sessionsAttended":
      return prisma.booking.count({ where: { studentId: userId, status: "COMPLETED" } });
    case "fiveStarRatings":
      return prisma.booking.count({ where: { alumniId: userId, rating: 5 } });
    case "spacesHosted":
      return prisma.space.count({ where: { hostId: userId, status: "ENDED" } });
    case "spacesAttended":
      return prisma.spaceParticipant.count({ where: { userId, joinedAt: { not: null }, role: { not: "HOST" } } });
    case "questionsAsked":
      return prisma.spaceQuestion.count({ where: { authorId: userId } });
    case "postsCreated":
      return prisma.post.count({ where: { authorId: userId } });
    case "commentsCreated":
      return prisma.comment.count({ where: { authorId: userId } });
    case "reactionsReceived":
      return prisma.reaction.count({ where: { post: { authorId: userId } } });
    case "connections":
      return prisma.conversation.count({
        where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { recipientId: userId }] },
      });
    case "signupRank": {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { createdAt: true } });
      return (await prisma.user.count({ where: { createdAt: { lt: user.createdAt } } })) + 1;
    }
  }
}

/** Grants every badge the user now qualifies for and has not yet earned. */
export async function evaluateBadges(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { role: true, userBadges: { select: { badge: { select: { code: true } } } } },
  });
  const owned = new Set(user.userBadges.map((userBadge) => userBadge.badge.code));
  const candidates = BADGE_DEFINITIONS.filter(
    (definition) => !owned.has(definition.code) && (definition.role === null || definition.role === user.role),
  );
  if (candidates.length === 0) return;

  const metricCache = new Map<BadgeMetric, number>();
  for (const definition of candidates) {
    if (!metricCache.has(definition.metric)) metricCache.set(definition.metric, await measure(userId, definition.metric));
    const value = metricCache.get(definition.metric)!;
    const isEarned = definition.metric === "signupRank" ? value <= definition.threshold : value >= definition.threshold;
    if (!isEarned) continue;

    const badge = await prisma.badge.findUnique({ where: { code: definition.code } });
    if (!badge) continue;
    await prisma.userBadge.create({ data: { userId, badgeId: badge.id } });
    await notify({
      userId,
      type: "BADGE_EARNED",
      title: `${badge.icon} Badge earned: ${badge.name}`,
      body: badge.description,
      linkUrl: "/achievements",
    });
  }
}

export type LeaderboardPeriod = "MONTH" | "YEAR" | "ALL_TIME";

export function periodRange(period: LeaderboardPeriod, reference = new Date()) {
  if (period === "MONTH") {
    return {
      start: new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1)),
      end: new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 1)),
    };
  }
  if (period === "YEAR") {
    return {
      start: new Date(Date.UTC(reference.getUTCFullYear(), 0, 1)),
      end: new Date(Date.UTC(reference.getUTCFullYear() + 1, 0, 1)),
    };
  }
  return undefined;
}

/** Sums ledger points per user in a date range. Award bonuses are excluded so winners do not snowball. */
export async function pointsByUser(range: { start: Date; end: Date }, userFilter: { role?: "STUDENT" | "ALUMNI"; departmentId?: string }) {
  const rows = await prisma.pointTransaction.groupBy({
    by: ["userId"],
    where: {
      createdAt: { gte: range.start, lt: range.end },
      activityType: { not: "AWARD_WON" },
      user: { role: userFilter.role, departmentId: userFilter.departmentId },
    },
    _sum: { points: true },
    orderBy: { _sum: { points: "desc" } },
  });
  return rows.map((row) => ({ userId: row.userId, points: row._sum.points ?? 0 }));
}

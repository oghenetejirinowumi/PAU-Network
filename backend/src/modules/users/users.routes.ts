import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { badRequest, notFound } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { experienceOrderBy, publicUserSelect } from "../../lib/user-select.js";
import { imageUrlSchema, pageMeta, paginationSchema, parse, queryBooleanSchema, uuidSchema } from "../../lib/validation.js";
import { authenticate, authenticateOptional, currentUser } from "../../middleware/authenticate.js";
import { awardPoints } from "../gamification/gamification.service.js";

export const usersRouter = Router();

const listUsersQuerySchema = paginationSchema.extend({
  role: z.enum(["STUDENT", "ALUMNI"]).default("ALUMNI"),
  departmentId: uuidSchema.optional(),
  graduationYearFrom: z.coerce.number().int().optional(),
  graduationYearTo: z.coerce.number().int().optional(),
  industry: z.string().optional(),
  search: z.string().trim().min(1).optional(),
  hasOpenSlots: queryBooleanSchema.optional(),
  sort: z.enum(["RELEVANCE", "POINTS", "GRADUATION_YEAR", "NAME"]).default("RELEVANCE"),
});

/** GET /users — the alumni directory (role=ALUMNI by default). */
usersRouter.get("/", async (req, res) => {
  const query = parse(listUsersQuerySchema, req.query);
  const now = new Date();

  const where: Prisma.UserWhereInput = {
    role: query.role,
    departmentId: query.departmentId,
    industry: query.industry ? { equals: query.industry, mode: "insensitive" } : undefined,
    graduationYear: { gte: query.graduationYearFrom, lte: query.graduationYearTo },
    ...(query.search && {
      OR: [
        { firstName: { contains: query.search, mode: "insensitive" } },
        { lastName: { contains: query.search, mode: "insensitive" } },
        { company: { contains: query.search, mode: "insensitive" } },
        { jobTitle: { contains: query.search, mode: "insensitive" } },
        { headline: { contains: query.search, mode: "insensitive" } },
      ],
    }),
    ...(query.hasOpenSlots && {
      availabilitySlots: {
        some: { startsAt: { gt: now }, bookings: { none: { status: { in: ["PENDING", "ACCEPTED"] } } } },
      },
    }),
  };

  const orderBy: Prisma.UserOrderByWithRelationInput[] = {
    RELEVANCE: [{ isVerified: "desc" as const }, { points: "desc" as const }],
    POINTS: [{ points: "desc" as const }],
    GRADUATION_YEAR: [{ graduationYear: "desc" as const }],
    NAME: [{ firstName: "asc" as const }, { lastName: "asc" as const }],
  }[query.sort];

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        ...publicUserSelect,
        availabilitySlots: {
          where: { startsAt: { gt: now }, bookings: { none: { status: { in: ["PENDING", "ACCEPTED"] } } } },
          orderBy: { startsAt: "asc" },
          take: 1,
          select: { id: true, startsAt: true, endsAt: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    data: users.map(({ availabilitySlots, ...user }) => ({ ...user, nextOpenSlot: availabilitySlots[0] ?? null })),
    meta: pageMeta(query.page, query.pageSize, total),
  });
});

/** GET /users/:userId — public profile with counts and follow state. */
usersRouter.get("/:userId", authenticateOptional, async (req, res) => {
  const userId = parse(uuidSchema, req.params.userId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...publicUserSelect,
      experiences: { orderBy: experienceOrderBy },
      educations: { orderBy: [{ endYear: { sort: "desc", nulls: "first" } }, { startYear: "desc" }] },
      _count: { select: { followers: true, following: true, posts: true, hostedSpaces: true } },
    },
  });
  if (!user) throw notFound("User");

  const [sessionsCompleted, ratingStats, follow] = await Promise.all([
    prisma.booking.count({
      where: { status: "COMPLETED", ...(user.role === "ALUMNI" ? { alumniId: userId } : { studentId: userId }) },
    }),
    prisma.booking.aggregate({ where: { alumniId: userId, rating: { not: null } }, _avg: { rating: true }, _count: { rating: true } }),
    req.user
      ? prisma.follow.findUnique({ where: { followerId_followingId: { followerId: req.user.id, followingId: userId } } })
      : null,
  ]);

  const { _count, ...profile } = user;
  res.json({
    data: {
      ...profile,
      stats: {
        followerCount: _count.followers,
        followingCount: _count.following,
        postCount: _count.posts,
        spacesHostedCount: _count.hostedSpaces,
        sessionsCompletedCount: sessionsCompleted,
        averageRating: ratingStats._avg.rating,
        ratingCount: ratingStats._count.rating,
      },
      isFollowing: Boolean(follow),
    },
  });
});

const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(50),
    lastName: z.string().trim().min(1).max(50),
    avatarUrl: imageUrlSchema.nullable(),
    bannerUrl: imageUrlSchema.nullable(),
    headline: z.string().trim().max(120).nullable(),
    bio: z.string().trim().max(600).nullable(),
    studentLevel: z.number().int().refine((level) => [100, 200, 300, 400, 500].includes(level)),
    jobTitle: z.string().trim().max(100).nullable(),
    company: z.string().trim().max(100).nullable(),
    industry: z.string().trim().max(60).nullable(),
    location: z.string().trim().max(60).nullable(),
    linkedinUrl: z.string().url().nullable(),
    skills: z.array(z.string().trim().min(1).max(40)).max(30),
  })
  .partial();

/** PATCH /users/me */
usersRouter.patch("/me", authenticate, async (req, res) => {
  const me = currentUser(req);
  const input = parse(updateProfileSchema, req.body);
  if (me.role === "STUDENT" && (input.jobTitle || input.company)) throw badRequest("Students cannot set a job title or company");

  const user = await prisma.user.update({ where: { id: me.id }, data: input, select: { ...publicUserSelect, email: true } });

  const isProfileComplete = Boolean(
    user.avatarUrl && user.headline && user.bio && user.skills.length > 0 && (user.role !== "ALUMNI" || (user.jobTitle && user.company)),
  );
  if (isProfileComplete) await awardPoints(me.id, "PROFILE_COMPLETED", { referenceId: me.id });

  res.json({ data: user });
});

/** PUT /users/:userId/follow — idempotent follow. */
usersRouter.put("/:userId/follow", authenticate, async (req, res) => {
  const me = currentUser(req);
  const userId = parse(uuidSchema, req.params.userId);
  if (userId === me.id) throw badRequest("You cannot follow yourself");
  if (!(await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) throw notFound("User");
  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId: me.id, followingId: userId } },
    create: { followerId: me.id, followingId: userId },
    update: {},
  });
  res.status(204).end();
});

/** DELETE /users/:userId/follow */
usersRouter.delete("/:userId/follow", authenticate, async (req, res) => {
  const me = currentUser(req);
  const userId = parse(uuidSchema, req.params.userId);
  await prisma.follow.deleteMany({ where: { followerId: me.id, followingId: userId } });
  res.status(204).end();
});

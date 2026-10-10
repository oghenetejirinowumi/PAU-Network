import { Router } from "express";
import { z } from "zod";
import { AwardType } from "../../generated/prisma/enums.js";
import { badRequest, forbidden, notFound } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { userSummarySelect } from "../../lib/user-select.js";
import { parse, uuidSchema } from "../../lib/validation.js";
import { authenticate, currentUser, requireRole } from "../../middleware/authenticate.js";
import { pointsByUser } from "../gamification/gamification.service.js";
import { AWARD_TITLES, MONTHLY_AWARD_TYPES, computeAward } from "./awards.service.js";

export const awardsRouter = Router();

const VOTABLE_AWARD_TYPES = ["ALUMNI_OF_THE_YEAR", "STUDENTS_CHOICE_OF_THE_YEAR"] as const;

const awardInclude = {
  recipient: { select: { ...userSummarySelect, department: { select: { id: true, name: true } } } },
  department: { select: { id: true, name: true } },
};

/** GET /awards?type=&year= — the hall of fame, newest first. */
awardsRouter.get("/", async (req, res) => {
  const query = parse(z.object({ type: z.nativeEnum(AwardType).optional(), year: z.coerce.number().int().optional() }), req.query);
  const awards = await prisma.award.findMany({
    where: {
      type: query.type,
      periodStart: query.year ? { gte: new Date(Date.UTC(query.year, 0, 1)), lt: new Date(Date.UTC(query.year + 1, 0, 1)) } : undefined,
    },
    orderBy: [{ periodStart: "desc" }, { type: "asc" }],
    include: awardInclude,
  });
  res.json({ data: awards.map((award) => ({ ...award, title: AWARD_TITLES[award.type] })) });
});

/** GET /awards/current — latest winner of each award type (for the home page spotlight). */
awardsRouter.get("/current", async (_req, res) => {
  const latest = await Promise.all(
    Object.values(AwardType)
      .filter((type) => type !== "DEPARTMENT_CHAMPION_OF_THE_MONTH")
      .map((type) => prisma.award.findFirst({ where: { type }, orderBy: { periodStart: "desc" }, include: awardInclude })),
  );
  res.json({ data: latest.filter(Boolean).map((award) => ({ ...award!, title: AWARD_TITLES[award!.type] })) });
});

/** GET /awards/nominees?awardType=ALUMNI_OF_THE_YEAR&year=2026 — top alumni by year points with vote counts. */
awardsRouter.get("/nominees", async (req, res) => {
  const query = parse(
    z.object({ awardType: z.enum(VOTABLE_AWARD_TYPES), year: z.coerce.number().int().default(new Date().getUTCFullYear()) }),
    req.query,
  );
  const start = new Date(Date.UTC(query.year, 0, 1));
  const end = new Date(Date.UTC(query.year + 1, 0, 1));
  const ranking = (await pointsByUser({ start, end }, { role: "ALUMNI" })).slice(0, 12);
  const [users, votes] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ranking.map((row) => row.userId) } }, select: { ...userSummarySelect, department: { select: { id: true, name: true } } } }),
    prisma.awardVote.groupBy({ by: ["nomineeId"], where: { awardType: query.awardType, year: query.year }, _count: { _all: true } }),
  ]);
  const userById = new Map(users.map((user) => [user.id, user]));
  const votesById = new Map(votes.map((row) => [row.nomineeId, row._count._all]));
  res.json({
    data: ranking.map((row) => ({ user: userById.get(row.userId), yearPoints: row.points, voteCount: votesById.get(row.userId) ?? 0 })),
  });
});

/** PUT /awards/votes — one vote per user per award per year; voting again moves your vote. */
awardsRouter.put("/votes", authenticate, async (req, res) => {
  const me = currentUser(req);
  const input = parse(
    z.object({ awardType: z.enum(VOTABLE_AWARD_TYPES), nomineeId: uuidSchema, year: z.number().int().default(new Date().getUTCFullYear()) }),
    req.body,
  );
  if (input.awardType === "STUDENTS_CHOICE_OF_THE_YEAR" && me.role !== "STUDENT") throw forbidden("Only students vote for the Students' Choice Award");
  if (input.nomineeId === me.id) throw badRequest("You cannot vote for yourself");
  const nominee = await prisma.user.findUnique({ where: { id: input.nomineeId }, select: { role: true } });
  if (!nominee) throw notFound("Nominee");
  if (nominee.role !== "ALUMNI") throw badRequest("Only alumni can be nominated");

  const vote = await prisma.awardVote.upsert({
    where: { awardType_year_voterId: { awardType: input.awardType, year: input.year, voterId: me.id } },
    create: { ...input, voterId: me.id },
    update: { nomineeId: input.nomineeId },
  });
  res.json({ data: vote });
});

/** POST /awards/compute — admin runs the monthly/yearly selection. In production, call this from a cron job. */
awardsRouter.post("/compute", authenticate, requireRole("ADMIN"), async (req, res) => {
  const input = parse(
    z.object({ type: z.nativeEnum(AwardType), year: z.number().int().min(2020), month: z.number().int().min(1).max(12).optional() }),
    req.body,
  );
  const isMonthly = (MONTHLY_AWARD_TYPES as readonly string[]).includes(input.type);
  if (isMonthly && !input.month) throw badRequest("month is required for monthly awards");
  const awards = await computeAward(input.type, input.year, input.month);
  res.status(201).json({ data: awards });
});

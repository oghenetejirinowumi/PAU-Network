import type { AwardType } from "../../generated/prisma/enums.js";
import { conflict } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { AWARD_POINTS } from "../gamification/gamification.config.js";
import { awardPoints, pointsByUser } from "../gamification/gamification.service.js";
import { notify } from "../notifications/notifications.service.js";

/**
 * How winners are chosen (all scores come from the points ledger, award bonuses excluded):
 *
 * Monthly
 *   ALUMNI_OF_THE_MONTH              Most points in the month among verified alumni with at least one
 *                                    completed session or hosted space that month. Tie-break: average rating.
 *   STUDENT_OF_THE_MONTH             Most points in the month among students.
 *   (Both monthly awards have a cooldown: winners are ineligible for the same award for the next 3 months.)
 *   DEPARTMENT_CHAMPION_OF_THE_MONTH Top alumnus in each department (one award per department).
 *
 * Yearly
 *   ALUMNI_OF_THE_YEAR               Year points + 300 per Alumni of the Month win + 25 per community vote.
 *   RISING_STAR_OF_THE_YEAR          Same as above, limited to alumni who graduated in the last 3 years.
 *   STUDENTS_CHOICE_OF_THE_YEAR      Most votes from students (one vote per student per year).
 *   SPACE_OF_THE_YEAR                Host of the ended space with the most attendees + question upvotes.
 */
export const MONTHLY_AWARD_TYPES = ["ALUMNI_OF_THE_MONTH", "STUDENT_OF_THE_MONTH", "DEPARTMENT_CHAMPION_OF_THE_MONTH"] as const;
export const YEARLY_AWARD_TYPES = ["ALUMNI_OF_THE_YEAR", "RISING_STAR_OF_THE_YEAR", "STUDENTS_CHOICE_OF_THE_YEAR", "SPACE_OF_THE_YEAR"] as const;

const MONTH_WIN_BONUS = 300;
const VOTE_WEIGHT = 25;
const RISING_STAR_YEARS = 3;
const MONTHLY_WIN_COOLDOWN_MONTHS = 3;

/** Users who won this monthly award in the months just before `start`. */
async function recentWinnerIds(type: AwardType, start: Date) {
  const cooldownStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - MONTHLY_WIN_COOLDOWN_MONTHS, 1));
  const awards = await prisma.award.findMany({ where: { type, periodStart: { gte: cooldownStart, lt: start } }, select: { recipientId: true } });
  return new Set(awards.map((award) => award.recipientId));
}

export const AWARD_TITLES: Record<AwardType, string> = {
  ALUMNI_OF_THE_MONTH: "Alumni of the Month",
  STUDENT_OF_THE_MONTH: "Student of the Month",
  DEPARTMENT_CHAMPION_OF_THE_MONTH: "Department Champion",
  ALUMNI_OF_THE_YEAR: "Alumni of the Year",
  RISING_STAR_OF_THE_YEAR: "Rising Star of the Year",
  STUDENTS_CHOICE_OF_THE_YEAR: "Students' Choice Award",
  SPACE_OF_THE_YEAR: "Space of the Year",
};

const monthLabel = (date: Date) => date.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

interface Winner {
  recipientId: string;
  departmentId?: string;
  score: number;
  citation: string;
}

async function activityCounts(userId: string, start: Date, end: Date) {
  const [sessions, spaces, rating] = await Promise.all([
    prisma.booking.count({ where: { alumniId: userId, status: "COMPLETED", slot: { startsAt: { gte: start, lt: end } } } }),
    prisma.space.count({ where: { hostId: userId, status: "ENDED", endedAt: { gte: start, lt: end } } }),
    prisma.booking.aggregate({ where: { alumniId: userId, rating: { not: null }, slot: { startsAt: { gte: start, lt: end } } }, _avg: { rating: true } }),
  ]);
  return { sessions, spaces, averageRating: rating._avg.rating ?? 0 };
}

async function pickMonthlyAlumni(start: Date, end: Date, departmentId?: string): Promise<Winner | null> {
  const ranking = await pointsByUser({ start, end }, { role: "ALUMNI", departmentId });
  const ineligible = departmentId ? new Set<string>() : await recentWinnerIds("ALUMNI_OF_THE_MONTH", start);
  const scored = [];
  for (const row of ranking.filter((candidate) => !ineligible.has(candidate.userId)).slice(0, 10)) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: row.userId }, select: { isVerified: true, firstName: true, departmentId: true } });
    if (!user.isVerified) continue;
    const counts = await activityCounts(row.userId, start, end);
    if (counts.sessions + counts.spaces === 0) continue;
    scored.push({ ...row, ...counts, firstName: user.firstName, departmentId: user.departmentId });
  }
  scored.sort((a, b) => b.points - a.points || b.averageRating - a.averageRating);
  const best = scored[0];
  if (!best) return null;
  return {
    recipientId: best.userId,
    departmentId,
    score: best.points,
    citation: `${best.firstName} mentored ${best.sessions} student${best.sessions === 1 ? "" : "s"} and hosted ${best.spaces} space${best.spaces === 1 ? "" : "s"} in ${monthLabel(start)}, earning ${best.points} points.`,
  };
}

async function pickMonthlyStudent(start: Date, end: Date): Promise<Winner | null> {
  const ineligible = await recentWinnerIds("STUDENT_OF_THE_MONTH", start);
  const best = (await pointsByUser({ start, end }, { role: "STUDENT" })).find((candidate) => !ineligible.has(candidate.userId));
  if (!best) return null;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: best.userId }, select: { firstName: true } });
  return { recipientId: best.userId, score: best.points, citation: `${user.firstName} was the most active learner in ${monthLabel(start)} with ${best.points} points.` };
}

async function pickYearlyAlumni(start: Date, end: Date, graduatedFrom?: number): Promise<Winner | null> {
  const year = start.getUTCFullYear();
  const [ranking, monthWins, votes] = await Promise.all([
    pointsByUser({ start, end }, { role: "ALUMNI" }),
    prisma.award.groupBy({ by: ["recipientId"], where: { type: "ALUMNI_OF_THE_MONTH", periodStart: { gte: start, lt: end } }, _count: { _all: true } }),
    prisma.awardVote.groupBy({ by: ["nomineeId"], where: { awardType: "ALUMNI_OF_THE_YEAR", year }, _count: { _all: true } }),
  ]);
  const winsById = new Map(monthWins.map((row) => [row.recipientId, row._count._all]));
  const votesById = new Map(votes.map((row) => [row.nomineeId, row._count._all]));
  const candidateIds = new Set([...ranking.map((row) => row.userId), ...winsById.keys(), ...votesById.keys()]);
  const pointsById = new Map(ranking.map((row) => [row.userId, row.points]));

  const users = await prisma.user.findMany({
    where: { id: { in: [...candidateIds] }, role: "ALUMNI", isVerified: true, graduationYear: graduatedFrom ? { gte: graduatedFrom } : undefined },
    select: { id: true, firstName: true },
  });
  const scored = users
    .map((user) => {
      const points = pointsById.get(user.id) ?? 0;
      const wins = winsById.get(user.id) ?? 0;
      const voteCount = votesById.get(user.id) ?? 0;
      return { user, points, wins, voteCount, score: points + wins * MONTH_WIN_BONUS + voteCount * VOTE_WEIGHT };
    })
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score === 0) return null;
  return {
    recipientId: best.user.id,
    score: best.score,
    citation: `${best.user.firstName} earned ${best.points} points in ${year}, was Alumni of the Month ${best.wins} time${best.wins === 1 ? "" : "s"} and received ${best.voteCount} community vote${best.voteCount === 1 ? "" : "s"}.`,
  };
}

async function pickStudentsChoice(year: number): Promise<Winner | null> {
  const top = (
    await prisma.awardVote.groupBy({
      by: ["nomineeId"],
      where: { awardType: "STUDENTS_CHOICE_OF_THE_YEAR", year },
      _count: { _all: true },
      orderBy: { _count: { nomineeId: "desc" } },
      take: 1,
    })
  )[0];
  if (!top) return null;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: top.nomineeId }, select: { firstName: true } });
  return { recipientId: top.nomineeId, score: top._count._all, citation: `${user.firstName} was voted the most helpful alumnus by students in ${year} with ${top._count._all} votes.` };
}

async function pickSpaceOfTheYear(start: Date, end: Date): Promise<Winner | null> {
  const spaces = await prisma.space.findMany({
    where: { status: "ENDED", endedAt: { gte: start, lt: end } },
    select: {
      id: true,
      title: true,
      hostId: true,
      _count: { select: { participants: { where: { joinedAt: { not: null } } } } },
      questions: { select: { upvoteCount: true } },
    },
  });
  const scored = spaces
    .map((space) => ({ space, score: space._count.participants + space.questions.reduce((sum, question) => sum + question.upvoteCount, 0) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return null;
  return {
    recipientId: best.space.hostId,
    score: best.score,
    citation: `"${best.space.title}" drew ${best.space._count.participants} attendees and the most engaged Q&A of ${start.getUTCFullYear()}.`,
  };
}

async function saveWinner(type: AwardType, start: Date, end: Date, winner: Winner) {
  const existing = await prisma.award.findFirst({ where: { type, periodStart: start, departmentId: winner.departmentId ?? null } });
  if (existing) throw conflict(`${AWARD_TITLES[type]} for this period has already been awarded`);

  const award = await prisma.award.create({
    data: { type, recipientId: winner.recipientId, departmentId: winner.departmentId, periodStart: start, periodEnd: end, score: winner.score, citation: winner.citation },
    include: { recipient: { select: { id: true, firstName: true, lastName: true } }, department: { select: { id: true, name: true } } },
  });
  await awardPoints(winner.recipientId, "AWARD_WON", { referenceId: award.id, points: AWARD_POINTS[type] });
  await notify({
    userId: winner.recipientId,
    type: "AWARD_WON",
    title: `🏆 You are ${AWARD_TITLES[type]}!`,
    body: winner.citation,
    linkUrl: "/awards",
  });
  return award;
}

/** Computes and stores the winner(s) for one award and period. `month` is 1-12 for monthly awards. */
export async function computeAward(type: AwardType, year: number, month?: number) {
  const isMonthly = (MONTHLY_AWARD_TYPES as readonly AwardType[]).includes(type);
  const start = isMonthly ? new Date(Date.UTC(year, month! - 1, 1)) : new Date(Date.UTC(year, 0, 1));
  const end = isMonthly ? new Date(Date.UTC(year, month!, 1)) : new Date(Date.UTC(year + 1, 0, 1));

  if (type === "DEPARTMENT_CHAMPION_OF_THE_MONTH") {
    const departments = await prisma.department.findMany({ select: { id: true } });
    const awards = [];
    for (const department of departments) {
      const winner = await pickMonthlyAlumni(start, end, department.id);
      if (winner) awards.push(await saveWinner(type, start, end, winner));
    }
    return awards;
  }

  const winner = await {
    ALUMNI_OF_THE_MONTH: () => pickMonthlyAlumni(start, end),
    STUDENT_OF_THE_MONTH: () => pickMonthlyStudent(start, end),
    ALUMNI_OF_THE_YEAR: () => pickYearlyAlumni(start, end),
    RISING_STAR_OF_THE_YEAR: () => pickYearlyAlumni(start, end, year - RISING_STAR_YEARS),
    STUDENTS_CHOICE_OF_THE_YEAR: () => pickStudentsChoice(year),
    SPACE_OF_THE_YEAR: () => pickSpaceOfTheYear(start, end),
  }[type]();

  return winner ? [await saveWinner(type, start, end, winner)] : [];
}

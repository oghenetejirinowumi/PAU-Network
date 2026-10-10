import type { Prisma } from "../generated/prisma/client.js";

/** Public profile fields. Never includes email or passwordHash. */
export const publicUserSelect = {
  id: true,
  role: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  bannerUrl: true,
  headline: true,
  bio: true,
  skills: true,
  graduationYear: true,
  studentLevel: true,
  jobTitle: true,
  company: true,
  industry: true,
  location: true,
  linkedinUrl: true,
  isVerified: true,
  points: true,
  tier: true,
  createdAt: true,
  department: { select: { id: true, name: true, slug: true, school: true } },
} satisfies Prisma.UserSelect;

/** Compact author/participant shape used inside posts, comments, messages, spaces. */
export const userSummarySelect = {
  id: true,
  role: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  headline: true,
  jobTitle: true,
  company: true,
  isVerified: true,
  tier: true,
} satisfies Prisma.UserSelect;

/** Work history: current roles first, then most recent. */
export const experienceOrderBy = [{ endDate: { sort: "desc", nulls: "first" } }, { startDate: "desc" }] satisfies Prisma.ExperienceOrderByWithRelationInput[];

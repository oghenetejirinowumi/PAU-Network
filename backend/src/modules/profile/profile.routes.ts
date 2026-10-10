import { Router } from "express";
import { z } from "zod";
import { badRequest, forbidden, notFound } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { experienceOrderBy } from "../../lib/user-select.js";
import { parse, uuidSchema } from "../../lib/validation.js";
import { authenticate, currentUser } from "../../middleware/authenticate.js";

/**
 * The signed-in user's work history and education (LinkedIn-style).
 * Mounted at /users/me, so routes are /users/me/experiences and /users/me/educations.
 */
export const profileRouter = Router();
profileRouter.use(authenticate);

const currentYear = new Date().getUTCFullYear();

const experienceSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    company: z.string().trim().min(1).max(100),
    employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", "SELF_EMPLOYED", "VOLUNTEER"]).default("FULL_TIME"),
    location: z.string().trim().max(60).nullish(),
    startDate: z.coerce.date(),
    /** null = "I currently work here" */
    endDate: z.coerce.date().nullish(),
    description: z.string().trim().max(1000).nullish(),
  })
  .refine((value) => !value.endDate || value.endDate >= value.startDate, { message: "End date must be after start date", path: ["endDate"] });

const educationSchema = z
  .object({
    school: z.string().trim().min(1).max(120),
    degree: z.string().trim().max(100).nullish(),
    fieldOfStudy: z.string().trim().max(100).nullish(),
    startYear: z.number().int().min(1960).max(currentYear + 1),
    endYear: z.number().int().min(1960).max(currentYear + 8).nullish(),
    description: z.string().trim().max(600).nullish(),
  })
  .refine((value) => !value.endYear || value.endYear >= value.startYear, { message: "End year must be after start year", path: ["endYear"] });

/** Keeps users.jobTitle / users.company (used by the directory and cards) in sync with the latest current role. */
async function syncCurrentRole(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true } });
  if (user.role !== "ALUMNI") return;
  const current = await prisma.experience.findFirst({ where: { userId, endDate: null }, orderBy: { startDate: "desc" } });
  if (current) await prisma.user.update({ where: { id: userId }, data: { jobTitle: current.title, company: current.company } });
}

async function findOwnExperience(userId: string, experienceId: string) {
  const experience = await prisma.experience.findUnique({ where: { id: experienceId } });
  if (!experience) throw notFound("Experience");
  if (experience.userId !== userId) throw forbidden();
  return experience;
}

async function findOwnEducation(userId: string, educationId: string) {
  const education = await prisma.education.findUnique({ where: { id: educationId } });
  if (!education) throw notFound("Education");
  if (education.userId !== userId) throw forbidden();
  return education;
}

// ───── Experiences ─────

profileRouter.get("/experiences", async (req, res) => {
  const me = currentUser(req);
  res.json({ data: await prisma.experience.findMany({ where: { userId: me.id }, orderBy: experienceOrderBy }) });
});

profileRouter.post("/experiences", async (req, res) => {
  const me = currentUser(req);
  const input = parse(experienceSchema, req.body);
  const experience = await prisma.experience.create({ data: { ...input, userId: me.id } });
  await syncCurrentRole(me.id);
  res.status(201).json({ data: experience });
});

profileRouter.patch("/experiences/:experienceId", async (req, res) => {
  const me = currentUser(req);
  const experienceId = parse(uuidSchema, req.params.experienceId);
  const existing = await findOwnExperience(me.id, experienceId);
  const input = parse(experienceSchema, { ...existing, ...req.body });
  const experience = await prisma.experience.update({ where: { id: experienceId }, data: input });
  await syncCurrentRole(me.id);
  res.json({ data: experience });
});

profileRouter.delete("/experiences/:experienceId", async (req, res) => {
  const me = currentUser(req);
  const experienceId = parse(uuidSchema, req.params.experienceId);
  await findOwnExperience(me.id, experienceId);
  await prisma.experience.delete({ where: { id: experienceId } });
  await syncCurrentRole(me.id);
  res.status(204).end();
});

// ───── Educations ─────

profileRouter.get("/educations", async (req, res) => {
  const me = currentUser(req);
  res.json({ data: await prisma.education.findMany({ where: { userId: me.id }, orderBy: [{ endYear: { sort: "desc", nulls: "first" } }, { startYear: "desc" }] }) });
});

profileRouter.post("/educations", async (req, res) => {
  const me = currentUser(req);
  const input = parse(educationSchema, req.body);
  res.status(201).json({ data: await prisma.education.create({ data: { ...input, userId: me.id } }) });
});

profileRouter.patch("/educations/:educationId", async (req, res) => {
  const me = currentUser(req);
  const educationId = parse(uuidSchema, req.params.educationId);
  const existing = await findOwnEducation(me.id, educationId);
  const input = parse(educationSchema, { ...existing, ...req.body });
  res.json({ data: await prisma.education.update({ where: { id: educationId }, data: input }) });
});

profileRouter.delete("/educations/:educationId", async (req, res) => {
  const me = currentUser(req);
  const educationId = parse(uuidSchema, req.params.educationId);
  const education = await findOwnEducation(me.id, educationId);
  if (education.school === "Pan-Atlantic University" && (await prisma.education.count({ where: { userId: me.id, school: "Pan-Atlantic University" } })) === 1) {
    throw badRequest("Your Pan-Atlantic University entry is required on PAU Network");
  }
  await prisma.education.delete({ where: { id: educationId } });
  res.status(204).end();
});

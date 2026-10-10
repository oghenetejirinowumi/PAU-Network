import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { badRequest, conflict, notFound, unauthorized } from "../../lib/http-error.js";
import { signAccessToken } from "../../lib/jwt.js";
import { prisma } from "../../lib/prisma.js";
import { publicUserSelect } from "../../lib/user-select.js";
import { parse, uuidSchema } from "../../lib/validation.js";
import { authenticate, currentUser } from "../../middleware/authenticate.js";
import { evaluateBadges } from "../gamification/gamification.service.js";

export const authRouter = Router();

const currentYear = new Date().getUTCFullYear();

const registerSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("STUDENT"),
    email: z.string().email().toLowerCase(),
    password: z.string().min(8),
    firstName: z.string().trim().min(1).max(50),
    lastName: z.string().trim().min(1).max(50),
    departmentId: uuidSchema,
    graduationYear: z.number().int().min(currentYear).max(currentYear + 6),
    studentLevel: z.number().int().refine((level) => [100, 200, 300, 400, 500].includes(level)),
  }),
  z.object({
    role: z.literal("ALUMNI"),
    email: z.string().email().toLowerCase(),
    password: z.string().min(8),
    firstName: z.string().trim().min(1).max(50),
    lastName: z.string().trim().min(1).max(50),
    departmentId: uuidSchema,
    graduationYear: z.number().int().min(1990).max(currentYear),
    jobTitle: z.string().trim().min(1).max(100),
    company: z.string().trim().min(1).max(100),
    industry: z.string().trim().max(60).optional(),
    location: z.string().trim().max(60).optional(),
    linkedinUrl: z.string().url().optional(),
  }),
]);

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

/** Shape returned by /auth/register, /auth/login and /auth/me. */
async function sessionPayload(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { ...publicUserSelect, email: true } });
  if (!user) throw notFound("User");
  return { user, accessToken: signAccessToken({ sub: user.id, role: user.role }) };
}

authRouter.post("/register", async (req, res) => {
  const { password, ...input } = parse(registerSchema, req.body);
  const department = await prisma.department.findUnique({ where: { id: input.departmentId } });
  if (!department) throw badRequest("Unknown department");
  if (await prisma.user.findUnique({ where: { email: input.email } })) throw conflict("An account with this email already exists");

  const programmeYears = department.slug.includes("engineering") ? 5 : department.slug === "mba" ? 2 : 4;
  const user = await prisma.user.create({
    data: {
      ...input,
      passwordHash: await bcrypt.hash(password, 10),
      lastActiveAt: new Date(),
      // Every member starts with their PAU degree; alumni also start with their current role.
      educations: {
        create: {
          school: "Pan-Atlantic University",
          degree: department.slug === "mba" ? "MBA" : "Bachelor's degree",
          fieldOfStudy: department.name,
          startYear: input.graduationYear - programmeYears,
          endYear: input.graduationYear,
        },
      },
      ...(input.role === "ALUMNI" && {
        experiences: { create: { title: input.jobTitle, company: input.company, location: input.location, startDate: new Date(Date.UTC(currentYear, 0, 1)) } },
      }),
    },
  });
  await evaluateBadges(user.id);
  res.status(201).json({ data: await sessionPayload(user.id) });
});

authRouter.post("/login", async (req, res) => {
  const input = parse(loginSchema, req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) throw unauthorized("Incorrect email or password");
  await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });
  res.json({ data: await sessionPayload(user.id) });
});

authRouter.get("/me", authenticate, async (req, res) => {
  res.json({ data: await sessionPayload(currentUser(req).id) });
});

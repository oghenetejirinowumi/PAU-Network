import bcrypt from "bcryptjs";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { Router, type Request } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { badRequest, conflict, HttpError, notFound, serviceUnavailable, unauthorized } from "../../lib/http-error.js";
import { signAccessToken } from "../../lib/jwt.js";
import { prisma } from "../../lib/prisma.js";
import { publicUserSelect } from "../../lib/user-select.js";
import { parse, uuidSchema } from "../../lib/validation.js";
import { authenticate, currentUser } from "../../middleware/authenticate.js";
import { env } from "../../config/env.js";
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

const linkedInRegisterSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("STUDENT"),
    departmentId: uuidSchema,
    graduationYear: z.number().int().min(currentYear).max(currentYear + 6),
    studentLevel: z.number().int().refine((level) => [100, 200, 300, 400, 500].includes(level)),
  }),
  z.object({
    role: z.literal("ALUMNI"),
    departmentId: uuidSchema,
    graduationYear: z.number().int().min(1990).max(currentYear),
    jobTitle: z.string().trim().min(1).max(100),
    company: z.string().trim().min(1).max(100),
    industry: z.string().trim().max(60).optional(),
    location: z.string().trim().max(60).optional(),
  }),
]);

const linkedInProfileSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email().toLowerCase(),
  email_verified: z.literal(true),
  given_name: z.string().trim().min(1).max(50),
  family_name: z.string().trim().min(1).max(50),
  picture: z.string().url().optional(),
});

const linkedInTokenSchema = z.object({ access_token: z.string().min(1) });
const linkedInTicketSchema = z.object({
  kind: z.literal("linkedin-onboarding"),
  profile: linkedInProfileSchema,
});

const linkedInStateCookie = "pau-linkedin-state";
const linkedInPendingCookie = "pau-linkedin-pending";
const linkedInSessionCookie = "pau-linkedin-session";
const linkedInCookiePath = "/api/v1/auth/linkedin";
const linkedInStateCookiePath = `${linkedInCookiePath}/callback`;

function linkedInCookieOptions(path: string) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
    path,
  };
}

function readCookie(req: Request, name: string) {
  const value = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return value?.slice(name.length + 1);
}

function linkedInCredentials() {
  const { LINKEDIN_CLIENT_ID: clientId, LINKEDIN_CLIENT_SECRET: clientSecret } = env;
  if (!clientId || !clientSecret) {
    throw serviceUnavailable("LinkedIn sign-in is not configured. Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET.");
  }
  return { clientId, clientSecret };
}

async function linkedInOnboardingProfile(req: Request) {
  const token = readCookie(req, linkedInPendingCookie);
  if (!token) throw unauthorized("LinkedIn registration has expired. Please sign in again.");
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const parsed = linkedInTicketSchema.safeParse(decoded);
    if (!parsed.success) throw unauthorized("LinkedIn registration has expired. Please sign in again.");
    return parsed.data.profile;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw unauthorized("LinkedIn registration has expired. Please sign in again.");
  }
}

function linkedInSessionUserId(token: string) {
  let decoded: string | jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw unauthorized("LinkedIn sign-in has expired. Please try again.");
  }
  if (typeof decoded !== "object" || typeof decoded.sub !== "string" || typeof decoded.role !== "string") {
    throw unauthorized("LinkedIn sign-in has expired. Please try again.");
  }
  return decoded.sub;
}

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

authRouter.get("/linkedin", (_req, res) => {
  const { clientId } = linkedInCredentials();
  const state = randomBytes(32).toString("hex");
  res.cookie(linkedInStateCookie, state, {
    ...linkedInCookieOptions(linkedInStateCookiePath),
    maxAge: 10 * 60 * 1000,
  });
  const authorizationUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", env.LINKEDIN_REDIRECT_URI);
  authorizationUrl.searchParams.set("scope", "openid profile email");
  authorizationUrl.searchParams.set("state", state);
  res.redirect(authorizationUrl.toString());
});

authRouter.get("/linkedin/callback", async (req, res) => {
  const { clientId, clientSecret } = linkedInCredentials();
  const stateCookie = readCookie(req, linkedInStateCookie);
  res.clearCookie(linkedInStateCookie, linkedInCookieOptions(linkedInStateCookiePath));
  if (typeof req.query.error === "string") {
    res.redirect(`${env.FRONTEND_URL}/login?linkedinError=cancelled`);
    return;
  }
  const state = req.query.state;
  const code = req.query.code;
  if (!stateCookie || typeof state !== "string" || typeof code !== "string" || stateCookie.length !== state.length) {
    throw unauthorized("LinkedIn sign-in could not be verified. Please try again.");
  }
  if (!timingSafeEqual(Buffer.from(stateCookie), Buffer.from(state))) {
    throw unauthorized("LinkedIn sign-in could not be verified. Please try again.");
  }

  const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: env.LINKEDIN_REDIRECT_URI,
    }),
  });
  if (!tokenResponse.ok) throw serviceUnavailable("LinkedIn could not complete sign-in. Please try again.");
  const tokenResult = linkedInTokenSchema.safeParse(await tokenResponse.json());
  if (!tokenResult.success) throw serviceUnavailable("LinkedIn returned an invalid sign-in response.");

  const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenResult.data.access_token}` },
  });
  if (!profileResponse.ok) throw serviceUnavailable("LinkedIn profile details could not be retrieved.");
  const profileResult = linkedInProfileSchema.safeParse(await profileResponse.json());
  if (!profileResult.success) throw unauthorized("LinkedIn did not provide a verified email and basic profile details.");

  const profile = profileResult.data;
  const user =
    (await prisma.user.findUnique({ where: { linkedinId: profile.sub }, select: { id: true } })) ??
    (await prisma.user.findUnique({ where: { email: profile.email }, select: { id: true } }));
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { linkedinId: profile.sub, lastActiveAt: new Date() },
    });
    const session = await sessionPayload(user.id);
    res.cookie(linkedInSessionCookie, session.accessToken, {
      ...linkedInCookieOptions(linkedInCookiePath),
      maxAge: 2 * 60 * 1000,
    });
    res.redirect(`${env.FRONTEND_URL}/auth/linkedin/callback`);
    return;
  }

  const onboardingTicket = jwt.sign(
    { kind: "linkedin-onboarding", profile },
    env.JWT_SECRET,
    { expiresIn: "10m" } as jwt.SignOptions,
  );
  res.cookie(linkedInPendingCookie, onboardingTicket, {
    ...linkedInCookieOptions(linkedInCookiePath),
    maxAge: 10 * 60 * 1000,
  });
  res.redirect(`${env.FRONTEND_URL}/register?linkedin=1`);
});

authRouter.get("/linkedin/pending", async (req, res) => {
  const profile = await linkedInOnboardingProfile(req);
  res.json({
    data: {
      email: profile.email,
      firstName: profile.given_name,
      lastName: profile.family_name,
      avatarUrl: profile.picture ?? null,
    },
  });
});

authRouter.post("/linkedin/register", async (req, res) => {
  const profile = await linkedInOnboardingProfile(req);
  const input = parse(linkedInRegisterSchema, req.body);
  const department = await prisma.department.findUnique({ where: { id: input.departmentId } });
  if (!department) throw badRequest("Unknown department");
  if (await prisma.user.findUnique({ where: { email: profile.email } })) {
    throw conflict("An account with this email already exists. Please sign in with LinkedIn.");
  }

  const programmeYears = department.slug.includes("engineering") ? 5 : department.slug === "mba" ? 2 : 4;
  const user = await prisma.user.create({
    data: {
      ...input,
      email: profile.email,
      linkedinId: profile.sub,
      passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 10),
      firstName: profile.given_name,
      lastName: profile.family_name,
      avatarUrl: profile.picture,
      lastActiveAt: new Date(),
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
        experiences: {
          create: {
            title: input.jobTitle,
            company: input.company,
            location: input.location,
            startDate: new Date(Date.UTC(currentYear, 0, 1)),
          },
        },
      }),
    },
  });
  await evaluateBadges(user.id);
  res.clearCookie(linkedInPendingCookie, linkedInCookieOptions(linkedInCookiePath));
  res.status(201).json({ data: await sessionPayload(user.id) });
});

authRouter.get("/linkedin/session", async (req, res) => {
  const token = readCookie(req, linkedInSessionCookie);
  if (!token) throw unauthorized("LinkedIn sign-in has expired. Please try again.");
  const userId = linkedInSessionUserId(token);
  const session = await sessionPayload(userId);
  res.clearCookie(linkedInSessionCookie, linkedInCookieOptions(linkedInCookiePath));
  res.json({ data: session });
});

authRouter.get("/me", authenticate, async (req, res) => {
  res.json({ data: await sessionPayload(currentUser(req).id) });
});

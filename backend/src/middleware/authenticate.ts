import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../generated/prisma/enums.js";
import { forbidden, unauthorized } from "../lib/http-error.js";
import { verifyAccessToken } from "../lib/jwt.js";

export interface AuthUser {
  id: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function readUser(req: Request): AuthUser | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;
  try {
    const payload = verifyAccessToken(header.slice("Bearer ".length));
    return { id: payload.sub, role: payload.role };
  } catch {
    throw unauthorized("Invalid or expired token");
  }
}

/** Requires a valid bearer token. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const user = readUser(req);
  if (!user) throw unauthorized();
  req.user = user;
  next();
}

/** Attaches the user when a token is present, but allows anonymous requests. */
export function authenticateOptional(req: Request, _res: Response, next: NextFunction) {
  req.user = readUser(req);
  next();
}

/** Use after `authenticate`. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) throw forbidden();
    next();
  };
}

/** Narrows req.user after `authenticate`. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

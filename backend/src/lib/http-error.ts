export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_FAILED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

const statusByCode: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

/** Thrown anywhere in a request; the error handler turns it into `{ error: { code, message, details } }`. */
export class HttpError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.status = statusByCode[code];
  }
}

export const badRequest = (message: string) => new HttpError("BAD_REQUEST", message);
export const unauthorized = (message = "Authentication required") => new HttpError("UNAUTHORIZED", message);
export const forbidden = (message = "You do not have permission to do this") => new HttpError("FORBIDDEN", message);
export const notFound = (resource: string) => new HttpError("NOT_FOUND", `${resource} not found`);
export const conflict = (message: string) => new HttpError("CONFLICT", message);
export const serviceUnavailable = (message: string) => new HttpError("SERVICE_UNAVAILABLE", message);

import { z } from "zod";
import { HttpError } from "./http-error.js";

/** Parses input with a zod schema or throws a 422 with field-level details. */
export function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new HttpError("VALIDATION_FAILED", "Request validation failed", result.error.flatten().fieldErrors);
  }
  return result.data;
}

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export function pageMeta(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

/** Query-string boolean: only "true" / "false" are accepted (z.coerce.boolean treats "false" as true). */
export const queryBooleanSchema = z.enum(["true", "false"]).transform((value) => value === "true");

/**
 * Profile and post images: an https URL, or a data URL from an image the browser has already
 * resized (the frontend keeps avatars ≈256px and banners ≈1500×375, so they stay well under 1 MB).
 */
export const imageUrlSchema = z
  .string()
  .max(1_000_000, "Image is too large")
  .refine((value) => /^https:\/\//.test(value) || /^data:image\/(png|jpeg|webp);base64,/.test(value), "Must be an https URL or an uploaded image");

import cors from "cors";
import express from "express";
import helmet from "helmet";
import { corsOrigins } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { availabilityRouter } from "./modules/availability/availability.routes.js";
import { awardsRouter } from "./modules/awards/awards.routes.js";
import { bookingsRouter } from "./modules/bookings/bookings.routes.js";
import { conversationsRouter } from "./modules/conversations/conversations.routes.js";
import { departmentsRouter } from "./modules/departments/departments.routes.js";
import { gamificationRouter } from "./modules/gamification/gamification.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import { postsRouter } from "./modules/posts/posts.routes.js";
import { profileRouter } from "./modules/profile/profile.routes.js";
import { spacesRouter } from "./modules/spaces/spaces.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(express.json({ limit: "3mb" }));

  app.get("/health", (_req, res) => {
    res.json({ data: { status: "ok" } });
  });

  const api = express.Router();
  api.use("/auth", authRouter);
  api.use("/departments", departmentsRouter);
  api.use("/users/me", profileRouter);
  api.use("/users", usersRouter);
  api.use("/bookings", bookingsRouter);
  api.use("/conversations", conversationsRouter);
  api.use("/posts", postsRouter);
  api.use("/spaces", spacesRouter);
  api.use("/awards", awardsRouter);
  api.use("/notifications", notificationsRouter);
  // Mounted at the root because they span resources: /users/:id/availability-slots, /availability-slots,
  // /leaderboard, /badges, /tiers, /users/:id/achievements
  api.use(availabilityRouter);
  api.use(gamificationRouter);

  app.use("/api/v1", api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

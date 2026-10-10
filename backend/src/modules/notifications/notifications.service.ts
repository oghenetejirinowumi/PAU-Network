import type { NotificationType } from "../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import { emitToUser } from "../../realtime/socket.js";

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  linkUrl?: string;
}

/** Stores a notification and pushes it live to the user's open tabs. */
export async function notify(input: NotifyInput) {
  const notification = await prisma.notification.create({ data: input });
  emitToUser(input.userId, "notification:created", notification);
  return notification;
}

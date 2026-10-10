import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { corsOrigins } from "../config/env.js";
import { verifyAccessToken } from "../lib/jwt.js";

/**
 * Socket.IO carries live updates only; every state change goes through the REST API,
 * whose services call emitToUser / emitToSpace.
 *
 * Event names: "<resource>:<action-in-past-tense>", e.g. "space:hand-raised".
 * Rooms:       "user:<userId>" (joined automatically), "space:<spaceId>" (joined on "space:subscribe").
 */
let io: Server | undefined;

export const SPACE_REACTION_EMOJIS = ["👏", "❤️", "🔥", "😂", "💡", "🙌", "🎉", "👍"] as const;

export function initSocketServer(httpServer: HttpServer) {
  io = new Server(httpServer, { cors: { origin: corsOrigins, credentials: true } });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("UNAUTHORIZED"));
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);

    socket.on("space:subscribe", (spaceId: string) => socket.join(`space:${spaceId}`));
    socket.on("space:unsubscribe", (spaceId: string) => socket.leave(`space:${spaceId}`));

    // Emoji reactions are ephemeral: broadcast only, never stored.
    socket.on("space:react", (payload: { spaceId: string; emoji: string }) => {
      if (!socket.rooms.has(`space:${payload.spaceId}`)) return;
      if (!SPACE_REACTION_EMOJIS.includes(payload.emoji as (typeof SPACE_REACTION_EMOJIS)[number])) return;
      io?.to(`space:${payload.spaceId}`).emit("space:reacted", { userId, emoji: payload.emoji, sentAt: new Date() });
    });
  });

  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function emitToSpace(spaceId: string, event: string, payload: unknown) {
  io?.to(`space:${spaceId}`).emit(event, payload);
}

import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { ReactionType } from "../../generated/prisma/enums.js";
import { badRequest, forbidden, notFound } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { userSummarySelect } from "../../lib/user-select.js";
import { imageUrlSchema, parse, queryBooleanSchema, uuidSchema } from "../../lib/validation.js";
import { authenticate, authenticateOptional, currentUser, requireRole } from "../../middleware/authenticate.js";
import { awardPoints } from "../gamification/gamification.service.js";
import { notify } from "../notifications/notifications.service.js";

/**
 * Timeline rules:
 *   - Only ALUMNI can create posts.
 *   - Everyone (students and alumni) can comment and react.
 *   - One reaction per user per post/comment; reacting again with another type replaces it.
 */
export const postsRouter = Router();

export const REACTION_EMOJI: Record<ReactionType, string> = {
  LIKE: "👍",
  LOVE: "❤️",
  CELEBRATE: "🎉",
  INSIGHTFUL: "💡",
  FUNNY: "😂",
  SUPPORT: "🤝",
};

const reactionTypeSchema = z.nativeEnum(ReactionType);

async function reactionSummary(where: Prisma.ReactionWhereInput, viewerId?: string) {
  const [grouped, mine] = await Promise.all([
    prisma.reaction.groupBy({ by: ["type"], where, _count: { _all: true } }),
    viewerId ? prisma.reaction.findFirst({ where: { ...where, userId: viewerId }, select: { type: true } }) : null,
  ]);
  return {
    counts: Object.fromEntries(grouped.map((row) => [row.type, row._count._all])) as Partial<Record<ReactionType, number>>,
    viewerReaction: mine?.type ?? null,
  };
}

/** GET /posts?authorId=&departmentId=&isFollowing=true&cursor=<ISO date> — newest first, 20 per page. */
postsRouter.get("/", authenticateOptional, async (req, res) => {
  const query = parse(
    z.object({
      authorId: uuidSchema.optional(),
      departmentId: uuidSchema.optional(),
      isFollowing: queryBooleanSchema.optional(),
      cursor: z.coerce.date().optional(),
    }),
    req.query,
  );
  if (query.isFollowing && !req.user) throw badRequest("Log in to see posts from people you follow");

  const pageSize = 20;
  const posts = await prisma.post.findMany({
    where: {
      authorId: query.authorId,
      createdAt: query.cursor ? { lt: query.cursor } : undefined,
      author: {
        departmentId: query.departmentId,
        ...(query.isFollowing && { followers: { some: { followerId: req.user!.id } } }),
      },
    },
    orderBy: { createdAt: "desc" },
    take: pageSize + 1,
    include: { author: { select: { ...userSummarySelect, department: { select: { id: true, name: true } } } } },
  });
  const page = posts.slice(0, pageSize);

  const viewerReactions = req.user
    ? await prisma.reaction.findMany({ where: { userId: req.user.id, postId: { in: page.map((post) => post.id) } }, select: { postId: true, type: true } })
    : [];
  const viewerReactionByPost = new Map(viewerReactions.map((reaction) => [reaction.postId, reaction.type]));
  const topReactions = await prisma.reaction.groupBy({
    by: ["postId", "type"],
    where: { postId: { in: page.map((post) => post.id) } },
    _count: { _all: true },
  });

  res.json({
    data: page.map((post) => ({
      ...post,
      reactionCounts: Object.fromEntries(topReactions.filter((row) => row.postId === post.id).map((row) => [row.type, row._count._all])),
      viewerReaction: viewerReactionByPost.get(post.id) ?? null,
    })),
    meta: { nextCursor: posts.length > pageSize ? page[page.length - 1].createdAt : null },
  });
});

/** POST /posts — alumni only. */
postsRouter.post("/", authenticate, requireRole("ALUMNI"), async (req, res) => {
  const me = currentUser(req);
  const input = parse(z.object({ body: z.string().trim().min(1).max(3000), imageUrl: imageUrlSchema.optional() }), req.body);
  const post = await prisma.post.create({
    data: { ...input, authorId: me.id },
    include: { author: { select: userSummarySelect } },
  });
  await awardPoints(me.id, "POST_CREATED", { referenceId: post.id });
  res.status(201).json({ data: { ...post, reactionCounts: {}, viewerReaction: null } });
});

/** GET /posts/:postId */
postsRouter.get("/:postId", authenticateOptional, async (req, res) => {
  const postId = parse(uuidSchema, req.params.postId);
  const post = await prisma.post.findUnique({ where: { id: postId }, include: { author: { select: userSummarySelect } } });
  if (!post) throw notFound("Post");
  const summary = await reactionSummary({ postId }, req.user?.id);
  res.json({ data: { ...post, reactionCounts: summary.counts, viewerReaction: summary.viewerReaction } });
});

/** PATCH /posts/:postId — author only. */
postsRouter.patch("/:postId", authenticate, async (req, res) => {
  const me = currentUser(req);
  const postId = parse(uuidSchema, req.params.postId);
  const input = parse(z.object({ body: z.string().trim().min(1).max(3000), imageUrl: imageUrlSchema.nullable() }).partial(), req.body);
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw notFound("Post");
  if (post.authorId !== me.id) throw forbidden();
  res.json({ data: await prisma.post.update({ where: { id: postId }, data: input }) });
});

/** DELETE /posts/:postId — author or admin. */
postsRouter.delete("/:postId", authenticate, async (req, res) => {
  const me = currentUser(req);
  const postId = parse(uuidSchema, req.params.postId);
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw notFound("Post");
  if (post.authorId !== me.id && me.role !== "ADMIN") throw forbidden();
  await prisma.post.delete({ where: { id: postId } });
  res.status(204).end();
});

// ───── Comments ─────

/** GET /posts/:postId/comments — top-level comments with their replies, oldest first. */
postsRouter.get("/:postId/comments", authenticateOptional, async (req, res) => {
  const postId = parse(uuidSchema, req.params.postId);
  const comments = await prisma.comment.findMany({
    where: { postId, parentId: null },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: userSummarySelect },
      replies: { orderBy: { createdAt: "asc" }, include: { author: { select: userSummarySelect } } },
    },
  });
  const allIds = comments.flatMap((comment) => [comment.id, ...comment.replies.map((reply) => reply.id)]);
  const viewerReactions = req.user
    ? await prisma.reaction.findMany({ where: { userId: req.user.id, commentId: { in: allIds } }, select: { commentId: true, type: true } })
    : [];
  const viewerReactionByComment = new Map(viewerReactions.map((reaction) => [reaction.commentId, reaction.type]));
  const withViewer = <T extends { id: string }>(comment: T) => ({ ...comment, viewerReaction: viewerReactionByComment.get(comment.id) ?? null });

  res.json({ data: comments.map((comment) => ({ ...withViewer(comment), replies: comment.replies.map(withViewer) })) });
});

/** POST /posts/:postId/comments — students and alumni. */
postsRouter.post("/:postId/comments", authenticate, async (req, res) => {
  const me = currentUser(req);
  const postId = parse(uuidSchema, req.params.postId);
  const input = parse(z.object({ body: z.string().trim().min(1).max(1000), parentId: uuidSchema.optional() }), req.body);

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true } });
  if (!post) throw notFound("Post");
  if (input.parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: input.parentId }, select: { postId: true, parentId: true } });
    if (!parent || parent.postId !== postId) throw badRequest("Parent comment is not on this post");
    if (parent.parentId) throw badRequest("Replies can only be one level deep");
  }

  const [comment] = await prisma.$transaction([
    prisma.comment.create({ data: { postId, authorId: me.id, body: input.body, parentId: input.parentId }, include: { author: { select: userSummarySelect } } }),
    prisma.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } }),
  ]);

  await awardPoints(me.id, "COMMENT_CREATED", { referenceId: comment.id });
  if (post.authorId !== me.id) {
    await notify({
      userId: post.authorId,
      type: "POST_COMMENTED",
      title: `${comment.author.firstName} ${comment.author.lastName} commented on your post`,
      body: input.body.slice(0, 140),
      linkUrl: `/posts/${postId}`,
    });
  }
  res.status(201).json({ data: { ...comment, replies: [], viewerReaction: null } });
});

/** DELETE /posts/:postId/comments/:commentId — comment author, post author, or admin. */
postsRouter.delete("/:postId/comments/:commentId", authenticate, async (req, res) => {
  const me = currentUser(req);
  const commentId = parse(uuidSchema, req.params.commentId);
  const comment = await prisma.comment.findUnique({ where: { id: commentId }, include: { post: { select: { authorId: true } }, _count: { select: { replies: true } } } });
  if (!comment || comment.postId !== req.params.postId) throw notFound("Comment");
  if (comment.authorId !== me.id && comment.post.authorId !== me.id && me.role !== "ADMIN") throw forbidden();
  await prisma.$transaction([
    prisma.comment.delete({ where: { id: commentId } }),
    prisma.post.update({ where: { id: comment.postId }, data: { commentCount: { decrement: 1 + comment._count.replies } } }),
  ]);
  res.status(204).end();
});

// ───── Reactions ─────

/** PUT /posts/:postId/reactions — body { type: "LIKE" | "LOVE" | ... }; replaces any previous reaction. */
postsRouter.put("/:postId/reactions", authenticate, async (req, res) => {
  const me = currentUser(req);
  const postId = parse(uuidSchema, req.params.postId);
  const { type } = parse(z.object({ type: reactionTypeSchema }), req.body);
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
  if (!post) throw notFound("Post");

  const existing = await prisma.reaction.findUnique({ where: { userId_postId: { userId: me.id, postId } } });
  if (existing) {
    await prisma.reaction.update({ where: { id: existing.id }, data: { type } });
  } else {
    await prisma.$transaction([
      prisma.reaction.create({ data: { userId: me.id, postId, type } }),
      prisma.post.update({ where: { id: postId }, data: { reactionCount: { increment: 1 } } }),
    ]);
    if (post.authorId !== me.id) {
      await awardPoints(post.authorId, "REACTION_RECEIVED");
      await notify({ userId: post.authorId, type: "POST_REACTED", title: `Someone reacted ${REACTION_EMOJI[type]} to your post`, linkUrl: `/posts/${postId}` });
    }
  }
  const summary = await reactionSummary({ postId }, me.id);
  res.json({ data: { reactionCounts: summary.counts, viewerReaction: summary.viewerReaction } });
});

/** DELETE /posts/:postId/reactions */
postsRouter.delete("/:postId/reactions", authenticate, async (req, res) => {
  const me = currentUser(req);
  const postId = parse(uuidSchema, req.params.postId);
  const deleted = await prisma.reaction.deleteMany({ where: { userId: me.id, postId } });
  if (deleted.count > 0) await prisma.post.update({ where: { id: postId }, data: { reactionCount: { decrement: 1 } } });
  const summary = await reactionSummary({ postId }, me.id);
  res.json({ data: { reactionCounts: summary.counts, viewerReaction: summary.viewerReaction } });
});

/** PUT /posts/:postId/comments/:commentId/reactions */
postsRouter.put("/:postId/comments/:commentId/reactions", authenticate, async (req, res) => {
  const me = currentUser(req);
  const commentId = parse(uuidSchema, req.params.commentId);
  const { type } = parse(z.object({ type: reactionTypeSchema }), req.body);
  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { id: true } });
  if (!comment) throw notFound("Comment");

  const existing = await prisma.reaction.findUnique({ where: { userId_commentId: { userId: me.id, commentId } } });
  if (existing) {
    await prisma.reaction.update({ where: { id: existing.id }, data: { type } });
  } else {
    await prisma.$transaction([
      prisma.reaction.create({ data: { userId: me.id, commentId, type } }),
      prisma.comment.update({ where: { id: commentId }, data: { reactionCount: { increment: 1 } } }),
    ]);
  }
  const summary = await reactionSummary({ commentId }, me.id);
  res.json({ data: { reactionCounts: summary.counts, viewerReaction: summary.viewerReaction } });
});

/** DELETE /posts/:postId/comments/:commentId/reactions */
postsRouter.delete("/:postId/comments/:commentId/reactions", authenticate, async (req, res) => {
  const me = currentUser(req);
  const commentId = parse(uuidSchema, req.params.commentId);
  const deleted = await prisma.reaction.deleteMany({ where: { userId: me.id, commentId } });
  if (deleted.count > 0) await prisma.comment.update({ where: { id: commentId }, data: { reactionCount: { decrement: 1 } } });
  const summary = await reactionSummary({ commentId }, me.id);
  res.json({ data: { reactionCounts: summary.counts, viewerReaction: summary.viewerReaction } });
});

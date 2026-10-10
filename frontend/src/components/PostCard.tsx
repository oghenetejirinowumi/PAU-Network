"use client";

import { useState } from "react";
import { MessageCircle, MoreHorizontal, Send, Trash2 } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { fullName, REACTIONS, reactionEmoji, timeAgo } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Comment, Post, ReactionCounts, ReactionType } from "@/lib/types";
import { EmojiPicker } from "./EmojiPicker";
import { useToast } from "./Toast";
import { Avatar, Button, RoleBadge, Spinner, TierBadge, UserLine } from "./ui";

/** LinkedIn-style reaction button: click = Like / remove, hover = pick an emoji reaction. */
function ReactionButton({ viewerReaction, onReact }: { viewerReaction: ReactionType | null; onReact: (type: ReactionType | null) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const current = REACTIONS.find((reaction) => reaction.type === viewerReaction);
  return (
    <div className="relative flex items-center" onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
      {isOpen && (
        <div className="absolute bottom-full left-0 z-20 pb-2">
          <div role="menu" aria-label="Reactions" className="flex gap-1 rounded-full border border-line bg-surface px-2 py-1 shadow-lg">
            {REACTIONS.map((reaction) => (
              <button
                key={reaction.type}
                title={reaction.label}
                aria-label={reaction.label}
                role="menuitem"
                onClick={() => {
                  onReact(reaction.type);
                  setIsOpen(false);
                }}
                className="tap-target text-2xl transition hover:-translate-y-1 hover:scale-125"
              >
                {reaction.emoji}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => onReact(viewerReaction ? null : "LIKE")}
        className={`flex items-center gap-1.5 rounded-control px-3 py-2 text-sm font-semibold transition hover:bg-surface-muted ${current ? "text-primary" : "text-muted"}`}
      >
        <span className="text-base">{current ? current.emoji : "👍"}</span>
        {current ? current.label : "React"}
      </button>
      <button
        onClick={() => setIsOpen((value) => !value)}
        className="hidden rounded-control px-2 text-muted coarse:inline-flex coarse:min-h-11 coarse:items-center"
        aria-label="Choose a reaction"
        aria-expanded={isOpen}
      >
        ▾
      </button>
    </div>
  );
}

function ReactionSummary({ counts }: { counts: ReactionCounts }) {
  const entries = (Object.entries(counts) as [ReactionType, number][]).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-muted">
      <span className="flex -space-x-1">
        {entries.slice(0, 3).map(([type]) => (
          <span key={type} className="flex size-5 items-center justify-center rounded-full border border-surface bg-surface-muted text-[11px]">
            {reactionEmoji(type)}
          </span>
        ))}
      </span>
      {total}
    </span>
  );
}

function CommentComposer({ postId, parentId, onCreated, autoFocus }: { postId: string; parentId?: string; onCreated: (comment: Comment) => void; autoFocus?: boolean }) {
  const { user } = useSession();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  if (!user) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    setIsSending(true);
    try {
      const { data } = await api.post<Comment>(`/posts/${postId}/comments`, { body, parentId });
      onCreated(data);
      setBody("");
    } catch (caught) {
      toast(errorMessage(caught), "error");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <Avatar user={user} size={parentId ? 28 : 32} />
      <div className="flex flex-1 items-center rounded-full border border-line bg-surface pl-3 pr-1 focus-within:border-primary">
        <input
          autoFocus={autoFocus}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={parentId ? "Write a reply…" : "Add a comment…"}
          aria-label={parentId ? "Reply" : "Comment"} className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none sm:text-sm"
          maxLength={1000}
        />
        <EmojiPicker align="right" onPick={(emoji) => setBody((current) => current + emoji)} />
        <button type="submit" disabled={!body.trim() || isSending} className="tap-target rounded-full p-1.5 text-primary disabled:text-muted" aria-label="Send">
          <Send className="size-4" />
        </button>
      </div>
    </form>
  );
}

function CommentItem({ comment, postId, onReply, isReply }: { comment: Comment; postId: string; onReply?: (comment: Comment) => void; isReply?: boolean }) {
  const [viewerReaction, setViewerReaction] = useState(comment.viewerReaction);
  const [isReplying, setIsReplying] = useState(false);

  const react = async () => {
    const next = viewerReaction ? null : ("LOVE" as const);
    setViewerReaction(next);
    if (next) await api.put(`/posts/${postId}/comments/${comment.id}/reactions`, { type: next }).catch(() => setViewerReaction(null));
    else await api.delete(`/posts/${postId}/comments/${comment.id}/reactions`).catch(() => {});
  };

  return (
    <div className="flex gap-2">
      <Avatar user={comment.author} size={isReply ? 28 : 32} />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-surface-muted px-3 py-2">
          <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            {fullName(comment.author)} <RoleBadge role={comment.author.role} />
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm">{comment.body}</p>
        </div>
        <div className="mt-1 flex items-center gap-3 px-2 text-xs text-muted">
          <span>{timeAgo(comment.createdAt)}</span>
          <button onClick={react} className={`font-semibold hover:text-primary ${viewerReaction ? "text-danger" : ""}`}>
            {viewerReaction ? "❤️ Loved" : "Love"}
          </button>
          {!isReply && onReply && (
            <button onClick={() => setIsReplying((value) => !value)} className="font-semibold hover:text-primary">
              Reply
            </button>
          )}
        </div>
        {comment.replies?.length > 0 && (
          <div className="mt-2 space-y-2">
            {comment.replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} postId={postId} isReply />
            ))}
          </div>
        )}
        {isReplying && onReply && (
          <div className="mt-2">
            <CommentComposer
              postId={postId}
              parentId={comment.id}
              autoFocus
              onCreated={(reply) => {
                onReply(reply);
                setIsReplying(false);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function PostCard({ post: initialPost, onDeleted }: { post: Post; onDeleted?: (postId: string) => void }) {
  const { user } = useSession();
  const toast = useToast();
  const [post, setPost] = useState(initialPost);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isLong = post.body.length > 320;
  const [isExpanded, setIsExpanded] = useState(!isLong);

  const react = async (type: ReactionType | null) => {
    try {
      const { data } = type
        ? await api.put<{ reactionCounts: ReactionCounts; viewerReaction: ReactionType | null }>(`/posts/${post.id}/reactions`, { type })
        : await api.delete<{ reactionCounts: ReactionCounts; viewerReaction: ReactionType | null }>(`/posts/${post.id}/reactions`);
      setPost((current) => ({ ...current, ...data }));
    } catch (caught) {
      toast(errorMessage(caught), "error");
    }
  };

  const toggleComments = async () => {
    setIsCommentsOpen((value) => !value);
    if (!comments) {
      const { data } = await api.get<Comment[]>(`/posts/${post.id}/comments`);
      setComments(data);
    }
  };

  const remove = async () => {
    await api.delete(`/posts/${post.id}`);
    toast("Post deleted");
    onDeleted?.(post.id);
  };

  return (
    <article className="@container rounded-card border border-line bg-surface">
      <div className="flex items-start justify-between gap-3 p-4 pb-2">
        <UserLine user={post.author} size={48} subtitle={<>{post.author.jobTitle && post.author.company ? `${post.author.jobTitle} at ${post.author.company}` : post.author.headline} · {timeAgo(post.createdAt)}</>} />
        <div className="flex shrink-0 items-center gap-1">
          <span className="hidden @sm:inline-flex">
            <TierBadge tier={post.author.tier} />
          </span>
          {user?.id === post.author.id && (
            <div className="relative">
              <button onClick={() => setIsMenuOpen((value) => !value)} className="tap-target rounded-full p-1 text-muted hover:bg-surface-muted" aria-label="Post options" aria-expanded={isMenuOpen}>
                <MoreHorizontal className="size-5" />
              </button>
              {isMenuOpen && (
                <button onClick={remove} className="absolute right-0 top-8 z-10 flex items-center gap-2 whitespace-nowrap rounded-control border border-line bg-surface px-3 py-2 text-sm text-danger shadow-lg">
                  <Trash2 className="size-4" /> Delete post
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-3">
        <p className={`whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed ${isExpanded ? "" : "line-clamp-4"}`}>{post.body}</p>
        {isLong && !isExpanded && (
          <button onClick={() => setIsExpanded(true)} className="mt-1 text-sm font-semibold text-muted hover:text-primary">
            …see more
          </button>
        )}
      </div>
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt="" loading="lazy" decoding="async" width={1200} height={675} className="aspect-video max-h-[30rem] w-full border-y border-line object-cover" />
      )}

      <div className="flex items-center justify-between px-4 py-2">
        <ReactionSummary counts={post.reactionCounts} />
        {post.commentCount > 0 && (
          <button onClick={toggleComments} className="text-xs text-muted hover:text-primary hover:underline">
            {post.commentCount} comment{post.commentCount === 1 ? "" : "s"}
          </button>
        )}
      </div>

      <div className="flex border-t border-line px-2 py-1">
        <ReactionButton viewerReaction={post.viewerReaction} onReact={react} />
        <button onClick={toggleComments} className="flex items-center gap-1.5 rounded-control px-3 py-2 text-sm font-semibold text-muted hover:bg-surface-muted">
          <MessageCircle className="size-4" /> Comment
        </button>
      </div>

      {isCommentsOpen && (
        <div className="space-y-3 border-t border-line p-4">
          <CommentComposer
            postId={post.id}
            onCreated={(comment) => {
              setComments((current) => [...(current ?? []), comment]);
              setPost((current) => ({ ...current, commentCount: current.commentCount + 1 }));
            }}
          />
          {!comments ? (
            <Spinner />
          ) : (
            comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                postId={post.id}
                onReply={(reply) => {
                  setComments((current) => current?.map((item) => (item.id === comment.id ? { ...item, replies: [...item.replies, reply] } : item)) ?? null);
                  setPost((current) => ({ ...current, commentCount: current.commentCount + 1 }));
                }}
              />
            ))
          )}
        </div>
      )}
    </article>
  );
}

export function PostComposer({ onCreated }: { onCreated: (post: Post) => void }) {
  const { user } = useSession();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  if (!user) return null;

  const attach = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const { resizeImage, POST_IMAGE_SIZE } = await import("@/lib/image");
    setImageUrl(await resizeImage(file, POST_IMAGE_SIZE.width, POST_IMAGE_SIZE.height));
  };

  const submit = async () => {
    setIsPosting(true);
    try {
      const { data } = await api.post<Post>("/posts", { body, imageUrl: imageUrl ?? undefined });
      onCreated(data);
      setBody("");
      setImageUrl(null);
      toast("🎉 Posted! +10 points");
    } catch (caught) {
      toast(errorMessage(caught), "error");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="flex gap-3">
        <span className="hidden shrink-0 min-[400px]:block">
          <Avatar user={user} size={48} />
        </span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={`Share advice, an opportunity or a win with PAU students, ${user.firstName}…`}
          rows={body ? 4 : 2}
          maxLength={3000}
          aria-label="Write a post" className="min-w-0 flex-1 resize-none rounded-control border border-line bg-surface px-3 py-2 text-base outline-none focus:border-primary sm:text-sm"
        />
      </div>
      {imageUrl && (
        <div className="relative mt-3 sm:ml-[3.75rem]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="max-h-60 rounded-control object-cover" />
          <button onClick={() => setImageUrl(null)} className="absolute right-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-xs text-on-primary">
            Remove
          </button>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between sm:ml-[3.75rem]">
        <div className="flex items-center gap-1">
          <EmojiPicker onPick={(emoji) => setBody((current) => current + emoji)} />
          <label className="tap-target cursor-pointer rounded-full p-1.5 text-muted hover:bg-surface-muted hover:text-primary" title="Add a photo">
            <span className="text-lg leading-none">🖼️</span>
            <input type="file" accept="image/*" className="hidden" onChange={attach} />
          </label>
        </div>
        <Button size="sm" onClick={submit} disabled={!body.trim()} isLoading={isPosting}>
          Post
        </Button>
      </div>
    </div>
  );
}

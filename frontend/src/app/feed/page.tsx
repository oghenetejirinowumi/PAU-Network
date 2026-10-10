"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Radio, Trophy } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PostCard, PostComposer } from "@/components/PostCard";
import { Avatar, Button, Card, EmptyState, Spinner, StatusPill, TierBadge, UserLine } from "@/components/ui";
import { api } from "@/lib/api";
import { formatMonthLong, formatSlot, fullName, studentLevelLabel, TIER_CLASSES } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Achievements, Award, DirectoryUser, Post, Space } from "@/lib/types";

type FeedFilter = "ALL" | "FOLLOWING" | "DEPARTMENT";

function ProfileSummary() {
  const { user } = useSession();
  const [achievements, setAchievements] = useState<Achievements | null>(null);
  useEffect(() => {
    if (user) api.get<Achievements>(`/users/${user.id}/achievements`).then(({ data }) => setAchievements(data)).catch(() => {});
  }, [user]);
  if (!user) return null;
  const progress = achievements?.nextTier ? 100 - (achievements.nextTier.pointsNeeded / achievements.nextTier.minPoints) * 100 : 100;

  return (
    <Card className="overflow-hidden">
      {user.bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.bannerUrl} alt="" loading="lazy" decoding="async" className="aspect-[4/1] w-full object-cover" />
      ) : (
        <div className="banner-default h-16" />
      )}
      <div className="-mt-8 px-4 pb-4 text-center">
        <Link href={`/profile/${user.id}`} className="inline-block">
          <Avatar user={user} size={64} className="border-4 border-surface" />
        </Link>
        <p className="mt-1 font-bold">{fullName(user)}</p>
        <p className="text-xs text-muted">
          {user.role === "ALUMNI" ? `${user.jobTitle} at ${user.company}` : `${studentLevelLabel(user.studentLevel)} ${user.department.name}`}
        </p>
        <div className="mt-3 border-t border-line pt-3 text-left">
          <div className="flex items-center justify-between text-xs">
            <TierBadge tier={user.tier} />
            <span className="font-semibold">{user.points.toLocaleString()} pts</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <div className={`h-full ${TIER_CLASSES[achievements?.nextTier?.tier ?? user.tier].bg}`} style={{ width: `${Math.max(4, progress)}%` }} />
          </div>
          {achievements && (
            <p className="mt-1 text-[11px] text-muted">
              {achievements.nextTier ? `${achievements.nextTier.pointsNeeded.toLocaleString()} pts to ${achievements.nextTier.tier.toLowerCase()}` : "Top tier reached 👑"}
            </p>
          )}
          {achievements && achievements.badges.length > 0 && (
            <Link href="/achievements" className="mt-2 flex flex-wrap gap-1">
              {achievements.badges.slice(0, 8).map((badge) => (
                <span key={badge.id} title={badge.name} className="text-lg">
                  {badge.icon}
                </span>
              ))}
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}

function Sidebar() {
  const { user } = useSession();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [award, setAward] = useState<Award | null>(null);
  const [suggested, setSuggested] = useState<DirectoryUser[]>([]);

  useEffect(() => {
    api.get<Space[]>("/spaces").then(({ data }) => setSpaces(data.slice(0, 4))).catch(() => {});
    api.get<Award[]>("/awards/current").then(({ data }) => setAward(data.find((item) => item.type === "ALUMNI_OF_THE_MONTH") ?? null)).catch(() => {});
    if (user) api.get<DirectoryUser[]>("/users", { departmentId: user.department.id, pageSize: 3 }).then(({ data }) => setSuggested(data.filter((item) => item.id !== user.id))).catch(() => {});
  }, [user]);

  return (
    <div className="space-y-4">
      {award && (
        <Link href="/awards" className="relative block overflow-hidden rounded-card bg-primary p-4 text-on-primary">
          <p className="eyebrow !text-accent">🏆 Alumni of the Month</p>
          <div className="mt-3 flex items-center gap-3">
            <Avatar user={award.recipient} size={44} />
            <div>
              <p className="font-bold">{fullName(award.recipient)}</p>
              <p className="text-xs opacity-80">{formatMonthLong(award.periodStart)}</p>
            </div>
          </div>
          <Trophy className="absolute -bottom-4 -right-4 size-20 text-accent opacity-20" />
        </Link>
      )}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-bold">
            <Radio className="size-4 text-live" /> Spaces
          </p>
          <Link href="/spaces" className="text-xs font-semibold text-primary hover:underline">
            See all
          </Link>
        </div>
        <div className="space-y-3">
          {spaces.map((space) => (
            <Link key={space.id} href={`/spaces/${space.id}`} className="block">
              <div className="flex items-center gap-2">
                <StatusPill status={space.status} />
                <span className="truncate text-xs text-muted">{space.status === "LIVE" ? `${space.participantCount} in the room` : formatSlot(space.scheduledStartAt)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm font-semibold hover:underline">{space.title}</p>
              <p className="text-xs text-muted">with {fullName(space.host)}</p>
            </Link>
          ))}
        </div>
      </Card>
      {suggested.length > 0 && (
        <Card className="p-4">
          <p className="mb-3 text-sm font-bold">From {user?.department.name}</p>
          <div className="space-y-3">
            {suggested.map((alumnus) => (
              <UserLine key={alumnus.id} user={alumnus} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export default function FeedPage() {
  const { user } = useSession();
  const [filter, setFilter] = useState<FeedFilter>("ALL");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const load = useCallback(
    async (cursor?: string) => {
      if (!user) return;
      const query = { cursor, isFollowing: filter === "FOLLOWING" ? "true" : undefined, departmentId: filter === "DEPARTMENT" ? user.department.id : undefined };
      const { data, meta } = await api.get<Post[], { nextCursor: string | null }>("/posts", query);
      setPosts((current) => (cursor ? [...(current ?? []), ...data] : data));
      setNextCursor(meta.nextCursor);
    },
    [filter, user],
  );

  useEffect(() => {
    setPosts(null);
    load().catch(() => setPosts([]));
  }, [load]);

  return (
    <AppShell wide>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_17rem] md:gap-6 lg:grid-cols-[15rem_minmax(0,1fr)_18.75rem]">
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <ProfileSummary />
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          {user?.role === "ALUMNI" ? (
            <PostComposer onCreated={(post) => setPosts((current) => [post, ...(current ?? [])])} />
          ) : (
            <Card className="flex items-center gap-3 p-4 text-sm">
              <span className="text-2xl">💬</span>
              <p className="text-muted">
                Alumni share advice and opportunities here. <span className="font-semibold text-ink">Comment and react</span> to join the conversation.
              </p>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["ALL", "All posts"],
                ["FOLLOWING", "Following"],
                ["DEPARTMENT", user?.department.name ?? "My course"],
              ] as [FeedFilter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`max-w-full truncate rounded-full border px-3 py-1.5 text-xs font-semibold transition coarse:py-2.5 ${filter === value ? "border-primary bg-primary text-on-primary" : "border-line bg-surface text-muted hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {!posts ? (
            <Spinner />
          ) : posts.length === 0 ? (
            <EmptyState icon="📝" title="No posts here yet" description="Follow alumni from your course to fill this feed." />
          ) : (
            <>
              {posts.map((post) => (
                <PostCard key={post.id} post={post} onDeleted={(postId) => setPosts((current) => current?.filter((item) => item.id !== postId) ?? null)} />
              ))}
              {nextCursor && (
                <Button
                  variant="secondary"
                  className="w-full"
                  isLoading={isLoadingMore}
                  onClick={async () => {
                    setIsLoadingMore(true);
                    await load(nextCursor);
                    setIsLoadingMore(false);
                  }}
                >
                  Load more
                </Button>
              )}
            </>
          )}
        </div>

        <aside className="hidden md:block">
          <div className="sticky top-20">
            <Sidebar />
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

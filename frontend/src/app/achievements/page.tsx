"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar, Card, PageHeader, Spinner, TierBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { ACTIVITY_LABEL, fullName, TIER_CLASSES, TIER_LABEL, timeAgo } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Achievements, Badge, LeaderboardRow, Tier } from "@/lib/types";
import Link from "next/link";

const TIERS: { tier: Tier; minPoints: number }[] = [
  { tier: "BRONZE", minPoints: 0 },
  { tier: "SILVER", minPoints: 500 },
  { tier: "GOLD", minPoints: 2000 },
  { tier: "PLATINUM", minPoints: 5000 },
];

const HOW_TO_EARN: Record<"ALUMNI" | "STUDENT", [string, string][]> = {
  ALUMNI: [
    ["Complete a mentorship session", "+50"],
    ["Host a space", "+40"],
    ["Receive a 5-star rating", "+15"],
    ["Publish a post (3/day)", "+10"],
    ["Answer a question in your space", "+5"],
    ["Accept a message request", "+5"],
    ["Reaction on your post (25/day)", "+1"],
    ["Alumni of the Month", "+200"],
  ],
  STUDENT: [
    ["Attend a mentorship session", "+20"],
    ["Join a live space (3/day)", "+10"],
    ["Rate a session", "+5"],
    ["Ask a question in a space", "+3"],
    ["Comment on a post (10/day)", "+2"],
    ["Complete your profile", "+25"],
    ["Student of the Month", "+100"],
  ],
};

export default function AchievementsPage() {
  const { user } = useSession();
  const [achievements, setAchievements] = useState<Achievements | null>(null);
  const [catalogue, setCatalogue] = useState<Badge[]>([]);
  const [period, setPeriod] = useState<"MONTH" | "YEAR" | "ALL_TIME">("MONTH");
  const [role, setRole] = useState<"ALUMNI" | "STUDENT">("ALUMNI");
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[] | null>(null);

  useEffect(() => {
    if (!user) return;
    setRole(user.role === "STUDENT" ? "STUDENT" : "ALUMNI");
    api.get<Achievements>(`/users/${user.id}/achievements`).then(({ data }) => setAchievements(data)).catch(() => {});
    api.get<Badge[]>("/badges").then(({ data }) => setCatalogue(data)).catch(() => {});
  }, [user]);

  useEffect(() => {
    setLeaderboard(null);
    api.get<LeaderboardRow[]>("/leaderboard", { role, period, limit: 10 }).then(({ data }) => setLeaderboard(data)).catch(() => setLeaderboard([]));
  }, [role, period]);

  if (!user || !achievements) return <AppShell><Spinner /></AppShell>;

  const earned = new Set(achievements.badges.map((badge) => badge.code));
  const relevantBadges = catalogue.filter((badge) => !badge.role || badge.role === user.role);
  const currentIndex = TIERS.findIndex((item) => item.tier === achievements.tier);
  const next = TIERS[currentIndex + 1];
  const progress = next ? ((achievements.points - TIERS[currentIndex].minPoints) / (next.minPoints - TIERS[currentIndex].minPoints)) * 100 : 100;

  return (
    <AppShell wide>
      <PageHeader eyebrow="Achievements" title="Points, tiers and badges" description="Earn points for helping and learning. Climb from Bronze to Platinum and collect badges along the way." />

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          <Card className="overflow-hidden">
            <div className="bg-primary p-6 text-on-primary">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="eyebrow !text-accent">Your tier</p>
                  <p className="mt-1 text-4xl font-black">{TIER_LABEL[achievements.tier]}</p>
                  <p className="text-sm opacity-80">{achievements.points.toLocaleString()} lifetime points</p>
                </div>
                <div className="text-6xl">{{ BRONZE: "🥉", SILVER: "🥈", GOLD: "🥇", PLATINUM: "💎" }[achievements.tier]}</div>
              </div>
              <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-on-primary/20">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(3, Math.min(100, progress))}%` }} />
              </div>
              <p className="mt-2 text-xs opacity-80">{next ? `${(next.minPoints - achievements.points).toLocaleString()} points to ${TIER_LABEL[next.tier]}` : "You've reached the top tier 👑"}</p>
            </div>
            <div className="grid grid-cols-4 divide-x divide-line">
              {TIERS.map((item) => (
                <div key={item.tier} className={`p-3 text-center ${item.tier === achievements.tier ? "bg-primary-soft" : ""}`}>
                  <p className={`text-sm font-bold ${TIER_CLASSES[item.tier].text}`}>{TIER_LABEL[item.tier]}</p>
                  <p className="text-[11px] text-muted">{item.minPoints.toLocaleString()}+ pts</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <p className="mb-1 font-bold text-primary">
              Badges · {achievements.badges.length}/{relevantBadges.length}
            </p>
            <p className="mb-4 text-xs text-muted">Each badge has a Bronze, Silver, Gold or Platinum level. Greyed-out badges are still to earn.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {relevantBadges.map((badge) => {
                const isEarned = earned.has(badge.code);
                return (
                  <div key={badge.id} className={`rounded-card border p-3 text-center ${isEarned ? "border-line bg-surface" : "border-dashed border-line bg-surface-muted opacity-60 grayscale"}`}>
                    <div className="text-3xl">{badge.icon}</div>
                    <p className="mt-1 text-sm font-semibold">{badge.name}</p>
                    <p className="text-[11px] text-muted">{badge.description}</p>
                    <div className="mt-2 flex justify-center">
                      <TierBadge tier={badge.tier} />
                    </div>
                    <p className="mt-1 text-[10px] text-muted">{badge.earnedCount} member{badge.earnedCount === 1 ? "" : "s"} have this</p>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <p className="mb-3 font-bold text-primary">Recent points</p>
            {achievements.recentPointTransactions.length === 0 ? (
              <p className="text-sm text-muted">No points yet. Start by completing your profile.</p>
            ) : (
              <ul className="divide-y divide-line">
                {achievements.recentPointTransactions.map((transaction) => (
                  <li key={transaction.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{ACTIVITY_LABEL[transaction.activityType] ?? transaction.activityType}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-muted">{timeAgo(transaction.createdAt)}</span>
                      <span className="font-bold text-success">+{transaction.points}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="mb-3 font-bold text-primary">🏁 Leaderboard</p>
            <div className="mb-3 flex gap-1">
              {(["ALUMNI", "STUDENT"] as const).map((value) => (
                <button key={value} onClick={() => setRole(value)} className={`flex-1 rounded-control py-1.5 text-xs font-semibold ${role === value ? "bg-primary text-on-primary" : "bg-surface-muted text-muted"}`}>
                  {value === "ALUMNI" ? "Alumni" : "Students"}
                </button>
              ))}
            </div>
            <div className="mb-4 flex gap-1">
              {(
                [
                  ["MONTH", "This month"],
                  ["YEAR", "This year"],
                  ["ALL_TIME", "All time"],
                ] as const
              ).map(([value, label]) => (
                <button key={value} onClick={() => setPeriod(value)} className={`flex-1 rounded-full border py-1 text-[11px] font-semibold ${period === value ? "border-accent bg-accent-soft text-on-accent" : "border-line text-muted"}`}>
                  {label}
                </button>
              ))}
            </div>
            {!leaderboard ? (
              <Spinner />
            ) : leaderboard.length === 0 ? (
              <p className="text-sm text-muted">No points earned in this period yet.</p>
            ) : (
              <ol className="space-y-2">
                {leaderboard.map((row) => (
                  <li key={row.user.id} className={`flex items-center gap-3 rounded-control p-2 ${row.user.id === user.id ? "bg-primary-soft" : ""}`}>
                    <span className="w-6 text-center text-sm font-black text-muted">{row.rank <= 3 ? ["🥇", "🥈", "🥉"][row.rank - 1] : row.rank}</span>
                    <Avatar user={row.user} size={32} />
                    <Link href={`/profile/${row.user.id}`} className="min-w-0 flex-1 truncate text-sm font-semibold hover:underline">
                      {fullName(row.user)}
                    </Link>
                    <span className="text-sm font-bold text-primary">{row.points.toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card className="p-5">
            <p className="mb-3 font-bold text-primary">How to earn points</p>
            <ul className="space-y-1.5 text-sm">
              {HOW_TO_EARN[user.role === "STUDENT" ? "STUDENT" : "ALUMNI"].map(([label, points]) => (
                <li key={label} className="flex justify-between gap-2">
                  <span className="text-muted">{label}</span>
                  <span className="font-semibold text-success">{points}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-muted">Daily limits stop point farming. Points come from helping others, not from volume.</p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import { Avatar, Button, Card, PageHeader, Spinner, VerifiedBadge } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatMonthLong, fullName } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Award, AwardType, UserSummary } from "@/lib/types";

const AWARD_ICON: Record<AwardType, string> = {
  ALUMNI_OF_THE_MONTH: "🏆",
  ALUMNI_OF_THE_YEAR: "👑",
  STUDENT_OF_THE_MONTH: "🎓",
  RISING_STAR_OF_THE_YEAR: "🌟",
  DEPARTMENT_CHAMPION_OF_THE_MONTH: "🏅",
  SPACE_OF_THE_YEAR: "🎙️",
  STUDENTS_CHOICE_OF_THE_YEAR: "💜",
};

interface Nominee {
  user: UserSummary;
  yearPoints: number;
  voteCount: number;
}

function AwardCard({ award, isFeatured }: { award: Award; isFeatured?: boolean }) {
  const period = award.type.endsWith("YEAR") ? String(new Date(award.periodStart).getUTCFullYear()) : formatMonthLong(award.periodStart);
  return (
    <div className={`relative overflow-hidden rounded-card p-5 ${isFeatured ? "bg-primary text-on-primary" : "border border-line bg-surface"}`}>
      <p className={`eyebrow ${isFeatured ? "!text-accent" : ""}`}>
        {AWARD_ICON[award.type]} {award.title} · {period}
        {award.department && ` · ${award.department.name}`}
      </p>
      <Link href={`/profile/${award.recipient.id}`} className="mt-3 flex items-center gap-3">
        <Avatar user={award.recipient} size={isFeatured ? 64 : 48} />
        <div>
          <p className={`flex items-center gap-1 font-bold hover:underline ${isFeatured ? "text-xl" : ""}`}>
            {fullName(award.recipient)} {award.recipient.isVerified && !isFeatured && <VerifiedBadge />}
          </p>
          <p className={`text-sm ${isFeatured ? "opacity-80" : "text-muted"}`}>
            {award.recipient.jobTitle ? `${award.recipient.jobTitle} at ${award.recipient.company}` : award.recipient.headline}
          </p>
        </div>
      </Link>
      <p className={`mt-3 text-sm ${isFeatured ? "opacity-90" : "text-muted"}`}>{award.citation}</p>
      {isFeatured && <Trophy className="absolute -bottom-6 -right-6 size-36 text-accent opacity-15" />}
    </div>
  );
}

export default function AwardsPage() {
  const { user } = useSession();
  const toast = useToast();
  const [current, setCurrent] = useState<Award[] | null>(null);
  const [history, setHistory] = useState<Award[]>([]);
  const [nominees, setNominees] = useState<Nominee[]>([]);
  const voteAward = user?.role === "STUDENT" ? "STUDENTS_CHOICE_OF_THE_YEAR" : "ALUMNI_OF_THE_YEAR";
  const year = new Date().getFullYear();

  const load = useCallback(async () => {
    const [currentResult, historyResult, nomineesResult] = await Promise.all([
      api.get<Award[]>("/awards/current"),
      api.get<Award[]>("/awards", { type: "ALUMNI_OF_THE_MONTH" }),
      api.get<Nominee[]>("/awards/nominees", { awardType: voteAward, year }),
    ]);
    setCurrent(currentResult.data);
    setHistory(historyResult.data);
    setNominees(nomineesResult.data);
  }, [voteAward, year]);

  useEffect(() => {
    load().catch(() => setCurrent([]));
  }, [load]);

  const featured = current?.find((award) => award.type === "ALUMNI_OF_THE_MONTH");
  const others = useMemo(() => current?.filter((award) => award !== featured) ?? [], [current, featured]);
  const maxVotes = Math.max(1, ...nominees.map((nominee) => nominee.voteCount));

  const vote = async (nomineeId: string) => {
    try {
      await api.put("/awards/votes", { awardType: voteAward, nomineeId, year });
      toast("Vote counted 🗳️ You can change it until the year ends.");
      load();
    } catch (caught) {
      toast(errorMessage(caught), "error");
    }
  };

  return (
    <AppShell wide>
      <PageHeader eyebrow="Recognition" title="Awards & hall of fame" description="Every month we celebrate the alumni and students who give the most to the PAU community. At the end of the year, the community helps choose the Alumni of the Year." />
      {!current ? (
        <Spinner />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="min-w-0 space-y-4">
            {featured && <AwardCard award={featured} isFeatured />}
            <div className="grid gap-4 md:grid-cols-2">
              {others.map((award) => (
                <AwardCard key={award.id} award={award} />
              ))}
            </div>

            <Card className="p-5">
              <p className="mb-4 font-bold text-primary">🏆 Alumni of the Month: past winners</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {history.map((award) => (
                  <Link key={award.id} href={`/profile/${award.recipient.id}`} className="flex items-center gap-3 rounded-control p-2 hover:bg-surface-muted">
                    <Avatar user={award.recipient} size={36} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{fullName(award.recipient)}</p>
                      <p className="text-xs text-muted">{formatMonthLong(award.periodStart)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <p className="font-bold text-primary">🗳️ {voteAward === "STUDENTS_CHOICE_OF_THE_YEAR" ? "Students' Choice" : "Alumni of the Year"} {year}</p>
              <p className="mb-4 mt-1 text-xs text-muted">
                {voteAward === "STUDENTS_CHOICE_OF_THE_YEAR" ? "Vote for the alumnus who helped you most this year. One vote per student." : "Community votes count toward Alumni of the Year, alongside points and monthly wins."}
              </p>
              <div className="space-y-3">
                {nominees.map((nominee) => (
                  <div key={nominee.user.id}>
                    <div className="flex items-center gap-2">
                      <Avatar user={nominee.user} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{fullName(nominee.user)}</p>
                        <p className="text-[11px] text-muted">
                          {nominee.yearPoints.toLocaleString()} pts · {nominee.voteCount} vote{nominee.voteCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      {nominee.user.id !== user?.id && (
                        <Button size="sm" variant="secondary" onClick={() => vote(nominee.user.id)}>
                          Vote
                        </Button>
                      )}
                    </div>
                    <div className="ml-10 mt-1 h-1 overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full bg-accent" style={{ width: `${(nominee.voteCount / maxVotes) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5 text-sm">
              <p className="mb-2 font-bold text-primary">How winners are chosen</p>
              <ul className="space-y-2 text-muted">
                <li>🏆 <strong className="text-ink">Alumni of the Month</strong>: most points that month among verified alumni who held at least one session or space. Winners sit out for the next 3 months.</li>
                <li>🎓 <strong className="text-ink">Student of the Month</strong>: the most active learner.</li>
                <li>🏅 <strong className="text-ink">Department Champion</strong>: top alumnus in each course every month.</li>
                <li>👑 <strong className="text-ink">Alumni of the Year</strong>: year points + 300 per monthly win + 25 per community vote.</li>
                <li>🌟 <strong className="text-ink">Rising Star</strong>: the same formula, for alumni who graduated in the last 3 years.</li>
                <li>🎙️ <strong className="text-ink">Space of the Year</strong>: the space with the most attendees and question upvotes.</li>
                <li>💜 <strong className="text-ink">Students&apos; Choice</strong>: decided by student votes alone.</li>
              </ul>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}

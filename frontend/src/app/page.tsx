"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarCheck, MessageCircle, Radio, Trophy, Users } from "lucide-react";
import { Logo } from "@/components/AppShell";
import { Avatar, ButtonLink, StatusPill } from "@/components/ui";
import { api } from "@/lib/api";
import { formatMonthLong, formatSlot, fullName } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Award, Department, Space } from "@/lib/types";

const STEPS = [
  { icon: Users, title: "Find alumni from your course", body: "Filter by department, graduation year and industry. See who sat in your lectures and where they are now." },
  { icon: CalendarCheck, title: "Book a 30-minute session", body: "Pick an open slot an alumnus published. They accept, and a meeting link appears on your dashboard." },
  { icon: Radio, title: "Join live spaces", body: "Alumni host live Q&As. Raise your hand to speak, ask questions, and upvote the ones you care about." },
  { icon: MessageCircle, title: "Send a message request", body: "Introduce yourself. Once an alumnus accepts, you can keep the conversation going." },
];

export default function LandingPage() {
  const { user, isLoading } = useSession();
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);

  useEffect(() => {
    if (!isLoading && user) router.replace("/feed");
  }, [isLoading, user, router]);

  useEffect(() => {
    api.get<Department[]>("/departments").then(({ data }) => setDepartments(data)).catch(() => {});
    api.get<Space[]>("/spaces").then(({ data }) => setSpaces(data.slice(0, 3))).catch(() => {});
    api.get<Award[]>("/awards/current").then(({ data }) => setAwards(data)).catch(() => {});
  }, []);

  const alumniCount = departments.reduce((sum, department) => sum + (department.alumniCount ?? 0), 0);
  const alumniOfTheMonth = awards.find((award) => award.type === "ALUMNI_OF_THE_MONTH");

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,var(--primary-soft),transparent_45%),radial-gradient(circle_at_100%_100%,var(--accent-soft),transparent_45%)]">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 sm:py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <ButtonLink href="/login" variant="ghost" className="!px-3">
            Log in
          </ButtonLink>
          <ButtonLink href="/register">Join</ButtonLink>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:pb-16 sm:pt-16">
        <p className="eyebrow mb-4">Pan-Atlantic University · Alumni network</p>
        <h1 className="text-display max-w-4xl font-extrabold tracking-tight text-primary text-balance">
          Talk to PAU alumni who sat in <span className="text-muted/70">your</span> lectures.{" "}
          <span className="inline-block rounded-card bg-accent px-3 text-on-accent">Book in a minute.</span>
        </h1>
        <p className="text-lead measure mt-6 text-muted">
          PAU Network connects students with alumni from their own course for mentorship sessions, live Q&amp;A spaces and direct messages.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/register?role=STUDENT" className="h-12 flex-1 px-6 sm:flex-none">
            Join as a student <ArrowRight className="size-4" />
          </ButtonLink>
          <ButtonLink href="/register?role=ALUMNI" variant="accent" className="h-12 flex-1 px-6 sm:flex-none">
            Join as alumni
          </ButtonLink>
        </div>
        <div className="mt-8 flex flex-wrap gap-2 font-mono text-xs">
          {[
            [alumniCount || "17", "alumni"],
            [departments.length || "10", "departments"],
            [spaces.length ? `${spaces.filter((space) => space.status === "LIVE").length} live` : "Live", "spaces now"],
          ].map(([value, label]) => (
            <span key={label} className="rounded-full border border-line bg-surface px-3 py-1.5 shadow-sm">
              <strong className="text-primary">{value}</strong> <span className="text-muted">{label}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-4 px-4 pb-16">
        {STEPS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-card border border-line bg-surface p-5">
            <Icon className="mb-3 size-6 text-black" />
            <p className="font-bold text-black">{title}</p>
            <p className="mt-1 text-sm text-black">{body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 lg:grid-cols-[1fr_1.4fr]">
        {alumniOfTheMonth && (
          <div className="relative overflow-hidden rounded-card bg-primary p-6 text-on-primary">
            <p className="eyebrow !text-accent">🏆 Alumni of the Month · {formatMonthLong(alumniOfTheMonth.periodStart)}</p>
            <div className="mt-4 flex items-center gap-4">
              <Avatar user={alumniOfTheMonth.recipient} size={64} />
              <div>
                <p className="text-xl font-bold">{fullName(alumniOfTheMonth.recipient)}</p>
                <p className="text-sm opacity-80">
                  {alumniOfTheMonth.recipient.jobTitle} at {alumniOfTheMonth.recipient.company}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm opacity-90">{alumniOfTheMonth.citation}</p>
            <Trophy className="absolute -bottom-6 -right-6 size-32 text-accent opacity-15" />
          </div>
        )}
        <div className="rounded-card border border-line bg-surface p-6">
          <p className="eyebrow mb-4">Spaces</p>
          <div className="space-y-3">
            {spaces.map((space) => (
              <Link key={space.id} href="/login" className="flex items-center justify-between gap-3 rounded-control border border-line p-3 hover:bg-surface-muted">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{space.title}</p>
                  <p className="text-xs text-muted">
                    {fullName(space.host)} · {space.status === "LIVE" ? `${space.participantCount} listening` : formatSlot(space.scheduledStartAt)}
                  </p>
                </div>
                <StatusPill status={space.status} />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

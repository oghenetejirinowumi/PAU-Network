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
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 sm:py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <ButtonLink href="/login" variant="ghost" className="!px-3">
            Log in
          </ButtonLink>
          <ButtonLink href="/register">Join</ButtonLink>
        </div>
      </header>

      <section className="relative isolate overflow-hidden bg-primary text-on-primary">
        <div className="pointer-events-none absolute -right-12 top-1/2 -translate-y-1/2 text-white opacity-10" aria-hidden>
          <Users className="size-96" strokeWidth={1} />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-10 sm:pb-20 sm:pt-20">
          <p className="eyebrow mb-4 !text-accent">Pan-Atlantic University · Alumni network</p>
          <h1 className="text-display max-w-4xl font-extrabold tracking-tight text-balance">
            Talk to PAU alumni who sat in <span className="text-accent">your</span> lectures.{" "}
            <span className="inline-block rounded-card bg-white px-3 text-primary">Book in a minute.</span>
          </h1>
          <p className="text-lead measure mt-6 text-white/80">
            PAU Network connects students with alumni from their own course for mentorship sessions, live Q&amp;A spaces and direct messages.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/register?role=STUDENT" className="h-12 flex-1 bg-white px-6 text-primary hover:bg-accent sm:flex-none">
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
              <span key={label} className="rounded-full border border-white/30 bg-white/10 px-3 py-1.5">
                <strong className="text-white">{value}</strong> <span className="text-white/70">{label}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="mb-8 max-w-2xl">
          <p className="eyebrow mb-2">How it works</p>
          <h2 className="text-title font-extrabold text-primary">A network built around your next step.</h2>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-4">
          {STEPS.map(({ icon: Icon, title, body }, index) => (
            <div key={title} className={`rounded-card border p-5 ${index % 2 === 1 ? "border-primary bg-primary text-on-primary" : "border-line bg-surface"}`}>
              <Icon className={`mb-3 size-7 ${index % 2 === 1 ? "text-accent" : "text-primary"}`} />
              <p className={`font-bold ${index % 2 === 1 ? "text-white" : "text-primary"}`}>{title}</p>
              <p className={`mt-1 text-sm ${index % 2 === 1 ? "text-white/75" : "text-muted"}`}>{body}</p>
            </div>
          ))}
        </div>
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

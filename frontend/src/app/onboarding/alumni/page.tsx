"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Logo } from "@/components/AppShell";
import { Button, Card, Spinner } from "@/components/ui";
import { useSession } from "@/lib/session";

const pages = [
  {
    label: "Goals",
    headline: "Choose who you want to help",
    description: "Set your goals and the kind of students you want to mentor. We match you with students who fit, and show you why.",
    emoji: "👥",
    illustration: "A mentor meeting the students they can help",
  },
  {
    label: "Sessions",
    headline: "Your experience is someone's shortcut",
    description: "Host open sessions for many students, or mentor a few one on one. Set your availability once and students book from your open slots.",
    emoji: "📅",
    illustration: "A calendar connecting alumni and student sessions",
  },
  {
    label: "Inbox",
    headline: "Stay in control of your inbox",
    description: "Students send message requests, and you decide who gets through. Filter by goal, course or topic so only the right people reach you.",
    emoji: "📥",
    illustration: "A message request inbox with helpful filters",
    privacyNote: "Your personal email is never shown to students. It is only used for notifications.",
  },
  {
    label: "Timeline",
    headline: "Share what you've learned",
    description: "Post career lessons, openings and advice to your timeline. Students comment and learn from your journey.",
    emoji: "💡",
    illustration: "Career advice shared with the PAU community",
  },
  {
    label: "Recognition",
    headline: "Impact that gets recognised",
    description: "Earn badges and awards for every student you mentor, every session you host and every referral you make.",
    emoji: "🏆",
    illustration: "Badges celebrating an alum's community impact",
  },
];

export default function AlumniOnboardingPage() {
  const { user, isLoading } = useSession();
  const router = useRouter();
  const [pageIndex, setPageIndex] = useState(0);
  const page = pages[pageIndex];
  const isLastPage = pageIndex === pages.length - 1;

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
    else if (!isLoading && user?.role !== "ALUMNI") router.replace("/feed");
  }, [isLoading, router, user]);

  if (isLoading || !user || user.role !== "ALUMNI") return <Spinner label="Getting your welcome ready…" />;

  return (
    <main id="main-content" className="flex min-h-dvh items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex flex-col items-center gap-2">
          <Logo />
          <p className="text-sm font-medium text-muted">Your network starts here.</p>
        </div>

        <Card className="overflow-hidden shadow-sm">
          <div className="px-5 pt-5 sm:px-10 sm:pt-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                {page.label}
              </p>
              <Link href="/feed" className="text-sm font-semibold text-muted hover:text-primary hover:underline">
                Skip for now
              </Link>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-primary-soft"
              role="progressbar"
              aria-label="Alumni onboarding progress"
              aria-valuemin={1}
              aria-valuemax={pages.length}
              aria-valuenow={pageIndex + 1}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${((pageIndex + 1) / pages.length) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-right text-xs text-muted" aria-live="polite">
              {pageIndex + 1} of {pages.length}
            </p>
          </div>

          <div className="px-5 pb-6 pt-3 sm:px-10 sm:pb-9">
            <div
              className="mb-7 flex min-h-48 flex-col items-center justify-center rounded-card border-2 border-dashed border-line bg-background px-5 py-6 text-center sm:min-h-56"
              role="img"
              aria-label={`Illustration placeholder: ${page.illustration}`}
            >
              <div className="mb-3 flex size-16 items-center justify-center rounded-2xl bg-primary-soft text-4xl" aria-hidden="true">
                {page.emoji}
              </div>
              <p className="text-sm font-semibold text-ink">Illustration placeholder</p>
              <p className="mt-1 max-w-sm text-xs text-muted">{page.illustration}</p>
            </div>

            <div className="mx-auto max-w-lg text-center" aria-live="polite">
              <h1 className="text-title font-extrabold tracking-tight text-primary">{page.headline}</h1>
              <p className="mt-3 text-sm leading-6 text-muted sm:text-base">{page.description}</p>
              {page.privacyNote && (
                <p className="mt-4 rounded-control bg-primary-soft px-4 py-3 text-left text-xs leading-5 text-ink">
                  <span className="font-bold">Privacy:</span> {page.privacyNote}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-line bg-surface-muted/50 px-5 py-4 sm:px-10">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
              disabled={pageIndex === 0}
              aria-label="Previous onboarding page"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Back
            </Button>
            {isLastPage ? (
              <Button type="button" onClick={() => router.replace("/availability")}>
                Start giving back
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button type="button" onClick={() => setPageIndex((current) => Math.min(pages.length - 1, current + 1))}>
                Next
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}

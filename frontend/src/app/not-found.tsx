import Link from "next/link";
import { ArrowLeft, Compass, Home } from "lucide-react";
import { Logo } from "@/components/AppShell";
import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,var(--primary-soft),transparent_35%),radial-gradient(circle_at_85%_80%,var(--accent-soft),transparent_35%)]" />

      <div className="relative w-full max-w-xl text-center">
        <div className="mb-12 flex justify-center">
          <Logo />
        </div>

        <div className="mx-auto flex size-24 items-center justify-center rounded-full border border-line bg-surface shadow-lg shadow-primary/10">
          <Compass className="size-11 text-primary" strokeWidth={1.5} aria-hidden="true" />
        </div>

        <p className="eyebrow mt-8">Lost in the network</p>
        <p className="mt-2 text-[clamp(5rem,20vw,9rem)] font-black leading-none tracking-tighter text-primary">404</p>
        <h1 className="mt-3 text-title font-extrabold tracking-tight text-ink">This page isn&apos;t here</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted sm:text-base">
          The link may be outdated, or the page may have moved. Let&apos;s get you back to the PAU Network.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/" className="min-h-11">
            <Home className="size-4" aria-hidden="true" />
            Back to home
          </ButtonLink>
          <ButtonLink href="/alumni" variant="secondary" className="min-h-11">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Browse alumni
          </ButtonLink>
        </div>

        <p className="mt-8 text-sm text-muted">
          Need a hand?{" "}
          <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
            Sign in to your account
          </Link>
        </p>
      </div>
    </main>
  );
}

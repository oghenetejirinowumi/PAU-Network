"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, GraduationCap, MessageCircle, Users } from "lucide-react";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { API_URL, errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";

// Seeded demo accounts (all fictional, password demo1234) so judges can switch roles in one click.
const DEMO_ACCOUNTS = [
  { label: "David · CS student", email: "david.olawale@pau-network.demo" },
  { label: "Chinedu · Alumni, Paystack", email: "chinedu.okafor@pau-network.demo" },
  { label: "Fatima · Mass Comm student", email: "fatima.bello@pau-network.demo" },
  { label: "Aisha · Alumni, MTN", email: "aisha.abubakar@pau-network.demo" },
];

function LoginForm() {
  const { login } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/feed";
  const linkedInError = searchParams.get("linkedinError");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const signIn = async (signInEmail: string, signInPassword: string) => {
    setError("");
    setIsSubmitting(true);
    try {
      await login(signInEmail, signInPassword);
      router.replace(next);
    } catch (caught) {
      setError(errorMessage(caught));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-primary px-4 py-10">
      <div className="pointer-events-none absolute -left-12 top-12 text-white opacity-10" aria-hidden>
        <GraduationCap className="size-48 sm:size-64" strokeWidth={1} />
      </div>
      <div className="pointer-events-none absolute -right-10 top-1/4 text-white opacity-10" aria-hidden>
        <Users className="size-56 sm:size-80" strokeWidth={1} />
      </div>
      <div className="pointer-events-none absolute bottom-0 left-1/4 text-white opacity-10" aria-hidden>
        <MessageCircle className="size-48 sm:size-64" strokeWidth={1} />
      </div>
      <button
        type="button"
        onClick={() => router.back()}
        className="tap-target absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-control px-2 text-sm font-semibold text-white hover:bg-white/10 sm:left-5 sm:top-5"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back
      </button>
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Image src="/PAU_NETWORK_LOGO_WHITE.png" alt="PAU Network" width={190} height={48} priority className="h-auto w-44 sm:w-48" />
        </div>
        <Card className="p-6 shadow-[0_0_45px_rgba(255,255,255,0.22)]">
          <h1 className="text-xl font-bold text-primary">Welcome back</h1>
          <p className="mb-5 text-sm text-muted">Log in to connect with the PAU community.</p>
          {linkedInError && (
            <p className="mb-4 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
              LinkedIn sign-in was cancelled. You can try again or log in with your email.
            </p>
          )}
          <a
            href={`${API_URL}/auth/linkedin`}
            className="mb-4 flex h-10 items-center justify-center rounded-control border border-line bg-surface text-sm font-semibold text-ink transition hover:bg-surface-muted"
          >
            Continue with LinkedIn
          </a>
          <p className="mb-4 text-center text-xs text-muted">or log in with email</p>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              signIn(email, password);
            }}
          >
            <Field label="Email">
              <input className={inputClass} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </Field>
            <Field label="Password">
              <input className={inputClass} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </Field>
            {error && <p className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              Log in
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted">
            New here?{" "}
            <Link href="/register" className="font-semibold text-primary hover:underline">
              Create an account
            </Link>
          </p>
        </Card>

        <Card className="mt-4 p-4">
          <p className="eyebrow mb-3">Demo accounts</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                onClick={() => signIn(account.email, "demo1234")}
                disabled={isSubmitting}
                className="rounded-control border border-line px-3 py-2 text-left text-xs font-medium hover:border-primary hover:bg-primary-soft"
              >
                {account.label}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

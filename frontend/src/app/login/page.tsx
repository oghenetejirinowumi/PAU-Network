"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Logo } from "@/components/AppShell";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { errorMessage } from "@/lib/api";
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
  const next = useSearchParams().get("next") ?? "/feed";
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
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <Card className="p-6">
          <h1 className="text-xl font-bold text-primary">Welcome back</h1>
          <p className="mb-5 text-sm text-muted">Log in to connect with the PAU community.</p>
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

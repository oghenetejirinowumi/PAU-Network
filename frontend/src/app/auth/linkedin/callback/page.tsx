"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/AppShell";
import { Button, Card } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { useSession } from "@/lib/session";

export default function LinkedInCallbackPage() {
  const { completeLinkedInLogin } = useSession();
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;
    completeLinkedInLogin()
      .then(() => router.replace("/feed"))
      .catch((caught) => {
        if (isActive) setError(errorMessage(caught));
      });
    return () => {
      isActive = false;
    };
  }, [completeLinkedInLogin, router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md p-6 text-center">
        <div className="mb-5 flex justify-center">
          <Logo />
        </div>
        {error ? (
          <>
            <h1 className="text-xl font-bold text-primary">Could not complete LinkedIn sign-in</h1>
            <p className="mt-3 text-sm text-danger">{error}</p>
            <Link href="/login">
              <Button className="mt-5">Back to login</Button>
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted">Finishing LinkedIn sign-in…</p>
        )}
      </Card>
    </div>
  );
}

"use client";

import { SessionProvider } from "@/lib/session";
import { ToastProvider } from "./Toast";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}

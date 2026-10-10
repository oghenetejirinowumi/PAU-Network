"use client";

import Link from "next/link";
import { BadgeCheck, Loader2, X } from "lucide-react";
import { useEffect, useId } from "react";
import { fullName, initials, TIER_CLASSES, TIER_LABEL } from "@/lib/format";
import type { Tier, UserSummary } from "@/lib/types";

// ───── Buttons ─────

type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  accent: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-muted",
  ghost: "text-muted hover:bg-surface-muted hover:text-ink",
  danger: "border border-danger/30 bg-danger-soft text-danger hover:bg-danger/10",
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading,
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md"; isLoading?: boolean }) {
  // 44px tall on touch screens (WCAG target size), compact with a mouse.
  const sizing = size === "sm" ? "h-8 coarse:h-11 px-3 text-xs" : "h-10 coarse:h-11 px-4 text-sm";
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-control font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${BUTTON_VARIANTS[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function ButtonLink({ href, variant = "primary", className = "", children }: { href: string; variant?: ButtonVariant; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={`inline-flex h-10 coarse:h-11 items-center justify-center gap-1.5 rounded-control px-4 text-sm font-semibold transition ${BUTTON_VARIANTS[variant]} ${className}`}>
      {children}
    </Link>
  );
}

// ───── Layout pieces ─────

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-card border border-line bg-surface ${className}`}>{children}</div>;
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="eyebrow mb-2 flex items-center gap-2">
            <span className="inline-block h-0.5 w-5 bg-accent" />
            {eyebrow}
          </p>
        )}
        <h1 className="text-title font-extrabold tracking-tight text-primary text-balance">{title}</h1>
        {description && <p className="measure mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center">
      <div className="mb-3 text-3xl">{icon}</div>
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const titleId = useId();
  useEffect(() => {
    // Lock background scroll while the dialog is open.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`safe-bottom max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-card bg-surface p-4 shadow-2xl sm:rounded-card sm:p-5 ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-bold text-primary">{title}</h2>
          <button autoFocus onClick={onClose} className="tap-target rounded-full p-1 text-muted hover:bg-surface-muted" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ───── Form fields ─────

export const inputClass =
  "w-full min-w-0 rounded-control border border-line bg-surface px-3 py-2 text-base sm:text-sm coarse:min-h-11 outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary-soft";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

// ───── People ─────

/**
 * `size`: a number (px at the 16px base, converted to rem so avatars scale on large screens)
 * or any CSS length for fluid sizing, e.g. "clamp(5.5rem, 24vw, 8.5rem)".
 */
export function Avatar({ user, size = 40, className = "" }: { user: Pick<UserSummary, "firstName" | "lastName" | "avatarUrl"> & { tier?: Tier }; size?: number | string; className?: string }) {
  const ring = user.tier ? `ring-2 ring-offset-2 ring-offset-surface ${TIER_CLASSES[user.tier].ring}` : "";
  const length = typeof size === "number" ? `${size / 16}rem` : size;
  const style = { width: length, height: length, fontSize: typeof size === "number" ? `${Math.max(11, size * 0.36) / 16}rem` : `calc(${size} * 0.36)` };
  if (user.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.avatarUrl} alt={fullName(user)} loading="lazy" decoding="async" style={style} className={`shrink-0 rounded-full object-cover ${ring} ${className}`} />;
  }
  return (
    <div style={style} className={`flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary ${ring} ${className}`}>
      {initials(user)}
    </div>
  );
}

export function VerifiedBadge() {
  return (
    <span title="Verified PAU alumni" className="inline-flex text-primary">
      <BadgeCheck className="size-4" />
    </span>
  );
}

export function TierBadge({ tier, size = "sm" }: { tier: Tier; size?: "sm" | "md" }) {
  const classes = TIER_CLASSES[tier];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-current/20 font-semibold ${classes.text} ${size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"}`}>
      <span className={`size-1.5 rounded-full ${classes.bg}`} />
      {TIER_LABEL[tier]}
    </span>
  );
}

export function RoleBadge({ role }: { role: UserSummary["role"] }) {
  if (role === "ALUMNI") return <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-on-accent">Alumni</span>;
  if (role === "STUDENT") return <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">Student</span>;
  return <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted">Admin</span>;
}

/** Avatar + name + headline, linking to the profile. */
export function UserLine({ user, subtitle, size = 40 }: { user: UserSummary; subtitle?: React.ReactNode; size?: number }) {
  const line = subtitle ?? (user.jobTitle && user.company ? `${user.jobTitle} at ${user.company}` : user.headline);
  return (
    <Link href={`/profile/${user.id}`} className="flex min-w-0 items-center gap-3">
      <Avatar user={user} size={size} />
      <div className="min-w-0">
        <p className="flex items-center gap-1 truncate text-sm font-semibold hover:underline">
          {fullName(user)}
          {user.isVerified && <VerifiedBadge />}
        </p>
        {line && <p className="truncate text-xs text-muted">{line}</p>}
      </div>
    </Link>
  );
}

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-warning-soft text-warning",
    ACCEPTED: "bg-success-soft text-success",
    COMPLETED: "bg-primary-soft text-primary",
    DECLINED: "bg-surface-muted text-muted",
    CANCELLED: "bg-surface-muted text-muted",
    LIVE: "bg-live text-on-primary",
    SCHEDULED: "bg-primary-soft text-primary",
    ENDED: "bg-surface-muted text-muted",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles[status] ?? "bg-surface-muted text-muted"}`}>
      {status === "LIVE" && <span className="animate-pulse-live size-1.5 rounded-full bg-on-primary" />}
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

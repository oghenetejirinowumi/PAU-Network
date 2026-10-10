"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CalendarClock, Home, LogOut, MessageCircle, Radio, Settings, Trophy, User as UserIcon, Users, Award, CalendarPlus } from "lucide-react";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { useSession, useSocketEvent } from "@/lib/session";
import type { Notification } from "@/lib/types";
import { useToast } from "./Toast";
import { Avatar, Spinner, TierBadge } from "./ui";

const NAV_ITEMS = [
  { href: "/feed", label: "Home", icon: Home },
  { href: "/alumni", label: "Alumni", icon: Users },
  { href: "/spaces", label: "Spaces", icon: Radio },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/bookings", label: "Sessions", icon: CalendarClock },
  { href: "/awards", label: "Awards", icon: Trophy },
];

export function Logo({ light = false }: { light?: boolean }) {
  if (light) {
    return (
      <Link href="/feed" className="flex items-center">
        <Image src="/PAU_NETWORK_LOGO_WHITE.png" alt="PAU Network" width={168} height={42} priority className="h-auto w-36" />
      </Link>
    );
  }

  return (
    <Link href="/feed" className="flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-control bg-primary text-sm font-black text-on-primary">P</span>
      <span className="text-base font-extrabold tracking-tight text-ink">
        PAU <span className="text-primary">Network</span>
      </span>
    </Link>
  );
}

function NotificationBell() {
  const router = useRouter();
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data, meta } = await api.get<Notification[], { unreadCount: number }>("/notifications", { pageSize: 15 });
    setItems(data);
    setUnreadCount(meta.unreadCount);
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  useSocketEvent<Notification>("notification:created", (notification) => {
    setItems((current) => [notification, ...(current ?? [])]);
    setUnreadCount((count) => count + 1);
    toast(notification.title, "info");
  });

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setIsOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const open = async (notification: Notification) => {
    setIsOpen(false);
    if (!notification.readAt) {
      await api.post(`/notifications/${notification.id}/read`).catch(() => {});
      setUnreadCount((count) => Math.max(0, count - 1));
      setItems((current) => current?.map((item) => (item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item)) ?? null);
    }
    if (notification.linkUrl) router.push(notification.linkUrl);
  };

  const markAllRead = async () => {
    await api.post("/notifications/read-all");
    setUnreadCount(0);
    setItems((current) => current?.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })) ?? null);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen((value) => !value)}
        className="tap-target relative rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-live px-1 text-[10px] font-bold text-on-primary">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="fixed inset-x-2 top-14 z-40 overflow-hidden rounded-card border border-line bg-surface shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-[22.5rem]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-bold">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs font-semibold text-primary hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[min(24rem,70dvh)] overflow-y-auto overscroll-contain">
            {!items ? (
              <Spinner />
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">You&apos;re all caught up 🎉</p>
            ) : (
              items.map((item) => (
                <button key={item.id} onClick={() => open(item)} className={`block w-full border-b border-line px-4 py-3 text-left last:border-0 hover:bg-surface-muted ${item.readAt ? "" : "bg-primary-soft/50"}`}>
                  <p className="text-sm font-semibold">{item.title}</p>
                  {item.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{item.body}</p>}
                  <p className="mt-1 text-[11px] text-muted">{timeAgo(item.createdAt)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AccountMenu() {
  const { user, logout } = useSession();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setIsOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  if (!user) return null;

  const links = [
    { href: `/profile/${user.id}`, label: "View profile", icon: UserIcon },
    { href: "/achievements", label: "Points & badges", icon: Award },
    ...(user.role === "ALUMNI" ? [{ href: "/availability", label: "My availability", icon: CalendarPlus }] : []),
    { href: "/settings", label: "Edit profile", icon: Settings },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button onClick={() => setIsOpen((value) => !value)} className="tap-target flex items-center rounded-full" aria-label="Account menu" aria-expanded={isOpen} aria-haspopup="menu">
        <Avatar user={user} size={34} />
      </button>
      {isOpen && (
        <div role="menu" className="absolute right-0 top-11 z-40 w-[min(16rem,calc(100vw-1rem))] overflow-hidden rounded-card border border-line bg-surface shadow-xl">
          <div className="border-b border-line p-4">
            <p className="font-semibold">
              {user.firstName} {user.lastName}
            </p>
            <p className="mb-2 truncate text-xs text-muted">{user.email}</p>
            <div className="flex items-center gap-2">
              <TierBadge tier={user.tier} />
              <span className="text-xs text-muted">{user.points.toLocaleString()} pts</span>
            </div>
          </div>
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} role="menuitem" onClick={() => setIsOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-surface-muted coarse:py-3.5">
              <Icon className="size-4 text-muted" /> {label}
            </Link>
          ))}
          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            role="menuitem"
            className="flex w-full items-center gap-2 border-t border-line px-4 py-2.5 text-left text-sm text-danger hover:bg-danger-soft coarse:py-3.5"
          >
            <LogOut className="size-4" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

/** Signed-in layout. Redirects to /login when there is no session. */
export function AppShell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  const { user, isLoading } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isLoading, user, router, pathname]);

  if (isLoading || !user) return <Spinner label="Loading PAU Network…" />;

  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <header className="sticky top-0 z-30 border-b border-white/15 bg-primary/95 text-on-primary shadow-sm backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-4 sm:px-4">
          <Logo light />
          {/* Tablet (768-1023px): icons only, so six items fit. Laptop and up: icon + label. */}
          <nav aria-label="Main" className="ml-2 hidden flex-1 items-center gap-0.5 md:flex lg:ml-4 lg:gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-1.5 rounded-control px-2.5 py-2 text-sm font-medium transition lg:px-3 ${isActive ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
                >
                  <Icon className="size-5 lg:size-4" aria-hidden />
                  <span className="sr-only lg:not-sr-only">{label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <NotificationBell />
            <AccountMenu />
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className={`mx-auto px-3 py-4 outline-none sm:px-4 sm:py-6 ${wide ? "max-w-6xl" : "max-w-5xl"}`}>
        {children}
      </main>

      {/* Phones: bottom tab bar, padded above the iPhone home indicator. */}
      <nav aria-label="Main" className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-[0.6875rem] font-medium ${isActive ? "text-primary" : "text-muted"}`}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

"use client";

import Link from "next/link";
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

export function Logo() {
  return (
    <Link href="/feed" className="flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-control bg-primary text-sm font-black text-accent">P</span>
      <span className="text-base font-extrabold tracking-tight text-primary">
        PAU <span className="text-accent">Network</span>
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
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
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
      <button onClick={() => setIsOpen((value) => !value)} className="relative rounded-full p-2 text-muted hover:bg-surface-muted hover:text-ink" aria-label="Notifications">
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-live px-1 text-[10px] font-bold text-on-primary">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-11 z-40 w-[min(92vw,360px)] overflow-hidden rounded-card border border-line bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-bold">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs font-semibold text-primary hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
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
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
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
      <button onClick={() => setIsOpen((value) => !value)} className="flex items-center rounded-full" aria-label="Account menu">
        <Avatar user={user} size={34} />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-11 z-40 w-64 overflow-hidden rounded-card border border-line bg-surface shadow-xl">
          <div className="border-b border-line p-4">
            <p className="font-semibold">
              {user.firstName} {user.lastName}
            </p>
            <p className="mb-2 text-xs text-muted">{user.email}</p>
            <div className="flex items-center gap-2">
              <TierBadge tier={user.tier} />
              <span className="text-xs text-muted">{user.points.toLocaleString()} pts</span>
            </div>
          </div>
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setIsOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-surface-muted">
              <Icon className="size-4 text-muted" /> {label}
            </Link>
          ))}
          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="flex w-full items-center gap-2 border-t border-line px-4 py-2.5 text-left text-sm text-danger hover:bg-danger-soft"
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
    <div className="min-h-screen pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Logo />
          <nav className="ml-4 hidden flex-1 items-center gap-1 md:flex">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive = pathname.startsWith(href);
              return (
                <Link key={href} href={href} className={`flex items-center gap-1.5 rounded-control px-3 py-2 text-sm font-medium transition ${isActive ? "bg-primary-soft text-primary" : "text-muted hover:text-ink"}`}>
                  <Icon className="size-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className={`mx-auto px-4 py-6 ${wide ? "max-w-6xl" : "max-w-5xl"}`}>{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-line bg-surface md:hidden">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${isActive ? "text-primary" : "text-muted"}`}>
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import { Avatar, Button, Card, EmptyState, PageHeader, Spinner, StatusPill } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { fullName, timeAgo } from "@/lib/format";
import { useSession, useSocketEvent } from "@/lib/session";
import type { Conversation } from "@/lib/types";

type Box = "INBOX" | "REQUESTS" | "SENT";

function MessagesContent() {
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const initialBox = (useSearchParams().get("box") as Box) ?? "INBOX";
  const [box, setBox] = useState<Box>(initialBox);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [requestCount, setRequestCount] = useState(0);

  const load = useCallback(async () => {
    const { data, meta } = await api.get<Conversation[], { requestCount: number }>("/conversations", { box });
    setConversations(data);
    setRequestCount(meta.requestCount);
  }, [box]);

  useEffect(() => {
    setConversations(null);
    load().catch(() => setConversations([]));
  }, [load]);
  useSocketEvent("conversation:created", load);
  useSocketEvent("conversation:updated", load);
  useSocketEvent("message:created", load);

  const respond = async (conversation: Conversation, action: "accept" | "decline") => {
    try {
      await api.post(`/conversations/${conversation.id}/${action}`);
      if (action === "accept") {
        toast(`You're now connected with ${conversation.otherUser.firstName} 🤝`);
        router.push(`/messages/${conversation.id}`);
      } else {
        toast("Request declined");
        load();
      }
    } catch (caught) {
      toast(errorMessage(caught), "error");
    }
  };

  const tabs: [Box, string][] = [
    ["INBOX", "Inbox"],
    ["REQUESTS", `Requests${requestCount ? ` (${requestCount})` : ""}`],
    ["SENT", "Sent requests"],
  ];

  return (
    <>
      <PageHeader
        eyebrow="Messages"
        title="Messages"
        description={user?.role === "STUDENT" ? "Send a message request from any alumni profile. Once they accept, you can chat freely." : "Students send message requests. Accept the ones you can help with."}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setBox(value)}
            aria-pressed={box === value}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold coarse:py-2.5 ${box === value ? "border-primary bg-primary text-on-primary" : "border-line bg-surface text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {!conversations ? (
        <Spinner />
      ) : conversations.length === 0 ? (
        <EmptyState
          icon={box === "REQUESTS" ? "📨" : "💬"}
          title={box === "REQUESTS" ? "No message requests" : box === "SENT" ? "No sent requests" : "No conversations yet"}
          description={user?.role === "STUDENT" ? "Open an alumni profile and press Message to introduce yourself." : undefined}
          action={user?.role === "STUDENT" ? <Link href="/alumni" className="text-sm font-semibold text-primary">Find alumni →</Link> : undefined}
        />
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {conversations.map((conversation) => {
            const content = (
              <div className="flex items-center gap-3 p-4">
                <Avatar user={conversation.otherUser} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${conversation.unreadCount ? "font-bold" : "font-semibold"}`}>{fullName(conversation.otherUser)}</p>
                    <span className="shrink-0 text-xs text-muted">{conversation.lastMessage && timeAgo(conversation.lastMessage.createdAt)}</span>
                  </div>
                  <p className="truncate text-xs text-muted">{conversation.otherUser.jobTitle ? `${conversation.otherUser.jobTitle} at ${conversation.otherUser.company}` : conversation.otherUser.headline}</p>
                  <p className={`mt-1 truncate text-sm ${conversation.unreadCount ? "font-semibold text-ink" : "text-muted"}`}>
                    {conversation.lastMessage?.senderId === user?.id && "You: "}
                    {conversation.lastMessage?.body}
                  </p>
                </div>
                {conversation.unreadCount > 0 && <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-on-primary">{conversation.unreadCount}</span>}
                {box === "SENT" && <StatusPill status={conversation.status} />}
              </div>
            );
            if (box === "REQUESTS") {
              return (
                <div key={conversation.id}>
                  {content}
                  <div className="flex flex-wrap gap-2 px-4 pb-4 sm:pl-[76px]">
                    <Button size="sm" onClick={() => respond(conversation, "accept")}>
                      Accept
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => respond(conversation, "decline")}>
                      Decline
                    </Button>
                  </div>
                </div>
              );
            }
            return (
              <Link key={conversation.id} href={`/messages/${conversation.id}`} className="block hover:bg-surface-muted">
                {content}
              </Link>
            );
          })}
        </Card>
      )}
    </>
  );
}

export default function MessagesPage() {
  return (
    <AppShell>
      <Suspense>
        <MessagesContent />
      </Suspense>
    </AppShell>
  );
}

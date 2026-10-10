"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmojiPicker } from "@/components/EmojiPicker";
import { useToast } from "@/components/Toast";
import { Avatar, Button, Card, Spinner, UserLine } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { useSession, useSocketEvent } from "@/lib/session";
import type { ConversationStatus, Message, UserSummary } from "@/lib/types";

interface ConversationMeta {
  id: string;
  status: ConversationStatus;
  requesterId: string;
  recipientId: string;
  otherUser: UserSummary;
}

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user } = useSession();
  const toast = useToast();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [conversation, setConversation] = useState<ConversationMeta | null>(null);
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data, meta } = await api.get<Message[], { conversation: ConversationMeta }>(`/conversations/${conversationId}/messages`);
    setMessages(data);
    setConversation(meta.conversation);
  }, [conversationId]);

  useEffect(() => {
    load().catch((caught) => toast(errorMessage(caught), "error"));
  }, [load, toast]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useSocketEvent<Message>("message:created", (message) => {
    if (message.conversationId !== conversationId) return;
    setMessages((current) => (current?.some((item) => item.id === message.id) ? current : [...(current ?? []), message]));
  });
  useSocketEvent("conversation:updated", load);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    setIsSending(true);
    try {
      const { data } = await api.post<Message>(`/conversations/${conversationId}/messages`, { body });
      setMessages((current) => (current?.some((item) => item.id === data.id) ? current : [...(current ?? []), data]));
      setBody("");
    } catch (caught) {
      toast(errorMessage(caught), "error");
    } finally {
      setIsSending(false);
    }
  };

  const respond = async (action: "accept" | "decline") => {
    await api.post(`/conversations/${conversationId}/${action}`);
    load();
  };

  if (!messages || !conversation || !user) return <AppShell><Spinner /></AppShell>;

  const isRecipientOfPending = conversation.status === "PENDING" && conversation.recipientId === user.id;
  const isWaiting = conversation.status === "PENDING" && conversation.requesterId === user.id;

  return (
    <AppShell>
      <Card className="flex h-[calc(100vh-9rem)] flex-col overflow-hidden md:h-[calc(100vh-7rem)]">
        <div className="flex items-center gap-3 border-b border-line p-3">
          <Link href="/messages" className="rounded-full p-1.5 text-muted hover:bg-surface-muted" aria-label="Back">
            <ArrowLeft className="size-5" />
          </Link>
          <UserLine user={conversation.otherUser} />
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto bg-background p-4">
          {messages.map((message, index) => {
            const isMine = message.senderId === user.id;
            const showAvatar = !isMine && messages[index + 1]?.senderId !== message.senderId;
            return (
              <div key={message.id} className={`flex items-end gap-2 ${isMine ? "justify-end" : ""}`}>
                {!isMine && <div className="w-7">{showAvatar && <Avatar user={conversation.otherUser} size={28} />}</div>}
                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${isMine ? "rounded-br-md bg-primary text-on-primary" : "rounded-bl-md border border-line bg-surface"}`}>
                  <p className="whitespace-pre-wrap">{message.body}</p>
                  <p className={`mt-0.5 text-right text-[10px] ${isMine ? "opacity-70" : "text-muted"}`}>{formatTime(message.createdAt)}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {isRecipientOfPending ? (
          <div className="border-t border-line p-4 text-center">
            <p className="mb-3 text-sm text-muted">{conversation.otherUser.firstName} sent you a message request.</p>
            <div className="flex justify-center gap-2">
              <Button onClick={() => respond("accept")}>Accept</Button>
              <Button variant="secondary" onClick={() => respond("decline")}>
                Decline
              </Button>
            </div>
          </div>
        ) : isWaiting || conversation.status === "DECLINED" ? (
          <p className="border-t border-line p-4 text-center text-sm text-muted">
            {conversation.status === "DECLINED" ? "This request was declined." : `Waiting for ${conversation.otherUser.firstName} to accept your request. You can send more messages once they do.`}
          </p>
        ) : (
          <form onSubmit={send} className="flex items-center gap-2 border-t border-line p-3">
            <EmojiPicker onPick={(emoji) => setBody((current) => current + emoji)} />
            <input value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a message…" maxLength={2000} className="flex-1 rounded-full border border-line bg-surface px-4 py-2 text-sm outline-none focus:border-primary" />
            <Button type="submit" size="sm" className="!rounded-full" disabled={!body.trim()} isLoading={isSending} aria-label="Send">
              <Send className="size-4" />
            </Button>
          </form>
        )}
      </Card>
    </AppShell>
  );
}

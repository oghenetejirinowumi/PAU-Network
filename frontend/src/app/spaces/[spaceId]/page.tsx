"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowUp, Check, Hand, LogOut, Mic, MicOff, Radio, Send, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/Toast";
import { Avatar, Button, Card, Spinner, StatusPill } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatSlot, fullName, SPACE_REACTION_EMOJIS, timeAgo } from "@/lib/format";
import { useSession, useSocketEvent } from "@/lib/session";
import type { SpaceDetail, SpaceParticipant, SpaceQuestion } from "@/lib/types";

interface FloatingReaction {
  id: number;
  emoji: string;
  left: number;
}

function ParticipantTile({ participant, isHostView, onPromote, onDemote, onLowerHand }: { participant: SpaceParticipant; isHostView: boolean; onPromote: () => void; onDemote: () => void; onLowerHand: () => void }) {
  const isOnStage = participant.role !== "LISTENER";
  return (
    <div className="group relative flex flex-col items-center text-center">
      <div className="relative">
        <Avatar user={participant.user} size={isOnStage ? 64 : 48} />
        {participant.isHandRaised && <span className="absolute -right-1 -top-1 animate-bounce text-xl">✋</span>}
        {participant.role === "HOST" && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-accent px-1.5 text-[9px] font-bold text-on-accent">HOST</span>}
      </div>
      <p className="mt-1.5 max-w-20 truncate text-xs font-semibold">{participant.user.firstName}</p>
      <p className="text-[10px] text-muted">{participant.role === "SPEAKER" ? "Speaker" : participant.role === "HOST" ? "" : participant.user.role === "ALUMNI" ? "Alumni" : "Student"}</p>
      {isHostView && participant.role !== "HOST" && (
        <div className="mt-1 flex gap-1">
          {participant.role === "LISTENER" ? (
            <button onClick={onPromote} title="Invite to speak" className="rounded-full bg-primary p-1 text-on-primary">
              <Mic className="size-3" />
            </button>
          ) : (
            <button onClick={onDemote} title="Move to audience" className="rounded-full bg-surface-muted p-1 text-muted">
              <MicOff className="size-3" />
            </button>
          )}
          {participant.isHandRaised && (
            <button onClick={onLowerHand} title="Lower hand" className="rounded-full bg-surface-muted p-1 text-muted">
              <X className="size-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function SpaceRoomPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const { user, socket } = useSession();
  const toast = useToast();
  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [question, setQuestion] = useState("");
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [isMediaOpen, setIsMediaOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get<SpaceDetail>(`/spaces/${spaceId}`);
    setSpace(data);
  }, [spaceId]);

  useEffect(() => {
    load().catch((caught) => toast(errorMessage(caught), "error"));
  }, [load, toast]);

  // Join the realtime room for this space.
  useEffect(() => {
    if (!socket) return;
    const subscribe = () => socket.emit("space:subscribe", spaceId);
    subscribe();
    socket.on("connect", subscribe);
    return () => {
      socket.emit("space:unsubscribe", spaceId);
      socket.off("connect", subscribe);
    };
  }, [socket, spaceId]);

  const upsertParticipant = (participant: SpaceParticipant, isPresent: boolean) =>
    setSpace((current) => {
      if (!current) return current;
      const others = current.participants.filter((item) => item.userId !== participant.userId);
      const participants = isPresent ? [...others, participant] : others;
      const viewer = participant.userId === user?.id ? { ...current.viewer, role: participant.role, isHandRaised: participant.isHandRaised, isInRoom: isPresent } : current.viewer;
      return { ...current, participants, viewer };
    });

  const upsertQuestion = (incoming: SpaceQuestion) =>
    setSpace((current) => {
      if (!current) return current;
      const existing = current.questions.find((item) => item.id === incoming.id);
      const merged = { ...incoming, hasViewerUpvoted: existing?.hasViewerUpvoted ?? incoming.hasViewerUpvoted };
      const questions = existing ? current.questions.map((item) => (item.id === incoming.id ? merged : item)) : [...current.questions, merged];
      return { ...current, questions };
    });

  useSocketEvent<SpaceParticipant>("space:participant-joined", (participant) => participant.spaceId === spaceId && upsertParticipant(participant, true));
  useSocketEvent<SpaceParticipant>("space:participant-updated", (participant) => participant.spaceId === spaceId && upsertParticipant(participant, true));
  useSocketEvent<SpaceParticipant>("space:participant-left", (participant) => participant.spaceId === spaceId && upsertParticipant(participant, false));
  useSocketEvent<SpaceQuestion>("space:question-created", (incoming) => incoming.spaceId === spaceId && upsertQuestion(incoming));
  useSocketEvent<SpaceQuestion>("space:question-updated", (incoming) => incoming.spaceId === spaceId && upsertQuestion(incoming));
  useSocketEvent<{ spaceId: string }>("space:started", (event) => {
    if (event.spaceId !== spaceId) return;
    toast("The space is live! 🔴", "info");
    load();
  });
  useSocketEvent<{ spaceId: string }>("space:ended", (event) => {
    if (event.spaceId !== spaceId) return;
    toast("The host ended the space. Thanks for joining! 👋", "info");
    setIsMediaOpen(false);
    load();
  });
  useSocketEvent<{ emoji: string }>("space:reacted", ({ emoji }) => {
    const reaction = { id: Date.now() + Math.random(), emoji, left: 10 + Math.random() * 80 };
    setReactions((current) => [...current.slice(-25), reaction]);
    setTimeout(() => setReactions((current) => current.filter((item) => item.id !== reaction.id)), 2500);
  });

  const call = async (fn: () => Promise<unknown>, success?: string) => {
    try {
      await fn();
      if (success) toast(success);
      await load();
    } catch (caught) {
      toast(errorMessage(caught), "error");
    }
  };

  if (!space || !user) return <AppShell><Spinner /></AppShell>;

  const isHost = space.hostId === user.id;
  const isLive = space.status === "LIVE";
  const stage = space.participants.filter((participant) => participant.role !== "LISTENER");
  const audience = space.participants.filter((participant) => participant.role === "LISTENER" && (isLive ? participant.joinedAt : true));
  const raisedHands = audience.filter((participant) => participant.isHandRaised).sort((a, b) => (a.handRaisedAt ?? "").localeCompare(b.handRaisedAt ?? ""));
  const openQuestions = space.questions.filter((item) => item.status === "OPEN").sort((a, b) => b.upvoteCount - a.upvoteCount);
  const answeredQuestions = space.questions.filter((item) => item.status === "ANSWERED");
  const canAsk = !isHost && (space.status === "SCHEDULED" || isLive) && (space.viewer.isRegistered || space.viewer.isInRoom);

  return (
    <AppShell wide>
      <Link href="/spaces" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-primary">
        <ArrowLeft className="size-4" /> All spaces
      </Link>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-4">
          <Card className="relative overflow-hidden">
            <div className={`p-5 ${isLive ? "bg-gradient-to-br from-primary to-primary-hover text-on-primary" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={space.status} />
                {space.department && <span className={`text-xs ${isLive ? "opacity-80" : "text-muted"}`}>For {space.department.name}</span>}
              </div>
              <h1 className="mt-2 text-2xl font-extrabold">{space.title}</h1>
              {space.description && <p className={`mt-1 text-sm ${isLive ? "opacity-85" : "text-muted"}`}>{space.description}</p>}
              <p className={`mt-3 text-xs ${isLive ? "opacity-80" : "text-muted"}`}>
                {isLive ? `Live since ${space.startedAt ? timeAgo(space.startedAt) : "now"} · ${space.participants.filter((participant) => participant.joinedAt && !participant.leftAt).length} in the room` : formatSlot(space.scheduledStartAt)}
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2 border-t border-line p-4">
              {isHost && space.status === "SCHEDULED" && (
                <Button variant="accent" onClick={() => call(() => api.post(`/spaces/${space.id}/start`), "You're live! 🎙️")}>
                  <Radio className="size-4" /> Go live
                </Button>
              )}
              {isHost && isLive && (
                <Button variant="danger" onClick={() => call(() => api.post(`/spaces/${space.id}/end`), "Space ended. +40 points 🎉")}>
                  End space
                </Button>
              )}
              {!isHost && isLive && !space.viewer.isInRoom && (
                <Button variant="accent" onClick={() => call(() => api.post(`/spaces/${space.id}/join`), "You joined the space 👋")}>
                  Join space
                </Button>
              )}
              {!isHost && space.status === "SCHEDULED" && (
                <Button variant={space.viewer.isRegistered ? "secondary" : "primary"} onClick={() => call(() => (space.viewer.isRegistered ? api.delete(`/spaces/${space.id}/registration`) : api.put(`/spaces/${space.id}/registration`)), space.viewer.isRegistered ? "Reminder removed" : "We'll notify you when it starts 🔔")}>
                  {space.viewer.isRegistered ? "Reminder set ✓" : "Remind me"}
                </Button>
              )}
              {space.viewer.isInRoom && isLive && (
                <>
                  {space.meetingUrl && (
                    <Button variant="primary" onClick={() => setIsMediaOpen((value) => !value)}>
                      <Mic className="size-4" /> {isMediaOpen ? "Hide audio" : "Open audio & video"}
                    </Button>
                  )}
                  {space.viewer.role === "LISTENER" && (
                    <Button variant={space.viewer.isHandRaised ? "accent" : "secondary"} onClick={() => call(() => (space.viewer.isHandRaised ? api.delete(`/spaces/${space.id}/hand`) : api.put(`/spaces/${space.id}/hand`)), space.viewer.isHandRaised ? undefined : "Hand raised ✋ The host can invite you to speak.")}>
                      <Hand className="size-4" /> {space.viewer.isHandRaised ? "Lower hand" : "Raise hand"}
                    </Button>
                  )}
                  {!isHost && (
                    <Button variant="ghost" onClick={() => call(() => api.post(`/spaces/${space.id}/leave`))}>
                      <LogOut className="size-4" /> Leave
                    </Button>
                  )}
                </>
              )}
            </div>

            {isMediaOpen && space.meetingUrl && (
              <iframe
                title="Space audio and video"
                src={`${space.meetingUrl}#userInfo.displayName="${encodeURIComponent(fullName(user))}"&config.prejoinPageEnabled=false&config.startWithVideoMuted=true&config.startWithAudioMuted=${space.viewer.role === "LISTENER"}`}
                allow="camera; microphone; display-capture; autoplay"
                className="h-[420px] w-full border-t border-line"
              />
            )}
          </Card>

          {/* Stage + audience */}
          <Card className="relative overflow-hidden p-5">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {reactions.map((reaction) => (
                <span key={reaction.id} className="animate-float-up absolute bottom-4 text-3xl" style={{ left: `${reaction.left}%` }}>
                  {reaction.emoji}
                </span>
              ))}
            </div>
            <p className="eyebrow mb-4">On stage</p>
            <div className="flex flex-wrap gap-6">
              {stage.map((participant) => (
                <ParticipantTile
                  key={participant.userId}
                  participant={participant}
                  isHostView={isHost && isLive}
                  onPromote={() => {}}
                  onDemote={() => call(() => api.patch(`/spaces/${space.id}/participants/${participant.userId}`, { role: "LISTENER" }))}
                  onLowerHand={() => {}}
                />
              ))}
            </div>
            <p className="eyebrow mb-4 mt-6">{isLive ? `Audience · ${audience.length}` : `Registered · ${audience.length}`}</p>
            {audience.length === 0 ? (
              <p className="text-sm text-muted">No one here yet.</p>
            ) : (
              <div className="flex flex-wrap gap-4">
                {audience.map((participant) => (
                  <ParticipantTile
                    key={participant.userId}
                    participant={participant}
                    isHostView={isHost && isLive}
                    onPromote={() => call(() => api.patch(`/spaces/${space.id}/participants/${participant.userId}`, { role: "SPEAKER" }), `${participant.user.firstName} is now a speaker 🎤`)}
                    onDemote={() => {}}
                    onLowerHand={() => call(() => api.patch(`/spaces/${space.id}/participants/${participant.userId}`, { isHandRaised: false }))}
                  />
                ))}
              </div>
            )}

            {space.viewer.isInRoom && isLive && (
              <div className="mt-6 flex flex-wrap gap-1 border-t border-line pt-4">
                {SPACE_REACTION_EMOJIS.map((emoji) => (
                  <button key={emoji} onClick={() => socket?.emit("space:react", { spaceId: space.id, emoji })} className="rounded-full p-1.5 text-2xl transition hover:scale-125 hover:bg-surface-muted">
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Hands + questions */}
        <div className="space-y-4">
          {isHost && isLive && (
            <Card className="p-4">
              <p className="mb-3 flex items-center gap-2 font-bold">✋ Raised hands {raisedHands.length > 0 && <span className="rounded-full bg-accent-soft px-2 text-xs text-on-accent">{raisedHands.length}</span>}</p>
              {raisedHands.length === 0 ? (
                <p className="text-sm text-muted">No hands raised.</p>
              ) : (
                <div className="space-y-2">
                  {raisedHands.map((participant) => (
                    <div key={participant.userId} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Avatar user={participant.user} size={28} />
                        <span className="text-sm font-semibold">{fullName(participant.user)}</span>
                      </div>
                      <Button size="sm" onClick={() => call(() => api.patch(`/spaces/${space.id}/participants/${participant.userId}`, { role: "SPEAKER" }), `${participant.user.firstName} is now a speaker 🎤`)}>
                        Invite
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          <Card className="p-4">
            <p className="mb-3 font-bold">❓ Questions · {openQuestions.length} open</p>
            {canAsk && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  call(() => api.post(`/spaces/${space.id}/questions`, { body: question }), "Question posted").then(() => setQuestion(""));
                }}
                className="mb-4 flex gap-2"
              >
                <input value={question} onChange={(event) => setQuestion(event.target.value)} minLength={5} maxLength={300} placeholder="Ask the host something…" className="min-w-0 flex-1 rounded-full border border-line px-3 py-2 text-sm outline-none focus:border-primary" />
                <Button type="submit" size="sm" className="!rounded-full" disabled={question.trim().length < 5} aria-label="Ask">
                  <Send className="size-4" />
                </Button>
              </form>
            )}
            {!canAsk && !isHost && space.status !== "ENDED" && <p className="mb-3 text-xs text-muted">{isLive ? "Join the space" : "Set a reminder"} to ask questions.</p>}
            <div className="space-y-3">
              {openQuestions.map((item) => (
                <div key={item.id} className="flex gap-3 rounded-control border border-line p-3">
                  <button
                    disabled={item.author.id === user.id || isHost}
                    onClick={() => call(() => (item.hasViewerUpvoted ? api.delete(`/spaces/${space.id}/questions/${item.id}/upvote`) : api.put(`/spaces/${space.id}/questions/${item.id}/upvote`)))}
                    className={`flex h-fit flex-col items-center rounded-control border px-2 py-1 text-xs font-bold ${item.hasViewerUpvoted ? "border-primary bg-primary-soft text-primary" : "border-line text-muted"}`}
                  >
                    <ArrowUp className="size-3.5" />
                    {item.upvoteCount}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{item.body}</p>
                    <p className="mt-1 text-[11px] text-muted">
                      {fullName(item.author)} · {timeAgo(item.createdAt)}
                    </p>
                    {isHost && isLive && (
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => call(() => api.patch(`/spaces/${space.id}/questions/${item.id}`, { status: "ANSWERED" }), "Marked as answered. +5 points")} className="flex items-center gap-1 text-xs font-semibold text-success">
                          <Check className="size-3.5" /> Answered
                        </button>
                        <button onClick={() => call(() => api.patch(`/spaces/${space.id}/questions/${item.id}`, { status: "DISMISSED" }))} className="text-xs font-semibold text-muted">
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {openQuestions.length === 0 && <p className="text-sm text-muted">No open questions.</p>}
            </div>
            {answeredQuestions.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-xs font-semibold text-muted">{answeredQuestions.length} answered</summary>
                <ul className="mt-2 space-y-2">
                  {answeredQuestions.map((item) => (
                    <li key={item.id} className="text-sm text-muted line-through decoration-success/60">
                      {item.body}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

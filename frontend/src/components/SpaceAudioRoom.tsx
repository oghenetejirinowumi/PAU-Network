"use client";

import { useEffect, useRef, useState } from "react";
import { ConnectionState, Room, RoomEvent, Track } from "livekit-client";
import { Mic, MicOff } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { Button, Card } from "@/components/ui";

interface AudioToken {
  serverUrl: string;
  token: string;
}

export function SpaceAudioRoom({ spaceId, canPublish }: { spaceId: string; canPublish: boolean }) {
  const [status, setStatus] = useState("Connecting to audio…");
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false);
  const [isChangingMicrophone, setIsChangingMicrophone] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const audioContainerRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    let active = true;
    let room: Room | null = null;
    const attachedAudio: HTMLAudioElement[] = [];

    setError(null);
    setIsConnected(false);
    setIsMicrophoneEnabled(false);
    setStatus("Connecting to audio…");

    const connect = async () => {
      const { data } = await api.get<AudioToken>(`/spaces/${spaceId}/audio-token`);
      if (!active) return;

      room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      room
        .on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind !== Track.Kind.Audio || !audioContainerRef.current) return;
          const element = document.createElement("audio");
          element.autoplay = true;
          element.setAttribute("playsinline", "");
          track.attach(element);
          audioContainerRef.current.append(element);
          attachedAudio.push(element);
        })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          for (const element of track.detach()) {
            element.remove();
            const index = attachedAudio.indexOf(element as HTMLAudioElement);
            if (index >= 0) attachedAudio.splice(index, 1);
          }
        })
        .on(RoomEvent.ConnectionStateChanged, (state) => {
          if (active && state === ConnectionState.Connected) {
            setIsConnected(true);
            setStatus("Connected — listening");
          }
        })
        .on(RoomEvent.Disconnected, () => {
          if (active) {
            setIsConnected(false);
            setStatus("Disconnected from audio");
          }
        });

      await room.connect(data.serverUrl, data.token);
      if (!active) return;
      setIsConnected(true);
      setStatus(canPublish ? "Connected — microphone on" : "Connected — listening");

      if (canPublish) {
        try {
          await room.localParticipant.setMicrophoneEnabled(true);
          if (active) setIsMicrophoneEnabled(true);
        } catch {
          if (active) setError("You’re connected, but microphone access was denied. Allow microphone access in your browser, then choose Retry microphone.");
        }
      }
    };

    connect().catch((caught: unknown) => {
      if (active) {
        setError(errorMessage(caught));
        setStatus("Could not connect to audio");
      }
    });

    return () => {
      active = false;
      room?.removeAllListeners();
      void room?.disconnect();
      if (roomRef.current === room) roomRef.current = null;
      for (const element of attachedAudio) {
        element.remove();
      }
    };
  }, [attempt, canPublish, spaceId]);

  const toggleMicrophone = async () => {
    const room = roomRef.current;
    if (!room || isChangingMicrophone) return;
    setIsChangingMicrophone(true);
    setError(null);
    try {
      await room.localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
      setIsMicrophoneEnabled((enabled) => !enabled);
      setStatus(isMicrophoneEnabled ? "Microphone muted" : "Connected — microphone on");
    } catch {
      setError("Could not access your microphone. Check browser permissions and try again.");
    } finally {
      setIsChangingMicrophone(false);
    }
  };

  const retryMicrophone = async () => {
    const room = roomRef.current;
    if (!room || isChangingMicrophone) return;
    setIsChangingMicrophone(true);
    setError(null);
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
      setIsMicrophoneEnabled(true);
      setStatus("Connected — microphone on");
    } catch {
      setError("Could not access your microphone. Check browser permissions and try again.");
    } finally {
      setIsChangingMicrophone(false);
    }
  };

  return (
    <Card className="border-t border-line p-4">
      <div ref={audioContainerRef} className="hidden" aria-hidden="true" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Space audio</p>
          <p role="status" className="text-xs text-muted">{status}</p>
        </div>
        {isConnected && canPublish && (
          <Button variant={isMicrophoneEnabled ? "secondary" : "primary"} onClick={toggleMicrophone} isLoading={isChangingMicrophone}>
            {isMicrophoneEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
            {isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}
          </Button>
        )}
      </div>
      {error && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-control bg-danger-soft p-3 text-sm text-danger">
          <p role="alert">{error}</p>
          {canPublish && error.includes("microphone") ? (
            <Button size="sm" variant="danger" onClick={retryMicrophone} isLoading={isChangingMicrophone}>Retry microphone</Button>
          ) : (
            <Button size="sm" variant="danger" onClick={() => setAttempt((current) => current + 1)}>Retry connection</Button>
          )}
        </div>
      )}
    </Card>
  );
}

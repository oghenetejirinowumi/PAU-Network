"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { api, getToken, setToken, SOCKET_URL } from "./api";
import type { User } from "./types";

interface SessionValue {
  user: User | null;
  isLoading: boolean;
  socket: Socket | null;
  login: (email: string, password: string) => Promise<User>;
  register: (input: Record<string, unknown>) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const connectSocket = useCallback((token: string) => {
    socketRef.current?.disconnect();
    const next = io(SOCKET_URL, { auth: { token }, transports: ["websocket", "polling"] });
    socketRef.current = next;
    setSocket(next);
  }, []);

  const startSession = useCallback(
    (session: { user: User; accessToken: string }) => {
      setToken(session.accessToken);
      setUser(session.user);
      connectSocket(session.accessToken);
      return session.user;
    },
    [connectSocket],
  );

  const refreshUser = useCallback(async () => {
    const { data } = await api.get<{ user: User; accessToken: string }>("/auth/me");
    setUser(data.user);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      setIsLoading(false);
      return;
    }
    api
      .get<{ user: User; accessToken: string }>("/auth/me")
      .then(({ data }) => startSession(data))
      .catch(() => setToken(null))
      .finally(() => setIsLoading(false));
    return () => {
      socketRef.current?.disconnect();
    };
  }, [startSession]);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      isLoading,
      socket,
      refreshUser,
      login: async (email, password) => startSession((await api.post<{ user: User; accessToken: string }>("/auth/login", { email, password })).data),
      register: async (input) => startSession((await api.post<{ user: User; accessToken: string }>("/auth/register", input)).data),
      logout: () => {
        setToken(null);
        socketRef.current?.disconnect();
        socketRef.current = null;
        setSocket(null);
        setUser(null);
      },
    }),
    [user, isLoading, socket, refreshUser, startSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}

/** Subscribes to a Socket.IO event for the lifetime of the component. */
export function useSocketEvent<T>(event: string, handler: (payload: T) => void) {
  const { socket } = useSession();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    if (!socket) return;
    const listener = (payload: T) => handlerRef.current(payload);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [socket, event]);
}

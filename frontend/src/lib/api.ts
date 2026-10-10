export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
export const SOCKET_URL = API_URL.replace(/\/api\/v1\/?$/, "");

const TOKEN_KEY = "pau-network.accessToken";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable (private mode); the session lasts until reload
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, string[]>,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

/** Calls the backend. Returns `{ data, meta }` exactly as the API sends it. */
export async function request<T, M = undefined>(
  path: string,
  options: { method?: string; body?: unknown; query?: Query } = {},
): Promise<{ data: T; meta: M }> {
  const url = new URL(API_URL + path);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  const token = getToken();
  const response = await fetch(url, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {
      ...(options.body !== undefined && { "Content-Type": "application/json" }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (response.status === 204) return { data: undefined as T, meta: undefined as M };
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = json.error ?? {};
    throw new ApiError(response.status, error.code ?? "UNKNOWN", error.message ?? "Something went wrong", error.details);
  }
  return json;
}

export const api = {
  get: <T, M = undefined>(path: string, query?: Query) => request<T, M>(path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: body ?? {} }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T = void>(path: string) => request<T>(path, { method: "DELETE" }),
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0 || error.code === "NETWORK_ERROR") {
      return "We’re unable to connect right now. Please check your connection and try again.";
    }
    if (error.status === 401) {
      return "Your session has expired. Please sign in again.";
    }
    if (error.status === 403) {
      return "You don’t have permission to complete this action.";
    }
    if (error.status === 404) {
      return "We couldn’t find what you were looking for.";
    }
    if (error.status >= 500) {
      return "Something went wrong on our side. Please try again in a moment.";
    }
    const firstDetail = error.details && Object.values(error.details).flat()[0];
    return firstDetail ? `${error.message}: ${firstDetail}` : error.message;
  }
  if (error instanceof TypeError) {
    return "We’re unable to connect right now. Please check your connection and try again.";
  }
  return "Something went wrong. Please try again.";
}

/**
 * API client for the Assure+ backend (Assure+_MS).
 *
 * Owns the browser-side token store (access + refresh) and mirrors the
 * backend's error envelope:
 *   { "error": { "code": "...", "message": "...", "details": {} } }
 *
 * A 401 on an authenticated request transparently rotates the refresh token
 * once and replays the original request. If the rotation fails the session is
 * cleared and the registered session-expired handler fires so the shell can
 * drop back to the login screen.
 */

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "/api";

const TOKEN_KEY = "assure_token";
const REFRESH_KEY = "assure_refresh";
const USER_KEY = "assure_user";
const PERMS_KEY = "assure_permissions";

export const STORAGE_KEYS = {
  token: TOKEN_KEY,
  refresh: REFRESH_KEY,
  user: USER_KEY,
  permissions: PERMS_KEY,
};

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setRefreshToken(token: string | null) {
  if (token) localStorage.setItem(REFRESH_KEY, token);
  else localStorage.removeItem(REFRESH_KEY);
}

/** Wipe every trace of the signed-in session from the browser. */
export function clearSession(): void {
  setToken(null);
  setRefreshToken(null);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PERMS_KEY);
  sessionStorage.removeItem("email");
}

let sessionExpiredHandler: (() => void) | null = null;

/** The shell registers here so an unrecoverable 401 returns it to /login. */
export function setSessionExpiredHandler(fn: (() => void) | null) {
  sessionExpiredHandler = fn;
}

export class ApiError extends Error {
  code: string;
  status: number;
  details: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown; auth?: boolean };

async function rawFetch(path: string, options: RequestOptions): Promise<Response> {
  const { body, auth = true, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string> | undefined),
  };

  if (auth) {
    const token = getToken();
    if (token) finalHeaders["Authorization"] = `Bearer ${token}`;
  }

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      "network_error",
      "Unable to reach the server. Please try again shortly."
    );
  }
}

// Concurrent 401s must not each burn a refresh token — the first rotation wins
// and everyone else awaits it.
let refreshInFlight: Promise<boolean> | null = null;

async function rotateRefreshToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const res = await rawFetch("/auth/refresh", {
    method: "POST",
    auth: false,
    body: { refreshToken },
  }).catch(() => null);

  if (!res || !res.ok) return false;

  const payload = await res.json().catch(() => null);
  if (!payload?.token) return false;

  setToken(payload.token);
  if (payload.refreshToken) setRefreshToken(payload.refreshToken);
  return true;
}

function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = rotateRefreshToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function toResult<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    const err = (payload && payload.error) || {};
    throw new ApiError(
      res.status,
      err.code || "error",
      err.message || `Request failed (${res.status})`,
      err.details || {}
    );
  }

  return payload as T;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const authed = options.auth !== false;
  let res = await rawFetch(path, options);

  // Access token expired mid-session: rotate once, then replay.
  if (res.status === 401 && authed && !path.startsWith("/auth/refresh")) {
    const rotated = await refreshSession();
    if (rotated) {
      res = await rawFetch(path, options);
    } else {
      clearSession();
      sessionExpiredHandler?.();
      throw new ApiError(401, "session_expired", "Your session has expired. Please sign in again.");
    }
  }

  return toResult<T>(res);
}

/**
 * Auth layer for Assure+ — talks to the Assure+_MS identity module.
 *
 * Backend contract (app/modules/identity):
 *   POST /auth/login          -> { token, refreshToken, user }
 *   POST /auth/logout         -> { ok }
 *   GET  /auth/me             -> AuthUser
 *   GET  /auth/my-permissions -> { [permKey]: { view: bool, edit: bool } }
 *   POST /auth/change-password
 */

import {
  apiFetch,
  clearSession,
  setToken,
  setRefreshToken,
  getToken,
  STORAGE_KEYS,
} from "./api";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  roleLabel?: string | null;
  department?: string | null;
  avatar?: string | null;
  status?: string;
  lastLogin?: string | null;
  mustResetPassword?: boolean;
}

export type PermissionMap = Record<string, { view?: boolean; edit?: boolean }>;

interface LoginResponse {
  token: string;
  refreshToken: string;
  user: AuthUser;
}

const { user: USER_KEY, permissions: PERMS_KEY } = STORAGE_KEYS;

function storeUser(user: AuthUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  // The shell reads sessionStorage.email in a few legacy spots.
  sessionStorage.setItem("email", user.email);
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password },
  });

  setToken(res.token);
  setRefreshToken(res.refreshToken);
  storeUser(res.user);

  try {
    await refreshPermissions();
  } catch (error) {
    // Login is only complete once all session state is available — never leave
    // a half-authenticated browser session behind.
    clearSession();
    throw error;
  }

  return res.user;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch {
    /* ignore network / expired-token errors on logout */
  }
  clearSession();
}

/**
 * Re-validate a token found in localStorage on page load and refresh the
 * cached profile + permission matrix. Throws if the session is no longer good.
 */
export async function restoreSession(): Promise<AuthUser> {
  const user = await apiFetch<AuthUser>("/auth/me");
  storeUser(user);
  await refreshPermissions();
  return user;
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function getCurrentUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function getPermissions(): PermissionMap {
  const raw = localStorage.getItem(PERMS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as PermissionMap;
  } catch {
    return {};
  }
}

export function hasPermission(key: string, action: "view" | "edit" = "view"): boolean {
  return !!getPermissions()[key]?.[action];
}

/** Re-fetch the current user's permission matrix (e.g. after a role change). */
export async function refreshPermissions(): Promise<PermissionMap> {
  const permissions = await apiFetch<PermissionMap>("/auth/my-permissions");
  localStorage.setItem(PERMS_KEY, JSON.stringify(permissions));
  return permissions;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await apiFetch("/auth/change-password", {
    method: "POST",
    body: { currentPassword, newPassword },
  });
}

export { clearSession };

/**
 * Admin API — User Management & Role Management (Assure+_MS identity module).
 *   GET/POST/PATCH/DELETE /users
 *   GET/POST/PATCH/DELETE /roles, PUT /roles/{id}/permissions
 *   GET /permissions
 */

import { apiFetch } from "./api";
import type { PermissionMap } from "./auth";

export interface UserRow {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  department?: string | null;
  role: string;
  roleLabel?: string | null;
  status: string;
  avatar?: string | null;
  lastLogin?: string | null;
  createdAt: string;
}

export interface RoleRow {
  id: string;
  name: string;
  description: string;
  status: string;
  permissions: PermissionMap;
  isSystem: boolean;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionInfo {
  key: string;
  label: string;
  path: string;
}

export interface UserCreate {
  fullName: string;
  email: string;
  password: string;
  role: string;
  phone?: string;
  department?: string;
  status?: string;
}

export type UserUpdate = Partial<Omit<UserCreate, "password">> & { password?: string };

// --- Users -----------------------------------------------------------------
export const listUsers = () => apiFetch<UserRow[]>("/users");
export const createUser = (body: UserCreate) =>
  apiFetch<UserRow>("/users", { method: "POST", body });
export const updateUser = (id: string, body: UserUpdate) =>
  apiFetch<UserRow>(`/users/${id}`, { method: "PATCH", body });
export const deleteUser = (id: string) =>
  apiFetch<{ ok: boolean }>(`/users/${id}`, { method: "DELETE" });
export const setUserStatus = (id: string, status: string) => updateUser(id, { status });

// --- Roles -----------------------------------------------------------------
export const listRoles = () => apiFetch<RoleRow[]>("/roles");
export const listPermissions = () => apiFetch<PermissionInfo[]>("/permissions");
export const upsertRole = (body: {
  id?: string;
  name: string;
  description?: string;
  status?: string;
  permissions?: PermissionMap;
}) => apiFetch<RoleRow>("/roles", { method: "POST", body });
export const updateRole = (
  id: string,
  body: { name?: string; description?: string; status?: string }
) => apiFetch<RoleRow>(`/roles/${id}`, { method: "PATCH", body });
export const updateRolePermissions = (id: string, permissions: PermissionMap) =>
  apiFetch<RoleRow>(`/roles/${id}/permissions`, { method: "PUT", body: { permissions } });
export const deleteRole = (id: string) =>
  apiFetch<{ ok: boolean }>(`/roles/${id}`, { method: "DELETE" });

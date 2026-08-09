import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Save, ShieldCheck, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listRoles,
  listPermissions,
  upsertRole,
  updateRole,
  updateRolePermissions,
  deleteRole,
  type RoleRow,
  type PermissionInfo,
} from "@/lib/admin";
import type { PermissionMap } from "@/lib/auth";
import { getCurrentUser, hasPermission, refreshPermissions } from "@/lib/auth";
import { ApiError } from "@/lib/api";

interface MetaForm {
  id?: string;
  name: string;
  description: string;
  status: string;
}

interface RoleManagementProps {
  /** Fired after the signed-in user's own permissions changed, so the shell can re-render. */
  onPermissionsChanged?: () => void;
}

export default function RoleManagement({ onPermissionsChanged }: RoleManagementProps = {}) {
  const canEdit = hasPermission("roleManagement", "edit");
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [catalog, setCatalog] = useState<PermissionInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<PermissionMap>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  const [meta, setMeta] = useState<MetaForm>({ name: "", description: "", status: "Active" });

  const reload = async (keepSelection = true) => {
    try {
      const [r, p] = await Promise.all([listRoles(), listPermissions()]);
      setRoles(r);
      setCatalog(p);
      const sel = keepSelection && selectedId ? selectedId : r[0]?.id ?? null;
      setSelectedId(sel);
      const role = r.find((x) => x.id === sel);
      if (role) {
        setMatrix(JSON.parse(JSON.stringify(role.permissions)));
        setDirty(false);
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load roles");
    }
  };

  useEffect(() => {
    reload(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(() => roles.find((r) => r.id === selectedId), [roles, selectedId]);

  const selectRole = (role: RoleRow) => {
    setSelectedId(role.id);
    setMatrix(JSON.parse(JSON.stringify(role.permissions)));
    setDirty(false);
  };

  const setCell = (key: string, view: boolean, edit: boolean) => {
    setMatrix((m) => ({ ...m, [key]: { view, edit } }));
    setDirty(true);
  };

  const savePermissions = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await updateRolePermissions(selectedId, matrix);
      toast.success("Permissions saved");
      await reload(true);
      // Editing your own role changes what the sidebar may show — pull the
      // fresh matrix rather than waiting for the next sign-in.
      if (getCurrentUser()?.role === selectedId) {
        await refreshPermissions();
        onPermissionsChanged?.();
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const openNew = () => {
    setMeta({ name: "", description: "", status: "Active" });
    setMetaOpen(true);
  };
  const openEditMeta = (role: RoleRow) => {
    setMeta({ id: role.id, name: role.name, description: role.description, status: role.status });
    setMetaOpen(true);
  };

  const saveMeta = async () => {
    try {
      if (meta.id) {
        await updateRole(meta.id, {
          name: meta.name,
          description: meta.description,
          status: meta.status,
        });
        toast.success("Role updated");
      } else {
        const created = await upsertRole({
          name: meta.name,
          description: meta.description,
          status: meta.status,
        });
        toast.success("Role created");
        setSelectedId(created.id);
      }
      setMetaOpen(false);
      await reload(true);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Save failed");
    }
  };

  const removeRole = async (role: RoleRow) => {
    if (!window.confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    try {
      await deleteRole(role.id);
      toast.success("Role deleted");
      setSelectedId(null);
      await reload(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Role Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create roles, configure page-level access, and control which modules each role can view
            or edit.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> New role
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        {/* Roles list */}
        <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
            Roles
          </div>
          <div className="divide-y divide-border">
            {roles.map((role) => {
              const active = role.id === selectedId;
              return (
                <button
                  key={role.id}
                  onClick={() => selectRole(role)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                    active ? "bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <span
                    className={`mt-0.5 h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ${
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-foreground truncate">{role.name}</span>
                      <span
                        className={`text-[10px] rounded-full px-1.5 py-0.5 ${
                          role.status === "Active"
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {role.status}
                      </span>
                    </span>
                    <span className="block text-xs text-muted-foreground truncate">
                      {role.description || "—"}
                    </span>
                    <span className="block text-[11px] text-muted-foreground/70 mt-0.5">
                      {role.userCount} user{role.userCount === 1 ? "" : "s"}
                      {role.isSystem ? " · system" : ""}
                    </span>
                  </span>
                  {canEdit && (
                    <span className="flex items-center gap-1">
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditMeta(role);
                        }}
                        className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </span>
                      {!role.isSystem && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRole(role);
                          }}
                          className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Permission matrix */}
        <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">
                Permission Matrix
              </div>
              <div className="text-lg font-bold text-foreground">{selected?.name ?? "—"}</div>
            </div>
            {canEdit && (
              <Button onClick={savePermissions} disabled={!dirty || saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save permissions
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="px-5 py-3 font-semibold">Module / Page</th>
                  <th className="px-5 py-3 font-semibold text-center w-24">View</th>
                  <th className="px-5 py-3 font-semibold text-center w-24">Edit</th>
                </tr>
              </thead>
              <tbody>
                {catalog.map((p) => {
                  const cell = matrix[p.key] ?? { view: false, edit: false };
                  return (
                    <tr key={p.key} className="border-b border-border last:border-0">
                      <td className="px-5 py-3 font-medium text-foreground">{p.label}</td>
                      <td className="px-5 py-3 text-center">
                        <Checkbox
                          checked={!!cell.view}
                          disabled={!canEdit}
                          onCheckedChange={(c) =>
                            setCell(p.key, !!c, c ? !!cell.edit : false)
                          }
                        />
                      </td>
                      <td className="px-5 py-3 text-center">
                        <Checkbox
                          checked={!!cell.edit}
                          disabled={!canEdit}
                          onCheckedChange={(c) => setCell(p.key, c ? true : !!cell.view, !!c)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground">
            Checking <b>Edit</b> automatically grants <b>View</b>. Unchecking <b>View</b> removes{" "}
            <b>Edit</b> and hides the module from the sidebar.
          </div>
        </div>
      </div>

      {/* Role metadata dialog */}
      <Dialog open={metaOpen} onOpenChange={setMetaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{meta.id ? "Edit role" : "New role"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={meta.description}
                onChange={(e) => setMeta({ ...meta, description: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={meta.status} onValueChange={(v) => setMeta({ ...meta, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!meta.id && (
              <p className="text-xs text-muted-foreground">
                New roles start with sensible default permissions — adjust them in the matrix after
                creating.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMetaOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveMeta} disabled={!meta.name}>
              Save role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

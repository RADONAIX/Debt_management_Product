import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Power, Search, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listUsers,
  listRoles,
  createUser,
  updateUser,
  deleteUser,
  setUserStatus,
  type UserRow,
  type RoleRow,
} from "@/lib/admin";
import { getCurrentUser, hasPermission, restoreSession } from "@/lib/auth";
import { ApiError } from "@/lib/api";

const STATUS_ACTIVE = "Active";
const STATUS_DISABLED = "Disabled";

interface FormState {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  role: string;
  status: string;
  password: string;
}

const emptyForm = (role: string): FormState => ({
  fullName: "",
  email: "",
  phone: "",
  department: "",
  role,
  status: STATUS_ACTIVE,
  password: "",
});

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface UserManagementProps {
  /** Fired after the signed-in user's own account/role changed, so the shell can re-render. */
  onPermissionsChanged?: () => void;
}

export default function UserManagement({ onPermissionsChanged }: UserManagementProps = {}) {
  const canEdit = hasPermission("userManagement", "edit");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(""));
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([listUsers(), listRoles()]);
      setUsers(u);
      setRoles(r);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const roleLabel = (id: string) => roles.find((r) => r.id === id)?.name ?? id;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      const matchQ =
        !q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchRole = roleFilter === "all" || u.role === roleFilter;
      const matchStatus = statusFilter === "all" || u.status === statusFilter;
      return matchQ && matchRole && matchStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const openAdd = () => {
    setForm(emptyForm(roles[0]?.id ?? ""));
    setDialogOpen(true);
  };

  const openEdit = (u: UserRow) => {
    setForm({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone ?? "",
      department: u.department ?? "",
      role: u.role,
      status: u.status,
      password: "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (form.id) {
        await updateUser(form.id, {
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          department: form.department,
          role: form.role,
          status: form.status,
          ...(form.password ? { password: form.password } : {}),
        });
        toast.success("User updated");
        // Reassigning your own role changes your effective access immediately.
        if (getCurrentUser()?.id === form.id) {
          await restoreSession();
          onPermissionsChanged?.();
        }
      } else {
        await createUser({
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          role: form.role,
          phone: form.phone,
          department: form.department,
          status: form.status,
        });
        toast.success("User created");
      }
      setDialogOpen(false);
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (u: UserRow) => {
    const next = u.status === STATUS_ACTIVE ? STATUS_DISABLED : STATUS_ACTIVE;
    try {
      await setUserStatus(u.id, next);
      toast.success(next === STATUS_ACTIVE ? "User activated" : "User deactivated");
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Action failed");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUser(deleteTarget.id);
      toast.success("User deleted");
      setDeleteTarget(null);
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">User Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage operators, analysts and auditors who have access to Assure+. Assign roles to
            control permissions.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" /> Add user
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-card">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 p-4 border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full md:w-44">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value={STATUS_ACTIVE}>Active</SelectItem>
              <SelectItem value={STATUS_DISABLED}>Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Full name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Last login</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No users match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <span className="h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                          {u.avatar}
                        </span>
                        {u.fullName}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.phone || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.department || "—"}</td>
                    <td className="px-4 py-3">{roleLabel(u.role)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.status === STATUS_ACTIVE
                            ? "bg-success/10 text-success"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {fmtDate(u.lastLogin)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit ? (
                          <>
                            <button
                              onClick={() => openEdit(u)}
                              title="Edit user"
                              className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => toggleStatus(u)}
                              title={u.status === STATUS_ACTIVE ? "Deactivate" : "Activate"}
                              className={`h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center ${
                                u.status === STATUS_ACTIVE
                                  ? "text-destructive"
                                  : "text-success"
                              }`}
                            >
                              <Power className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(u)}
                              title="Delete user"
                              className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">View only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit user" : "Add user"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Assigned role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STATUS_ACTIVE}>Active</SelectItem>
                  <SelectItem value={STATUS_DISABLED}>Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{form.id ? "New password (leave blank to keep)" : "Password"}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={form.id ? "••••••••" : "Min 8 characters"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.fullName || !form.email || !form.role}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-destructive" /> Delete user
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate and remove <b>{deleteTarget?.fullName}</b> and revoke all their
              sessions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

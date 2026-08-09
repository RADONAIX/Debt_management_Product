import { useEffect, useRef, useState } from "react";
import { Menu, Moon, Sun, Settings, ChevronDown, LogOut, Users, Filter, Check, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { changePassword } from "@/lib/auth";
import { ApiError } from "@/lib/api";

type CustomerType = "all" | "normal" | "enterprise";

const CUSTOMER_TYPES: { value: CustomerType; label: string }[] = [
  { value: "all", label: "All Customers" },
  { value: "normal", label: "Consumer Customers" },
  { value: "enterprise", label: "Enterprise Customers" },
];

interface AppHeaderProps {
  title: string;
  customerType: CustomerType;
  onCustomerTypeChange: (value: CustomerType) => void;
  email: string | null;
  userName?: string | null;
  roleLabel?: string | null;
  canAdmin: boolean;
  onOpenAdmin: () => void;
  onLogout: () => void;
  onToggleSidebar: () => void;
}

export function AppHeader({
  title,
  customerType,
  onCustomerTypeChange,
  email,
  userName,
  roleLabel,
  canAdmin,
  onOpenAdmin,
  onLogout,
  onToggleSidebar,
}: AppHeaderProps) {
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("theme") === "dark" : false,
  );
  const [scopeOpen, setScopeOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdDone, setPwdDone] = useState(false);
  const scopeRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (scopeRef.current && !scopeRef.current.contains(e.target as Node)) setScopeOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const activeType = CUSTOMER_TYPES.find((t) => t.value === customerType) ?? CUSTOMER_TYPES[0];
  const initials = (userName ?? email ?? "RA").slice(0, 2).toUpperCase();

  const openPasswordDialog = () => {
    setPwd({ current: "", next: "", confirm: "" });
    setPwdError(null);
    setPwdDone(false);
    setPwdOpen(true);
  };

  const submitPassword = async () => {
    if (pwd.next !== pwd.confirm) {
      setPwdError("The new passwords do not match.");
      return;
    }
    if (pwd.next.length < 8) {
      setPwdError("The new password must be at least 8 characters.");
      return;
    }
    setPwdSaving(true);
    setPwdError(null);
    try {
      await changePassword(pwd.current, pwd.next);
      setPwdDone(true);
      setPwd({ current: "", next: "", confirm: "" });
    } catch (err) {
      setPwdError(err instanceof ApiError ? err.message : "Could not change the password.");
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <header className="h-16 shrink-0 border-b border-border bg-card/80 backdrop-blur flex items-center px-4 md:px-6 gap-4 sticky top-0 z-30">
      <button
        onClick={onToggleSidebar}
        className="md:hidden h-9 w-9 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
        aria-label="Toggle menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      <h1 className="text-base font-semibold text-foreground truncate">{title}</h1>

      <div className="flex items-center gap-2 ml-auto">
        {/* Customer scope pill */}
        <div className="relative" ref={scopeRef}>
          <button
            onClick={() => {
              setScopeOpen((o) => !o);
              setProfileOpen(false);
            }}
            className="hidden md:flex items-center gap-2 h-10 pl-3 pr-3 rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/10 transition"
          >
            <Filter className="h-4 w-4 text-primary" />
            <div className="text-left leading-tight">
              <div className="text-[10px] tracking-widest text-primary/80 font-semibold">
                CUSTOMER SCOPE
              </div>
              <div className="text-sm font-semibold text-foreground">{activeType.label}</div>
            </div>
            <ChevronDown className="h-4 w-4 text-primary ml-1" />
          </button>
          {scopeOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-popover shadow-lg py-2 z-40">
              <div className="px-4 py-2 text-[10px] tracking-widest text-muted-foreground font-semibold">
                CUSTOMER SCOPE
              </div>
              {CUSTOMER_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => {
                    onCustomerTypeChange(t.value);
                    setScopeOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-muted ${
                    customerType === t.value ? "text-primary font-semibold" : "text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Users
                      className={`h-4 w-4 ${
                        customerType === t.value ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    {t.label}
                  </span>
                  {customerType === t.value && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme */}
        <button
          onClick={() => setDark((d) => !d)}
          className="h-9 w-9 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition"
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Admin config */}
        {canAdmin && (
          <button
            onClick={onOpenAdmin}
            className="h-9 w-9 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition"
            aria-label="Admin configuration"
            title="Admin configuration"
          >
            <Settings className="h-4 w-4" />
          </button>
        )}

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => {
              setProfileOpen((o) => !o);
              setScopeOpen(false);
            }}
            className="flex items-center gap-2 h-10 pl-1 pr-3 rounded-full hover:bg-muted transition"
          >
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-info text-primary-foreground text-xs font-semibold flex items-center justify-center">
              {initials}
            </div>
            <div className="hidden md:block text-left leading-tight max-w-[160px]">
              <div className="text-xs font-semibold text-foreground truncate">
                {userName || email || "Signed in"}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {roleLabel || "Assure+ user"}
              </div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-popover shadow-lg py-2 z-40">
              {email && (
                <div className="px-4 py-2 border-b border-border mb-1">
                  <div className="text-xs font-semibold text-foreground truncate">{userName || email}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{email}</div>
                  {roleLabel && (
                    <div className="text-[11px] text-primary mt-0.5 truncate">{roleLabel}</div>
                  )}
                </div>
              )}
              <button
                onClick={() => {
                  setProfileOpen(false);
                  openPasswordDialog();
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted text-foreground"
              >
                <KeyRound className="h-4 w-4" />
                Change password
              </button>
              <button
                onClick={() => {
                  setProfileOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Change password */}
      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>
              Your new password must be at least 8 characters long.
            </DialogDescription>
          </DialogHeader>

          {pwdDone ? (
            <p className="text-sm text-success py-2">
              Password updated. It applies the next time you sign in.
            </p>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="current-pwd">Current password</Label>
                <Input
                  id="current-pwd"
                  type="password"
                  autoComplete="current-password"
                  value={pwd.current}
                  onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-pwd">New password</Label>
                <Input
                  id="new-pwd"
                  type="password"
                  autoComplete="new-password"
                  value={pwd.next}
                  onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-pwd">Confirm new password</Label>
                <Input
                  id="confirm-pwd"
                  type="password"
                  autoComplete="new-password"
                  value={pwd.confirm}
                  onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                />
              </div>
              {pwdError && <p className="text-sm text-destructive">{pwdError}</p>}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdOpen(false)}>
              {pwdDone ? "Close" : "Cancel"}
            </Button>
            {!pwdDone && (
              <Button
                onClick={submitPassword}
                disabled={pwdSaving || !pwd.current || !pwd.next || !pwd.confirm}
              >
                {pwdSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update password
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}

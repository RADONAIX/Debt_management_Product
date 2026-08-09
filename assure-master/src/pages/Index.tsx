import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import LoginPage from "@/components/LoginPage";
import Dashboard from "@/components/Dashboard";
import { isAuthenticated, logout, restoreSession } from "@/lib/auth";
import { clearSession, setSessionExpiredHandler } from "@/lib/api";

type SessionState = "checking" | "signed-out" | "signed-in";

const Index = () => {
  const [session, setSession] = useState<SessionState>("checking");

  // Re-validate a token left in localStorage so a refresh keeps you signed in,
  // but a revoked / expired session drops straight back to the login screen.
  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated()) {
      setSession("signed-out");
      return;
    }

    restoreSession()
      .then(() => !cancelled && setSession("signed-in"))
      .catch(() => {
        clearSession();
        if (!cancelled) setSession("signed-out");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // An unrecoverable 401 anywhere in the app ends the session here.
  useEffect(() => {
    setSessionExpiredHandler(() => setSession("signed-out"));
    return () => setSessionExpiredHandler(null);
  }, []);

  const handleLogin = useCallback(() => setSession("signed-in"), []);

  const handleLogout = useCallback(async () => {
    await logout();
    setSession("signed-out");
  }, []);

  if (session === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (session === "signed-out") {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <Dashboard onLogout={handleLogout} />;
};

export default Index;

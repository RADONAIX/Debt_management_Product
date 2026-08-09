import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { telecomService } from "@/services/telecom-service";
import type { SubscriberProfile } from "@/lib/telecom-types";

interface SubscriberContextValue {
  profile: SubscriberProfile | null;
  loading: boolean;
  error: string | null;
  reveal: boolean;
  toggleReveal: () => void;
  refresh: () => void;
}

const SubscriberContext = createContext<SubscriberContextValue | null>(null);

export function SubscriberProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<SubscriberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await telecomService.getSubscriberContext());
    } catch {
      setError("We couldn't load your account context. Retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<SubscriberContextValue>(
    () => ({
      profile,
      loading,
      error,
      reveal,
      toggleReveal: () => setReveal((v) => !v),
      refresh: () => void load(),
    }),
    [profile, loading, error, reveal, load],
  );

  return <SubscriberContext.Provider value={value}>{children}</SubscriberContext.Provider>;
}

export function useSubscriber() {
  const ctx = useContext(SubscriberContext);
  if (!ctx) throw new Error("useSubscriber must be used inside SubscriberProvider");
  return ctx;
}

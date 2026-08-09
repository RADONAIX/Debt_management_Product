import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { TransactionDescriptor } from "@/lib/transactions";
import { telecomService } from "@/services/telecom-service";
import type { TransactionResult } from "@/lib/telecom-types";

export type TransactionStep = "idle" | "confirm" | "otp" | "processing" | "done";

interface TransactionContextValue {
  step: TransactionStep;
  descriptor: TransactionDescriptor | null;
  result: TransactionResult | null;
  otpError: string | null;
  history: TransactionResult[];
  start: (descriptor: TransactionDescriptor, onComplete?: (r: TransactionResult) => void) => void;
  confirm: () => void;
  submitOtp: (code: string) => Promise<void>;
  cancel: () => void;
  close: () => void;
}

const TransactionContext = createContext<TransactionContextValue | null>(null);

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<TransactionStep>("idle");
  const [descriptor, setDescriptor] = useState<TransactionDescriptor | null>(null);
  const [result, setResult] = useState<TransactionResult | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [history, setHistory] = useState<TransactionResult[]>([]);
  const onComplete = useRef<((r: TransactionResult) => void) | undefined>(undefined);

  const start = useCallback(
    (next: TransactionDescriptor, complete?: (r: TransactionResult) => void) => {
      setDescriptor(next);
      setResult(null);
      setOtpError(null);
      onComplete.current = complete;
      setStep("confirm");
    },
    [],
  );

  const run = useCallback(async (current: TransactionDescriptor) => {
    setStep("processing");
    try {
      const txn = await current.execute();
      setResult(txn);
      setHistory((prev) => [txn, ...prev]);
      onComplete.current?.(txn);
    } catch {
      const failure: TransactionResult = {
        reference: "TXN-FAILED",
        status: "Failed",
        message: "We couldn't complete this request. No amount has been debited.",
        timestamp: new Date().toISOString(),
      };
      setResult(failure);
      onComplete.current?.(failure);
    } finally {
      setStep("done");
    }
  }, []);

  const confirm = useCallback(() => {
    if (!descriptor) return;
    if (descriptor.requiresOtp) {
      setOtpError(null);
      void telecomService.requestOtp();
      setStep("otp");
      return;
    }
    void run(descriptor);
  }, [descriptor, run]);

  const submitOtp = useCallback(
    async (code: string) => {
      if (!descriptor) return;
      const verification = await telecomService.verifyOtp(code);
      if (!verification.verified) {
        setOtpError(verification.message);
        return;
      }
      setOtpError(null);
      await run(descriptor);
    },
    [descriptor, run],
  );

  const reset = useCallback(() => {
    setStep("idle");
    setDescriptor(null);
    setResult(null);
    setOtpError(null);
    onComplete.current = undefined;
  }, []);

  const value = useMemo<TransactionContextValue>(
    () => ({
      step,
      descriptor,
      result,
      otpError,
      history,
      start,
      confirm,
      submitOtp,
      cancel: reset,
      close: reset,
    }),
    [step, descriptor, result, otpError, history, start, confirm, submitOtp, reset],
  );

  return <TransactionContext.Provider value={value}>{children}</TransactionContext.Provider>;
}

export function useTransactions() {
  const ctx = useContext(TransactionContext);
  if (!ctx) throw new Error("useTransactions must be used inside TransactionProvider");
  return ctx;
}
